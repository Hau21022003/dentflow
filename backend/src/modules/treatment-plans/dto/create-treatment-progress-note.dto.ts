import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTreatmentProgressNoteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  imageObjectKeys?: string[];
}
