import { Controller } from '@nestjs/common';
import { PasskeysService } from './passkeys.service';

@Controller('passkeys')
export class PasskeysController {
  constructor(private readonly passkeysService: PasskeysService) {}
}
