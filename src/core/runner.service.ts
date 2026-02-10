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
  private timer: NodeJS.Timeout | null = null;
  private signalHandler: (() => void) | null = null;
  private handlers: RunnerHandlers | null = null;

  constructor(private readonly syncService: SyncService) {}

  async runOnce(accountId?: string): Promise<SyncRunStats[]> {
    return this.syncService.runOnce(accountId);
  }

  startDaemon(intervalSeconds: number, accountId?: string, handlers?: RunnerHandlers): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.handlers = handlers ?? null;

    const tick = async (): Promise<void> => {
      if (!this.isRunning) {
        return;
      }

      if (this.syncInFlight) {
        this.handlers?.onCycleSkip?.();
        return;
      }

      this.syncInFlight = true;
      this.handlers?.onCycleStart?.();

      try {
        const stats = await this.syncService.runOnce(accountId);
        this.handlers?.onCycleSuccess?.(stats);
      } catch (error) {
        this.handlers?.onCycleError?.(error as Error);
      } finally {
        this.syncInFlight = false;
      }
    };

    void tick();
    this.timer = setInterval(() => {
      void tick();
    }, intervalSeconds * 1000);

    this.signalHandler = () => {
      this.stopDaemon();
    };

    process.on('SIGINT', this.signalHandler);
    process.on('SIGTERM', this.signalHandler);
  }

  stopDaemon(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.signalHandler) {
      process.off('SIGINT', this.signalHandler);
      process.off('SIGTERM', this.signalHandler);
      this.signalHandler = null;
    }

    this.handlers?.onStop?.();
    this.handlers = null;
  }
}
