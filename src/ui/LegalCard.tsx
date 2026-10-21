import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Label } from './components';

/**
 * Privacy Policy and Terms can be read again at any time; withdrawing consent means deleting
 * the account (founder 2026-10-21; PRD §18.5).
 */
export function LegalCard() {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  return (
    <Card>
      <Label>{t('legalCard.title')}</Label>
      <Button
        title={t('legalCard.privacy')}
        variant="secondary"
        onPress={() => nav.navigate('Legal', { doc: 'privacy' })}
      />
      <Button
        title={t('legalCard.terms')}
        variant="secondary"
        onPress={() => nav.navigate('Legal', { doc: 'terms' })}
      />
      <Body muted>{t('legalCard.withdrawNote')}</Body>
      <Button title={t('legalCard.withdraw')} variant="link" onPress={() => nav.navigate('DeleteAccount')} />
    </Card>
  );
}
