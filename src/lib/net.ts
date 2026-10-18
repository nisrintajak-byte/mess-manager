/** True when an error means "could not reach the server" (offline, timeout, dropped connection). */
export function isNetworkError(e: unknown): boolean {
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '');
  return /network request failed|failed to fetch|fetch failed|networkerror|load failed|timed out|timeout|aborted|offline|econnreset|enotfound/i.test(
    msg,
  );
}
