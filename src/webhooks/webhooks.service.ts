import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Workflow } from '../documents/models/workflow.model';
import { WorkflowsService } from '../workflows/workflows.service';
import { DOCUSEAL_ROLE_NAMES } from '../common/constants';
import { SignerRole } from '../common/enums';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(Workflow)
    private readonly workflowModel: typeof Workflow,
    private readonly workflowsService: WorkflowsService,
  ) {}

  async handleDocusealWebhook(payload: any) {
    if (!payload || !payload.event_type) {
      return { received: true };
    }

    this.logger.log(`Webhook: ${payload.event_type}`);

    if (payload.event_type === 'form.completed') {
      await this.handleFormCompleted(payload);
    }

    if (payload.event_type === 'submission.completed') {
      await this.handleSubmissionCompleted(payload);
    }

    return { received: true };
  }

  private async handleFormCompleted(payload: any) {
    const data = payload.data;
    if (!data) return;

    const submissionId = String(
      data.submission_id ?? data.submission?.id,
    );
    if (!submissionId || submissionId === 'undefined') return;

    const workflow = await this.workflowModel.findOne({
      where: { docusealSubmissionId: submissionId },
    });
    if (!workflow) return;

    const role = data.role;

    if (role === DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_2]) {
      await this.workflowsService.handleRole2Signed(workflow);
    }

    if (role === DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_3]) {
      await this.workflowsService.handleRole3Signed(workflow);
    }
  }

  private async handleSubmissionCompleted(payload: any) {
    const data = payload.data;
    if (!data || data.id == null) return;

    const submissionId = String(data.id);

    const workflow = await this.workflowModel.findOne({
      where: { docusealSubmissionId: submissionId },
    });
    if (!workflow) return;

    await this.workflowsService.downloadAndSaveSignedDocument(workflow);
  }
}
