import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getPref, setPref } from './prefs';

/**
 * App Lock (PRD §7.4): optional PIN and/or fingerprint/face, asked when the app opens and after
 * the app has been in the background for a while. The PIN is stored only as a salted hash in the
 * phone's secure storage. Phone-only: the web preview has no secure storage.
 */
export const lockSupported = Platform.OS !== 'web';
export const LOCK_TIMEOUTS_MIN = [0, 1, 5, 15] as const;

export type LockConfig = { enabled: boolean; biometric: boolean; timeoutMin: number };
export const DEFAULT_LOCK: LockConfig = { enabled: false, biometric: false, timeoutMin: 5 };

const PIN_KEY = 'mm.lock.pin';
const ROUNDS = 2000;

const listeners = new Set<() => void>();
export function subscribeLock(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
const changed = () => listeners.forEach((l) => l());

async function hashPin(pin: string, salt: string): Promise<string> {
  let h = `${salt}:${pin}`;
  for (let i = 0; i < ROUNDS; i++) {
    h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, h);
  }
  return h;
}

export async function getLockConfig(): Promise<LockConfig> {
  if (!lockSupported) return DEFAULT_LOCK;
  const [enabled, biometric, timeout] = await Promise.all([
    getPref('lock.enabled'),
    getPref('lock.biometric'),
    getPref('lock.timeout'),
  ]);
  const t = Number(timeout);
  return {
    enabled: enabled === '1',
    biometric: biometric === '1',
    timeoutMin: (LOCK_TIMEOUTS_MIN as readonly number[]).includes(t) ? t : DEFAULT_LOCK.timeoutMin,
  };
}

export async function enableLock(pin: string, biometric: boolean, timeoutMin: number): Promise<void> {
  const salt = Crypto.randomUUID();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt, hash }));
  await setPref('lock.biometric', biometric ? '1' : '0');
  await setPref('lock.timeout', String(timeoutMin));
  await setPref('lock.enabled', '1');
  changed();
}

export async function setLockOptions(
  patch: Partial<Pick<LockConfig, 'biometric' | 'timeoutMin'>>,
): Promise<void> {
  if (patch.biometric !== undefined) await setPref('lock.biometric', patch.biometric ? '1' : '0');
  if (patch.timeoutMin !== undefined) await setPref('lock.timeout', String(patch.timeoutMin));
  changed();
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(PIN_KEY);
    if (!raw) return false;
    const { salt, hash } = JSON.parse(raw) as { salt: string; hash: string };
    return (await hashPin(pin, salt)) === hash;
  } catch {
    return false;
  }
}

/** Remove the PIN and switch App Lock off (also used on sign-out so a shared phone is clean). */
export async function clearLock(): Promise<void> {
  if (!lockSupported) return;
  try {
    await SecureStore.deleteItemAsync(PIN_KEY);
  } catch {
    // nothing stored
  }
  await setPref('lock.enabled', '0');
  await setPref('lock.biometric', '0');
  changed();
}

export async function biometricAvailable(): Promise<boolean> {
  if (!lockSupported) return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function authenticateBiometric(prompt: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      disableDeviceFallback: true,
    });
    return res.success;
  } catch {
    return false;
  }
}
