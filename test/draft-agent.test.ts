import { afterEach, describe, expect, it, vi } from 'vitest';
import { DraftAgentService } from '../src/agent/draft-agent.service.js';

describe('DraftAgentService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not send temperature in chat completions payload', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: 'Draft reply' },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new DraftAgentService(
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
        getSecret: () => 'test-token',
      } as never,
      {
        maybeGenerate: async () => null,
      } as never,
    );

    await service.generateDraft({
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
          subject: 'Hi',
          fromAddress: 'sender@example.com',
          fromName: 'Sender',
          toAddresses: ['user@example.com'],
          ccAddresses: [],
          bodyText: 'Hello',
          sentAt: Date.now(),
          rawHeaders: '{}',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(payload.temperature).toBeUndefined();
    expect(payload.model).toBe('gpt-5-mini');
  });
});
