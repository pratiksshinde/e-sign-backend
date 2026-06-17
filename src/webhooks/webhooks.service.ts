import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Workflow } from '../documents/models/workflow.model';
import { WebhookLog } from '../documents/models/webhook-log.model';
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

    @InjectModel(WebhookLog)
    private readonly webhookLogModel: typeof WebhookLog,

    private readonly workflowsService: WorkflowsService,
  ) {}

  async handleDocusealWebhook(payload: DocusealWebhookPayload) {
    this.logger.log(
      `=== WEBHOOK RECEIVED === Full payload: ${JSON.stringify(payload, null, 2)}`,
    );

    // Always log the webhook to the database first
    const webhookLog = await this.webhookLogModel.create({
      eventType: payload?.event_type ?? 'UNKNOWN',
      rawPayload: JSON.stringify(payload),
      submissionId:
        String(
          payload?.data?.submission_id ??
            payload?.data?.submission?.id ??
            payload?.data?.id ??
            '',
        ) || null,
      role: payload?.data?.role ?? null,
      email: payload?.data?.email ?? null,
      processingStatus: 'RECEIVED',
      errorMessage: null,
    });

    try {
      if (!payload || !payload.event_type) {
        this.logger.warn(
          'Received webhook with missing or invalid payload',
        );
        await webhookLog.update({ processingStatus: 'SKIPPED_NO_EVENT_TYPE' });
        return { received: true, message: 'No event_type provided' };
      }

      this.logger.log(
        `Processing DocuSeal webhook event: ${payload.event_type}`,
      );

      if (payload.event_type === 'form.completed') {
        await this.handleFormCompleted(payload, webhookLog);
      } else if (payload.event_type === 'submission.completed') {
        await this.handleSubmissionCompleted(payload, webhookLog);
      } else {
        await webhookLog.update({
          processingStatus: 'SKIPPED_UNKNOWN_EVENT',
        });
      }

      return { received: true };
    } catch (error) {
      await webhookLog.update({
        processingStatus: 'ERROR',
        errorMessage: error.message,
      });
      this.logger.error(`Webhook processing failed: ${error.message}`, error.stack);
      return { received: true };
    }
  }

  private async handleFormCompleted(
    payload: DocusealWebhookPayload,
    webhookLog: WebhookLog,
  ) {
    if (!payload.data) {
      this.logger.warn('form.completed webhook received with no data');
      await webhookLog.update({ processingStatus: 'ERROR_NO_DATA' });
      return;
    }


    const rawSubmissionId =
      payload.data.submission_id ?? payload.data.submission?.id;

    this.logger.log(
      `form.completed - submitter id: ${payload.data.id}, ` +
        `email: ${payload.data.email}, ` +
        `role: ${payload.data.role}, ` +
        `submission_id (submission_id field): ${payload.data.submission_id}, ` +
        `submission_id (submission.id): ${payload.data.submission?.id}, ` +
        `resolved submissionId: ${rawSubmissionId}`,
    );

    if (rawSubmissionId == null) {
      this.logger.warn(
        'form.completed webhook has no submission_id - cannot find workflow',
      );
      await webhookLog.update({
        processingStatus: 'ERROR_NO_SUBMISSION_ID',
      });
      return;
    }

    const submissionId = String(rawSubmissionId);
    await webhookLog.update({ submissionId });

    const workflow = await this.workflowModel.findOne({
      where: { docusealSubmissionId: submissionId },
    });

    if (!workflow) {
      this.logger.warn(
        `No workflow found for submission ID "${submissionId}".`,
      );

      // Debug: log all workflows
      const allWorkflows = await this.workflowModel.findAll({
        attributes: [
          'id',
          'docusealSubmissionId',
          'status',
          'currentStep',
        ],
      });
      this.logger.log(
        `All workflows in DB: ${JSON.stringify(
          allWorkflows.map((w) => ({
            id: w.id,
            submissionId: w.docusealSubmissionId,
            status: w.status,
            step: w.currentStep,
          })),
        )}`,
      );

      await webhookLog.update({
        processingStatus: 'ERROR_WORKFLOW_NOT_FOUND',
      });
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
      this.logger.log(
        `Processing Role 2 signed for workflow ${workflow.id}`,
      );
      await this.workflowsService.handleRole2Signed(workflow);
      await webhookLog.update({ processingStatus: 'PROCESSED_ROLE_2' });
      this.logger.log(
        `Successfully processed Role 2 signing for workflow ${workflow.id}`,
      );
    } else if (role === role3Name) {
      this.logger.log(
        `Processing Role 3 signed for workflow ${workflow.id}`,
      );
      await this.workflowsService.handleRole3Signed(workflow);
      await webhookLog.update({ processingStatus: 'PROCESSED_ROLE_3' });
      this.logger.log(
        `Successfully processed Role 3 signing for workflow ${workflow.id}`,
      );
    } else {
      this.logger.warn(
        `Unknown role "${role}" in form.completed webhook. ` +
          `Expected "${role2Name}" or "${role3Name}". Skipping.`,
      );
      await webhookLog.update({
        processingStatus: 'ERROR_UNKNOWN_ROLE',
        errorMessage: `Got role "${role}", expected "${role2Name}" or "${role3Name}"`,
      });
    }
  }

  private async handleSubmissionCompleted(
    payload: DocusealWebhookPayload,
    webhookLog: WebhookLog,
  ) {
    if (!payload.data || payload.data.id == null) {
      this.logger.warn(
        'submission.completed webhook received with no data or id',
      );
      await webhookLog.update({ processingStatus: 'ERROR_NO_DATA' });
      return;
    }

    const submissionId = String(payload.data.id);
    this.logger.log(
      `submission.completed - submission ID: ${submissionId}`,
    );

    await webhookLog.update({ submissionId });

    const workflow = await this.workflowModel.findOne({
      where: { docusealSubmissionId: submissionId },
    });

    if (!workflow) {
      this.logger.warn(
        `No workflow found for submission.completed with id "${submissionId}"`,
      );
      await webhookLog.update({
        processingStatus: 'ERROR_WORKFLOW_NOT_FOUND',
      });
      return;
    }

    this.logger.log(
      `Downloading signed document for workflow ${workflow.id}`,
    );
    await this.workflowsService.downloadAndSaveSignedDocument(workflow);
    await webhookLog.update({
      processingStatus: 'PROCESSED_SUBMISSION_COMPLETED',
    });
    this.logger.log(
      `Successfully downloaded signed document for workflow ${workflow.id}`,
    );
  }
}
