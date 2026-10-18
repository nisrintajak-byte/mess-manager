import { createAttemptLimiter } from '../attemptLimiter';

describe('attempt limiter', () => {
  test('allows 4 wrong tries, blocks on the 5th and escalates', () => {
    let t = 0;
    const lim = createAttemptLimiter(5, 30_000, () => t);
    for (let i = 0; i < 4; i++) lim.fail();
    expect(lim.secondsLeft()).toBe(0);
    lim.fail();
    expect(lim.secondsLeft()).toBe(30);
    t = 31_000;
    expect(lim.secondsLeft()).toBe(0);
    lim.fail();
    expect(lim.secondsLeft()).toBe(60);
  });

  test('reset clears the block', () => {
    let t = 0;
    const lim = createAttemptLimiter(2, 10_000, () => t);
    lim.fail();
    lim.fail();
    expect(lim.secondsLeft()).toBe(10);
    lim.reset();
    expect(lim.secondsLeft()).toBe(0);
    t += 1;
  });
});
