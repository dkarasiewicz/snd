import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DraftAgentService } from '../agent/draft-agent.service.js';
import { ConfigService } from '../config/config.service.js';
import { selectLatestBootstrapThreadKeys } from './bootstrap.js';
import { withRetry } from './retry.js';
import { ImapClientService } from '../imap/imap-client.service.js';
import { cleanEmailBody } from '../imap/body-cleaner.js';
import { deriveThreadKey, hasBodyContent, snippet } from '../imap/threading.js';
import { ImapMessage } from '../imap/types.js';
import { MemoryService } from '../memory/memory.service.js';
import { RuleEngineService } from '../rules/rule-engine.service.js';
import { DatabaseService } from '../storage/database.service.js';

export type SyncRunStats = {
  accountId: string;
  fetched: number;
  imported: number;
  drafted: number;
  ignored: number;
};

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly imapClientService: ImapClientService,
    private readonly ruleEngineService: RuleEngineService,
    private readonly memoryService: MemoryService,
    private readonly draftAgentService: DraftAgentService,
  ) {}

  async runOnce(accountId?: string): Promise<SyncRunStats[]> {
    const config = this.configService.load();
    if (config.accounts.length === 0) {
      throw new Error('No accounts configured. Run `snd init` and add at least one account to config.yaml.');
    }

    const targetAccounts = accountId
      ? config.accounts.filter((account) => account.id === accountId)
      : config.accounts;

    if (targetAccounts.length === 0) {
      throw new Error(`Account ${accountId} not found in config.`);
    }

    const stats: SyncRunStats[] = [];
    for (const account of targetAccounts) {
      this.databaseService.upsertAccount({
        id: account.id,
        email: account.email,
        provider: account.provider,
        host: account.imap.host,
        port: account.imap.port,
        secure: account.imap.secure,
        username: account.imap.username,
        auth: account.imap.auth,
      });

      const syncState = this.databaseService.getSyncState(account.id);
      const isBootstrap = syncState.lastUid === 0;
      const pull = await withRetry(
        () =>
          this.imapClientService.fetchNewMessages(account, syncState.lastUid, {
            bootstrapMessageWindow: isBootstrap ? config.sync.bootstrapMessageWindow : undefined,
          }),
        {
          label: `imap:${account.id}`,
          attempts: 3,
          baseDelayMs: 400,
          logger: this.logger,
        },
      );
      let imported = 0;
      let drafted = 0;
      let ignored = 0;

      const dbRules = this.databaseService.listRules();
      const bootstrapThreadKeys = isBootstrap
        ? selectLatestBootstrapThreadKeys(pull.messages, config.sync.bootstrapThreadLimit)
        : null;

      for (const message of pull.messages) {
        if (bootstrapThreadKeys && !bootstrapThreadKeys.has(deriveThreadKey(message))) {
          continue;
        }

        if (this.databaseService.hasMessage(account.id, message.messageId)) {
          continue;
        }

        const ignore = this.ruleEngineService.shouldIgnoreMessage({
          sender: message.from.address,
          config,
          dbRules,
        });

        if (ignore.ignore) {
          ignored += 1;
          this.logger.debug(`Ignored ${message.messageId}: ${ignore.reason}`);
          continue;
        }

        const thread = this.upsertThreadFromMessage(account.email, account.id, message);
        this.insertMessage(thread.id, account.id, message);
        imported += 1;

        const messages = this.databaseService.getMessagesForThread(thread.id);
        this.memoryService.rememberThreadContext(thread.id, this.buildThreadContextMemory(messages));

        if (!thread.needsReply) {
          continue;
        }

        const vibe = this.ruleEngineService.resolveVibe({
          sender: message.from.address,
          config,
          dbRules,
        });

        if (!this.isInboundRequiringReply(messages, account.email)) {
          this.databaseService.setThreadNeedsReply(thread.id, false);
          continue;
        }

        const draft = await withRetry(
          () =>
            this.draftAgentService.generateDraft({
              threadId: thread.id,
              model: config.llm.model,
              vibe,
              userNotes: this.memoryService.getUserNotes(),
              threadNotes: this.memoryService.getThreadNotes(thread.id),
              messages,
            }),
          {
            label: `llm:${account.id}:${thread.id}`,
            attempts: 3,
            baseDelayMs: 500,
            logger: this.logger,
          },
        );

        this.databaseService.upsertDraft({
          threadId: thread.id,
          content: draft.content,
          model: draft.model,
          status: 'drafted',
        });

        const draftSnippet = snippet(draft.content, 280);
        this.memoryService.rememberDraftPattern(thread.id, draftSnippet);
        this.databaseService.setThreadSummary(thread.id, draftSnippet);
        drafted += 1;
      }

      this.databaseService.upsertSyncState({
        accountId: account.id,
        lastUid: pull.maxUid,
        lastSyncAt: Date.now(),
      });

      stats.push({
        accountId: account.id,
        fetched: pull.messages.length,
        imported,
        drafted,
        ignored,
      });
    }

    return stats;
  }

  private upsertThreadFromMessage(
    accountEmail: string,
    accountId: string,
    message: ImapMessage,
  ): { id: string; needsReply: boolean } {
    const threadKey = this.resolveThreadKey(accountId, message);
    const participants = new Set<string>();
    participants.add(message.from.address);
    for (const address of message.to) {
      participants.add(address.address);
    }
    for (const address of message.cc) {
      participants.add(address.address);
    }

    const isInbound = message.from.address !== accountEmail.toLowerCase();

    const thread = this.databaseService.upsertThread({
      id: randomUUID(),
      accountId,
      threadKey,
      subject: message.subject,
      participants: Array.from(participants).filter(Boolean),
      lastMessageAt: message.sentAt,
      lastSender: message.from.address,
      needsReply: isInbound,
      summary: null,
    });

    return {
      id: thread.id,
      needsReply: thread.needsReply,
    };
  }

  private resolveThreadKey(accountId: string, message: ImapMessage): string {
    const references = [...message.references];
    if (message.inReplyTo) {
      references.push(message.inReplyTo);
    }

    for (const reference of references) {
      const linkedThread = this.databaseService.findThreadByMessageReference(accountId, reference);
      if (linkedThread) {
        return linkedThread.threadKey;
      }
    }

    return deriveThreadKey(message);
  }

  private insertMessage(threadId: string, accountId: string, message: ImapMessage): void {
    const normalizedBody = cleanEmailBody(message.text);
    this.databaseService.insertMessage({
      id: randomUUID(),
      accountId,
      threadId,
      uid: message.uid,
      messageId: message.messageId,
      inReplyTo: message.inReplyTo,
      subject: message.subject,
      fromAddress: message.from.address,
      fromName: message.from.name,
      toAddresses: message.to.map((entry) => entry.address),
      ccAddresses: message.cc.map((entry) => entry.address),
      bodyText: hasBodyContent(normalizedBody) ? normalizedBody : '(no text body)',
      sentAt: message.sentAt,
      rawHeaders: message.headers,
    });
  }

  private isInboundRequiringReply(
    messages: Array<{ fromAddress: string; bodyText: string }>,
    accountEmail: string,
  ): boolean {
    if (messages.length === 0) {
      return false;
    }

    const latest = messages[messages.length - 1];
    if (!latest) {
      return false;
    }

    if (latest.fromAddress.toLowerCase() === accountEmail.toLowerCase()) {
      return false;
    }

    const body = latest.bodyText.toLowerCase();
    const noReplySignals = ['fyi', 'no reply needed', 'noreply', 'automated'];

    return !noReplySignals.some((signal) => body.includes(signal));
  }

  private buildThreadContextMemory(
    messages: Array<{ fromAddress: string; sentAt: number; bodyText: string }>,
  ): string {
    const latest = messages.slice(-3);
    if (latest.length === 0) {
      return 'no messages';
    }

    const joined = latest
      .map((message) => {
        const stamp = new Date(message.sentAt).toISOString();
        return `${stamp} ${message.fromAddress}: ${snippet(message.bodyText, 180)}`;
      })
      .join(' | ');

    return `recent thread context: ${joined}`;
  }
}
