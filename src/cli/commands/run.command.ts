import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { RunnerService } from '../../core/runner.service.js';
import {
  renderRunCycleError,
  renderRunCycleSkip,
  renderRunCycleStart,
  renderRunCycleStats,
  renderStop,
} from '../../ui/cli-render.js';
import { resolveUiMode } from '../../ui/ui-mode.js';
import type { UiMode } from '../../ui/ui-mode.js';

type RunOptions = {
  once?: boolean;
  interval?: number;
  account?: string;
  ui?: UiMode;
  verbose?: boolean;
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
    const mode = resolveUiMode(config.ui.mode, options?.ui);

    if (options?.once) {
      const startedAt = Date.now();
      process.stdout.write(`${renderRunCycleStart(mode, options.account)}\n`);

      try {
        const stats = await this.runnerService.runOnce(options.account);
        process.stdout.write(`${renderRunCycleStats(mode, stats, Date.now() - startedAt)}\n`);
      } catch (error) {
        process.stdout.write(`${renderRunCycleError(mode, error as Error)}\n`);
        throw error;
      }
      return;
    }

    process.stdout.write(`snd daemon started (interval=${interval}s)\n`);
    let cycleStartedAt = Date.now();
    this.runnerService.startDaemon(interval, options?.account, {
      onCycleStart: () => {
        cycleStartedAt = Date.now();
        if (options?.verbose) {
          process.stdout.write(`${renderRunCycleStart(mode, options.account)}\n`);
        }
      },
      onCycleSuccess: (stats) => {
        process.stdout.write(`${renderRunCycleStats(mode, stats, Date.now() - cycleStartedAt)}\n`);
      },
      onCycleError: (error) => {
        process.stdout.write(`${renderRunCycleError(mode, error)}\n`);
      },
      onCycleSkip: () => {
        if (options?.verbose) {
          process.stdout.write(`${renderRunCycleSkip(mode)}\n`);
        }
      },
      onStop: () => {
        process.stdout.write(`${renderStop(mode)}\n`);
      },
    });
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

  @Option({ flags: '--ui [mode]', description: 'UI mode: auto, rich, plain' })
  parseUi(value: string): UiMode {
    if (value !== 'auto' && value !== 'rich' && value !== 'plain') {
      throw new Error('--ui must be one of auto, rich, plain');
    }

    return value;
  }

  @Option({ flags: '--verbose', description: 'Show additional daemon cycle events' })
  parseVerbose(): boolean {
    return true;
  }
}
