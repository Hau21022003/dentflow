import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasskeysModule } from './passkeys/passkeys.module';
import { AuthSession } from './sessions/entities/auth-session.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TotpModule } from './totp/totp.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  imports: [
    JwtModule.register({}),
    PassportModule,
    TypeOrmModule.forFeature([AuthSession, User]),
    PasskeysModule,
    TotpModule,
  ],
})
export class AuthModule {}
