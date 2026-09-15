import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasskeysModule } from './passkeys/passkeys.module';
import { AuthSession } from './sessions/entities/auth-session.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { TotpModule } from './totp/totp.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OptionalJwtAuthGuard],
  imports: [
    JwtModule.register({}),
    PassportModule,
    TypeOrmModule.forFeature([AuthSession, User]),
    AuthorizationModule,
    AuditModule,
    UsersModule,
    PasskeysModule,
    TotpModule,
  ],
  exports: [OptionalJwtAuthGuard],
})
export class AuthModule {}
