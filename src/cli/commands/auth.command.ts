import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { CredentialStoreService } from '../../core/credential-store.service.js';
import { ask } from '../../core/prompt.js';
import { GmailOauthService } from '../../imap/gmail-oauth.service.js';

type AuthOptions = {
  account?: string;
  gmail?: boolean;
  imapPassword?: boolean;
  llmToken?: boolean;
  code?: string;
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

      const { url } = this.gmailOauthService.createAuthUrl({
        clientId: account.oauth.clientId,
        redirectUri: account.oauth.redirectUri,
      });

      process.stdout.write('Open this URL in browser and authorize:\n');
      process.stdout.write(`${url}\n`);

      const code = options.code ?? (await ask('Paste OAuth code from redirect URL (code=...): '));
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
}
