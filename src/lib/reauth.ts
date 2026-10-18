/**
 * Sensitive actions (remove a member, delete a Room, change password…) always ask the user to
 * prove it is them, regardless of App Lock (PRD §7.4). `ReauthHost` (mounted once in the app)
 * registers the handler that shows the prompt.
 */
type Handler = () => Promise<boolean>;
let handler: Handler | null = null;

export function registerReauthHandler(h: Handler | null): void {
  handler = h;
}

/** Resolves true when the user passed the check. Rejects nothing; false means cancelled/failed. */
export async function requireReauth(): Promise<boolean> {
  return handler ? handler() : false;
}
