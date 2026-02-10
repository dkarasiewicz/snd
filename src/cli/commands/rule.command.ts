import { Command, CommandRunner, Option } from 'nest-commander';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../../storage/database.service.js';

type RuleOptions = {
  addIgnoreSender?: string;
  addIgnoreDomain?: string;
  addStyle?: string;
  list?: boolean;
};

@Command({
  name: 'rule',
  description: 'Manage hard rules (ignore/style)',
})
export class RuleCommand extends CommandRunner {
  constructor(private readonly databaseService: DatabaseService) {
    super();
  }

  override async run(_params: string[], options?: RuleOptions): Promise<void> {
    if (options?.list) {
      const rules = this.databaseService.listRules();
      if (rules.length === 0) {
        process.stdout.write('no rules\n');
        return;
      }

      for (const rule of rules) {
        process.stdout.write(`${rule.id} | ${rule.kind} | ${rule.pattern} -> ${rule.value}\n`);
      }
      return;
    }

    if (options?.addIgnoreSender) {
      this.databaseService.upsertRule({
        id: randomUUID(),
        kind: 'ignore_sender',
        scope: 'global',
        pattern: options.addIgnoreSender.toLowerCase(),
        value: 'true',
        enabled: true,
      });
      process.stdout.write(`added ignore_sender rule for ${options.addIgnoreSender}\n`);
      return;
    }

    if (options?.addIgnoreDomain) {
      this.databaseService.upsertRule({
        id: randomUUID(),
        kind: 'ignore_domain',
        scope: 'global',
        pattern: options.addIgnoreDomain.toLowerCase(),
        value: 'true',
        enabled: true,
      });
      process.stdout.write(`added ignore_domain rule for ${options.addIgnoreDomain}\n`);
      return;
    }

    if (options?.addStyle) {
      const [pattern, ...vibeTokens] = options.addStyle.split(':');
      const vibe = vibeTokens.join(':').trim();
      if (!pattern || !vibe) {
        throw new Error('--add-style format: pattern:vibe');
      }

      this.databaseService.upsertRule({
        id: randomUUID(),
        kind: 'style',
        scope: 'global',
        pattern: pattern.toLowerCase(),
        value: vibe,
        enabled: true,
      });
      process.stdout.write(`added style rule ${pattern} -> ${vibe}\n`);
      return;
    }

    process.stdout.write('Use --list or one add option\n');
  }

  @Option({ flags: '--list', description: 'List rules' })
  parseList(): boolean {
    return true;
  }

  @Option({ flags: '--add-ignore-sender [emailOrPattern]', description: 'Ignore sender address/pattern' })
  parseAddIgnoreSender(value: string): string {
    return value;
  }

  @Option({ flags: '--add-ignore-domain [domain]', description: 'Ignore sender domain' })
  parseAddIgnoreDomain(value: string): string {
    return value;
  }

  @Option({ flags: '--add-style [pattern:vibe]', description: 'Set vibe for sender pattern' })
  parseAddStyle(value: string): string {
    return value;
  }
}
