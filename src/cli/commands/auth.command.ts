import { spawn } from 'node:child_process';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { CredentialStoreService } from '../../core/credential-store.service.js';
import { ask } from '../../core/prompt.js';
import { GmailOauthService } from '../../imap/gmail-oauth.service.js';
import { OauthCallbackService } from '../../imap/oauth-callback.service.js';

type AuthOptions = {
  account?: string;
  gmail?: boolean;
  imapPassword?: boolean;
  llmToken?: boolean;
  code?: string;
  noLocalServer?: boolean;
  listenTimeout?: number;
};

@Command({
  name: 'auth',
  description: 'Store credentials for IMAP/OAuth and LLM tokens',
})
export class AuthCommand extends CommandRunner {
  constructor(
    private readonly configService: ConfigService,
    private readonly credentialStoreService: CredentialStoreService,
    private readonly gmailOauthService: GmailOauthService,
    private readonly oauthCallbackService: OauthCallbackService,
  ) {
    super();
  }

  override async run(_params: string[], options?: AuthOptions): Promise<void> {
    if (options?.llmToken) {
      const config = this.configService.load();
      const token = await ask('Paste LLM API token: ');
      if (!token) {
        throw new Error('Empty token. Aborted.');
      }

      this.credentialStoreService.setSecret(config.llm.apiKeySecretKey, token);
      process.stdout.write(`Stored LLM token in secret key ${config.llm.apiKeySecretKey}\n`);
      return;
    }

    const accountId = options?.account;
    if (!accountId) {
      throw new Error('Specify account with --account <id>');
    }

    const config = this.configService.load();
    const account = config.accounts.find((entry) => entry.id === accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found in config`);
    }

    if (options?.imapPassword) {
      const password = await ask(`Enter IMAP password/app-password for ${account.id}: `);
      if (!password) {
        throw new Error('Empty password. Aborted.');
      }

      this.credentialStoreService.setSecret(`imap:${account.id}:password`, password);
      process.stdout.write(`Stored IMAP password secret for ${account.id}\n`);
      return;
    }

    if (options?.gmail) {
      if (!account.oauth) {
        throw new Error(`Account ${account.id} has no oauth config. Add oauth.clientId/clientSecret/redirectUri first.`);
      }

      const { url, state } = this.gmailOauthService.createAuthUrl({
        clientId: account.oauth.clientId,
        redirectUri: account.oauth.redirectUri,
      });
      let code = options.code;
      const timeoutSeconds = options.listenTimeout ?? 120;

      if (!code && !options.noLocalServer) {
        process.stdout.write(`Opening browser for OAuth: ${url}\n`);
        const opened = openAuthUrl(url);
        if (!opened) {
          process.stdout.write('Could not auto-open browser. Open URL manually.\n');
        }

        process.stdout.write(`Waiting for callback on ${account.oauth.redirectUri} (${timeoutSeconds}s timeout)...\n`);
        try {
          const callback = await this.oauthCallbackService.waitForCode({
            redirectUri: account.oauth.redirectUri,
            state,
            timeoutMs: timeoutSeconds * 1000,
          });
          code = callback.code;
          process.stdout.write('OAuth callback received.\n');
        } catch (error) {
          process.stdout.write(`Local callback failed: ${(error as Error).message}\n`);
          process.stdout.write('Falling back to manual code paste.\n');
        }
      }

      if (!code) {
        process.stdout.write('Open this URL in browser and authorize:\n');
        process.stdout.write(`${url}\n`);
        code = await ask('Paste OAuth code from redirect URL (code=...): ');
      }

      if (!code) {
        throw new Error('Missing OAuth code. Aborted.');
      }

      const token = await this.gmailOauthService.exchangeCode({
        code,
        clientId: account.oauth.clientId,
        clientSecret: account.oauth.clientSecret,
        redirectUri: account.oauth.redirectUri,
      });

      if (!token.refreshToken) {
        throw new Error('No refresh token received. Re-run with prompt=consent and ensure offline access.');
      }

      this.credentialStoreService.setSecret(
        `imap:${account.id}:oauth`,
        JSON.stringify({ refreshToken: token.refreshToken }),
      );

      process.stdout.write(`Stored OAuth refresh token for ${account.id}\n`);
      return;
    }

    process.stdout.write('No auth mode selected. Use one of --llm-token, --imap-password, --gmail\n');
  }

  @Option({ flags: '--account [accountId]', description: 'Account ID from config' })
  parseAccount(value: string): string {
    return value;
  }

  @Option({ flags: '--gmail', description: 'Run Gmail OAuth flow for selected account' })
  parseGmail(): boolean {
    return true;
  }

  @Option({ flags: '--imap-password', description: 'Store IMAP password/app-password for selected account' })
  parseImapPassword(): boolean {
    return true;
  }

  @Option({ flags: '--llm-token', description: 'Store LLM API token using llm.apiKeySecretKey from config' })
  parseLlmToken(): boolean {
    return true;
  }

  @Option({ flags: '--code [oauthCode]', description: 'OAuth code for non-interactive auth' })
  parseCode(value: string): string {
    return value;
  }

  @Option({ flags: '--no-local-server', description: 'Disable localhost callback and use manual OAuth code copy/paste' })
  parseNoLocalServer(): boolean {
    return true;
  }

  @Option({ flags: '--listen-timeout [seconds]', description: 'Timeout for localhost OAuth callback listener' })
  parseListenTimeout(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 900) {
      throw new Error('--listen-timeout must be an integer between 5 and 900');
    }

    return parsed;
  }
}

function openAuthUrl(url: string): boolean {
  try {
    if (process.platform === 'darwin') {
      const child = spawn('open', [url], { stdio: 'ignore', detached: true });
      child.unref();
      return true;
    }

    if (process.platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true });
      child.unref();
      return true;
    }

    const child = spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
    child.unref();
    return true;
  } catch {
    return false;
  }
}
