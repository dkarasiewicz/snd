import { describe, expect, it } from 'vitest';
import { withRetry } from '../src/core/retry.js';

describe('withRetry', () => {
  it('retries transient failures and returns success', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('transient');
        }
        return 'ok';
      },
      {
        label: 'test-op',
        attempts: 3,
        baseDelayMs: 1,
      },
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws after exhausting retries', async () => {
    await expect(
      withRetry(
        async () => {
          throw new Error('permanent');
        },
        {
          label: 'test-op',
          attempts: 2,
          baseDelayMs: 1,
        },
      ),
    ).rejects.toThrow('permanent');
  });
});
