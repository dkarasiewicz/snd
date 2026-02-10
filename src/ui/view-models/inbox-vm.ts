import { MessageRecord, ThreadRecord, DraftRecord } from '../../storage/types.js';
import { formatRelativeTime } from './time.js';

export type InboxRowVm = {
  id: string;
  sender: string;
  subject: string;
  relativeTime: string;
  hasDraft: boolean;
  draftSnippet: string | null;
};

export type InboxPreviewVm = {
  threadId: string;
  latestInboundSnippet: string;
  draftSnippet: string;
};

export function mapInboxRows(rows: ThreadRecord[], nowMs = Date.now()): InboxRowVm[] {
  return rows.map((row) => ({
    id: row.id,
    sender: row.lastSender,
    subject: row.subject,
    relativeTime: formatRelativeTime(row.lastMessageAt, nowMs),
    hasDraft: Boolean(row.summary),
    draftSnippet: row.summary,
  }));
}

export function mapInboxPreview(input: {
  threadId: string;
  messages: MessageRecord[];
  draft: DraftRecord | null;
}): InboxPreviewVm {
  const latestMessage = input.messages[input.messages.length - 1];
  const latestInboundSnippet = latestMessage
    ? latestMessage.bodyText.replace(/\s+/g, ' ').trim().slice(0, 240)
    : '(no messages)';

  const draftSnippet = input.draft?.content?.replace(/\s+/g, ' ').trim().slice(0, 240) || '(no draft yet)';

  return {
    threadId: input.threadId,
    latestInboundSnippet,
    draftSnippet,
  };
}
