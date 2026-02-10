import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { RunnerService } from '../../core/runner.service.js';
import { resolveUiMode } from '../../ui/ui-mode.js';
import { renderRunRich, UiRenderer } from '../../ui/ui-renderer.js';
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

    if (mode === 'rich') {
      await renderRunRich({
        runnerService: this.runnerService,
        intervalSeconds: interval,
        accountId: options?.account,
        once: Boolean(options?.once),
        verbose: options?.verbose,
      });
      return;
    }

    if (options?.once) {
      const startedAt = Date.now();
      process.stdout.write(`${UiRenderer.renderRunCycleStart(mode, options.account)}\n`);

      try {
        const stats = await this.runnerService.runOnce(options.account);
        process.stdout.write(`${UiRenderer.renderRunCycleStats(mode, stats, Date.now() - startedAt)}\n`);
      } catch (error) {
        process.stdout.write(`${UiRenderer.renderRunCycleError(mode, error as Error)}\n`);
        throw error;
      }
      return;
    }

    process.stdout.write(`snd daemon started (interval=${interval}s)\n`);
    let cycleStartedAt = Date.now();
    let resolveStop = (): void => undefined;
    this.runnerService.startDaemon(interval, options?.account, {
      onCycleStart: () => {
        cycleStartedAt = Date.now();
        if (options?.verbose) {
          process.stdout.write(`${UiRenderer.renderRunCycleStart(mode, options.account)}\n`);
        }
      },
      onCycleSuccess: (stats) => {
        process.stdout.write(`${UiRenderer.renderRunCycleStats(mode, stats, Date.now() - cycleStartedAt)}\n`);
      },
      onCycleError: (error) => {
        process.stdout.write(`${UiRenderer.renderRunCycleError(mode, error)}\n`);
      },
      onCycleSkip: () => {
        if (options?.verbose) {
          process.stdout.write(`${UiRenderer.renderRunCycleSkip(mode)}\n`);
        }
      },
      onStop: () => {
        process.stdout.write(`${UiRenderer.renderStop(mode)}\n`);
        resolveStop();
      },
    });
    await new Promise<void>((resolve) => {
      resolveStop = resolve;
    });
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
