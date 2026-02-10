import { Logger } from '@nestjs/common';

type RetryOptions = {
  label: string;
  attempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  logger?: Logger;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, options.attempts);
  const maxDelayMs = options.maxDelayMs ?? 4000;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }

      const delayMs = Math.min(maxDelayMs, options.baseDelayMs * 2 ** (attempt - 1));
      options.logger?.debug(
        `${options.label} failed (attempt ${attempt}/${attempts}): ${(error as Error).message}; retrying in ${delayMs}ms`,
      );
      await delay(delayMs);
    }
  }

  throw lastError;
}
