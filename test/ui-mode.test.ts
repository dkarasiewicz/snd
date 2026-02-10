import { describe, expect, it } from 'vitest';
import { resolveUiMode } from '../src/ui/ui-mode.js';

describe('resolveUiMode', () => {
  it('respects explicit override', () => {
    expect(resolveUiMode('auto', 'plain')).toBe('plain');
    expect(resolveUiMode('plain', 'rich')).toBe('rich');
  });

  it('uses config when override is absent', () => {
    expect(resolveUiMode('plain', undefined)).toBe('plain');
    expect(resolveUiMode('rich', undefined)).toBe('rich');
  });
});
