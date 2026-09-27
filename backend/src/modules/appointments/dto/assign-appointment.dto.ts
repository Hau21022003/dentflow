import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignAppointmentDto {
  @ApiProperty({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assignedDentistUserId: string | null;
}
