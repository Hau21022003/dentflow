import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasskeysService } from './passkeys.service';
import { PasskeysController } from './passkeys.controller';
import { PasskeyCredential } from './entities/passkey-credential.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PasskeyCredential])],
  controllers: [PasskeysController],
  providers: [PasskeysService],
})
export class PasskeysModule {}
