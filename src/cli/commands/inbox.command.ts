import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { DatabaseService } from '../../storage/database.service.js';
import { renderInboxHeader, renderInboxRow } from '../../ui/cli-render.js';
import { resolveUiMode } from '../../ui/ui-mode.js';
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
  ) {
    super();
  }

  override async run(_params: string[], options?: InboxOptions): Promise<void> {
    const config = this.configService.load();
    const mode = resolveUiMode(config.ui.mode, options?.ui);
    const rows = this.databaseService.listInboxNeedsReply(options?.limit ?? config.inbox.defaultLimit);

    if (rows.length === 0) {
      process.stdout.write('No threads need reply.\n');
      return;
    }

    process.stdout.write(`${renderInboxHeader(mode, rows.length)}\n`);
    for (const row of rows) {
      process.stdout.write(`${renderInboxRow(mode, row)}\n`);
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
