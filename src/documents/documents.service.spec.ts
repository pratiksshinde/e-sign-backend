import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/sequelize';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { Document } from './models/document.model';
import { AuditLog } from './models/audit-log.model';
import { SignatureTag } from './models/signature-tag.model';
import { DocumentStatus, SignerRole, FieldType } from '../common/enums';

describe('DocumentsService', () => {
  let service: DocumentsService;

  const mockDocumentModel = {
    create: jest.fn(),
    findByPk: jest.fn(),
  };

  const mockAuditLogModel = {
    create: jest.fn(),
  };

  const mockSignatureTagModel = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: getModelToken(Document), useValue: mockDocumentModel },
        { provide: getModelToken(AuditLog), useValue: mockAuditLogModel },
        { provide: getModelToken(SignatureTag), useValue: mockSignatureTagModel },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadDocument', () => {
    it('should throw BadRequestException when file is missing', async () => {
      await expect(
        service.uploadDocument(undefined as never, 'test@test.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDocumentById', () => {
    it('should throw NotFoundException when document not found', async () => {
      mockDocumentModel.findByPk.mockResolvedValue(null);

      await expect(service.getDocumentById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addSignatureTag', () => {
    it('should reject invalid signer role', async () => {
      mockDocumentModel.findByPk.mockResolvedValue({ id: 1 });

      await expect(
        service.addSignatureTag(1, {
          role: SignerRole.ROLE_1,
          pageNumber: 1,
          xPosition: 100,
          yPosition: 200,
          width: 150,
          height: 50,
          fieldType: FieldType.SIGNATURE,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add signature tag for ROLE_2', async () => {
      mockDocumentModel.findByPk.mockResolvedValue({ id: 1 });
      mockSignatureTagModel.create.mockResolvedValue({ id: 1, role: SignerRole.ROLE_2 });
      mockAuditLogModel.create.mockResolvedValue({});

      const result = await service.addSignatureTag(1, {
        role: SignerRole.ROLE_2,
        pageNumber: 1,
        xPosition: 100,
        yPosition: 200,
        width: 150,
        height: 50,
        fieldType: FieldType.SIGNATURE,
      });

      expect(result.message).toBe('Signature tag added successfully');
    });
  });
});
