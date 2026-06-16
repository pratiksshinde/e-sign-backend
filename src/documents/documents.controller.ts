import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import {
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { CreateSignatureTagDto } from './dto/create-signature-tag.dto';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        uploadedByEmail: {
          type: 'string',
          example: 'admin@gmail.com',
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['uploadedByEmail', 'file'],
    },
  })
  @UseInterceptors(
  FileInterceptor('file', {
    storage: diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (req, file, callback) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    callback(null, uniqueName + extname(file.originalname));
  },
}),
    fileFilter: (req, file, callback) => {
      if (file.mimetype !== 'application/pdf') {
        return callback(new Error('Only PDF files are allowed'), false);
      }
      callback(null, true);
    },
  }),
)
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(
      file,
      body.uploadedByEmail,
    );
  }

  @Get(':id')
  getDocument(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.getDocumentById(id);
  }

  @Get(':id/preview')
  async previewDocument(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.getDocumentFile(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${document.fileName}"`,
    );

    return res.sendFile(document.filePath);
  }

  @Get(':id/download')
  async downloadDocument(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const document = await this.documentsService.getDocumentFile(id);

    return res.download(document.filePath, document.fileName);
  }
  @Post(':documentId/signature-tags')
addSignatureTag(
  @Param('documentId', ParseIntPipe) documentId: number,
  @Body() body: CreateSignatureTagDto,
) {
  return this.documentsService.addSignatureTag(documentId, body);
}

@Get(':documentId/signature-tags')
getSignatureTags(
  @Param('documentId', ParseIntPipe) documentId: number,
) {
  return this.documentsService.getSignatureTagsByDocument(documentId);
}
}