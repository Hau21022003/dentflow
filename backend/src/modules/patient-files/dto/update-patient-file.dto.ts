import { PartialType, PickType } from '@nestjs/swagger';
import { CreatePatientFileDto } from './create-patient-file.dto';

export class UpdatePatientFileDto extends PartialType(
  PickType(CreatePatientFileDto, ['category', 'note', 'fileDate'] as const),
) {}
