import crypto from 'node:crypto';
import { ImapMessage } from './types.js';
import { normalizeMessageId } from './message-id.js';

function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveThreadKey(message: ImapMessage): string {
  if (message.references.length > 0) {
    const rootRef = message.references[0];
    if (rootRef) {
      return `ref:${normalizeMessageId(rootRef)}`;
    }
  }

  if (message.inReplyTo) {
    return `reply:${normalizeMessageId(message.inReplyTo)}`;
  }

  const basis = `${normalizeSubject(message.subject)}:${message.from.address}`;
  const digest = crypto.createHash('sha1').update(basis).digest('hex');
  return `subj:${digest}`;
}

export function hasBodyContent(text: string): boolean {
  return text.replace(/\s+/g, '').length > 0;
}

export function snippet(text: string, maxChars = 280): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxChars) {
    return compact;
  }

  return `${compact.slice(0, maxChars - 3)}...`;
}
