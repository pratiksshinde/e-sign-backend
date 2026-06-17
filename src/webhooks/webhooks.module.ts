import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { Workflow } from '../documents/models/workflow.model';
import { WebhookLog } from '../documents/models/webhook-log.model';
import { WorkflowsModule } from '../workflows/workflows.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Workflow, WebhookLog]),
    WorkflowsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
