import { Command, CommandRunner, Option } from 'nest-commander';
import { MemoryService } from '../../memory/memory.service.js';

type MemoryOptions = {
  listUser?: boolean;
  setUser?: string;
};

@Command({
  name: 'memory',
  description: 'Inspect and set user memory notes used during drafting',
})
export class MemoryCommand extends CommandRunner {
  constructor(private readonly memoryService: MemoryService) {
    super();
  }

  override async run(_params: string[], options?: MemoryOptions): Promise<void> {
    if (options?.setUser) {
      const split = options.setUser.indexOf(':');
      if (split < 1) {
        throw new Error('--set-user expects key:value');
      }

      const key = options.setUser.slice(0, split).trim();
      const value = options.setUser.slice(split + 1).trim();
      if (!key || !value) {
        throw new Error('--set-user expects key:value with non-empty values');
      }

      this.memoryService.rememberUserPreference(key, value);
      process.stdout.write(`stored user memory ${key}\n`);
      return;
    }

    if (options?.listUser) {
      const notes = this.memoryService.getUserNotes();
      if (notes.length === 0) {
        process.stdout.write('no user notes\n');
        return;
      }

      for (const note of notes) {
        process.stdout.write(`${note}\n`);
      }
      return;
    }

    process.stdout.write('Use --list-user or --set-user key:value\n');
  }

  @Option({ flags: '--list-user', description: 'List user notes' })
  parseListUser(): boolean {
    return true;
  }

  @Option({ flags: '--set-user [key:value]', description: 'Set user memory note' })
  parseSetUser(value: string): string {
    return value;
  }
}
