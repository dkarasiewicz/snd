import { Injectable } from '@nestjs/common';
import { DraftAgentService } from '../agent/draft-agent.service.js';
import { ConfigService } from '../config/config.service.js';
import { withRetry } from './retry.js';
import { snippet } from '../imap/threading.js';
import { MemoryService } from '../memory/memory.service.js';
import { RuleEngineService } from '../rules/rule-engine.service.js';
import { DatabaseService } from '../storage/database.service.js';

@Injectable()
export class ThreadService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly ruleEngineService: RuleEngineService,
    private readonly memoryService: MemoryService,
    private readonly draftAgentService: DraftAgentService,
  ) {}

  getThreadView(threadId: string): {
    thread: ReturnType<DatabaseService['getThread']>;
    messages: ReturnType<DatabaseService['getMessagesForThread']>;
    draft: ReturnType<DatabaseService['getDraft']>;
  } {
    const thread = this.databaseService.getThread(threadId);
    const messages = this.databaseService.getMessagesForThread(threadId);
    const draft = this.databaseService.getDraft(threadId);

    return {
      thread,
      messages,
      draft,
    };
  }

  async regenerateDraft(threadId: string, instruction?: string): Promise<string> {
    const thread = this.databaseService.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const messages = this.databaseService.getMessagesForThread(threadId);
    if (messages.length === 0) {
      throw new Error(`Thread ${threadId} has no messages`);
    }

    const config = this.configService.load();
    const dbRules = this.databaseService.listRules();
    const sender = messages[messages.length - 1]?.fromAddress ?? '';
    const vibe = this.ruleEngineService.resolveVibe({
      sender,
      config,
      dbRules,
    });

    const result = await withRetry(
      () =>
        this.draftAgentService.generateDraft({
          threadId,
          model: config.llm.model,
          vibe,
          userNotes: this.memoryService.getUserNotes(),
          threadNotes: this.memoryService.getThreadNotes(threadId),
          messages,
          instruction,
        }),
      {
        label: `llm:thread:${threadId}`,
        attempts: 3,
        baseDelayMs: 500,
      },
    );

    this.databaseService.upsertDraft({
      threadId,
      content: result.content,
      status: 'drafted',
      model: result.model,
    });
    this.databaseService.setThreadNeedsReply(threadId, true);
    const draftSnippet = snippet(result.content, 280);
    this.memoryService.rememberDraftPattern(threadId, draftSnippet);
    this.databaseService.setThreadSummary(threadId, draftSnippet);

    return result.content;
  }

  saveEditedDraft(threadId: string, content: string): void {
    const thread = this.databaseService.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    const existing = this.databaseService.getDraft(threadId);
    const config = this.configService.load();

    this.databaseService.upsertDraft({
      threadId,
      content,
      status: 'edited',
      model: existing?.model ?? config.llm.model,
    });

    this.databaseService.setThreadSummary(threadId, snippet(content, 280));
    this.memoryService.learnFromEdit(threadId, content);
  }

  markDone(threadId: string): void {
    this.databaseService.setThreadNeedsReply(threadId, false);
  }
}
