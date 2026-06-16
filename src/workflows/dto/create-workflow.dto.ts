import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsInt, Min } from 'class-validator';

export class CreateWorkflowDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  documentId: number;

  @ApiProperty({ example: 'role1@example.com' })
  @IsEmail()
  role1Email: string;

  @ApiProperty({
    example: 'role2.placeholder@example.com',
    description: 'Placeholder email for Role 2 signer',
  })
  @IsEmail()
  role2Email: string;
}
