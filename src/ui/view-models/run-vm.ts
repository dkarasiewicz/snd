import { SyncRunStats } from '../../core/sync.service.js';

export type RunPhase = 'idle' | 'syncing' | 'done' | 'error';

export type RunSummaryRow = {
  accountId: string;
  fetched: number;
  imported: number;
  drafted: number;
  ignored: number;
};

export type RunViewModel = {
  phase: RunPhase;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  rows: RunSummaryRow[];
  lastError: string | null;
};

export function initialRunViewModel(): RunViewModel {
  return {
    phase: 'idle',
    startedAt: null,
    completedAt: null,
    durationMs: null,
    rows: [],
    lastError: null,
  };
}

export function mapRunSuccess(stats: SyncRunStats[], startedAt: number, completedAt: number): RunViewModel {
  return {
    phase: 'done',
    startedAt,
    completedAt,
    durationMs: Math.max(0, completedAt - startedAt),
    rows: stats.map((row) => ({
      accountId: row.accountId,
      fetched: row.fetched,
      imported: row.imported,
      drafted: row.drafted,
      ignored: row.ignored,
    })),
    lastError: null,
  };
}

export function mapRunError(previous: RunViewModel, error: Error): RunViewModel {
  return {
    ...previous,
    phase: 'error',
    lastError: error.message,
  };
}
