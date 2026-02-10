import { describe, expect, it } from 'vitest';
import { cleanEmailBody } from '../src/imap/body-cleaner.js';

describe('cleanEmailBody', () => {
  it('removes quoted reply sections', () => {
    const raw = [
      'Hi team,',
      '',
      'Let us ship this today.',
      '',
      'On Tue, Feb 10, 2026 at 10:00 AM A <a@example.com> wrote:',
      '> previous quoted text',
    ].join('\n');

    expect(cleanEmailBody(raw)).toBe('Hi team,\n\nLet us ship this today.');
  });

  it('strips common signatures near the end', () => {
    const raw = ['Done, pushing fix now.', '', 'Best,', 'Damian'].join('\n');
    expect(cleanEmailBody(raw)).toBe('Done, pushing fix now.');
  });
});
