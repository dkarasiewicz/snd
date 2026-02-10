import { describe, expect, it } from 'vitest';
import { deriveThreadKey } from '../src/imap/threading.js';

describe('deriveThreadKey', () => {
  it('prefers references chain', () => {
    const key = deriveThreadKey({
      uid: 1,
      messageId: '<a@x>',
      inReplyTo: null,
      references: ['<root@x>', '<mid@x>'],
      subject: 'Re: Hello',
      from: { address: 'a@example.com', name: 'A' },
      to: [],
      cc: [],
      sentAt: Date.now(),
      text: 'x',
      headers: '{}',
    });

    expect(key).toBe('ref:root@x');
  });

  it('falls back to normalized subject digest', () => {
    const keyA = deriveThreadKey({
      uid: 1,
      messageId: '<a@x>',
      inReplyTo: null,
      references: [],
      subject: 'Re: Test',
      from: { address: 'a@example.com', name: 'A' },
      to: [],
      cc: [],
      sentAt: Date.now(),
      text: 'x',
      headers: '{}',
    });

    const keyB = deriveThreadKey({
      uid: 2,
      messageId: '<b@x>',
      inReplyTo: null,
      references: [],
      subject: 'Test',
      from: { address: 'a@example.com', name: 'A' },
      to: [],
      cc: [],
      sentAt: Date.now(),
      text: 'x',
      headers: '{}',
    });

    expect(keyA).toBe(keyB);
  });
});
