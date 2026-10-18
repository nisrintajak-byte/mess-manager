import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/auth/AuthProvider';
import { isSupabaseConfigured } from './src/lib/supabase';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Notice, Screen } from './src/ui/components';

export default function App() {
  const { t } = useTranslation();
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
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
