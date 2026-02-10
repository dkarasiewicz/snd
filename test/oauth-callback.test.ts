import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { OauthCallbackService } from '../src/imap/oauth-callback.service.js';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to get free port'));
        return;
      }

      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

describe('OauthCallbackService', () => {
  const service = new OauthCallbackService();

  it('captures OAuth code from localhost callback', async () => {
    const port = await getFreePort();
    const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

    const waiting = service.waitForCode({
      redirectUri,
      state: 'abc123',
      timeoutMs: 2000,
    });

    await fetch(`${redirectUri}?code=test-code&state=abc123`);

    await expect(waiting).resolves.toEqual({ code: 'test-code' });
  });

  it('rejects state mismatch', async () => {
    const port = await getFreePort();
    const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

    const waiting = service.waitForCode({
      redirectUri,
      state: 'right-state',
      timeoutMs: 2000,
    });
    waiting.catch(() => undefined);

    await fetch(`${redirectUri}?code=test-code&state=wrong-state`);

    await expect(waiting).rejects.toThrow('OAuth state mismatch');
  });
});
