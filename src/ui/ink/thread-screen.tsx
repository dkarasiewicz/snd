import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { AppShell } from './app-shell.js';
import { ErrorPanel } from './components/ErrorPanel.js';
import { EmptyState } from './components/EmptyState.js';
import { useKeymap, matchEscape, matchInputKey } from './hooks/useKeymap.js';
import { ThreadViewModel } from '../view-models/thread-vm.js';
import { theme } from './theme.js';

type ThreadScreenProps = {
  threadId: string;
  loadThread: (threadId: string) => Promise<ThreadViewModel>;
  regenerateDraft: (threadId: string) => Promise<void>;
  markDone: (threadId: string) => Promise<void>;
  saveDraft: (threadId: string, content: string) => Promise<void>;
  onBack: () => void;
};

export function ThreadScreen({
  threadId,
  loadThread,
  regenerateDraft,
  markDone,
  saveDraft,
  onBack,
}: ThreadScreenProps): React.JSX.Element {
  const [view, setView] = useState<ThreadViewModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('ready');
  const [showHelp, setShowHelp] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');

  const refresh = async (): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      const next = await loadThread(threadId);
      setView(next);
      if (!editing) {
        setEditBuffer(next.draft || '');
      }
      setStatus('ready');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const runBusyAction = async (action: () => Promise<void>, successMessage: string): Promise<void> => {
    if (busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await action();
      setStatus(successMessage);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  useKeymap([
    { id: 'help', match: matchInputKey('?'), handler: () => setShowHelp((prev) => !prev), enabled: !editing },
    {
      id: 'regen',
      match: matchInputKey('r'),
      enabled: !editing,
      handler: () => {
        void runBusyAction(() => regenerateDraft(threadId), 'draft regenerated');
      },
    },
    {
      id: 'done',
      match: matchInputKey('d'),
      enabled: !editing,
      handler: () => {
        void runBusyAction(() => markDone(threadId), 'thread marked done');
      },
    },
    {
      id: 'edit',
      match: matchInputKey('e'),
      enabled: !editing,
      handler: () => {
        setEditing(true);
        setStatus('edit mode');
      },
    },
    {
      id: 'back',
      match: (input, key) => input === 'q' || matchEscape(input, key),
      enabled: !editing,
      handler: () => onBack(),
    },
  ]);

  useInput((input, key) => {
    if (!editing) {
      return;
    }

    if (key.ctrl && input.toLowerCase() === 's') {
      void runBusyAction(async () => {
        await saveDraft(threadId, editBuffer.trim());
      }, 'draft saved');
      setEditing(false);
      return;
    }

    if (key.escape) {
      setEditing(false);
      setStatus('edit canceled');
      if (view) {
        setEditBuffer(view.draft || '');
      }
      return;
    }

    if (key.return) {
      setEditBuffer((prev) => `${prev}\n`);
      return;
    }

    if (key.backspace || key.delete) {
      setEditBuffer((prev) => prev.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setEditBuffer((prev) => prev + input);
    }
  });

  return (
    <AppShell
      title={`Thread ${threadId.slice(0, 8)}`}
      statusLeft={busy ? 'busy' : status}
      statusRight={editing ? 'ctrl+s save | esc cancel' : 'e edit | r regen | d done | q back | ? help'}
      hint="Drafts are suggestions. Final send happens in your email client."
    >
      {showHelp ? (
        <Box marginBottom={1} flexDirection="column">
          <Text color={theme.colors.muted}>help</Text>
          <Text>e edit draft | r regenerate | d mark done | q back | ? toggle help</Text>
          <Text>edit mode: type text, enter=new line, ctrl+s save, esc cancel</Text>
        </Box>
      ) : null}

      {error ? <ErrorPanel message={error} /> : null}

      {!view ? (
        <EmptyState title="loading thread..." />
      ) : (
        <Box flexDirection="column">
          <Text bold>{view.subject}</Text>
          <Text color={theme.colors.muted}>
            from {view.sender} | needs_reply: {String(view.needsReply)}
          </Text>

          <Box marginTop={1} flexDirection="column">
            <Text color={theme.colors.brand}>messages</Text>
            {view.messages.length === 0 ? (
              <Text color={theme.colors.muted}>(no messages)</Text>
            ) : (
              view.messages.map((message, index) => (
                <Box key={`${message.from}-${index}`} flexDirection="column" marginBottom={1}>
                  <Text color={theme.colors.muted}>
                    {message.from} · {message.at}
                  </Text>
                  <Text>{message.body}</Text>
                </Box>
              ))
            )}
          </Box>

          <Box marginTop={1} flexDirection="column">
            <Text color={theme.colors.accent}>draft</Text>
            {editing ? (
              <Box borderStyle="single" borderColor={theme.colors.brand} paddingX={1} flexDirection="column">
                <Text>{editBuffer || '(empty)'}</Text>
              </Box>
            ) : (
              <Box borderStyle="single" borderColor={theme.colors.muted} paddingX={1} flexDirection="column">
                <Text>{view.draft || '(no draft yet)'}</Text>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </AppShell>
  );
}
