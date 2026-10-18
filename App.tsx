import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  const { t } = useTranslation();
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <Text style={styles.title}>{t('app.name')}</Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
        <StatusBar style="auto" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#ffffff' },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  tagline: { marginTop: 8, fontSize: 16, color: '#4b5563', textAlign: 'center' },
});
