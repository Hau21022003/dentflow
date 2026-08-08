import { Controller } from '@nestjs/common';
import { TotpService } from './totp.service';

@Controller('totp')
export class TotpController {
  constructor(private readonly totpService: TotpService) {}
}
