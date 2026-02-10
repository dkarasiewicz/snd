import { describe, expect, it } from 'vitest';
import { makeMessageIdCandidates, normalizeMessageId } from '../src/imap/message-id.js';

describe('message-id helpers', () => {
  it('normalizes angle bracket ids', () => {
    expect(normalizeMessageId(' <AbC@Example.com> ')).toBe('abc@example.com');
  });

  it('provides multiple match candidates', () => {
    const candidates = makeMessageIdCandidates('<abc@example.com>');
    expect(candidates).toContain('abc@example.com');
    expect(candidates).toContain('<abc@example.com>');
  });
});
