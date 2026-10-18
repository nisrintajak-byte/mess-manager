import { useTranslation } from 'react-i18next';

import { Body, Notice, Screen, Title } from '../ui/components';

/** Placeholder legal text; final lawyer-reviewed documents arrive in v0.7 (PRD §20). */
export function LegalScreen({ route }: { route: { params: { doc: 'privacy' | 'terms' } } }) {
  const { t } = useTranslation();
  const isPrivacy = route.params.doc === 'privacy';
  return (
    <Screen>
      <Title>{isPrivacy ? t('auth.privacyPolicy') : t('auth.terms')}</Title>
      <Notice tone="info">{t('legal.draftNotice')}</Notice>
      <Body>{isPrivacy ? t('legal.privacyBody') : t('legal.termsBody')}</Body>
    </Screen>
  );
}
