import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Workflow } from '../documents/models/workflow.model';
import { WorkflowsService } from '../workflows/workflows.service';
import { DOCUSEAL_ROLE_NAMES } from '../common/constants';
import { SignerRole } from '../common/enums';

interface DocusealWebhookPayload {
  event_type: string;
  timestamp?: string;
  data: {
    id: number;
    role?: string;
    email?: string;
    status?: string;
    submission_id?: number;
    submission?: {
      id: number;
      status: string;
      combined_document_url?: string;
    };
    // submission.completed event has a different structure
    // where the top-level data IS the submission
    submitters?: Array<{
      id: number;
      role: string;
      email: string;
      status: string;
    }>;
    combined_document_url?: string;
    documents?: Array<{ url: string; name: string }>;
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
    this.logger.log(
      `=== WEBHOOK RECEIVED === Full payload: ${JSON.stringify(payload, null, 2)}`,
    );

    if (!payload || !payload.event_type) {
      this.logger.warn(
        'Received webhook with missing or invalid payload',
      );
      return { received: true, message: 'No event_type provided' };
    }

    this.logger.log(`Processing DocuSeal webhook event: ${payload.event_type}`);

    if (payload.event_type === 'form.completed') {
      await this.handleFormCompleted(payload);
    }

    if (payload.event_type === 'submission.completed') {
      await this.handleSubmissionCompleted(payload);
    }

    return { received: true };
  }

  private async handleFormCompleted(payload: DocusealWebhookPayload) {
    try {
      if (!payload.data) {
        this.logger.warn('form.completed webhook received with no data');
        return;
      }

      // DocuSeal form.completed payload structure:
      // data.id = submitter ID
      // data.submission.id = submission ID
      // data.submission_id may also be present
      // data.role = role name (e.g. "Role 2", "Role 3")
      // data.email = signer email
      const rawSubmissionId =
        payload.data.submission_id ?? payload.data.submission?.id;

      this.logger.log(
        `form.completed - submitter id: ${payload.data.id}, ` +
          `email: ${payload.data.email}, ` +
          `role: ${payload.data.role}, ` +
          `submission_id (from submission_id field): ${payload.data.submission_id}, ` +
          `submission_id (from submission.id): ${payload.data.submission?.id}, ` +
          `resolved submissionId: ${rawSubmissionId}`,
      );

      if (rawSubmissionId == null) {
        this.logger.warn(
          'form.completed webhook has no submission_id - cannot find workflow',
        );
        return;
      }

      const submissionId = String(rawSubmissionId);

      const workflow = await this.workflowModel.findOne({
        where: { docusealSubmissionId: submissionId },
      });

      if (!workflow) {
        this.logger.warn(
          `No workflow found for submission ID "${submissionId}". ` +
            `Checking all workflows for debugging...`,
        );

        // Debug: log all workflows with their submission IDs
        const allWorkflows = await this.workflowModel.findAll({
          attributes: ['id', 'docusealSubmissionId', 'status', 'currentStep'],
        });
        this.logger.log(
          `All workflows in DB: ${JSON.stringify(allWorkflows.map((w) => ({ id: w.id, submissionId: w.docusealSubmissionId, status: w.status, step: w.currentStep })))}`,
        );
        return;
      }

      const role = payload.data.role;
      this.logger.log(
        `Matched workflow ${workflow.id} (status: ${workflow.status}, step: ${workflow.currentStep}). ` +
          `Signer role from webhook: "${role}"`,
      );

      const role2Name = DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_2];
      const role3Name = DOCUSEAL_ROLE_NAMES[SignerRole.ROLE_3];

      this.logger.log(
        `Expected role names - Role 2: "${role2Name}", Role 3: "${role3Name}"`,
      );

      if (role === role2Name) {
        this.logger.log(`Processing Role 2 signed for workflow ${workflow.id}`);
        await this.workflowsService.handleRole2Signed(workflow);
        this.logger.log(
          `Successfully processed Role 2 signing for workflow ${workflow.id}`,
        );
      } else if (role === role3Name) {
        this.logger.log(`Processing Role 3 signed for workflow ${workflow.id}`);
        await this.workflowsService.handleRole3Signed(workflow);
        this.logger.log(
          `Successfully processed Role 3 signing for workflow ${workflow.id}`,
        );
      } else {
        this.logger.warn(
          `Unknown role "${role}" in form.completed webhook. ` +
            `Expected "${role2Name}" or "${role3Name}". Skipping.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling form.completed webhook: ${error.message}`,
        error.stack,
      );
    }
  }

  private async handleSubmissionCompleted(payload: DocusealWebhookPayload) {
    try {
      if (!payload.data || payload.data.id == null) {
        this.logger.warn(
          'submission.completed webhook received with no data or id',
        );
        return;
      }

      const submissionId = String(payload.data.id);
      this.logger.log(
        `submission.completed - submission ID: ${submissionId}`,
      );

      const workflow = await this.workflowModel.findOne({
        where: { docusealSubmissionId: submissionId },
      });

      if (!workflow) {
        this.logger.warn(
          `No workflow found for submission.completed with id "${submissionId}"`,
        );
        return;
      }

      this.logger.log(
        `Downloading signed document for workflow ${workflow.id}`,
      );
      await this.workflowsService.downloadAndSaveSignedDocument(workflow);
      this.logger.log(
        `Successfully downloaded signed document for workflow ${workflow.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling submission.completed webhook: ${error.message}`,
        error.stack,
      );
    }
  }
}
