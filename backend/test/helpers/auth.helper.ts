import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from 'src/modules/auth/auth.constants';
import { cookiePair, findSetCookie } from './cookie.helper';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthenticatedTestSession {
  agent: ReturnType<typeof request.agent>;
  loginResponse: request.Response;
  accessCookie: string;
  refreshCookie: string;
}

export async function loginAs(
  app: INestApplication,
  credentials: LoginCredentials,
): Promise<AuthenticatedTestSession> {
  const agent = request.agent(app.getHttpServer());
  const loginResponse = await agent
    .post('/auth/login')
    .send(credentials)
    .expect(200);

  return {
    agent,
    loginResponse,
    accessCookie: cookiePair(findSetCookie(loginResponse, ACCESS_TOKEN_COOKIE)),
    refreshCookie: cookiePair(
      findSetCookie(loginResponse, REFRESH_TOKEN_COOKIE),
    ),
  };
}
