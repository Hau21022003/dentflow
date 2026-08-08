import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasskeysModule } from './passkeys/passkeys.module';
import { TotpModule } from './totp/totp.module';
import { AuthSession } from './sessions/entities/auth-session.entity';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [
    TypeOrmModule.forFeature([AuthSession]),
    PasskeysModule,
    TotpModule,
  ],
})
export class AuthModule {}
