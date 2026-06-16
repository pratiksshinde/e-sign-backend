import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Document } from './models/document.model';
import { AuditLog } from './models/audit-log.model';
import { AuditAction, DocumentStatus } from '../common/enums';
import { join } from 'path';
import * as fs from 'fs';
import { SignatureTag } from './models/signature-tag.model';
import { CreateSignatureTagDto } from './dto/create-signature-tag.dto';
import { SignerRole } from '../common/enums';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Document)
    private readonly documentModel: typeof Document,

    @InjectModel(AuditLog)
    private readonly auditLogModel: typeof AuditLog,

    @InjectModel(SignatureTag)
    private readonly signatureTagModel: typeof SignatureTag,
  ) {}

  async uploadDocument(file: Express.Multer.File, uploadedByEmail: string) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    const uploadDir = join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savedFilePath = file.path || join(uploadDir, file.filename);

    if (!fs.existsSync(savedFilePath)) {
      throw new BadRequestException('File was not saved properly');
    }

    const document = await this.documentModel.create({
      fileName: file.originalname,
      filePath: savedFilePath,
      uploadedByEmail,
      status: DocumentStatus.DRAFT,
      currentSigner: null,
    });

    await this.auditLogModel.create({
      documentId: document.id,
      workflowId: null,
      action: AuditAction.DOCUMENT_UPLOADED,
      performedByRole: null,
      performedByEmail: uploadedByEmail,
      message: `Document uploaded: ${file.originalname}`,
    });

    return {
      message: 'Document uploaded successfully',
      document,
    };
  }

  async getDocumentById(id: number) {
    const document = await this.documentModel.findByPk(id, {
      include: [
        { association: 'signatureTags' },
        { association: 'workflow' },
        { association: 'auditLogs' },
      ],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  async getDocumentFile(id: number) {
    const document = await this.getDocumentById(id);

    if (!document.filePath) {
      throw new NotFoundException('File path not found in database');
    }

    if (!fs.existsSync(document.filePath)) {
      throw new NotFoundException(
        `PDF file not found on server. Stored path: ${document.filePath}`,
      );
    }

    return document;
  }

  async addSignatureTag(
  documentId: number,
  createSignatureTagDto: CreateSignatureTagDto,
) {
  const document = await this.getDocumentById(documentId);

  if (
    createSignatureTagDto.role !== SignerRole.ROLE_2 &&
    createSignatureTagDto.role !== SignerRole.ROLE_3
  ) {
    throw new BadRequestException('Signature tag can only be added for ROLE_2 or ROLE_3');
  }

  const signatureTag = await this.signatureTagModel.create({
    documentId: document.id,
    role: createSignatureTagDto.role,
    pageNumber: createSignatureTagDto.pageNumber,
    xPosition: createSignatureTagDto.xPosition,
    yPosition: createSignatureTagDto.yPosition,
    width: createSignatureTagDto.width,
    height: createSignatureTagDto.height,
    fieldType: createSignatureTagDto.fieldType,
  });

  await this.auditLogModel.create({
    documentId: document.id,
    workflowId: null,
    action: AuditAction.SIGNATURE_TAG_ADDED,
    performedByRole: createSignatureTagDto.role,
    performedByEmail: null,
    message: `${createSignatureTagDto.fieldType} tag added for ${createSignatureTagDto.role}`,
  });

  return {
    message: 'Signature tag added successfully',
    signatureTag,
  };
}

async getSignatureTagsByDocument(documentId: number) {
  const document = await this.getDocumentById(documentId);

  const tags = await this.signatureTagModel.findAll({
    where: { documentId: document.id },
    order: [['pageNumber', 'ASC']],
  });

  return {
    documentId: document.id,
    totalTags: tags.length,
    tags,
  };
}
}