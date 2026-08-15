/** Thrown when a user exceeds their hourly AI request budget. */
export class RateLimitError extends Error {}

/** Per-user sliding window. In-memory is fine for a single-instance server. */
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;

export function checkRateLimit(userId: string, limitPerHour: number): void {
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limitPerHour) {
    throw new RateLimitError(
      "You've used your Ask Regroove requests for this hour. Try again later."
    );
  }
}

/**
 * Server-wide sliding window (one counter for the whole instance). Per-user
 * limits are easy to defeat by creating many accounts; this caps the total so
 * the owner's server-side OpenAI key can't be drained. `limitPerHour <= 0`
 * disables the check.
 */
const globalBucket = { count: 0, resetAt: 0 };

export function checkGlobalRateLimit(limitPerHour: number): void {
  if (limitPerHour <= 0) return;
  const now = Date.now();
  if (globalBucket.resetAt <= now) {
    globalBucket.count = 1;
    globalBucket.resetAt = now + WINDOW_MS;
    return;
  }
  globalBucket.count += 1;
  if (globalBucket.count > limitPerHour) {
    throw new RateLimitError(
      "Ask Regroove is at capacity right now. Please try again in a little while."
    );
  }
}

/** Validates the question text; returns the trimmed question or throws. */
export function validateQuestion(message: unknown): string {
  if (typeof message !== "string") {
    throw new Error("Please send your question as text.");
  }
  const trimmed = message.trim();
  if (trimmed.length < 2) {
    throw new Error("Please ask a complete question.");
  }
  if (trimmed.length > 2000) {
    throw new Error("That question is a bit long — try shortening it.");
  }
  return trimmed;
}
