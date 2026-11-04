import type { Member } from './api';

/**
 * What happens when `me` leaves a Room (mirrors public.leave_room):
 * - `alone`: nobody else is in the Room, so it is closed;
 * - `handover`: I am the only Admin, so `successor` (the longest-standing member) becomes Admin;
 * - `normal`: everyone else stays as they are.
 */
export type LeavePlan = { kind: 'alone' } | { kind: 'handover'; successor: Member } | { kind: 'normal' };

const cmp = (a: string | null | undefined, b: string | null | undefined) =>
  a === b ? 0 : a == null ? 1 : b == null ? -1 : a < b ? -1 : 1;

export function leavePlan(members: Member[], me: string | undefined): LeavePlan {
  const approved = members.filter((m) => m.status === 'approved');
  const mine = approved.find((m) => m.user_id === me);
  const others = approved.filter((m) => m.user_id !== me);
  if (others.length === 0) return { kind: 'alone' };
  if (mine?.role === 'admin' && !others.some((m) => m.role === 'admin')) {
    const successor = [...others].sort(
      (a, b) =>
        cmp(a.joined_on, b.joined_on) ||
        cmp(a.decided_at, b.decided_at) ||
        cmp(a.requested_at, b.requested_at) ||
        cmp(a.id, b.id),
    )[0] as Member; // others is non-empty here
    return { kind: 'handover', successor };
  }
  return { kind: 'normal' };
}
