import { describe, expect, it } from 'vitest';
import { resolveFetchRange } from '../src/imap/imap-client.service.js';

describe('resolveFetchRange', () => {
  it('fetches all unseen messages for periodic sync', () => {
    expect(resolveFetchRange(66, 500, {})).toBe('67:*');
  });

  it('uses windowed bootstrap range for first sync', () => {
    expect(resolveFetchRange(0, 500, { bootstrapMessageWindow: 20 })).toBe('481:*');
  });

  it('falls back to full mailbox when bootstrap window is missing', () => {
    expect(resolveFetchRange(0, 500)).toBe('1:*');
  });
});
