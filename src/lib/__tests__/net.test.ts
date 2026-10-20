import { isNetworkError, withTimeout } from '../net';

describe('offline helpers', () => {
  test('withTimeout gives up and the error counts as "offline"', async () => {
    const never = new Promise<number>(() => undefined);
    let err: unknown = null;
    try {
      await withTimeout(never, 20);
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
    expect(isNetworkError(err)).toBe(true);
  });

  test('withTimeout passes results and real errors through', async () => {
    expect(await withTimeout(Promise.resolve(7), 50)).toBe(7);
    let err: unknown = null;
    try {
      await withTimeout(Promise.reject(new Error('not_allowed')), 50);
    } catch (e) {
      err = e;
    }
    expect(isNetworkError(err)).toBe(false);
  });
});
