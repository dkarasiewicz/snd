import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'openid',
  'email',
  'profile',
];

export type GmailTokenResponse = {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  scope: string;
  tokenType: string;
  idToken?: string;
};

@Injectable()
export class GmailOauthService {
  createAuthUrl(input: {
    clientId: string;
    redirectUri: string;
    state?: string;
  }): { url: string; state: string } {
    const state = input.state ?? crypto.randomBytes(16).toString('hex');

    const params = new URLSearchParams({
      client_id: input.clientId,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      redirect_uri: input.redirectUri,
      scope: GMAIL_SCOPES.join(' '),
      state,
    });

    return {
      url: `${GOOGLE_AUTH_BASE}?${params.toString()}`,
      state,
    };
  }

  async exchangeCode(input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<GmailTokenResponse> {
    const payload = new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange OAuth code: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      accessToken: String(data.access_token ?? ''),
      expiresIn: Number(data.expires_in ?? 3600),
      refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
      scope: String(data.scope ?? ''),
      tokenType: String(data.token_type ?? 'Bearer'),
      idToken: data.id_token ? String(data.id_token) : undefined,
    };
  }

  async refreshAccessToken(input: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<GmailTokenResponse> {
    const payload = new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: 'refresh_token',
    });

    const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh OAuth token: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    return {
      accessToken: String(data.access_token ?? ''),
      expiresIn: Number(data.expires_in ?? 3600),
      refreshToken: input.refreshToken,
      scope: String(data.scope ?? ''),
      tokenType: String(data.token_type ?? 'Bearer'),
      idToken: data.id_token ? String(data.id_token) : undefined,
    };
  }
}
