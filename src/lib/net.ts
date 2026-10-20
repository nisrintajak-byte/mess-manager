/** True when an error means "could not reach the server" (offline, timeout, dropped connection). */
export function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '');
  return /network request failed|failed to fetch|fetch failed|networkerror|load failed|timed out|timeout|aborted|offline|econnreset|enotfound/i.test(
    msg,
  );
}

/**
 * Give up waiting after `ms` (the request may still finish in the background). Used so the app
 * falls back to its saved copy quickly when the phone is offline, instead of waiting ~30 s for
 * the sign-in library's own retries (founder 2026-10-20).
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out (offline?)')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
