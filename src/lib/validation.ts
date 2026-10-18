/** Signup validation rules (PRD §7.2). Returns i18n keys for errors. */
import { PASSWORD_MIN_LENGTH, TESTING_MODE } from '../config';

// Small built-in list; Supabase's leaked-password protection adds a larger check server-side.
const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'qwertyuiop',
  '11111111',
  '00000000',
  'iloveyou',
  'abcd1234',
  'admin123',
  'welcome1',
  'letmein1',
  'pakistan',
  'india123',
  'bismillah',
  'football',
  'baseball',
  'sunshine',
]);

export const CONSENT_VERSION = '2026-10-v1';

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function passwordError(password: string, testing = TESTING_MODE): string | null {
  const min = testing ? PASSWORD_MIN_LENGTH : 8;
  if (password.length < min) return 'auth.errors.passwordShort';
  if (!testing && COMMON_PASSWORDS.has(password.toLowerCase())) return 'auth.errors.passwordCommon';
  return null;
}

/** Parse YYYY-MM-DD; must be a real past date, not more than 120 years ago. */
export function parseDateOfBirth(input: string, today = new Date()): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (date > today) return null;
  if (today.getUTCFullYear() - y > 120) return null;
  return date;
}

export function ageOn(dob: Date, today = new Date()): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  consent: boolean;
}

export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

export function validateSignup(v: SignupInput, today = new Date(), testing = TESTING_MODE): SignupErrors {
  const e: SignupErrors = {};
  if (!v.name.trim()) e.name = 'auth.errors.nameRequired';
  if (!isValidEmail(v.email)) e.email = 'auth.errors.emailInvalid';
  const pw = passwordError(v.password, testing);
  if (pw) e.password = pw;
  if (v.password !== v.confirmPassword) e.confirmPassword = 'auth.errors.passwordMismatch';
  const dob = parseDateOfBirth(v.dateOfBirth, today);
  if (!dob) e.dateOfBirth = 'auth.errors.dobInvalid';
  // Under-18 needs verified parent consent (PRD §20.4) — built in v0.7; blocked until then.
  else if (ageOn(dob, today) < 18) e.dateOfBirth = 'auth.errors.minorNotYet';
  if (!v.consent) e.consent = 'auth.errors.consentRequired';
  return e;
}
