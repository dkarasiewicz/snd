import { Injectable } from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { BirdUiService } from '../ui/bird-ui.service.js';

@Injectable()
export class RunnerService {
  private isRunning = false;
  private syncInFlight = false;

  constructor(
    private readonly syncService: SyncService,
    private readonly birdUiService: BirdUiService,
  ) {}

  async runOnce(accountId?: string): Promise<void> {
    this.birdUiService.start('sync', 'syncing mailbox');
    this.birdUiService.setState('sync');

    try {
      const stats = await this.syncService.runOnce(accountId);
      this.birdUiService.setState('done');

      for (const row of stats) {
        this.birdUiService.printLine(
          `[${row.accountId}] fetched=${row.fetched} imported=${row.imported} drafted=${row.drafted} ignored=${row.ignored}`,
        );
      }
    } catch (error) {
      this.birdUiService.setState('error');
      this.birdUiService.printLine(`sync failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 250));
      this.birdUiService.stop();
      process.stdout.write('\n');
    }
  }

  startDaemon(intervalSeconds: number, accountId?: string): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.birdUiService.start('idle', `poll every ${intervalSeconds}s`);

    const tick = async (): Promise<void> => {
      if (!this.isRunning) {
        return;
      }

      if (this.syncInFlight) {
        this.birdUiService.printLine('previous sync still running, skipping this tick');
        return;
      }

      this.syncInFlight = true;

      try {
        this.birdUiService.setState('sync');
        const stats = await this.syncService.runOnce(accountId);
        this.birdUiService.setState('done');

        for (const row of stats) {
          this.birdUiService.printLine(
            `[${new Date().toISOString()}] [${row.accountId}] fetched=${row.fetched} imported=${row.imported} drafted=${row.drafted} ignored=${row.ignored}`,
          );
        }
      } catch (error) {
        this.birdUiService.setState('error');
        this.birdUiService.printLine(`sync failed: ${(error as Error).message}`);
      } finally {
        this.syncInFlight = false;
        this.birdUiService.setState('idle');
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, intervalSeconds * 1000);

    process.on('SIGINT', () => {
      this.isRunning = false;
      clearInterval(timer);
      this.birdUiService.stop();
      process.stdout.write('\nbye\n');
      process.exit(0);
    });
  }
}
