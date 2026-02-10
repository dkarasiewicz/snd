import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { ThreadService } from '../../core/thread.service.js';
import { DatabaseService } from '../../storage/database.service.js';
import { resolveUiMode } from '../../ui/ui-mode.js';
import { renderInboxRich, UiRenderer } from '../../ui/ui-renderer.js';
import { mapInboxPreview, mapInboxRows } from '../../ui/view-models/inbox-vm.js';
import { mapThreadView } from '../../ui/view-models/thread-vm.js';
import type { UiMode } from '../../ui/ui-mode.js';

type InboxOptions = {
  limit?: number;
  ui?: UiMode;
};

@Command({
  name: 'inbox',
  description: 'Show threads that currently need reply',
})
export class InboxCommand extends CommandRunner {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly threadService: ThreadService,
  ) {
    super();
  }

  override async run(_params: string[], options?: InboxOptions): Promise<void> {
    const config = this.configService.load();
    const mode = resolveUiMode(config.ui.mode, options?.ui);
    const limit = options?.limit ?? config.inbox.defaultLimit;

    if (mode === 'rich') {
      await renderInboxRich({
        limit,
        loadRows: async () => mapInboxRows(this.databaseService.listInboxNeedsReply(limit)),
        loadPreview: async (threadId) => {
          const view = this.threadService.getThreadView(threadId);
          return mapInboxPreview({
            threadId,
            messages: view.messages,
            draft: view.draft,
          });
        },
        loadThread: async (threadId) => {
          const view = this.threadService.getThreadView(threadId);
          if (!view.thread) {
            throw new Error(`Thread ${threadId} not found`);
          }

          return mapThreadView({
            thread: view.thread,
            messages: view.messages,
            draft: view.draft,
          });
        },
        regenerateDraft: async (threadId) => {
          await this.threadService.regenerateDraft(threadId);
        },
        markDone: async (threadId) => {
          this.threadService.markDone(threadId);
        },
        saveDraft: async (threadId, content) => {
          this.threadService.saveEditedDraft(threadId, content);
        },
      });
      return;
    }

    const rows = this.databaseService.listInboxNeedsReply(limit);

    if (rows.length === 0) {
      process.stdout.write('No threads need reply.\n');
      return;
    }

    process.stdout.write(`${UiRenderer.renderInboxHeader(mode, rows.length)}\n`);
    for (const row of rows) {
      process.stdout.write(`${UiRenderer.renderInboxRow(mode, row)}\n`);
    }
  }

  @Option({ flags: '--limit [n]', description: 'Max number of threads' })
  parseLimit(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new Error('--limit must be an integer > 0');
    }

    return parsed;
  }

  @Option({ flags: '--ui [mode]', description: 'UI mode: auto, rich, plain' })
  parseUi(value: string): UiMode {
    if (value !== 'auto' && value !== 'rich' && value !== 'plain') {
      throw new Error('--ui must be one of auto, rich, plain');
    }

    return value;
  }
}
