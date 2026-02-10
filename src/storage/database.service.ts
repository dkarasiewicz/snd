import Database from 'better-sqlite3';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ensureSndHome, SND_DB_PATH } from '../core/paths.js';
import { makeMessageIdCandidates, normalizeMessageId } from '../imap/message-id.js';
import { DraftRecord, MemoryNote, MessageRecord, RuleRecord, SyncState, ThreadRecord } from './types.js';

function parseJsonArray(input: string | null): string[] {
  if (!input) {
    return [];
  }

  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((entry) => String(entry));
  } catch {
    return [];
  }
}

function padCandidates(candidates: string[]): [string, string, string] {
  const base = candidates[0] ?? '';
  return [candidates[0] ?? base, candidates[1] ?? base, candidates[2] ?? base];
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private db: Database.Database;

  constructor() {
    ensureSndHome();
    this.db = new Database(SND_DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  onModuleDestroy(): void {
    this.db.close();
  }

  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        secure INTEGER NOT NULL,
        username TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        account_id TEXT PRIMARY KEY,
        last_uid INTEGER NOT NULL DEFAULT 0,
        last_sync_at INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        thread_key TEXT NOT NULL,
        subject TEXT NOT NULL,
        participants TEXT NOT NULL,
        last_message_at INTEGER NOT NULL,
        last_sender TEXT NOT NULL,
        needs_reply INTEGER NOT NULL DEFAULT 1,
        summary TEXT,
        updated_at INTEGER NOT NULL,
        UNIQUE(account_id, thread_key)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        uid INTEGER NOT NULL,
        message_id TEXT NOT NULL,
        in_reply_to TEXT,
        subject TEXT NOT NULL,
        from_address TEXT NOT NULL,
        from_name TEXT NOT NULL,
        to_addresses TEXT NOT NULL,
        cc_addresses TEXT NOT NULL,
        body_text TEXT NOT NULL,
        sent_at INTEGER NOT NULL,
        raw_headers TEXT NOT NULL,
        UNIQUE(account_id, message_id)
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        model TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        scope TEXT NOT NULL,
        pattern TEXT NOT NULL,
        value TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS memory_notes (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(scope, key)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_messages_account_message_id ON messages(account_id, message_id);
      CREATE INDEX IF NOT EXISTS idx_threads_needs_reply ON threads(needs_reply, last_message_at);
    `);

    this.migrateLegacyMessageUniq();
  }

  private migrateLegacyMessageUniq(): void {
    const row = this.db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'messages'")
      .get() as { sql?: string } | undefined;

    const sql = row?.sql ?? '';
    if (!sql.includes('message_id TEXT NOT NULL UNIQUE')) {
      return;
    }

    const txn = this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS messages_new (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          thread_id TEXT NOT NULL,
          uid INTEGER NOT NULL,
          message_id TEXT NOT NULL,
          in_reply_to TEXT,
          subject TEXT NOT NULL,
          from_address TEXT NOT NULL,
          from_name TEXT NOT NULL,
          to_addresses TEXT NOT NULL,
          cc_addresses TEXT NOT NULL,
          body_text TEXT NOT NULL,
          sent_at INTEGER NOT NULL,
          raw_headers TEXT NOT NULL,
          UNIQUE(account_id, message_id)
        );

        INSERT OR IGNORE INTO messages_new (
          id, account_id, thread_id, uid, message_id, in_reply_to,
          subject, from_address, from_name, to_addresses, cc_addresses,
          body_text, sent_at, raw_headers
        )
        SELECT
          id, account_id, thread_id, uid, message_id, in_reply_to,
          subject, from_address, from_name, to_addresses, cc_addresses,
          body_text, sent_at, raw_headers
        FROM messages;

        DROP TABLE messages;
        ALTER TABLE messages_new RENAME TO messages;
      `);
    });

    txn();
  }

  upsertAccount(params: {
    id: string;
    email: string;
    provider: string;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    auth: string;
  }): void {
    const now = Date.now();

    this.db
      .prepare(
        `
      INSERT INTO accounts (id, email, provider, host, port, secure, username, auth, created_at)
      VALUES (@id, @email, @provider, @host, @port, @secure, @username, @auth, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        provider = excluded.provider,
        host = excluded.host,
        port = excluded.port,
        secure = excluded.secure,
        username = excluded.username,
        auth = excluded.auth
    `,
      )
      .run({
        ...params,
        secure: params.secure ? 1 : 0,
        createdAt: now,
      });
  }

  getSyncState(accountId: string): SyncState {
    const row = this.db
      .prepare('SELECT account_id, last_uid, last_sync_at FROM sync_state WHERE account_id = ?')
      .get(accountId) as { account_id: string; last_uid: number; last_sync_at: number } | undefined;

    if (!row) {
      return {
        accountId,
        lastUid: 0,
        lastSyncAt: 0,
      };
    }

    return {
      accountId: row.account_id,
      lastUid: row.last_uid,
      lastSyncAt: row.last_sync_at,
    };
  }

  upsertSyncState(syncState: SyncState): void {
    this.db
      .prepare(
        `
      INSERT INTO sync_state (account_id, last_uid, last_sync_at)
      VALUES (@accountId, @lastUid, @lastSyncAt)
      ON CONFLICT(account_id) DO UPDATE SET
        last_uid = excluded.last_uid,
        last_sync_at = excluded.last_sync_at
    `,
      )
      .run(syncState);
  }

  findThreadByKey(accountId: string, threadKey: string): ThreadRecord | null {
    const row = this.db
      .prepare(
        `
      SELECT id, account_id, thread_key, subject, participants, last_message_at, last_sender, needs_reply, summary, updated_at
      FROM threads
      WHERE account_id = ? AND thread_key = ?
    `,
      )
      .get(accountId, threadKey) as
      | {
          id: string;
          account_id: string;
          thread_key: string;
          subject: string;
          participants: string;
          last_message_at: number;
          last_sender: string;
          needs_reply: number;
          summary: string | null;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      accountId: row.account_id,
      threadKey: row.thread_key,
      subject: row.subject,
      participants: parseJsonArray(row.participants),
      lastMessageAt: row.last_message_at,
      lastSender: row.last_sender,
      needsReply: row.needs_reply === 1,
      summary: row.summary,
      updatedAt: row.updated_at,
    };
  }

  upsertThread(input: Omit<ThreadRecord, 'id' | 'updatedAt'> & { id?: string }): ThreadRecord {
    const existing = this.findThreadByKey(input.accountId, input.threadKey);
    const now = Date.now();
    const id = existing?.id ?? input.id ?? randomUUID();

    this.db
      .prepare(
        `
      INSERT INTO threads (id, account_id, thread_key, subject, participants, last_message_at, last_sender, needs_reply, summary, updated_at)
      VALUES (@id, @accountId, @threadKey, @subject, @participants, @lastMessageAt, @lastSender, @needsReply, @summary, @updatedAt)
      ON CONFLICT(account_id, thread_key) DO UPDATE SET
        subject = excluded.subject,
        participants = excluded.participants,
        last_message_at = excluded.last_message_at,
        last_sender = excluded.last_sender,
        needs_reply = excluded.needs_reply,
        summary = excluded.summary,
        updated_at = excluded.updated_at
    `,
      )
      .run({
        id,
        accountId: input.accountId,
        threadKey: input.threadKey,
        subject: input.subject,
        participants: JSON.stringify(input.participants),
        lastMessageAt: input.lastMessageAt,
        lastSender: input.lastSender,
        needsReply: input.needsReply ? 1 : 0,
        summary: input.summary,
        updatedAt: now,
      });

    return {
      id,
      accountId: input.accountId,
      threadKey: input.threadKey,
      subject: input.subject,
      participants: input.participants,
      lastMessageAt: input.lastMessageAt,
      lastSender: input.lastSender,
      needsReply: input.needsReply,
      summary: input.summary,
      updatedAt: now,
    };
  }

  hasMessage(accountId: string, messageId: string): boolean {
    const candidates = makeMessageIdCandidates(messageId);
    if (candidates.length === 0) {
      return false;
    }
    const [candidateA, candidateB, candidateC] = padCandidates(candidates);
    const row = this.db
      .prepare(
        `
      SELECT 1 as ok
      FROM messages
      WHERE account_id = ?
        AND (
          message_id = ?
          OR message_id = ?
          OR message_id = ?
          OR lower(replace(replace(message_id, '<', ''), '>', '')) = ?
        )
      LIMIT 1
    `,
      )
      .get(accountId, candidateA, candidateB, candidateC, normalizeMessageId(messageId)) as
      | { ok: number }
      | undefined;

    return Boolean(row?.ok);
  }

  findThreadByMessageReference(accountId: string, reference: string): ThreadRecord | null {
    const candidates = makeMessageIdCandidates(reference);
    if (candidates.length === 0) {
      return null;
    }
    const [candidateA, candidateB, candidateC] = padCandidates(candidates);
    const normalizedRef = normalizeMessageId(reference);
    const row = this.db
      .prepare(
        `
      SELECT t.id, t.account_id, t.thread_key, t.subject, t.participants, t.last_message_at, t.last_sender, t.needs_reply, t.summary, t.updated_at
      FROM messages m
      JOIN threads t ON t.id = m.thread_id
      WHERE m.account_id = ?
        AND (
          m.message_id = ?
          OR m.message_id = ?
          OR m.message_id = ?
          OR lower(replace(replace(m.message_id, '<', ''), '>', '')) = ?
        )
      ORDER BY m.sent_at DESC
      LIMIT 1
    `,
      )
      .get(accountId, candidateA, candidateB, candidateC, normalizedRef) as
      | {
          id: string;
          account_id: string;
          thread_key: string;
          subject: string;
          participants: string;
          last_message_at: number;
          last_sender: string;
          needs_reply: number;
          summary: string | null;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      accountId: row.account_id,
      threadKey: row.thread_key,
      subject: row.subject,
      participants: parseJsonArray(row.participants),
      lastMessageAt: row.last_message_at,
      lastSender: row.last_sender,
      needsReply: row.needs_reply === 1,
      summary: row.summary,
      updatedAt: row.updated_at,
    };
  }

  insertMessage(message: MessageRecord): void {
    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO messages (
        id, account_id, thread_id, uid, message_id, in_reply_to,
        subject, from_address, from_name, to_addresses, cc_addresses,
        body_text, sent_at, raw_headers
      ) VALUES (
        @id, @accountId, @threadId, @uid, @messageId, @inReplyTo,
        @subject, @fromAddress, @fromName, @toAddresses, @ccAddresses,
        @bodyText, @sentAt, @rawHeaders
      )
    `,
      )
      .run({
        ...message,
        toAddresses: JSON.stringify(message.toAddresses),
        ccAddresses: JSON.stringify(message.ccAddresses),
      });
  }

  getMessagesForThread(threadId: string): MessageRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT
        id, account_id, thread_id, uid, message_id, in_reply_to,
        subject, from_address, from_name, to_addresses, cc_addresses,
        body_text, sent_at, raw_headers
      FROM messages
      WHERE thread_id = ?
      ORDER BY sent_at ASC
    `,
      )
      .all(threadId) as Array<{
      id: string;
      account_id: string;
      thread_id: string;
      uid: number;
      message_id: string;
      in_reply_to: string | null;
      subject: string;
      from_address: string;
      from_name: string;
      to_addresses: string;
      cc_addresses: string;
      body_text: string;
      sent_at: number;
      raw_headers: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      threadId: row.thread_id,
      uid: row.uid,
      messageId: row.message_id,
      inReplyTo: row.in_reply_to,
      subject: row.subject,
      fromAddress: row.from_address,
      fromName: row.from_name,
      toAddresses: parseJsonArray(row.to_addresses),
      ccAddresses: parseJsonArray(row.cc_addresses),
      bodyText: row.body_text,
      sentAt: row.sent_at,
      rawHeaders: row.raw_headers,
    }));
  }

  listInboxNeedsReply(limit = 25): ThreadRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, account_id, thread_key, subject, participants, last_message_at, last_sender, needs_reply, summary, updated_at
      FROM threads
      WHERE needs_reply = 1
      ORDER BY last_message_at DESC
      LIMIT ?
    `,
      )
      .all(limit) as Array<{
      id: string;
      account_id: string;
      thread_key: string;
      subject: string;
      participants: string;
      last_message_at: number;
      last_sender: string;
      needs_reply: number;
      summary: string | null;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      threadKey: row.thread_key,
      subject: row.subject,
      participants: parseJsonArray(row.participants),
      lastMessageAt: row.last_message_at,
      lastSender: row.last_sender,
      needsReply: row.needs_reply === 1,
      summary: row.summary,
      updatedAt: row.updated_at,
    }));
  }

  getThread(threadId: string): ThreadRecord | null {
    const row = this.db
      .prepare(
        `
      SELECT id, account_id, thread_key, subject, participants, last_message_at, last_sender, needs_reply, summary, updated_at
      FROM threads
      WHERE id = ?
      LIMIT 1
    `,
      )
      .get(threadId) as
      | {
          id: string;
          account_id: string;
          thread_key: string;
          subject: string;
          participants: string;
          last_message_at: number;
          last_sender: string;
          needs_reply: number;
          summary: string | null;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      accountId: row.account_id,
      threadKey: row.thread_key,
      subject: row.subject,
      participants: parseJsonArray(row.participants),
      lastMessageAt: row.last_message_at,
      lastSender: row.last_sender,
      needsReply: row.needs_reply === 1,
      summary: row.summary,
      updatedAt: row.updated_at,
    };
  }

  getDraft(threadId: string): DraftRecord | null {
    const row = this.db
      .prepare('SELECT id, thread_id, content, status, updated_at, model FROM drafts WHERE thread_id = ? LIMIT 1')
      .get(threadId) as
      | {
          id: string;
          thread_id: string;
          content: string;
          status: 'drafted' | 'edited' | 'skipped';
          updated_at: number;
          model: string;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      threadId: row.thread_id,
      content: row.content,
      status: row.status,
      updatedAt: row.updated_at,
      model: row.model,
    };
  }

  upsertDraft(input: Omit<DraftRecord, 'id' | 'updatedAt'> & { id?: string }): DraftRecord {
    const existing = this.getDraft(input.threadId);
    const now = Date.now();
    const id = existing?.id ?? input.id ?? randomUUID();

    this.db
      .prepare(
        `
      INSERT INTO drafts (id, thread_id, content, status, updated_at, model)
      VALUES (@id, @threadId, @content, @status, @updatedAt, @model)
      ON CONFLICT(thread_id) DO UPDATE SET
        content = excluded.content,
        status = excluded.status,
        updated_at = excluded.updated_at,
        model = excluded.model
    `,
      )
      .run({
        id,
        threadId: input.threadId,
        content: input.content,
        status: input.status,
        updatedAt: now,
        model: input.model,
      });

    return {
      id,
      threadId: input.threadId,
      content: input.content,
      status: input.status,
      updatedAt: now,
      model: input.model,
    };
  }

  setThreadNeedsReply(threadId: string, needsReply: boolean): void {
    this.db
      .prepare('UPDATE threads SET needs_reply = ?, updated_at = ? WHERE id = ?')
      .run(needsReply ? 1 : 0, Date.now(), threadId);
  }

  setThreadSummary(threadId: string, summary: string | null): void {
    this.db
      .prepare('UPDATE threads SET summary = ?, updated_at = ? WHERE id = ?')
      .run(summary, Date.now(), threadId);
  }

  listRules(): RuleRecord[] {
    const rows = this.db
      .prepare('SELECT id, kind, scope, pattern, value, enabled FROM rules WHERE enabled = 1')
      .all() as Array<{
      id: string;
      kind: RuleRecord['kind'];
      scope: string;
      pattern: string;
      value: string;
      enabled: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      scope: row.scope,
      pattern: row.pattern,
      value: row.value,
      enabled: row.enabled === 1,
    }));
  }

  upsertRule(rule: Omit<RuleRecord, 'id'> & { id?: string }): RuleRecord {
    const id = rule.id ?? randomUUID();

    this.db
      .prepare(
        `
      INSERT INTO rules (id, kind, scope, pattern, value, enabled)
      VALUES (@id, @kind, @scope, @pattern, @value, @enabled)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        scope = excluded.scope,
        pattern = excluded.pattern,
        value = excluded.value,
        enabled = excluded.enabled
    `,
      )
      .run({
        id,
        kind: rule.kind,
        scope: rule.scope,
        pattern: rule.pattern,
        value: rule.value,
        enabled: rule.enabled ? 1 : 0,
      });

    return {
      id,
      kind: rule.kind,
      scope: rule.scope,
      pattern: rule.pattern,
      value: rule.value,
      enabled: rule.enabled,
    };
  }

  upsertMemoryNote(note: Omit<MemoryNote, 'id' | 'updatedAt'> & { id?: string }): MemoryNote {
    const existing = this.getMemoryNote(note.scope, note.key);
    const id = note.id ?? existing?.id ?? randomUUID();
    const updatedAt = Date.now();

    this.db
      .prepare(
        `
      INSERT INTO memory_notes (id, scope, key, value, updated_at)
      VALUES (@id, @scope, @key, @value, @updatedAt)
      ON CONFLICT(scope, key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
      )
      .run({
        id,
        scope: note.scope,
        key: note.key,
        value: note.value,
        updatedAt,
      });

    return {
      id,
      scope: note.scope,
      key: note.key,
      value: note.value,
      updatedAt,
    };
  }

  getMemoryNote(scope: MemoryNote['scope'], key: string): MemoryNote | null {
    const row = this.db
      .prepare('SELECT id, scope, key, value, updated_at FROM memory_notes WHERE scope = ? AND key = ? LIMIT 1')
      .get(scope, key) as
      | {
          id: string;
          scope: MemoryNote['scope'];
          key: string;
          value: string;
          updated_at: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      scope: row.scope,
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
    };
  }

  listMemory(scope: MemoryNote['scope']): MemoryNote[] {
    const rows = this.db
      .prepare('SELECT id, scope, key, value, updated_at FROM memory_notes WHERE scope = ? ORDER BY updated_at DESC')
      .all(scope) as Array<{
      id: string;
      scope: MemoryNote['scope'];
      key: string;
      value: string;
      updated_at: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      scope: row.scope,
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
    }));
  }
}
