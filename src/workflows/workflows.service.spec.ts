import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { Workflow } from '../documents/models/workflow.model';
import { Document } from '../documents/models/document.model';
import { SignatureTag } from '../documents/models/signature-tag.model';
import { AuditLog } from '../documents/models/audit-log.model';
import { DocusealService } from '../docuseal/docuseal.service';
import {
  DocumentStatus,
  SignerRole,
  WorkflowStep,
} from '../common/enums';

describe('WorkflowsService', () => {
  let service: WorkflowsService;

  const mockWorkflowModel = {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockDocumentModel = {
    findByPk: jest.fn(),
  };

  const mockSignatureTagModel = {
    findAll: jest.fn(),
  };

  const mockAuditLogModel = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  const mockDocusealService = {
    createSubmissionFromPdf: jest.fn(),
    updateSubmitter: jest.fn(),
    getSubmission: jest.fn(),
    downloadFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowsService,
        { provide: getModelToken(Workflow), useValue: mockWorkflowModel },
        { provide: getModelToken(Document), useValue: mockDocumentModel },
        { provide: getModelToken(SignatureTag), useValue: mockSignatureTagModel },
        { provide: getModelToken(AuditLog), useValue: mockAuditLogModel },
        { provide: DocusealService, useValue: mockDocusealService },
      ],
    }).compile();

    service = module.get<WorkflowsService>(WorkflowsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorkflow', () => {
    it('should throw NotFoundException when document does not exist', async () => {
      mockDocumentModel.findByPk.mockResolvedValue(null);

      await expect(
        service.createWorkflow({
          documentId: 1,
          role1Email: 'role1@test.com',
          role2Email: 'role2@test.com',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when workflow already exists', async () => {
      mockDocumentModel.findByPk.mockResolvedValue({ id: 1 });
      mockWorkflowModel.findOne.mockResolvedValue({ id: 10 });

      await expect(
        service.createWorkflow({
          documentId: 1,
          role1Email: 'role1@test.com',
          role2Email: 'role2@test.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create workflow successfully', async () => {
      const document = { id: 1 };
      const workflow = { id: 10, documentId: 1 };

      mockDocumentModel.findByPk.mockResolvedValue(document);
      mockWorkflowModel.findOne.mockResolvedValue(null);
      mockWorkflowModel.create.mockResolvedValue(workflow);
      mockAuditLogModel.create.mockResolvedValue({});

      const result = await service.createWorkflow({
        documentId: 1,
        role1Email: 'role1@test.com',
        role2Email: 'role2.placeholder@test.com',
      });

      expect(result.message).toBe('Workflow created successfully');
      expect(mockWorkflowModel.create).toHaveBeenCalled();
    });
  });

  describe('updateRole3Email', () => {
    it('should throw BadRequestException if Role 2 has not signed yet', async () => {
      const workflow = {
        id: 1,
        currentStep: WorkflowStep.ROLE_2,
        docusealRole3SubmitterId: '123',
        update: jest.fn(),
        document: {},
      };

      mockWorkflowModel.findByPk.mockResolvedValue(workflow);

      await expect(
        service.updateRole3Email(1, { role3Email: 'role3@test.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update Role 3 email after Role 2 signed', async () => {
      const workflow = {
        id: 1,
        documentId: 1,
        role2Email: 'role2@test.com',
        currentStep: WorkflowStep.AWAITING_ROLE_3_EMAIL,
        docusealRole3SubmitterId: '456',
        update: jest.fn(),
        document: {},
      };

      mockWorkflowModel.findByPk
        .mockResolvedValueOnce(workflow)
        .mockResolvedValueOnce({ ...workflow, role3Email: 'role3@test.com' });
      mockDocusealService.updateSubmitter.mockResolvedValue({});
      mockDocumentModel.findByPk.mockResolvedValue({ update: jest.fn() });
      mockAuditLogModel.create.mockResolvedValue({});

      const result = await service.updateRole3Email(1, {
        role3Email: 'role3@test.com',
      });

      expect(result.message).toContain('Role 3 email updated');
      expect(mockDocusealService.updateSubmitter).toHaveBeenCalledWith(
        '456',
        'role3@test.com',
        true,
      );
    });
  });

  describe('handleRole2Signed', () => {
    it('should move workflow to AWAITING_ROLE_3_EMAIL step', async () => {
      const workflow = {
        id: 1,
        documentId: 1,
        role2Email: 'role2@test.com',
        update: jest.fn(),
      };

      mockAuditLogModel.create.mockResolvedValue({});

      await service.handleRole2Signed(workflow as never);

      expect(workflow.update).toHaveBeenCalledWith({
        status: DocumentStatus.PENDING_ROLE_2_SIGNATURE,
        currentStep: WorkflowStep.AWAITING_ROLE_3_EMAIL,
      });
    });
  });
});
