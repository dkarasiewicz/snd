import { SyncRunStats } from '../core/sync.service.js';
import { ResolvedUiMode } from './ui-mode.js';

function color(text: string, code: number, enabled: boolean): string {
  return enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}

function bold(text: string, enabled: boolean): string {
  return color(text, 1, enabled);
}

function cyan(text: string, enabled: boolean): string {
  return color(text, 36, enabled);
}

function green(text: string, enabled: boolean): string {
  return color(text, 32, enabled);
}

function yellow(text: string, enabled: boolean): string {
  return color(text, 33, enabled);
}

function red(text: string, enabled: boolean): string {
  return color(text, 31, enabled);
}

function padRight(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }

  return `${value}${' '.repeat(width - value.length)}`;
}

export function renderRunCycleStart(mode: ResolvedUiMode, accountId?: string): string {
  const rich = mode === 'rich';
  const now = new Date().toISOString();
  const target = accountId ? ` account=${accountId}` : '';
  const label = `${now} sync starting${target}`;
  return rich ? cyan(`>> ${label}`, true) : label;
}

export function renderRunCycleStats(mode: ResolvedUiMode, stats: SyncRunStats[], durationMs: number): string {
  const rich = mode === 'rich';
  const lines: string[] = [];
  const title = `sync done in ${durationMs}ms`;
  lines.push(rich ? green(`>> ${title}`, true) : title);

  const header = [
    padRight('account', 14),
    padRight('fetched', 8),
    padRight('imported', 9),
    padRight('drafted', 8),
    padRight('ignored', 8),
  ].join(' ');

  lines.push(rich ? bold(header, true) : header);

  for (const row of stats) {
    lines.push([
      padRight(row.accountId, 14),
      padRight(String(row.fetched), 8),
      padRight(String(row.imported), 9),
      padRight(String(row.drafted), 8),
      padRight(String(row.ignored), 8),
    ].join(' '));
  }

  return lines.join('\n');
}

export function renderRunCycleError(mode: ResolvedUiMode, error: Error): string {
  const rich = mode === 'rich';
  const line = `sync failed: ${error.message}`;
  return rich ? red(`>> ${line}`, true) : line;
}

export function renderRunCycleSkip(mode: ResolvedUiMode): string {
  const rich = mode === 'rich';
  const line = 'previous sync still running, tick skipped';
  return rich ? yellow(`>> ${line}`, true) : line;
}

export function renderStop(mode: ResolvedUiMode): string {
  const rich = mode === 'rich';
  return rich ? cyan('>> bye', true) : 'bye';
}

export function renderInboxHeader(mode: ResolvedUiMode, count: number): string {
  const rich = mode === 'rich';
  const label = `threads needing reply: ${count}`;
  return rich ? cyan(`>> ${label}`, true) : label;
}

export function renderInboxRow(
  mode: ResolvedUiMode,
  row: { id: string; lastMessageAt: number; lastSender: string; subject: string; summary: string | null },
): string {
  const rich = mode === 'rich';
  const ts = new Date(row.lastMessageAt).toISOString();
  const subject = row.subject || '(no subject)';
  const base = `${padRight(row.id, 36)} ${ts} ${padRight(row.lastSender, 28)} ${subject}`;
  if (!row.summary) {
    return base;
  }

  const summary = rich ? yellow(`  draft: ${row.summary}`, true) : `  draft: ${row.summary}`;
  return `${base}\n${summary}`;
}

export function renderThreadHeader(
  mode: ResolvedUiMode,
  thread: { subject: string; lastSender: string; needsReply: boolean },
): string {
  const rich = mode === 'rich';
  const lines = [
    `thread: ${thread.subject}`,
    `from: ${thread.lastSender}`,
    `needs_reply: ${thread.needsReply}`,
  ];

  if (rich) {
    return lines.map((line, index) => (index === 0 ? bold(line, true) : line)).join('\n');
  }

  return lines.join('\n');
}
