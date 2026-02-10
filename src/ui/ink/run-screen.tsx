import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { RunnerService } from '../../core/runner.service.js';
import { SyncRunStats } from '../../core/sync.service.js';
import { AppShell } from './app-shell.js';
import { ErrorPanel } from './components/ErrorPanel.js';
import { EmptyState } from './components/EmptyState.js';
import { theme } from './theme.js';
import { initialRunViewModel, mapRunError, mapRunSuccess, RunViewModel } from '../view-models/run-vm.js';

type RunScreenInput = {
  runnerService: RunnerService;
  intervalSeconds: number;
  accountId?: string;
  once: boolean;
  verbose?: boolean;
};

type RunScreenProps = RunScreenInput & {
  onExit: () => void;
};

function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }

  return `${value}${' '.repeat(width - value.length)}`;
}

function phaseColor(phase: RunViewModel['phase']): string {
  if (phase === 'done') {
    return theme.colors.success;
  }

  if (phase === 'error') {
    return theme.colors.danger;
  }

  if (phase === 'syncing') {
    return theme.colors.brand;
  }

  return theme.colors.muted;
}

function RunScreen({ runnerService, intervalSeconds, accountId, once, verbose, onExit }: RunScreenProps): React.JSX.Element {
  const { exit } = useApp();
  const [vm, setVm] = useState<RunViewModel>(initialRunViewModel());
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const headerTitle = once ? 'Run Once' : `Run Daemon (${intervalSeconds}s)`;

  useEffect(() => {
    let alive = true;

    const onCycleStart = (): number => {
      const startedAt = Date.now();
      setVm((previous) => ({
        ...previous,
        phase: 'syncing',
        startedAt,
        completedAt: null,
        durationMs: null,
      }));
      return startedAt;
    };

    if (once) {
      const startedAt = onCycleStart();
      void runnerService
        .runOnce(accountId)
        .then((stats) => {
          if (!alive) {
            return;
          }

          const doneAt = Date.now();
          setVm(mapRunSuccess(stats, startedAt, doneAt));
          setLastUpdatedAt(doneAt);
          setTimeout(() => {
            onExit();
            exit();
          }, 60);
        })
        .catch((error) => {
          if (!alive) {
            return;
          }

          setVm((prev) => mapRunError(prev, error as Error));
          setLastUpdatedAt(Date.now());
          setTimeout(() => {
            onExit();
            exit();
          }, 60);
        });

      return () => {
        alive = false;
      };
    }

    let cycleStartedAt = Date.now();
    runnerService.startDaemon(intervalSeconds, accountId, {
      onCycleStart: () => {
        cycleStartedAt = onCycleStart();
      },
      onCycleSuccess: (stats: SyncRunStats[]) => {
        if (!alive) {
          return;
        }

        const completedAt = Date.now();
        setVm(mapRunSuccess(stats, cycleStartedAt, completedAt));
        setLastUpdatedAt(completedAt);
      },
      onCycleError: (error: Error) => {
        if (!alive) {
          return;
        }

        setVm((prev) => mapRunError(prev, error));
        setLastUpdatedAt(Date.now());
      },
    });

    return () => {
      alive = false;
      runnerService.stopDaemon();
    };
  }, [accountId, exit, intervalSeconds, once, onExit, runnerService]);

  useInput((input, key) => {
    if (once) {
      return;
    }

    if (input === 'q' || key.escape) {
      runnerService.stopDaemon();
      onExit();
      exit();
    }
  });

  const summaryRows = useMemo(() => {
    if (vm.rows.length === 0) {
      return null;
    }

    return vm.rows.map((row) => (
      <Text key={row.accountId}>
        {padRight(row.accountId, 14)} {padRight(String(row.fetched), 8)} {padRight(String(row.imported), 9)}{' '}
        {padRight(String(row.drafted), 8)} {padRight(String(row.ignored), 8)}
      </Text>
    ));
  }, [vm.rows]);

  const statusLeft = `${vm.phase}${lastUpdatedAt ? ` | updated ${new Date(lastUpdatedAt).toLocaleTimeString()}` : ''}`;
  const statusRight = once
    ? 'one-shot'
    : `interval ${intervalSeconds}s | ${verbose ? 'verbose on' : 'verbose off'} | q quit`;

  return (
    <AppShell
      title={headerTitle}
      statusLeft={statusLeft}
      statusRight={statusRight}
      hint="snd drafts replies; send from your main email client."
    >
      <Box marginBottom={1}>
        <Text color={phaseColor(vm.phase)}>
          state: {vm.phase}
          {vm.durationMs !== null ? ` | duration ${vm.durationMs}ms` : ''}
        </Text>
      </Box>

      {summaryRows ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold>
            {padRight('account', 14)} {padRight('fetched', 8)} {padRight('imported', 9)} {padRight('drafted', 8)}{' '}
            {padRight('ignored', 8)}
          </Text>
          {summaryRows}
        </Box>
      ) : (
        <EmptyState title="waiting for first sync" subtitle="cycle summary appears here" />
      )}

      {vm.lastError ? <ErrorPanel message={vm.lastError} /> : null}
    </AppShell>
  );
}

export function RunScreenView(props: Omit<RunScreenProps, 'onExit'> & { onExit: () => void }): React.JSX.Element {
  return <RunScreen {...props} />;
}
