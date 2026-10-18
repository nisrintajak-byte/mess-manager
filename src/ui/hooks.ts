import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { loadOutbox, pendingCount } from '../lib/outbox';

/**
 * Load data when the screen gains focus; exposes reload for pull-to-refresh.
 * `key` identifies the data (e.g. a room id): a new key reloads.
 */
export function useLoader<T>(load: () => Promise<T>, key = '') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // `key` is intentionally the only dependency: it identifies what is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, loading, reload };
}

/** Yes/No confirmation that also works in the web preview. */
export function confirm(message: string, yes: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(message));
  }
  return new Promise((resolve) =>
    Alert.alert('', message, [
      { text: no, style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Warn before signing out when actions saved on this phone have not synced yet (PRD §17.2 rule 8). */
export async function confirmSignOut(
  t: (k: string, o?: Record<string, unknown>) => string,
): Promise<boolean> {
  await loadOutbox();
  const count = pendingCount();
  if (count === 0) return true;
  return confirm(t('sync.logoutWarning', { count }), t('common.yes'), t('common.no'));
}
