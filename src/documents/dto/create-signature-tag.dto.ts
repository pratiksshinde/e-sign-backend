import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, Min } from 'class-validator';
import { FieldType, SignerRole } from '../../common/enums';

export class CreateSignatureTagDto {
  @ApiProperty({ enum: [SignerRole.ROLE_2, SignerRole.ROLE_3] })
  @IsEnum(SignerRole)
  role: SignerRole;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  pageNumber: number;

  @ApiProperty({ example: 250 })
  @IsNumber()
  xPosition: number;

  @ApiProperty({ example: 600 })
  @IsNumber()
  yPosition: number;

  @ApiProperty({ example: 150 })
  @IsNumber()
  width: number;

  @ApiProperty({ example: 50 })
  @IsNumber()
  height: number;

  @ApiProperty({ enum: FieldType, example: FieldType.SIGNATURE })
  @IsEnum(FieldType)
  fieldType: FieldType;
}