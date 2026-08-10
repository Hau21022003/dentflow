import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfigService } from '../../config/app-config.service';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './auth.constants';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-user-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly appConfig: AppConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(response, result.tokens);

    return { user: result.user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = this.getRefreshToken(request);
    const result = await this.authService.refresh(refreshToken ?? '');
    this.setAuthCookies(response, result.tokens);

    return { user: result.user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiNoContentResponse({
    description: 'The current device session is revoked.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.getRefreshToken(request));
    this.clearAuthCookies(response);
  }

  private setAuthCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    const { jwtAccess, jwtRefresh } = this.appConfig.authConfig;

    response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...this.baseCookieOptions(ACCESS_TOKEN_COOKIE_PATH),
      maxAge: jwtAccess.expiresInMs,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...this.baseCookieOptions(REFRESH_TOKEN_COOKIE_PATH),
      maxAge: jwtRefresh.expiresInMs,
    });
  }

  private clearAuthCookies(response: Response): void {
    response.clearCookie(
      ACCESS_TOKEN_COOKIE,
      this.baseCookieOptions(ACCESS_TOKEN_COOKIE_PATH),
    );
    response.clearCookie(
      REFRESH_TOKEN_COOKIE,
      this.baseCookieOptions(REFRESH_TOKEN_COOKIE_PATH),
    );
  }

  private getRefreshToken(request: Request): string | undefined {
    const cookies: unknown = request.cookies;
    if (!cookies || typeof cookies !== 'object') {
      return undefined;
    }

    const refreshToken = (cookies as Record<string, unknown>)[
      REFRESH_TOKEN_COOKIE
    ];
    return typeof refreshToken === 'string' ? refreshToken : undefined;
  }

  private baseCookieOptions(path: string): CookieOptions {
    const runtimeConfig = this.appConfig.runtimeConfig;

    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: !runtimeConfig.isDevelopment && !runtimeConfig.isTesting,
      path,
    };
  }
}
