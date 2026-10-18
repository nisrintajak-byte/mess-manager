import { ageOn, parseDateOfBirth, passwordError, pinError, validateSignup } from '../validation';

const today = new Date(Date.UTC(2026, 9, 18));
const good = {
  name: 'Imran',
  email: 'imran@example.com',
  password: 'S3cure-pass',
  confirmPassword: 'S3cure-pass',
  dateOfBirth: '1990-05-01',
  consent: true,
};

describe('validateSignup', () => {
  it('accepts a valid adult signup', () => {
    expect(validateSignup(good, today, false)).toEqual({});
  });

  it('requires consent, matching passwords and valid email', () => {
    const e = validateSignup({ ...good, consent: false, confirmPassword: 'x', email: 'bad' }, today, false);
    expect(e.consent).toBe('auth.errors.consentRequired');
    expect(e.confirmPassword).toBe('auth.errors.passwordMismatch');
    expect(e.email).toBe('auth.errors.emailInvalid');
  });

  it('blocks under-18 until parental consent exists', () => {
    expect(validateSignup({ ...good, dateOfBirth: '2012-01-01' }, today).dateOfBirth).toBe(
      'auth.errors.minorNotYet',
    );
  });
});

describe('password rules', () => {
  it('launch rules: 8+ chars and not a common password', () => {
    expect(passwordError('short', false)).toBe('auth.errors.passwordShort');
    expect(passwordError('Password123', false)).toBe('auth.errors.passwordCommon');
    expect(passwordError('blue-tea-garden', false)).toBeNull();
  });

  it('testing mode: simple passwords of 6+ chars are allowed', () => {
    expect(passwordError('123456', true)).toBeNull();
    expect(passwordError('12345', true)).toBe('auth.errors.passwordShort');
  });
});

describe('date of birth', () => {
  it('rejects impossible and future dates', () => {
    expect(parseDateOfBirth('2001-02-30', today)).toBeNull();
    expect(parseDateOfBirth('2030-01-01', today)).toBeNull();
    expect(parseDateOfBirth('01-05-1990', today)).toBeNull();
  });

  it('computes age around birthdays', () => {
    expect(ageOn(parseDateOfBirth('2008-10-18', today)!, today)).toBe(18);
    expect(ageOn(parseDateOfBirth('2008-10-19', today)!, today)).toBe(17);
  });
});

describe('pinError', () => {
  test('accepts 4 to 8 digits only', () => {
    expect(pinError('1234')).toBeNull();
    expect(pinError('12345678')).toBeNull();
    expect(pinError('123')).not.toBeNull();
    expect(pinError('123456789')).not.toBeNull();
    expect(pinError('12a4')).not.toBeNull();
    expect(pinError('')).not.toBeNull();
  });
});
