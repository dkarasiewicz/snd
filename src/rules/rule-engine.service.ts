import { Injectable } from '@nestjs/common';
import { SndConfig } from '../config/schema.js';
import { RuleRecord } from '../storage/types.js';

@Injectable()
export class RuleEngineService {
  shouldIgnoreMessage(input: {
    sender: string;
    config: SndConfig;
    dbRules: RuleRecord[];
  }): { ignore: boolean; reason?: string } {
    const sender = input.sender.trim().toLowerCase();
    const domain = sender.includes('@') ? sender.split('@').at(1) ?? '' : '';

    if (input.config.rules.ignoreSenders.map((entry) => entry.toLowerCase()).includes(sender)) {
      return { ignore: true, reason: `ignored sender (${sender}) from config` };
    }

    if (domain && input.config.rules.ignoreDomains.map((entry) => entry.toLowerCase()).includes(domain)) {
      return { ignore: true, reason: `ignored domain (${domain}) from config` };
    }

    for (const rule of input.dbRules) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.kind === 'ignore_sender' && sender.includes(rule.pattern.toLowerCase())) {
        return { ignore: true, reason: `rule ${rule.id} matched sender` };
      }

      if (rule.kind === 'ignore_domain' && domain.includes(rule.pattern.toLowerCase())) {
        return { ignore: true, reason: `rule ${rule.id} matched domain` };
      }
    }

    return { ignore: false };
  }

  resolveVibe(input: {
    sender: string;
    config: SndConfig;
    dbRules: RuleRecord[];
  }): string {
    const sender = input.sender.toLowerCase();
    const configStyle = input.config.rules.styles.find((entry) => sender.includes(entry.match.toLowerCase()));
    if (configStyle) {
      return configStyle.vibe;
    }

    const dbStyleRule = input.dbRules.find(
      (rule) => rule.enabled && rule.kind === 'style' && sender.includes(rule.pattern.toLowerCase()),
    );

    if (dbStyleRule) {
      return dbStyleRule.value;
    }

    return input.config.rules.globalVibe;
  }
}
