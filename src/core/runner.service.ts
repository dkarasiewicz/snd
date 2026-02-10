import { Injectable } from '@nestjs/common';
import { SyncRunStats, SyncService } from './sync.service.js';

export type RunnerHandlers = {
  onCycleStart?: () => void;
  onCycleSuccess?: (stats: SyncRunStats[]) => void;
  onCycleError?: (error: Error) => void;
  onCycleSkip?: () => void;
  onStop?: () => void;
};

@Injectable()
export class RunnerService {
  private isRunning = false;
  private syncInFlight = false;

  constructor(private readonly syncService: SyncService) {}

  async runOnce(accountId?: string): Promise<SyncRunStats[]> {
    return this.syncService.runOnce(accountId);
  }

  startDaemon(intervalSeconds: number, accountId?: string, handlers?: RunnerHandlers): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const tick = async (): Promise<void> => {
      if (!this.isRunning) {
        return;
      }

      if (this.syncInFlight) {
        handlers?.onCycleSkip?.();
        return;
      }

      this.syncInFlight = true;
      handlers?.onCycleStart?.();

      try {
        const stats = await this.syncService.runOnce(accountId);
        handlers?.onCycleSuccess?.(stats);
      } catch (error) {
        handlers?.onCycleError?.(error as Error);
      } finally {
        this.syncInFlight = false;
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, intervalSeconds * 1000);

    process.on('SIGINT', () => {
      if (!this.isRunning) {
        return;
      }

      this.isRunning = false;
      clearInterval(timer);
      handlers?.onStop?.();
      process.exit(0);
    });
  }
}
