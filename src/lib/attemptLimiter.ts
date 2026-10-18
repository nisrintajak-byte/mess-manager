/** After repeated wrong PINs, make the user wait (in-memory; resets when the app restarts). */
export function createAttemptLimiter(maxFree = 5, waitMs = 30_000, now: () => number = Date.now) {
  let fails = 0;
  let blockedUntil = 0;
  return {
    secondsLeft(): number {
      return Math.max(0, Math.ceil((blockedUntil - now()) / 1000));
    },
    fail(): void {
      fails += 1;
      if (fails >= maxFree) {
        blockedUntil = now() + waitMs * (fails - maxFree + 1);
      }
    },
    reset(): void {
      fails = 0;
      blockedUntil = 0;
    },
  };
}
