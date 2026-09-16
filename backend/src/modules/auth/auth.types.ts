import type { AuthorizationSnapshot } from '../authorization/authorization.types';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  typ: 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  authorization: AuthorizationSnapshot;
}

export interface AuthResult {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}
