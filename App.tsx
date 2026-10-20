import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { isSupabaseConfigured } from './src/lib/supabase';
import { loadSettings, useSettings } from './src/lib/settings';
import { RootNavigator } from './src/navigation/RootNavigator';
import { startSync } from './src/lib/outbox';
import { initAds } from './src/lib/ads';
import { installCrashHandlers } from './src/lib/crash';
import { AppLockGate } from './src/ui/AppLockGate';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { Notice, Screen } from './src/ui/components';
import { ReauthHost } from './src/ui/ReauthHost';
import { SyncBanner } from './src/ui/SyncBanner';

export default function App() {
  const { t } = useTranslation();
  const { rev } = useSettings();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installCrashHandlers();
    void loadSettings().finally(() => setReady(true));
    startSync();
    void initAds();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/* light icons: every screen now starts with the navy band */}
      <StatusBar style="light" />
      {isSupabaseConfigured ? (
        <AuthProvider>
          <AppLockGate>
            {/* `rev` changes with language or theme: only the screens are redrawn, the sign-in
                is kept (re-creating it made language changes slow while offline) */}
            <View key={rev} style={{ flex: 1 }}>
              <View style={{ flex: 1 }}>
                <ErrorBoundary>
                  <RootNavigator />
                </ErrorBoundary>
              </View>
              <SyncBanner />
            </View>
          </AppLockGate>
          <ReauthHost />
        </AuthProvider>
      ) : (
        <Screen>
          <Notice tone="error">{t('common.notConfigured')}</Notice>
        </Screen>
      )}
    </SafeAreaProvider>
  );
}
