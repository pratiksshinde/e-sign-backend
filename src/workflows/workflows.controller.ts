import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateRole3EmailDto } from './dto/update-role3-email.dto';

@ApiTags('Workflows')
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  createWorkflow(@Body() body: CreateWorkflowDto) {
    return this.workflowsService.createWorkflow(body);
  }

  @Post(':id/submit')
  submitForSigning(@Param('id', ParseIntPipe) id: number) {
    return this.workflowsService.submitForSigning(id);
  }

  @Get(':id/status')
  getWorkflowStatus(@Param('id', ParseIntPipe) id: number) {
    return this.workflowsService.getWorkflowStatus(id);
  }

  @Patch(':id/role3-email')
  updateRole3Email(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRole3EmailDto,
  ) {
    return this.workflowsService.updateRole3Email(id, body);
  }

  @Get(':id/signed-document')
  async getSignedDocument(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const signedDoc = await this.workflowsService.getSignedDocument(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${signedDoc.fileName}"`,
    );

    return res.sendFile(signedDoc.filePath);
  }
}
