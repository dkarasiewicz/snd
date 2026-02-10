import { Command, CommandRunner, Option } from 'nest-commander';
import YAML from 'yaml';
import { ConfigService } from '../../config/config.service.js';

type ConfigOptions = {
  setPoll?: number;
  setDefaultAccount?: string;
};

@Command({
  name: 'config',
  description: 'Inspect or update snd config',
})
export class ConfigCommand extends CommandRunner {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  override async run(_params: string[], options?: ConfigOptions): Promise<void> {
    if (options?.setPoll) {
      this.configService.update((config) => ({
        ...config,
        poll: {
          ...config.poll,
          intervalSeconds: options.setPoll as number,
        },
      }));
      process.stdout.write(`poll.intervalSeconds set to ${options.setPoll}\n`);
      return;
    }

    if (options?.setDefaultAccount) {
      this.configService.update((config) => ({
        ...config,
        defaultAccountId: options.setDefaultAccount,
      }));
      process.stdout.write(`defaultAccountId set to ${options.setDefaultAccount}\n`);
      return;
    }

    const config = this.configService.load();
    process.stdout.write(`${YAML.stringify(config)}\n`);
  }

  @Option({ flags: '--set-poll [seconds]', description: 'Set polling interval in seconds' })
  parseSetPoll(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 30) {
      throw new Error('--set-poll must be >= 30');
    }

    return parsed;
  }

  @Option({ flags: '--set-default-account [accountId]', description: 'Set default account id' })
  parseSetDefaultAccount(value: string): string {
    return value;
  }
}
