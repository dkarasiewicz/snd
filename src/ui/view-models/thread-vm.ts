import { DraftRecord, MessageRecord, ThreadRecord } from '../../storage/types.js';
import { formatRelativeTime } from './time.js';

export type ThreadMessageVm = {
  from: string;
  at: string;
  body: string;
};

export type ThreadViewModel = {
  id: string;
  subject: string;
  sender: string;
  needsReply: boolean;
  messages: ThreadMessageVm[];
  draft: string;
};

export function mapThreadView(input: {
  thread: ThreadRecord;
  messages: MessageRecord[];
  draft: DraftRecord | null;
  nowMs?: number;
}): ThreadViewModel {
  const nowMs = input.nowMs ?? Date.now();

  return {
    id: input.thread.id,
    subject: input.thread.subject,
    sender: input.thread.lastSender,
    needsReply: input.thread.needsReply,
    messages: input.messages.slice(-6).map((message) => ({
      from: message.fromAddress,
      at: formatRelativeTime(message.sentAt, nowMs),
      body: message.bodyText.replace(/\s+/g, ' ').trim().slice(0, 280),
    })),
    draft: input.draft?.content ?? '',
  };
}
