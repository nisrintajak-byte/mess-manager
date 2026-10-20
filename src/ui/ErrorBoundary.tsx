import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import i18n from '../i18n';
import { reportError } from '../lib/crash';
import { Button } from './components';
import { colors, font, space } from './theme';

/**
 * If a screen crashes while drawing, show a calm message with "Try again" instead of a blank
 * screen, and log the error (no personal data). Data is safe on the server and in the outbox.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    reportError(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{i18n.t('crash.title')}</Text>
        <Text style={styles.body}>{i18n.t('crash.body')}</Text>
        <Button title={i18n.t('common.retry')} onPress={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.md, backgroundColor: colors.bg },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: font.md, color: colors.textMuted, textAlign: 'center' },
});
