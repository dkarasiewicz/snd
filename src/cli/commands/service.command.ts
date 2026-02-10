import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { LaunchdService } from '../../daemon/launchd.service.js';

type ServiceOptions = {
  interval?: number;
  account?: string;
  lines?: number;
};

@Command({
  name: 'service',
  description: 'Manage snd macOS launchd background service',
  arguments: '[action]',
})
export class ServiceCommand extends CommandRunner {
  constructor(
    private readonly configService: ConfigService,
    private readonly launchdService: LaunchdService,
  ) {
    super();
  }

  override async run(params: string[], options?: ServiceOptions): Promise<void> {
    const action = (params[0] ?? 'status').toLowerCase();
    const allowedActions = new Set(['install', 'uninstall', 'start', 'stop', 'status', 'logs']);
    if (!allowedActions.has(action)) {
      throw new Error('service action must be one of: install, uninstall, start, stop, status, logs');
    }

    const config = this.configService.load();
    const accountId = options?.account ?? config.defaultAccountId;
    const intervalSeconds = options?.interval ?? config.poll.intervalSeconds;

    if (action === 'install') {
      this.launchdService.install({
        intervalSeconds,
        accountId,
      });
      process.stdout.write(`service installed: ${this.launchdService.getLabel()}\n`);
      process.stdout.write(`plist: ${this.launchdService.getPlistPath()}\n`);
      process.stdout.write(`interval: ${intervalSeconds}s\n`);
      process.stdout.write(`account: ${accountId ?? '(all configured accounts)'}\n`);
      return;
    }

    if (action === 'uninstall') {
      this.launchdService.uninstall();
      process.stdout.write(`service uninstalled: ${this.launchdService.getLabel()}\n`);
      return;
    }

    if (action === 'start') {
      this.launchdService.start();
      process.stdout.write(`service started: ${this.launchdService.getLabel()}\n`);
      return;
    }

    if (action === 'stop') {
      this.launchdService.stop();
      process.stdout.write(`service stopped: ${this.launchdService.getLabel()}\n`);
      return;
    }

    if (action === 'logs') {
      const lines = options?.lines ?? 80;
      const logs = this.launchdService.readLogs(lines);
      process.stdout.write(`stdout: ${logs.outPath}\n`);
      process.stdout.write(`${logs.out.length > 0 ? logs.out.join('\n') : '(no stdout log lines)'}\n`);
      process.stdout.write(`stderr: ${logs.errPath}\n`);
      process.stdout.write(`${logs.err.length > 0 ? logs.err.join('\n') : '(no stderr log lines)'}\n`);
      return;
    }

    const status = this.launchdService.status();
    process.stdout.write(`service: ${this.launchdService.getLabel()}\n`);
    process.stdout.write(`active: ${status.active}\n`);
    process.stdout.write(`${status.output || '(no launchctl output)'}\n`);
  }

  @Option({ flags: '--interval [seconds]', description: 'Polling interval seconds for install action' })
  parseInterval(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 30) {
      throw new Error('--interval must be an integer >= 30');
    }

    return parsed;
  }

  @Option({ flags: '--account [accountId]', description: 'Default account id for install action' })
  parseAccount(value: string): string {
    return value;
  }

  @Option({ flags: '--lines [n]', description: 'Number of lines for service logs action' })
  parseLines(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 2000) {
      throw new Error('--lines must be an integer between 1 and 2000');
    }

    return parsed;
  }
}
