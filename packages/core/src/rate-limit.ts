/**
 * Tiny in-process fixed-window rate limiter. Adequate for a single-instance
 * self-host; a multi-replica deployment would need a shared store (Redis/PG).
 * Singletons live at module scope so they persist across per-request service
 * instances within one Node process.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  private recent(key: string): number[] {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (arr.length) this.hits.set(key, arr);
    else this.hits.delete(key);
    return arr;
  }

  isLimited(key: string): boolean {
    return this.recent(key).length >= this.max;
  }

  record(key: string): void {
    const arr = this.recent(key);
    arr.push(Date.now());
    this.hits.set(key, arr);
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** Record a hit if under the limit; returns whether it was allowed. */
  consume(key: string): boolean {
    if (this.isLimited(key)) return false;
    this.record(key);
    return true;
  }
}

// Shared limiters (module singletons).
export const loginLimiter = new RateLimiter(10, 5 * 60_000); // 10 failed logins / 5 min / email
export const passwordResetLimiter = new RateLimiter(5, 15 * 60_000); // 5 reset requests / 15 min / email
export const signupLimiter = new RateLimiter(8, 60 * 60_000); // 8 sign-ups / hour / IP
