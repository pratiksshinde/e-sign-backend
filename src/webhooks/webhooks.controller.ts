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

  /**
   * Health check - visit https://<your-render-url>/webhooks/docuseal in a browser.
   */
  @Get('docuseal')
  webhookHealthCheck() {
    this.logger.log('Webhook health check hit');
    return {
      status: 'ok',
      message: 'DocuSeal webhook endpoint is reachable',
      endpoint: 'POST /webhooks/docuseal',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * View recent webhook logs - visit https://<your-render-url>/webhooks/logs
   */
  @Get('logs')
  async getWebhookLogs() {
    const logs = await this.webhookLogModel.findAll({
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    return {
      total: logs.length,
      logs,
    };
  }

  @Post('docuseal')
  async handleDocusealWebhook(@Body() body: Record<string, unknown>) {
    this.logger.log(
      `Incoming DocuSeal webhook - event_type: ${body?.event_type ?? 'MISSING'}`,
    );
    return this.webhooksService.handleDocusealWebhook(body as never);
  }
}
