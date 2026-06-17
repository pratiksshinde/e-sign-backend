import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('docuseal')
  async handleDocusealWebhook(@Body() body: Record<string, unknown>) {
    return this.webhooksService.handleDocusealWebhook(body as never);
  }
}
