import { deriveThreadKey } from '../imap/threading.js';
import { ImapMessage } from '../imap/types.js';

export function selectLatestBootstrapThreadKeys(
  messages: ImapMessage[],
  limit: number,
): Set<string> {
  if (limit < 1 || messages.length === 0) {
    return new Set();
  }

  const sorted = [...messages].sort((a, b) => b.sentAt - a.sentAt);
  const keys = new Set<string>();

  for (const message of sorted) {
    if (keys.size >= limit) {
      break;
    }

    keys.add(deriveThreadKey(message));
  }

  return keys;
}
