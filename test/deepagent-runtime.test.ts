import { describe, expect, it, vi } from 'vitest';
import { DeepAgentRuntimeService } from '../src/agent/deepagent-runtime.service.js';

function makeRequest() {
  return {
    threadId: 'thread-1',
    model: 'gpt-5-mini',
    vibe: 'brief',
    userNotes: [],
    threadNotes: [],
    messages: [
      {
        id: 'm1',
        accountId: 'main',
        threadId: 'thread-1',
        uid: 1,
        messageId: '<m1@example.com>',
        inReplyTo: null,
        subject: 'Subject',
        fromAddress: 'sender@example.com',
        fromName: 'Sender',
        toAddresses: ['user@example.com'],
        ccAddresses: [],
        bodyText: 'Need update by Friday',
        sentAt: Date.now(),
        rawHeaders: '{}',
      },
    ],
  };
}

describe('DeepAgentRuntimeService', () => {
  it('returns deepagent output and persists memory draft snapshot', async () => {
    const put = vi.fn();

    const service = new DeepAgentRuntimeService(
      {
        load: () => ({
          version: 1,
          defaultAccountId: 'main',
          poll: { intervalSeconds: 300 },
          sync: { bootstrapThreadLimit: 20, bootstrapMessageWindow: 300 },
          inbox: { defaultLimit: 20 },
          ui: { mode: 'auto' },
          llm: {
            provider: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-5-mini',
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
            ignoreSenders: [],
            ignoreDomains: [],
            globalVibe: 'brief',
            styles: [],
          },
          accounts: [],
        }),
      } as never,
      {
        namespaceForDraftRequest: () => 'draft:main:local',
        makeNamespace: () => 'deepagent:main:local',
        list: () => [],
        put,
      } as never,
      {
        getPlugins: async () => ({
          roots: [],
          tools: [],
          subagents: [],
          sandboxes: [],
          skills: [],
          issues: [],
        }),
      } as never,
      {
        buildModelConfig: () => ({ model: 'gpt-5-mini' }),
      } as never,
    );

    (service as { dynamicImporter: (specifier: string) => Promise<Record<string, unknown>> }).dynamicImporter =
      async () => ({
        createDeepAgent: async () => ({
          invoke: async () => ({ output: 'Draft from deepagent' }),
        }),
      });

    const output = await service.maybeGenerate(makeRequest());

    expect(output).toBe('Draft from deepagent');
    expect(put).toHaveBeenCalledWith('draft:main:local', 'draft:thread-1:latest', 'Draft from deepagent');
  });

  it('falls back when deepagents package is unavailable', async () => {
    const service = new DeepAgentRuntimeService(
      {
        load: () => ({
          version: 1,
          defaultAccountId: 'main',
          poll: { intervalSeconds: 300 },
          sync: { bootstrapThreadLimit: 20, bootstrapMessageWindow: 300 },
          inbox: { defaultLimit: 20 },
          ui: { mode: 'auto' },
          llm: {
            provider: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-5-mini',
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
            ignoreSenders: [],
            ignoreDomains: [],
            globalVibe: 'brief',
            styles: [],
          },
          accounts: [],
        }),
      } as never,
      {
        namespaceForDraftRequest: () => 'draft:main:local',
        makeNamespace: () => 'deepagent:main:local',
        list: () => [],
        put: () => undefined,
      } as never,
      {
        getPlugins: async () => ({
          roots: [],
          tools: [],
          subagents: [],
          sandboxes: [],
          skills: [],
          issues: [],
        }),
      } as never,
      {
        buildModelConfig: () => ({ model: 'gpt-5-mini' }),
      } as never,
    );

    (service as { dynamicImporter: (specifier: string) => Promise<Record<string, unknown>> }).dynamicImporter =
      async () => {
        throw new Error('missing');
      };

    const output = await service.maybeGenerate(makeRequest());
    expect(output).toBeNull();
  });
});
