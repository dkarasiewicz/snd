import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { RunnerService } from '../../core/runner.service.js';

type RunOptions = {
  once?: boolean;
  interval?: number;
  account?: string;
};

@Command({
  name: 'run',
  description: 'Run mailbox sync and draft generation loop',
})
export class RunCommand extends CommandRunner {
  constructor(
    private readonly configService: ConfigService,
    private readonly runnerService: RunnerService,
  ) {
    super();
  }

  override async run(_passed: string[], options?: RunOptions): Promise<void> {
    const config = this.configService.load();
    const interval = options?.interval ?? config.poll.intervalSeconds;

    if (options?.once) {
      await this.runnerService.runOnce(options.account);
      return;
    }

    this.runnerService.startDaemon(interval, options?.account);
    await new Promise(() => undefined);
  }

  @Option({ flags: '--once', description: 'Run one sync cycle and exit' })
  parseOnce(): boolean {
    return true;
  }

  @Option({ flags: '--interval [seconds]', description: 'Polling interval seconds' })
  parseInterval(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 30) {
      throw new Error('--interval must be an integer >= 30');
    }

    return parsed;
  }

  @Option({ flags: '--account [accountId]', description: 'Sync only this account' })
  parseAccount(value: string): string {
    return value;
  }
}
