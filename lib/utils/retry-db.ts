/**
 * MongoDB Retry Utility
 *
 * Provides automatic retry logic for transient database errors like:
 * - WriteConflict (code 112)
 * - TransientTransactionError
 * - NetworkTimeout
 *
 * Usage:
 * const result = await withRetry(() => User.create({ email: '...' }));
 * const user = await withRetry(() => User.findByIdAndUpdate(id, data), { maxRetries: 5 });
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

interface MongoError extends Error {
  code?: number;
  codeName?: string;
  errorLabels?: string[];
}

// Errors that should be retried
const RETRYABLE_CODES = [
  112, // WriteConflict
  251, // TransactionAborted
  11000, // DuplicateKey (for upserts)
];

const RETRYABLE_LABELS = [
  "TransientTransactionError",
  "UnknownTransactionCommitResult",
];

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const mongoError = error as MongoError;

  // Check error code
  if (mongoError.code && RETRYABLE_CODES.includes(mongoError.code)) {
    return true;
  }

  // Check error labels
  if (mongoError.errorLabels) {
    for (const label of RETRYABLE_LABELS) {
      if (mongoError.errorLabels.includes(label)) {
        return true;
      }
    }
  }

  // Check error name/message for network issues
  if (
    mongoError.message?.includes("socket") ||
    mongoError.message?.includes("timeout") ||
    mongoError.message?.includes("ECONNRESET")
  ) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a database operation with automatic retry on transient errors
 *
 * @param operation - Async function that performs the database operation
 * @param options - Retry configuration
 * @returns Result of the operation
 * @throws Last error if all retries fail
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 2000,
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt or non-retryable errors
      if (attempt > maxRetries || !isRetryableError(error)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      // Log retry
      console.warn(
        `⚠️ [DB Retry] Attempt ${attempt}/${maxRetries + 1} failed with ${(error as MongoError).code || "unknown error"}, ` +
          `retrying in ${delay.toFixed(0)}ms...`,
      );

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt);
      }

      await sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error("Unknown retry error");
}

/**
 * Decorator version for class methods
 * Usage: @RetryOnConflict()
 */
export function RetryOnConflict(options: RetryOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Bulk operation with retry - processes items and retries failed ones
 *
 * @param items - Array of items to process
 * @param operation - Function to process each item
 * @param options - Retry and concurrency options
 * @returns Results array (successful results, nulls for permanent failures)
 */
export async function withBulkRetry<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: RetryOptions & { concurrency?: number } = {},
): Promise<(R | null)[]> {
  const { concurrency = 10, ...retryOptions } = options;
  const results: (R | null)[] = new Array(items.length).fill(null);

  // Process in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const globalIndex = i + batchIndex;
      try {
        results[globalIndex] = await withRetry(
          () => operation(item),
          retryOptions,
        );
      } catch (error) {
        console.error(
          `❌ [Bulk Retry] Item ${globalIndex} failed permanently:`,
          error,
        );
        results[globalIndex] = null;
      }
    });

    await Promise.all(batchPromises);
  }

  return results;
}

export default withRetry;
