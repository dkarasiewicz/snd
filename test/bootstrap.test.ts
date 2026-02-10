import { describe, expect, it } from 'vitest';
import { selectLatestBootstrapThreadKeys } from '../src/core/bootstrap.js';
import type { ImapMessage } from '../src/imap/types.js';

function makeMessage(input: {
  uid: number;
  sentAt: number;
  subject: string;
  messageId?: string;
  inReplyTo?: string | null;
  references?: string[];
}): ImapMessage {
  return {
    uid: input.uid,
    messageId: input.messageId ?? `<msg-${input.uid}@example.com>`,
    inReplyTo: input.inReplyTo ?? null,
    references: input.references ?? [],
    subject: input.subject,
    from: { name: 'Sender', address: 'sender@example.com' },
    to: [{ name: 'User', address: 'user@example.com' }],
    cc: [],
    sentAt: input.sentAt,
    text: 'hello',
    headers: '{}',
  };
}

describe('selectLatestBootstrapThreadKeys', () => {
  it('returns at most latest N thread keys by sentAt', () => {
    const messages: ImapMessage[] = [
      makeMessage({ uid: 1, sentAt: 1000, subject: 'A' }),
      makeMessage({ uid: 2, sentAt: 2000, subject: 'B' }),
      makeMessage({ uid: 3, sentAt: 3000, subject: 'C' }),
    ];

    const keys = selectLatestBootstrapThreadKeys(messages, 2);

    expect(keys.size).toBe(2);
  });

  it('groups replies into same thread key and does not overcount', () => {
    const rootId = '<root-1@example.com>';
    const messages: ImapMessage[] = [
      makeMessage({ uid: 1, sentAt: 1000, subject: 'Topic', messageId: rootId }),
      makeMessage({
        uid: 2,
        sentAt: 2000,
        subject: 'Re: Topic',
        inReplyTo: rootId,
        references: [rootId],
      }),
      makeMessage({ uid: 3, sentAt: 3000, subject: 'Other topic' }),
    ];

    const keys = selectLatestBootstrapThreadKeys(messages, 2);

    expect(keys.size).toBe(2);
  });
});
