import http from 'node:http';
import { Injectable } from '@nestjs/common';

export type OAuthCallbackResult = {
  code: string;
};

type WaitForCallbackInput = {
  redirectUri: string;
  state: string;
  timeoutMs: number;
};

@Injectable()
export class OauthCallbackService {
  async waitForCode(input: WaitForCallbackInput): Promise<OAuthCallbackResult> {
    const redirect = new URL(input.redirectUri);
    if (redirect.protocol !== 'http:') {
      throw new Error('OAuth local callback requires http redirect URI');
    }

    const hostname = redirect.hostname.toLowerCase();
    if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) {
      throw new Error('OAuth local callback requires loopback host (127.0.0.1 or localhost)');
    }

    const port = Number.parseInt(redirect.port, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      throw new Error('OAuth local callback requires explicit port in redirect URI');
    }

    const callbackPath = redirect.pathname || '/';

    return new Promise<OAuthCallbackResult>((resolve, reject) => {
      let settled = false;

      const finish = (handler: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        handler();
        server.close(() => undefined);
      };

      const server = http.createServer((req, res) => {
        if (!req.url) {
          res.statusCode = 400;
          res.end('Bad request');
          return;
        }

        const requestUrl = new URL(req.url, `http://${req.headers.host ?? '127.0.0.1'}`);
        if (requestUrl.pathname !== callbackPath) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        const returnedState = requestUrl.searchParams.get('state');
        const error = requestUrl.searchParams.get('error');
        const code = requestUrl.searchParams.get('code');

        if (error) {
          res.statusCode = 400;
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.end('OAuth failed. You can close this tab and return to snd.');
          finish(() => reject(new Error(`OAuth error from provider: ${error}`)));
          return;
        }

        if (!returnedState || returnedState !== input.state) {
          res.statusCode = 400;
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.end('State mismatch. You can close this tab and retry auth.');
          finish(() => reject(new Error('OAuth state mismatch')));
          return;
        }

        if (!code) {
          res.statusCode = 400;
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.end('Missing code. You can close this tab and retry auth.');
          finish(() => reject(new Error('OAuth callback missing code')));
          return;
        }

        res.statusCode = 200;
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end('snd auth complete. You can close this tab.');
        finish(() => resolve({ code }));
      });

      server.on('error', (error) => {
        finish(() => reject(error));
      });

      server.listen(port, redirect.hostname, () => undefined);

      const timer = setTimeout(() => {
        finish(() => reject(new Error(`Timed out waiting for OAuth callback after ${input.timeoutMs}ms`)));
      }, input.timeoutMs);
    });
  }
}
