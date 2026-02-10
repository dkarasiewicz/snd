import { describe, expect, it } from 'vitest';
import { RuleEngineService } from '../src/rules/rule-engine.service.js';
import type { SndConfig } from '../src/config/schema.js';

const baseConfig: SndConfig = {
  version: 1,
  defaultAccountId: 'main',
  poll: { intervalSeconds: 300 },
  sync: { bootstrapThreadLimit: 20, bootstrapMessageWindow: 300 },
  inbox: { defaultLimit: 20 },
  ui: { mode: 'auto' },
  llm: {
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
    apiKeySecretKey: 'llm:default',
    useDeepAgents: true,
  },
  agent: {
    enabled: true,
    plugins: { enabled: true, roots: [] },
    skills: { enabled: true },
    subagents: { enabled: true },
    tools: { enabled: true },
    sandbox: { enabled: false },
  },
  rules: {
    ignoreSenders: ['bot@example.com'],
    ignoreDomains: ['ignore.me'],
    globalVibe: 'brief',
    styles: [{ match: '@vip.com', vibe: 'ultra terse' }],
  },
  accounts: [],
};

describe('RuleEngineService', () => {
  const service = new RuleEngineService();

  it('ignores configured sender', () => {
    const result = service.shouldIgnoreMessage({
      sender: 'bot@example.com',
      config: baseConfig,
      dbRules: [],
    });

    expect(result.ignore).toBe(true);
  });

  it('resolves per-pattern vibe', () => {
    const vibe = service.resolveVibe({
      sender: 'ceo@vip.com',
      config: baseConfig,
      dbRules: [],
    });

    expect(vibe).toBe('ultra terse');
  });
});
