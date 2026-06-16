import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { Workflow } from '../documents/models/workflow.model';
import { Document } from '../documents/models/document.model';
import { SignatureTag } from '../documents/models/signature-tag.model';
import { AuditLog } from '../documents/models/audit-log.model';
import { DocusealModule } from '../docuseal/docuseal.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Workflow, Document, SignatureTag, AuditLog]),
    DocusealModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
