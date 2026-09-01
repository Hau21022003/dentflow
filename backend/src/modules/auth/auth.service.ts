import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { compare, hash } from '../../common/utils/hash.util';
import { AppConfigService } from '../../config/app-config.service';
import { AuditAction, AuditLogService, AuditActorType } from '../audit';
import { AuthorizationService } from '../authorization/authorization.service';
import { User, UserStatus } from '../users/entities/user.entity';
import {
  AccessTokenPayload,
  AuthenticatedUser,
  AuthResult,
  AuthTokens,
  RefreshTokenPayload,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { AuthSession } from './sessions/entities/auth-session.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly sessionsRepository: Repository<AuthSession>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly appConfig: AppConfigService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const emailNormalized = loginDto.email.toLowerCase();
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.emailNormalized = :emailNormalized', { emailNormalized })
      .getOne();

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw this.invalidCredentials();
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw this.invalidCredentials();
    }

    if (user.lockedUntil) {
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
    }

    const isPasswordValid = await compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.recordFailedLogin(user.id, now);
      throw this.invalidCredentials();
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = now;
    await this.usersRepository.save(user);

    return this.createSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const payload = await this.verifyRefreshToken(refreshToken);

    return this.dataSource.transaction((manager) =>
      this.rotateRefreshToken(manager, payload, refreshToken),
    );
  }

  async getAuthenticatedUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.usersRepository.findOneBy({ id: userId });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException();
    }

    return this.toAuthenticatedUser(user);
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const payload = await this.tryVerifyRefreshToken(refreshToken);
    if (!payload) {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const session = await this.findSessionForRefreshToken(manager, payload);
      if (
        !session ||
        !(await compare(refreshToken, session.refreshTokenHash))
      ) {
        return;
      }

      session.revokedAt = new Date();
      await manager.getRepository(AuthSession).save(session);
    });
  }

  private async createSession(user: User): Promise<AuthResult> {
    const session = this.sessionsRepository.create({
      id: randomUUID(),
      userId: user.id,
      refreshTokenId: randomUUID(),
      expiresAt: this.getRefreshExpiry(),
      lastUsedAt: null,
      revokedAt: null,
    });
    const tokens = await this.issueTokens(session, user.id);

    session.refreshTokenHash = await hash(
      tokens.refreshToken,
      this.appConfig.securityConfig.bcryptSaltRounds,
    );
    await this.sessionsRepository.save(session);

    return {
      user: await this.toAuthenticatedUser(user),
      tokens,
    };
  }

  private async rotateRefreshToken(
    manager: EntityManager,
    payload: RefreshTokenPayload,
    refreshToken: string,
  ): Promise<AuthResult> {
    const session = await this.findSessionForRefreshToken(manager, payload);
    const now = new Date();

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !(await compare(refreshToken, session.refreshTokenHash))
    ) {
      throw this.invalidRefreshToken();
    }

    const user = await manager.getRepository(User).findOneBy({
      id: payload.sub,
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw this.invalidRefreshToken();
    }

    session.refreshTokenId = randomUUID();
    session.expiresAt = this.getRefreshExpiry();
    session.lastUsedAt = now;

    const tokens = await this.issueTokens(session, user.id);
    session.refreshTokenHash = await hash(
      tokens.refreshToken,
      this.appConfig.securityConfig.bcryptSaltRounds,
    );
    await manager.getRepository(AuthSession).save(session);

    return {
      user: await this.toAuthenticatedUser(user),
      tokens,
    };
  }

  private async findSessionForRefreshToken(
    manager: EntityManager,
    payload: RefreshTokenPayload,
  ): Promise<AuthSession | null> {
    return manager
      .getRepository(AuthSession)
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .setLock('pessimistic_write')
      .where('session.id = :sessionId', { sessionId: payload.sid })
      .andWhere('session.refreshTokenId = :refreshTokenId', {
        refreshTokenId: payload.jti,
      })
      .andWhere('session.userId = :userId', { userId: payload.sub })
      .getOne();
  }

  private async issueTokens(
    session: AuthSession,
    userId: string,
  ): Promise<AuthTokens> {
    const { jwtAccess, jwtRefresh } = this.appConfig.authConfig;

    const accessToken = await this.jwtService.signAsync<AccessTokenPayload>(
      {
        sub: userId,
        sid: session.id,
        typ: 'access',
      },
      {
        secret: jwtAccess.secret,
        expiresIn: Math.ceil(jwtAccess.expiresInMs / 1000),
      },
    );
    const refreshToken = await this.jwtService.signAsync<RefreshTokenPayload>(
      {
        sub: userId,
        sid: session.id,
        jti: session.refreshTokenId,
        typ: 'refresh',
      },
      {
        secret: jwtRefresh.secret,
        expiresIn: Math.ceil(jwtRefresh.expiresInMs / 1000),
      },
    );

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    const payload = await this.tryVerifyRefreshToken(refreshToken);
    if (!payload) {
      throw this.invalidRefreshToken();
    }

    return payload;
  }

  private async tryVerifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload | null> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.appConfig.authConfig.jwtRefresh.secret,
        },
      );

      return this.isRefreshTokenPayload(payload) ? payload : null;
    } catch {
      return null;
    }
  }

  private isRefreshTokenPayload(
    payload: RefreshTokenPayload,
  ): payload is RefreshTokenPayload {
    return (
      payload.typ === 'refresh' &&
      typeof payload.sub === 'string' &&
      typeof payload.sid === 'string' &&
      typeof payload.jti === 'string'
    );
  }

  private async recordFailedLogin(userId: string, now: Date): Promise<void> {
    const { maxLoginAttempts, loginLockMinutes } =
      this.appConfig.securityConfig;

    await this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('user')
        .setLock('pessimistic_write')
        .where('user.id = :userId', { userId })
        .getOne();
      if (!user) {
        return;
      }

      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const wasLocked = Boolean(user.lockedUntil && user.lockedUntil > now);

      user.failedLoginAttempts = failedLoginAttempts;
      if (failedLoginAttempts >= maxLoginAttempts) {
        user.lockedUntil = new Date(
          now.getTime() + loginLockMinutes * 60 * 1000,
        );
      }

      await manager.getRepository(User).save(user);

      if (failedLoginAttempts >= maxLoginAttempts && !wasLocked) {
        await this.auditLogService.record(manager, {
          action: AuditAction.AUTH_ACCOUNT_LOCKED,
          actor: { type: AuditActorType.SYSTEM },
          resourceId: user.id,
          before: { failedLoginAttempts: failedLoginAttempts - 1 },
          after: {
            failedLoginAttempts,
            lockDurationSeconds: loginLockMinutes * 60,
          },
          metadata: { reasonCode: 'MAX_FAILED_LOGIN_ATTEMPTS' },
          occurredAt: now,
        });
      }
    });
  }

  private getRefreshExpiry(): Date {
    return new Date(
      Date.now() + this.appConfig.authConfig.jwtRefresh.expiresInMs,
    );
  }

  private async toAuthenticatedUser(user: User): Promise<AuthenticatedUser> {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      authorization: await this.authorizationService.getAuthorizationSnapshot(
        user.id,
      ),
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException('Invalid email or password');
  }

  private invalidRefreshToken(): UnauthorizedException {
    return new UnauthorizedException('Invalid or expired refresh token');
  }
}
