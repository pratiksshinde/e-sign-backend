import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('docuseal')
  async handleDocusealWebhook(@Body() body: Record<string, unknown>) {
    this.logger.log(
      `Incoming DocuSeal webhook - event_type: ${body?.event_type ?? 'MISSING'}`,
    );
    return this.webhooksService.handleDocusealWebhook(body as never);
  }
}
