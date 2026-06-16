import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadDocumentDto {
  @ApiProperty({
    example: 'admin@gmail.com',
  })
  @IsEmail()
  uploadedByEmail: string;
}