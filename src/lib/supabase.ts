import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Public project URL + publishable key (safe to ship in the app; data is
 * protected by Row Level Security). Override with EXPO_PUBLIC_* env vars.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://egylgjgimuytmnmrvzhs.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_gPryt81NP50aGXuKoo6hOg_qMgzBk4M';

/**
 * Session tokens: SecureStore on phones (PRD §18.1). SecureStore values are
 * limited to ~2 KB, so large sessions fall back to AsyncStorage chunks.
 */
const secureStorage = {
  async getItem(key: string) {
    const v = await SecureStore.getItemAsync(key);
    if (v !== '__chunked__') return v;
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (value.length < 1800) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
      await SecureStore.setItemAsync(key, '__chunked__');
    }
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key);
    await AsyncStorage.removeItem(key);
  },
};

/** Same name the library would pick by itself (kept explicit so the app can read it offline). */
export const AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/** Where the sign-in is kept: SecureStore on phones, the browser's localStorage on the web. */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS !== 'web') return secureStorage.getItem(key);
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    storageKey: AUTH_STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_KEY !== '';
