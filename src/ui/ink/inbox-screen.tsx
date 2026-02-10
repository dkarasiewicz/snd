import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import { AppShell } from './app-shell.js';
import { EmptyState } from './components/EmptyState.js';
import { ErrorPanel } from './components/ErrorPanel.js';
import { useKeymap, matchDown, matchEnter, matchEscape, matchInputKey, matchUp } from './hooks/useKeymap.js';
import { theme } from './theme.js';
import { InboxPreviewVm, InboxRowVm } from '../view-models/inbox-vm.js';
import { ThreadViewModel } from '../view-models/thread-vm.js';
import { ThreadScreen } from './thread-screen.js';

type InboxScreenProps = {
  limit: number;
  loadRows: () => Promise<InboxRowVm[]>;
  loadPreview: (threadId: string) => Promise<InboxPreviewVm>;
  loadThread: (threadId: string) => Promise<ThreadViewModel>;
  regenerateDraft: (threadId: string) => Promise<void>;
  markDone: (threadId: string) => Promise<void>;
  saveDraft: (threadId: string, content: string) => Promise<void>;
  onExit: () => void;
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= length) {
    return length - 1;
  }

  return index;
}

export function InboxScreen({
  limit,
  loadRows,
  loadPreview,
  loadThread,
  regenerateDraft,
  markDone,
  saveDraft,
  onExit,
}: InboxScreenProps): React.JSX.Element {
  const { exit } = useApp();
  const [rows, setRows] = useState<InboxRowVm[]>([]);
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState<InboxPreviewVm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('ready');
  const [showHelp, setShowHelp] = useState(false);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);

  const selectedRow = rows[selected] ?? null;

  const refreshRows = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      const nextRows = await loadRows();
      setRows(nextRows);
      setSelected((prev) => clampIndex(prev, nextRows.length));
      setStatus(`loaded ${nextRows.length} thread(s)`);
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refreshRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRow || openThreadId) {
      setPreview(null);
      return;
    }

    let alive = true;
    setError(null);

    void (async () => {
      try {
        const nextPreview = await loadPreview(selectedRow.id);
        if (alive) {
          setPreview(nextPreview);
        }
      } catch (err) {
        if (alive) {
          setError((err as Error).message);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadPreview, openThreadId, selectedRow]);

  const runAction = async (action: () => Promise<void>, successStatus: string): Promise<void> => {
    if (!selectedRow || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await action();
      await refreshRows();
      setStatus(successStatus);
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  useKeymap([
    {
      id: 'quit',
      match: (input, key) => input === 'q' || matchEscape(input, key),
      enabled: !openThreadId,
      handler: () => {
        onExit();
        exit();
      },
    },
    {
      id: 'help',
      match: matchInputKey('?'),
      enabled: !openThreadId,
      handler: () => setShowHelp((prev) => !prev),
    },
    {
      id: 'down-j',
      match: matchInputKey('j'),
      enabled: !openThreadId,
      handler: () => setSelected((prev) => clampIndex(prev + 1, rows.length)),
    },
    {
      id: 'up-k',
      match: matchInputKey('k'),
      enabled: !openThreadId,
      handler: () => setSelected((prev) => clampIndex(prev - 1, rows.length)),
    },
    {
      id: 'down-arrow',
      match: matchDown,
      enabled: !openThreadId,
      handler: () => setSelected((prev) => clampIndex(prev + 1, rows.length)),
    },
    {
      id: 'up-arrow',
      match: matchUp,
      enabled: !openThreadId,
      handler: () => setSelected((prev) => clampIndex(prev - 1, rows.length)),
    },
    {
      id: 'open-thread',
      match: matchEnter,
      enabled: !openThreadId,
      handler: () => {
        if (selectedRow) {
          setOpenThreadId(selectedRow.id);
        }
      },
    },
    {
      id: 'mark-done',
      match: matchInputKey('d'),
      enabled: !openThreadId,
      handler: () => {
        if (!selectedRow) {
          return;
        }

        void runAction(() => markDone(selectedRow.id), `marked ${selectedRow.id.slice(0, 8)} done`);
      },
    },
    {
      id: 'regen',
      match: matchInputKey('r'),
      enabled: !openThreadId,
      handler: () => {
        if (!selectedRow) {
          return;
        }

        void runAction(() => regenerateDraft(selectedRow.id), `regenerated ${selectedRow.id.slice(0, 8)} draft`);
      },
    },
    {
      id: 'refresh',
      match: matchInputKey('R'),
      enabled: !openThreadId,
      handler: () => {
        void refreshRows();
      },
    },
  ]);

  const rowsView = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }

    return rows.map((row, index) => {
      const selectedMarker = index === selected ? '>' : ' ';
      const draftBadge = row.hasDraft ? 'draft' : 'none';
      const line = `${selectedMarker} ${row.sender.padEnd(26)} ${row.relativeTime.padEnd(8)} ${draftBadge.padEnd(6)} ${row.subject}`;
      return (
        <Text key={row.id} color={index === selected ? theme.colors.brand : undefined}>
          {line}
        </Text>
      );
    });
  }, [rows, selected]);

  if (openThreadId) {
    return (
      <ThreadScreen
        threadId={openThreadId}
        loadThread={loadThread}
        regenerateDraft={regenerateDraft}
        markDone={markDone}
        saveDraft={saveDraft}
        onBack={() => {
          setOpenThreadId(null);
          void refreshRows();
        }}
      />
    );
  }

  return (
    <AppShell
      title="Inbox Triage"
      statusLeft={busy ? 'busy' : status}
      statusRight={`limit ${limit} | j/k move | enter open | r regen | d done | q quit | ? help`}
      hint="Triage here, then send final emails from your main email client."
    >
      {showHelp ? (
        <Box marginBottom={1} flexDirection="column">
          <Text color={theme.colors.muted}>help</Text>
          <Text>j/k or arrows move · enter open thread · r regenerate · d mark done · R refresh · q quit</Text>
        </Box>
      ) : null}

      {error ? <ErrorPanel message={error} /> : null}

      <Box>
        <Box flexDirection="column" width="56%" marginRight={2}>
          <Text color={theme.colors.brand}>latest threads</Text>
          {rowsView ?? <EmptyState title="no threads need reply" subtitle="run sync or check rules" />}
        </Box>

        <Box flexDirection="column" width="44%">
          <Text color={theme.colors.accent}>preview</Text>
          {selectedRow && preview ? (
            <Box flexDirection="column">
              <Text color={theme.colors.muted}>thread {selectedRow.id.slice(0, 8)}</Text>
              <Text>inbound: {preview.latestInboundSnippet || '(empty)'}</Text>
              <Text>draft: {preview.draftSnippet || '(empty)'}</Text>
            </Box>
          ) : (
            <EmptyState title="select a thread" subtitle="preview appears here" />
          )}
        </Box>
      </Box>
    </AppShell>
  );
}
