import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DocusealField {
  name: string;
  type: string;
  role: string;
  required?: boolean;
  areas: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    page: number;
  }>;
}

export interface DocusealSubmitter {
  name: string;
  role: string;
  email: string;
  order: number;
}

export interface DocusealSubmissionResponse {
  id: number;
  status: string;
  submitters: Array<{
    id: number;
    role: string;
    email: string;
    status: string;
    slug: string;
  }>;
  combined_document_url?: string;
  documents?: Array<{ url: string; name: string }>;
}

@Injectable()
export class DocusealService {
  private readonly logger = new Logger(DocusealService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl =
      this.configService.get<string>('DOCUSEAL_API_URL') ||
      'https://api.docuseal.com';
    this.apiKey = this.configService.get<string>('DOCUSEAL_API_KEY') || '';
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'DOCUSEAL_API_KEY is not set in .env file',
      );
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    this.ensureApiKey();

    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`DocuSeal API error: ${errorText}`);
      throw new InternalServerErrorException(
        `DocuSeal API failed: ${response.status} ${errorText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async createSubmissionFromPdf(
    pdfBase64: string,
    documentName: string,
    fields: DocusealField[],
    submitters: DocusealSubmitter[],
  ): Promise<DocusealSubmissionResponse> {
    return this.request<DocusealSubmissionResponse>(
      'POST',
      '/submissions/pdf',
      {
        name: documentName,
        send_email: true,
        order: 'preserved',
        documents: [
          {
            name: documentName,
            file: pdfBase64,
            fields,
          },
        ],
        submitters,
      },
    );
  }

  async updateSubmitter(
    submitterId: string,
    email: string,
    sendEmail = true,
  ): Promise<unknown> {
    return this.request('PUT', `/submitters/${submitterId}`, {
      email,
      send_email: sendEmail,
    });
  }

  async getSubmission(
    submissionId: string,
  ): Promise<DocusealSubmissionResponse> {
    return this.request<DocusealSubmissionResponse>(
      'GET',
      `/submissions/${submissionId}`,
    );
  }

  async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Failed to download signed document from DocuSeal`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
