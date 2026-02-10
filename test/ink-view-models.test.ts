import { describe, expect, it } from 'vitest';
import { mapInboxPreview, mapInboxRows } from '../src/ui/view-models/inbox-vm.js';
import { mapThreadView } from '../src/ui/view-models/thread-vm.js';
import { formatRelativeTime } from '../src/ui/view-models/time.js';
import { matchDown, matchEnter, matchEscape, matchInputKey, matchUp } from '../src/ui/ink/hooks/useKeymap.js';

describe('view model mappers', () => {
  it('formats inbox rows with relative time and draft flags', () => {
    const nowMs = Date.UTC(2026, 1, 10, 18, 0, 0);
    const rows = mapInboxRows(
      [
        {
          id: 'thread-1',
          accountId: 'main',
          threadKey: 'k1',
          subject: 'Status update',
          participants: [],
          lastMessageAt: nowMs - 2 * 60 * 60 * 1000,
          lastSender: 'boss@example.com',
          needsReply: true,
          summary: 'Draft summary',
          updatedAt: nowMs,
        },
      ],
      nowMs,
    );

    expect(rows).toEqual([
      {
        id: 'thread-1',
        sender: 'boss@example.com',
        subject: 'Status update',
        relativeTime: '2h ago',
        hasDraft: true,
        draftSnippet: 'Draft summary',
      },
    ]);
  });

  it('builds preview snippets from latest message and draft', () => {
    const preview = mapInboxPreview({
      threadId: 'thread-1',
      messages: [
        {
          id: 'm1',
          accountId: 'main',
          threadId: 'thread-1',
          uid: 1,
          messageId: '<1@example.com>',
          inReplyTo: null,
          subject: 'Subject',
          fromAddress: 'sender@example.com',
          fromName: 'Sender',
          toAddresses: ['me@example.com'],
          ccAddresses: [],
          bodyText: 'Hello   there\n\nthis is a test',
          sentAt: Date.now(),
          rawHeaders: '{}',
        },
      ],
      draft: {
        id: 'd1',
        threadId: 'thread-1',
        content: 'Sure,\nI can do that.',
        status: 'drafted',
        updatedAt: Date.now(),
        model: 'gpt-5-mini',
      },
    });

    expect(preview.latestInboundSnippet).toBe('Hello there this is a test');
    expect(preview.draftSnippet).toBe('Sure, I can do that.');
  });

  it('maps thread view with compact timeline', () => {
    const nowMs = Date.UTC(2026, 1, 10, 18, 0, 0);
    const vm = mapThreadView({
      thread: {
        id: 'thread-1',
        accountId: 'main',
        threadKey: 'k1',
        subject: 'Subject',
        participants: [],
        lastMessageAt: nowMs,
        lastSender: 'sender@example.com',
        needsReply: true,
        summary: null,
        updatedAt: nowMs,
      },
      messages: [
        {
          id: 'm1',
          accountId: 'main',
          threadId: 'thread-1',
          uid: 1,
          messageId: '<1@example.com>',
          inReplyTo: null,
          subject: 'Subject',
          fromAddress: 'sender@example.com',
          fromName: 'Sender',
          toAddresses: ['me@example.com'],
          ccAddresses: [],
          bodyText: 'Need approval by EOD',
          sentAt: nowMs - 60 * 60 * 1000,
          rawHeaders: '{}',
        },
      ],
      draft: null,
      nowMs,
    });

    expect(vm.sender).toBe('sender@example.com');
    expect(vm.messages[0]?.at).toBe('1h ago');
    expect(vm.draft).toBe('');
  });
});

describe('time formatting', () => {
  it('returns short relative labels', () => {
    const now = Date.UTC(2026, 1, 10, 18, 0, 0);
    expect(formatRelativeTime(now - 15_000, now)).toBe('15s ago');
    expect(formatRelativeTime(now - 3 * 60_000, now)).toBe('3m ago');
    expect(formatRelativeTime(now - 5 * 60 * 60_000, now)).toBe('5h ago');
    expect(formatRelativeTime(now - 2 * 24 * 60 * 60_000, now)).toBe('2d ago');
  });
});

describe('key match helpers', () => {
  it('matches expected inputs', () => {
    const enterKey = { return: true } as never;
    const upKey = { upArrow: true } as never;
    const downKey = { downArrow: true } as never;
    const escKey = { escape: true } as never;

    expect(matchInputKey('j')('j', {} as never)).toBe(true);
    expect(matchEnter('', enterKey)).toBe(true);
    expect(matchUp('', upKey)).toBe(true);
    expect(matchDown('', downKey)).toBe(true);
    expect(matchEscape('', escKey)).toBe(true);
  });
});
