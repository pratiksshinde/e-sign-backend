import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Workflow } from '../documents/models/workflow.model';
import { WorkflowsService } from '../workflows/workflows.service';
import { DOCUSEAL_ROLE_NAMES } from '../common/constants';
import { SignerRole } from '../common/enums';

interface DocusealWebhookPayload {
  event_type: string;
  data: {
    id: number;
    role?: string;
    email?: string;
    submission_id?: number;
    submission?: {
      id: number;
      status: string;
    };
  };
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(Workflow)
    private readonly workflowModel: typeof Workflow,
    private readonly workflowsService: WorkflowsService,
  ) {}

  async handleDocusealWebhook(payload: DocusealWebhookPayload) {
    this.logger.log(`Received DocuSeal webhook: ${payload.event_type}`);

    if (payload.event_type === 'form.completed') {
      await this.handleFormCompleted(payload);
    }

    if (payload.event_type === 'submission.completed') {
      await this.handleSubmissionCompleted(payload);
    }

    return { received: true };
  }

  private async handleFormCompleted(payload: DocusealWebhookPayload) {
    const submissionId = String(
      payload.data.submission_id ?? payload.data.submission?.id,
    );

    if (!submissionId) {
      return;
    }

    const workflow = await this.workflowModel.findOne({
      where: { docusealSubmissionId: submissionId },
    });

    if (!workflow) {
      this.logger.warn(`No workflow found for submission ${submissionId}`);
      return;
    }

    const role = payload.data.role;

    if (role === DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_2]) {
      await this.workflowsService.handleRole2Signed(workflow);
    }

    if (role === DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_3]) {
      await this.workflowsService.handleRole3Signed(workflow);
    }
  }

  private async handleSubmissionCompleted(payload: DocusealWebhookPayload) {
    const submissionId = String(payload.data.id);

    const workflow = await this.workflowModel.findOne({
      where: { docusealSubmissionId: submissionId },
    });

    if (!workflow) {
      return;
    }

    await this.workflowsService.downloadAndSaveSignedDocument(workflow);
  }
}
