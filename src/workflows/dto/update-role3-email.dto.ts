import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class UpdateRole3EmailDto {
  @ApiProperty({ example: 'role3@example.com' })
  @IsEmail()
  role3Email: string;
}
