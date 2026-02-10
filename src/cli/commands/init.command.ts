import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { SndConfig } from '../../config/schema.js';
import { CredentialStoreService } from '../../core/credential-store.service.js';
import { ask } from '../../core/prompt.js';
import { DatabaseService } from '../../storage/database.service.js';

interface InitOptions {
  force?: boolean;
  wizard?: boolean;
}

@Command({
  name: 'init',
  description: 'Bootstrap local snd config and storage',
})
export class InitCommand extends CommandRunner {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly credentialStoreService: CredentialStoreService,
  ) {
    super();
  }

  override async run(_passedParams: string[], options?: InitOptions): Promise<void> {
    this.configService.ensureConfigExists(Boolean(options?.force));
    this.databaseService.initialize();

    if (options?.wizard) {
      const config = this.configService.load();
      const updated = await this.runWizard(config);
      this.configService.save(updated);
      process.stdout.write('wizard complete\n');
    }

    process.stdout.write('snd init complete\n');
    process.stdout.write('config: ~/.snd/config.yaml\n');
    process.stdout.write('db: ~/.snd/snd.db\n');
  }

  @Option({ flags: '--force', description: 'Overwrite default config file if it exists' })
  parseForce(): boolean {
    return true;
  }

  @Option({ flags: '--wizard', description: 'Interactive setup for first account and LLM defaults' })
  parseWizard(): boolean {
    return true;
  }

  private async runWizard(config: SndConfig): Promise<SndConfig> {
    const accountId = (await ask('account id (default: main): ')) || 'main';
    const email = await ask('email address: ');
    if (!email) {
      throw new Error('email is required for wizard');
    }

    const providerRaw = (await ask('provider [gmail|generic] (default: gmail): ')).toLowerCase() || 'gmail';
    const provider = providerRaw === 'generic' ? 'generic' : 'gmail';

    const model = (await ask(`llm model (default: ${config.llm.model}): `)) || config.llm.model;
    const intervalRaw = await ask(`poll interval seconds (default: ${config.poll.intervalSeconds}): `);
    const intervalSeconds = intervalRaw ? Number.parseInt(intervalRaw, 10) : config.poll.intervalSeconds;
    const llmToken = await ask('LLM API token (blank to set later via snd auth --llm-token): ');

    const hostDefault = provider === 'gmail' ? 'imap.gmail.com' : 'imap.example.com';
    const portDefault = 993;
    const host = (await ask(`imap host (default: ${hostDefault}): `)) || hostDefault;
    const portRaw = await ask(`imap port (default: ${portDefault}): `);
    const port = portRaw ? Number.parseInt(portRaw, 10) : portDefault;
    const secureRaw = (await ask('imap secure [true|false] (default: true): ')).toLowerCase() || 'true';
    const secure = secureRaw !== 'false';
    const username = (await ask(`imap username (default: ${email}): `)) || email;
    const authDefault = provider === 'gmail' ? 'oauth2' : 'password';
    const authRaw = (await ask(`imap auth [oauth2|password] (default: ${authDefault}): `)).toLowerCase() || authDefault;
    const auth = authRaw === 'password' ? 'password' : 'oauth2';

    let oauth = undefined;
    let oauthRefreshToken = '';
    if (auth === 'oauth2') {
      const clientId = await ask('oauth clientId (blank for later): ');
      const clientSecret = await ask('oauth clientSecret (blank for later): ');
      const redirectUri = (await ask('oauth redirectUri (default: http://127.0.0.1:53682/oauth2callback): '))
        || 'http://127.0.0.1:53682/oauth2callback';
      if (clientId && clientSecret) {
        oauth = { clientId, clientSecret, redirectUri };
      }

      oauthRefreshToken = await ask('oauth refresh token (blank to set later via snd auth --account <id> --gmail): ');
    } else {
      const imapPassword = await ask('IMAP password/app-password (blank to set later via snd auth --imap-password): ');
      if (imapPassword) {
        this.credentialStoreService.setSecret(`imap:${accountId}:password`, imapPassword);
      }
    }

    if (llmToken) {
      this.credentialStoreService.setSecret(config.llm.apiKeySecretKey, llmToken);
    }

    if (oauthRefreshToken) {
      this.credentialStoreService.setSecret(
        `imap:${accountId}:oauth`,
        JSON.stringify({ refreshToken: oauthRefreshToken }),
      );
    }

    const nextAccounts = [
      ...config.accounts.filter((entry) => entry.id !== accountId),
      {
        id: accountId,
        email,
        provider,
        imap: {
          host,
          port,
          secure,
          username,
          auth,
        },
        ...(oauth ? { oauth } : {}),
        rulesProfile: 'default',
      },
    ];

    return {
      ...config,
      defaultAccountId: accountId,
      poll: {
        ...config.poll,
        intervalSeconds: Number.isFinite(intervalSeconds) && intervalSeconds >= 30 ? intervalSeconds : 300,
      },
      llm: {
        ...config.llm,
        model,
      },
      accounts: nextAccounts,
    };
  }
}
