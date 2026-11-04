import type { Member } from '../api';
import { leavePlan } from '../leavePlan';

const m = (id: string, role: Member['role'], extra: Partial<Member> = {}): Member => ({
  id,
  room_id: 'r',
  user_id: `u-${id}`,
  role,
  status: 'approved',
  requested_at: '2026-10-01T00:00:00Z',
  joined_on: '2026-10-01',
  left_on: null,
  ...extra,
});

describe('leavePlan', () => {
  test('last person in the Room closes it', () => {
    const plan = leavePlan([m('a', 'admin'), m('x', 'member', { status: 'left' })], 'u-a');
    expect(plan.kind).toBe('alone');
  });

  test('only Admin hands over to the longest-standing member', () => {
    const plan = leavePlan(
      [
        m('a', 'admin'),
        m('late', 'member', { joined_on: '2026-10-20' }),
        m('early', 'member', { joined_on: '2026-10-05' }),
        m('pend', 'member', { status: 'pending', joined_on: null }),
      ],
      'u-a',
    );
    expect(plan.kind === 'handover' && plan.successor.id).toBe('early');
  });

  test('another Admin present: nothing changes', () => {
    expect(leavePlan([m('a', 'admin'), m('b', 'admin'), m('c', 'member')], 'u-a').kind).toBe('normal');
  });

  test('a member leaving never hands over', () => {
    expect(leavePlan([m('a', 'admin'), m('c', 'member')], 'u-c').kind).toBe('normal');
  });
});
