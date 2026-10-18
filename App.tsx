import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { isSupabaseConfigured } from './src/lib/supabase';
import { loadSettings, useSettings } from './src/lib/settings';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Notice, Screen } from './src/ui/components';
import { currentTheme } from './src/ui/theme';

export default function App() {
  const { t } = useTranslation();
  const { rev } = useSettings();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadSettings().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  // `rev` changes whenever language or theme changes, so the whole UI re-renders with the new look.
  return (
    <SafeAreaProvider key={rev}>
      <StatusBar style={currentTheme() === 'dark' ? 'light' : 'dark'} />
      {isSupabaseConfigured ? (
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      ) : (
        <Screen>
          <Notice tone="error">{t('common.notConfigured')}</Notice>
        </Screen>
      )}
    </SafeAreaProvider>
  );
}
