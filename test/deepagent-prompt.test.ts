import { describe, expect, it } from 'vitest';
import { buildDeepAgentUserPrompt, DEEPAGENT_SYSTEM_PROMPT } from '../src/agent/deepagent-prompt.js';

describe('deepagent prompt policy', () => {
  it('contains planning and durable memory guidance', () => {
    expect(DEEPAGENT_SYSTEM_PROMPT).toContain('Plan internal todos before writing');
    expect(DEEPAGENT_SYSTEM_PROMPT).toContain('Use durable memory only for stable, reusable user/style facts');
    expect(DEEPAGENT_SYSTEM_PROMPT).toContain('Return only draft body text');
    expect(DEEPAGENT_SYSTEM_PROMPT).toContain('Never claim to send email');
  });

  it('builds user prompt with long-term memory and thread context', () => {
    const prompt = buildDeepAgentUserPrompt({
      request: {
        threadId: 'thread-1',
        model: 'gpt-5-mini',
        vibe: 'brief, direct',
        userNotes: ['prefers bullet points'],
        threadNotes: ['discussing rollout'],
        instruction: 'ask for ETA',
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
            bodyText: 'Can you ship this this week?',
            sentAt: Date.now(),
            rawHeaders: '{}',
          },
        ],
      },
      longTermMemory: [
        {
          key: 'memory:style',
          value: 'concise and technical',
        },
      ],
    });

    expect(prompt).toContain('Thread ID: thread-1');
    expect(prompt).toContain('Long-term memory:');
    expect(prompt).toContain('memory:style');
    expect(prompt).toContain('Thread context:');
  });
});
