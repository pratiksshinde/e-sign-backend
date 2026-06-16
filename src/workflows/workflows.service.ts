import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { join } from 'path';
import * as fs from 'fs';
import { Workflow } from '../documents/models/workflow.model';
import { Document } from '../documents/models/document.model';
import { SignatureTag } from '../documents/models/signature-tag.model';
import { AuditLog } from '../documents/models/audit-log.model';
import {
  AuditAction,
  DocumentStatus,
  FieldType,
  ROLE_3_PLACEHOLDER_EMAIL,
  SignerRole,
  WorkflowStep,
} from '../common/enums';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateRole3EmailDto } from './dto/update-role3-email.dto';
import {
  DocusealField,
  DocusealService,
  DocusealSubmitter,
} from '../docuseal/docuseal.service';
import { DOCUSEAL_ROLE_NAMES } from '../common/constants';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectModel(Workflow)
    private readonly workflowModel: typeof Workflow,

    @InjectModel(Document)
    private readonly documentModel: typeof Document,

    @InjectModel(SignatureTag)
    private readonly signatureTagModel: typeof SignatureTag,

    @InjectModel(AuditLog)
    private readonly auditLogModel: typeof AuditLog,

    private readonly docusealService: DocusealService,
  ) {}

  async createWorkflow(createWorkflowDto: CreateWorkflowDto) {
    const document = await this.documentModel.findByPk(
      createWorkflowDto.documentId,
    );

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const existingWorkflow = await this.workflowModel.findOne({
      where: { documentId: document.id },
    });

    if (existingWorkflow) {
      throw new BadRequestException(
        'Workflow already exists for this document',
      );
    }

    const workflow = await this.workflowModel.create({
      documentId: document.id,
      role1Email: createWorkflowDto.role1Email,
      role2Email: createWorkflowDto.role2Email,
      role3Email: null,
      status: DocumentStatus.DRAFT,
      currentStep: WorkflowStep.ROLE_1,
    });

    await this.auditLogModel.create({
      documentId: document.id,
      workflowId: workflow.id,
      action: AuditAction.WORKFLOW_CREATED,
      performedByRole: SignerRole.ROLE_1,
      performedByEmail: createWorkflowDto.role1Email,
      message: 'Workflow created by Role 1',
    });

    return {
      message: 'Workflow created successfully',
      workflow,
    };
  }

  async submitForSigning(workflowId: number) {
    const workflow = await this.getWorkflowById(workflowId);
    const document = await this.getDocumentForWorkflow(workflow);

    if (workflow.currentStep !== WorkflowStep.ROLE_1) {
      throw new BadRequestException(
        'Workflow has already been submitted for signing',
      );
    }

    const tags = await this.signatureTagModel.findAll({
      where: { documentId: document.id },
    });

    const role2Tags = tags.filter((tag) => tag.role === SignerRole.ROLE_2);
    const role3Tags = tags.filter((tag) => tag.role === SignerRole.ROLE_3);

    if (role2Tags.length === 0 || role3Tags.length === 0) {
      throw new BadRequestException(
        'Add at least one signature tag for ROLE_2 and ROLE_3 before submitting',
      );
    }

    const pdfBase64 = fs.readFileSync(document.filePath, {
      encoding: 'base64',
    });

    const fields = this.buildDocusealFields(tags);

    const submitters: DocusealSubmitter[] = [
      {
        name: 'Role 2 Signer',
        role: DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_2],
        email: workflow.role2Email,
        order: 0,
      },
      {
        name: 'Role 3 Signer',
        role: DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_3],
        email: ROLE_3_PLACEHOLDER_EMAIL,
        order: 1,
      },
    ];

    const submission = await this.docusealService.createSubmissionFromPdf(
      pdfBase64,
      document.fileName,
      fields,
      submitters,
    );

    const role2Submitter = submission.submitters.find(
      (s) => s.role === DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_2],
    );
    const role3Submitter = submission.submitters.find(
      (s) => s.role === DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_3],
    );

    await workflow.update({
      docusealSubmissionId: String(submission.id),
      docusealRole2SubmitterId: role2Submitter
        ? String(role2Submitter.id)
        : null,
      docusealRole3SubmitterId: role3Submitter
        ? String(role3Submitter.id)
        : null,
      status: DocumentStatus.PENDING_ROLE_2_SIGNATURE,
      currentStep: WorkflowStep.ROLE_2,
    });

    await document.update({
      status: DocumentStatus.PENDING_ROLE_2_SIGNATURE,
      currentSigner: workflow.role2Email,
    });

    await this.auditLogModel.create({
      documentId: document.id,
      workflowId: workflow.id,
      action: AuditAction.SENT_TO_ROLE_2,
      performedByRole: SignerRole.ROLE_1,
      performedByEmail: workflow.role1Email,
      message: `Signing request sent to Role 2 (${workflow.role2Email})`,
    });

    return {
      message: 'Document submitted for signing',
      workflow: await this.getWorkflowById(workflowId),
      docusealSubmissionId: submission.id,
      role2SigningUrl: role2Submitter
        ? `https://docuseal.com/s/${role2Submitter.slug}`
        : null,
    };
  }

  async getWorkflowStatus(workflowId: number) {
    const workflow = await this.getWorkflowById(workflowId);

    const auditLogs = await this.auditLogModel.findAll({
      where: { workflowId: workflow.id },
      order: [['createdAt', 'ASC']],
    });

    return {
      workflowId: workflow.id,
      documentId: workflow.documentId,
      status: workflow.status,
      currentStep: workflow.currentStep,
      currentSigner: workflow.document?.currentSigner ?? null,
      role1Email: workflow.role1Email,
      role2Email: workflow.role2Email,
      role3Email: workflow.role3Email,
      docusealSubmissionId: workflow.docusealSubmissionId,
      auditTrail: auditLogs,
    };
  }

  async updateRole3Email(
    workflowId: number,
    updateRole3EmailDto: UpdateRole3EmailDto,
  ) {
    const workflow = await this.getWorkflowById(workflowId);

    if (workflow.currentStep !== WorkflowStep.AWAITING_ROLE_3_EMAIL) {
      throw new BadRequestException(
        'Role 3 email can only be updated after Role 2 has completed signing',
      );
    }

    if (!workflow.docusealRole3SubmitterId) {
      throw new BadRequestException(
        'DocuSeal Role 3 submitter ID not found for this workflow',
      );
    }

    await this.docusealService.updateSubmitter(
      workflow.docusealRole3SubmitterId,
      updateRole3EmailDto.role3Email,
      true,
    );

    await workflow.update({
      role3Email: updateRole3EmailDto.role3Email,
      status: DocumentStatus.PENDING_ROLE_3_SIGNATURE,
      currentStep: WorkflowStep.ROLE_3,
    });

    const document = await this.documentModel.findByPk(workflow.documentId);
    if (document) {
      await document.update({
        status: DocumentStatus.PENDING_ROLE_3_SIGNATURE,
        currentSigner: updateRole3EmailDto.role3Email,
      });
    }

    await this.auditLogModel.create({
      documentId: workflow.documentId,
      workflowId: workflow.id,
      action: AuditAction.ROLE_3_EMAIL_UPDATED,
      performedByRole: SignerRole.ROLE_2,
      performedByEmail: workflow.role2Email,
      message: `Role 3 email updated to ${updateRole3EmailDto.role3Email}`,
    });

    await this.auditLogModel.create({
      documentId: workflow.documentId,
      workflowId: workflow.id,
      action: AuditAction.SENT_TO_ROLE_3,
      performedByRole: SignerRole.ROLE_2,
      performedByEmail: workflow.role2Email,
      message: `Signing request sent to Role 3 (${updateRole3EmailDto.role3Email})`,
    });

    return {
      message: 'Role 3 email updated and signing request sent',
      workflow: await this.getWorkflowById(workflowId),
    };
  }

  async getSignedDocument(workflowId: number) {
    const workflow = await this.getWorkflowById(workflowId);

    if (workflow.status !== DocumentStatus.COMPLETED) {
      throw new BadRequestException(
        'Signed document is available only after workflow is completed',
      );
    }

    if (!workflow.signedDocumentPath || !fs.existsSync(workflow.signedDocumentPath)) {
      throw new NotFoundException('Signed document file not found');
    }

    return {
      fileName: `signed-${workflow.document?.fileName ?? 'document.pdf'}`,
      filePath: workflow.signedDocumentPath,
    };
  }

  async handleRole2Signed(workflow: Workflow) {
    await workflow.update({
      status: DocumentStatus.PENDING_ROLE_2_SIGNATURE,
      currentStep: WorkflowStep.AWAITING_ROLE_3_EMAIL,
    });

    await this.auditLogModel.create({
      documentId: workflow.documentId,
      workflowId: workflow.id,
      action: AuditAction.ROLE_2_SIGNED,
      performedByRole: SignerRole.ROLE_2,
      performedByEmail: workflow.role2Email,
      message: 'Role 2 completed signing',
    });
  }

  async handleRole3Signed(workflow: Workflow) {
    await workflow.update({
      status: DocumentStatus.COMPLETED,
      currentStep: WorkflowStep.COMPLETED,
    });

    const document = await this.documentModel.findByPk(workflow.documentId);
    if (document) {
      await document.update({
        status: DocumentStatus.COMPLETED,
        currentSigner: null,
      });
    }

    await this.auditLogModel.create({
      documentId: workflow.documentId,
      workflowId: workflow.id,
      action: AuditAction.ROLE_3_SIGNED,
      performedByRole: SignerRole.ROLE_3,
      performedByEmail: workflow.role3Email,
      message: 'Role 3 completed signing',
    });

    await this.auditLogModel.create({
      documentId: workflow.documentId,
      workflowId: workflow.id,
      action: AuditAction.WORKFLOW_COMPLETED,
      performedByRole: null,
      performedByEmail: null,
      message: 'Workflow completed successfully',
    });
  }

  async downloadAndSaveSignedDocument(workflow: Workflow) {
    if (!workflow.docusealSubmissionId) {
      return;
    }

    const submission = await this.docusealService.getSubmission(
      workflow.docusealSubmissionId,
    );

    const downloadUrl =
      submission.combined_document_url || submission.documents?.[0]?.url;

    if (!downloadUrl) {
      return;
    }

    const fileBuffer = await this.docusealService.downloadFile(downloadUrl);
    const signedDir = join(process.cwd(), 'uploads', 'signed');

    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    const fileName = `signed-${workflow.documentId}-${Date.now()}.pdf`;
    const filePath = join(signedDir, fileName);

    fs.writeFileSync(filePath, fileBuffer);

    await workflow.update({ signedDocumentPath: filePath });
  }

  private buildDocusealFields(tags: SignatureTag[]): DocusealField[] {
    const fieldTypeMap: Record<FieldType, string> = {
      [FieldType.SIGNATURE]: 'signature',
      [FieldType.NAME]: 'text',
      [FieldType.DATE]: 'date',
      [FieldType.EMAIL]: 'text',
    };

    return tags.map((tag, index) => ({
      name: `${tag.role}_${tag.fieldType}_${index + 1}`,
      type: fieldTypeMap[tag.fieldType],
      role: DOCUSEAL_ROLE_NAMES[tag.role],
      required: true,
      areas: [
        {
          x: tag.xPosition,
          y: tag.yPosition,
          w: tag.width,
          h: tag.height,
          page: tag.pageNumber,
        },
      ],
    }));
  }

  private async getWorkflowById(id: number): Promise<Workflow> {
    const workflow = await this.workflowModel.findByPk(id, {
      include: [Document],
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  private async getDocumentForWorkflow(workflow: Workflow): Promise<Document> {
    const document = await this.documentModel.findByPk(workflow.documentId);

    if (!document) {
      throw new NotFoundException('Document not found for this workflow');
    }

    if (!document.filePath || !fs.existsSync(document.filePath)) {
      throw new NotFoundException('PDF file not found on server');
    }

    return document;
  }
}
