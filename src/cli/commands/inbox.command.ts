import { Command, CommandRunner, Option } from 'nest-commander';
import { DatabaseService } from '../../storage/database.service.js';

type InboxOptions = {
  limit?: number;
};

@Command({
  name: 'inbox',
  description: 'Show threads that currently need reply',
})
export class InboxCommand extends CommandRunner {
  constructor(private readonly databaseService: DatabaseService) {
    super();
  }

  override async run(_params: string[], options?: InboxOptions): Promise<void> {
    const rows = this.databaseService.listInboxNeedsReply(options?.limit ?? 25);

    if (rows.length === 0) {
      process.stdout.write('No threads need reply.\n');
      return;
    }

    for (const row of rows) {
      const ts = new Date(row.lastMessageAt).toISOString();
      process.stdout.write(`${row.id} | ${ts} | from=${row.lastSender} | ${row.subject}\n`);
      if (row.summary) {
        process.stdout.write(`  draft: ${row.summary}\n`);
      }
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
}
