import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './models/document.model';
import { SignatureTag } from './models/signature-tag.model';
import { Workflow } from './models/workflow.model';
import { AuditLog } from './models/audit-log.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Document,
      SignatureTag,
      Workflow,
      AuditLog,
    ]),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}