import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { WebhookLog } from '../documents/models/webhook-log.model';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    @InjectModel(WebhookLog)
    private readonly webhookLogModel: typeof WebhookLog,
  ) {}

  
  @Post('docuseal')
  async handleDocusealWebhook(@Body() body: Record<string, unknown>) {
    this.logger.log(
      `Incoming DocuSeal webhook - event_type: ${body?.event_type ?? 'MISSING'}`,
    );
    return this.webhooksService.handleDocusealWebhook(body as never);
  }
}
