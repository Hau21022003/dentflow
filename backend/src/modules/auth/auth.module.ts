import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasskeysModule } from './passkeys/passkeys.module';
import { TotpModule } from './totp/totp.module';
import { AuthSession } from './sessions/entities/auth-session.entity';
import { User } from '../users/entities/user.entity';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([AuthSession, User]),
    PasskeysModule,
    TotpModule,
  ],
})
export class AuthModule {}
