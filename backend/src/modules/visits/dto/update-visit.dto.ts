import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Trim } from '../../../common/dto-decorators/trim.decorator';

export const VISIT_CLINICAL_TEXT_MAX_LENGTH = 10_000;

export class UpdateVisitDto {
  @ApiPropertyOptional({
    maxLength: VISIT_CLINICAL_TEXT_MAX_LENGTH,
    nullable: true,
  })
  @Trim()
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(VISIT_CLINICAL_TEXT_MAX_LENGTH)
  symptoms?: string | null;

  @ApiPropertyOptional({
    maxLength: VISIT_CLINICAL_TEXT_MAX_LENGTH,
    nullable: true,
  })
  @Trim()
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(VISIT_CLINICAL_TEXT_MAX_LENGTH)
  relevantHistory?: string | null;

  @ApiPropertyOptional({
    maxLength: VISIT_CLINICAL_TEXT_MAX_LENGTH,
    nullable: true,
  })
  @Trim()
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(VISIT_CLINICAL_TEXT_MAX_LENGTH)
  examination?: string | null;

  @ApiPropertyOptional({
    maxLength: VISIT_CLINICAL_TEXT_MAX_LENGTH,
    nullable: true,
  })
  @Trim()
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(VISIT_CLINICAL_TEXT_MAX_LENGTH)
  diagnosis?: string | null;

  @ApiPropertyOptional({
    maxLength: VISIT_CLINICAL_TEXT_MAX_LENGTH,
    nullable: true,
  })
  @Trim()
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(VISIT_CLINICAL_TEXT_MAX_LENGTH)
  clinicalNote?: string | null;
}
