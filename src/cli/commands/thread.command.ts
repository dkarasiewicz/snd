import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ConfigService } from '../../config/config.service.js';
import { ThreadService } from '../../core/thread.service.js';
import { renderThreadHeader } from '../../ui/cli-render.js';
import { resolveUiMode } from '../../ui/ui-mode.js';
import { renderThreadRich } from '../../ui/ui-renderer.js';
import { mapThreadView } from '../../ui/view-models/thread-vm.js';
import type { UiMode } from '../../ui/ui-mode.js';

type ThreadOptions = {
  regen?: boolean;
  instruction?: string;
  interactive?: boolean;
  done?: boolean;
  ui?: UiMode;
};

@Command({
  name: 'thread',
  description: 'Inspect and edit a thread draft',
  arguments: '<threadId>',
})
export class ThreadCommand extends CommandRunner {
  constructor(
    private readonly threadService: ThreadService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  override async run(params: string[], options?: ThreadOptions): Promise<void> {
    const threadId = params[0];
    const config = this.configService.load();
    const mode = resolveUiMode(config.ui.mode, options?.ui);
    if (!threadId) {
      throw new Error('threadId is required');
    }

    if (options?.regen) {
      const draft = await this.threadService.regenerateDraft(threadId, options.instruction);
      process.stdout.write(`${draft}\n`);
      return;
    }

    if (options?.done) {
      this.threadService.markDone(threadId);
      process.stdout.write(`thread ${threadId} marked done\n`);
      return;
    }

    if (options?.interactive) {
      await this.runInteractive(threadId, mode);
      return;
    }

    if (mode === 'rich') {
      await renderThreadRich({
        threadId,
        loadThread: async (targetThreadId) => {
          const view = this.threadService.getThreadView(targetThreadId);
          if (!view.thread) {
            throw new Error(`Thread ${targetThreadId} not found`);
          }

          return mapThreadView({
            thread: view.thread,
            messages: view.messages,
            draft: view.draft,
          });
        },
        regenerateDraft: async (targetThreadId) => {
          await this.threadService.regenerateDraft(targetThreadId);
        },
        markDone: async (targetThreadId) => {
          this.threadService.markDone(targetThreadId);
        },
        saveDraft: async (targetThreadId, content) => {
          this.threadService.saveEditedDraft(targetThreadId, content);
        },
      });
      return;
    }

    this.printThread(threadId, mode);
  }

  @Option({ flags: '--regen', description: 'Regenerate draft for this thread' })
  parseRegen(): boolean {
    return true;
  }

  @Option({ flags: '--instruction [text]', description: 'Extra instruction for regeneration' })
  parseInstruction(value: string): string {
    return value;
  }

  @Option({ flags: '--interactive', description: 'Open interactive editor loop' })
  parseInteractive(): boolean {
    return true;
  }

  @Option({ flags: '--done', description: 'Mark thread as does not need reply' })
  parseDone(): boolean {
    return true;
  }

  @Option({ flags: '--ui [mode]', description: 'UI mode: auto, rich, plain' })
  parseUi(value: string): UiMode {
    if (value !== 'auto' && value !== 'rich' && value !== 'plain') {
      throw new Error('--ui must be one of auto, rich, plain');
    }

    return value;
  }

  private printThread(threadId: string, mode: 'rich' | 'plain'): void {
    const view = this.threadService.getThreadView(threadId);
    if (!view.thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    process.stdout.write(`${renderThreadHeader(mode, view.thread)}\n`);
    process.stdout.write('--- messages ---\n');

    for (const message of view.messages.slice(-8)) {
      process.stdout.write(`[${new Date(message.sentAt).toISOString()}] ${message.fromAddress}\n`);
      process.stdout.write(`${message.bodyText}\n\n`);
    }

    process.stdout.write('--- draft ---\n');
    process.stdout.write(`${view.draft?.content ?? '(none)'}\n`);
  }

  private async runInteractive(threadId: string, mode: 'rich' | 'plain'): Promise<void> {
    const rl = readline.createInterface({ input, output });

    try {
      this.printThread(threadId, mode);
      process.stdout.write(
        'interactive commands: :regen [instruction], :set <text>, :append <text>, :setm, :appendm, :done, :show, :quit\n',
      );

      while (true) {
        const line = (await rl.question('snd> ')).trim();

        if (!line) {
          continue;
        }

        if (line === ':quit') {
          break;
        }

        if (line === ':show') {
          this.printThread(threadId, mode);
          continue;
        }

        if (line === ':done') {
          this.threadService.markDone(threadId);
          process.stdout.write('marked done\n');
          continue;
        }

        if (line.startsWith(':regen')) {
          const instruction = line.replace(':regen', '').trim();
          const draft = await this.threadService.regenerateDraft(threadId, instruction || undefined);
          process.stdout.write(`\n${draft}\n\n`);
          continue;
        }

        if (line.startsWith(':set ')) {
          const text = line.slice(':set '.length).trim();
          this.threadService.saveEditedDraft(threadId, text);
          process.stdout.write('draft updated\n');
          continue;
        }

        if (line.startsWith(':append ')) {
          const text = line.slice(':append '.length).trim();
          const current = this.threadService.getThreadView(threadId).draft?.content ?? '';
          const next = [current, text].filter(Boolean).join('\n');
          this.threadService.saveEditedDraft(threadId, next);
          process.stdout.write('draft appended\n');
          continue;
        }

        if (line === ':setm') {
          const text = await this.collectMultiLine(rl, 'set draft');
          this.threadService.saveEditedDraft(threadId, text);
          process.stdout.write('draft replaced\n');
          continue;
        }

        if (line === ':appendm') {
          const current = this.threadService.getThreadView(threadId).draft?.content ?? '';
          const text = await this.collectMultiLine(rl, 'append draft');
          const next = [current, text].filter(Boolean).join('\n');
          this.threadService.saveEditedDraft(threadId, next);
          process.stdout.write('draft appended\n');
          continue;
        }

        process.stdout.write('unknown command\n');
      }
    } finally {
      rl.close();
    }
  }

  private async collectMultiLine(
    rl: readline.Interface,
    label: string,
  ): Promise<string> {
    process.stdout.write(`${label} mode (finish with a single '.' line)\n`);
    const lines: string[] = [];
    while (true) {
      const line = await rl.question('... ');
      if (line.trim() === '.') {
        break;
      }
      lines.push(line);
    }
    return lines.join('\n').trim();
  }
}
