import { useTranslation } from 'react-i18next';

import { legalTexts } from '../legal';
import { Screen, Title } from '../ui/components';
import { LegalBody } from '../ui/LegalBody';

/** Privacy Policy / Terms in the reader's language (PRD §20). Drafts until lawyer sign-off. */
export function LegalScreen({ route }: { route: { params: { doc: 'privacy' | 'terms' } } }) {
  const { i18n } = useTranslation();
  return (
    <Screen>
      <Title>{legalTexts(i18n.language)[route.params.doc].title}</Title>
      <LegalBody doc={route.params.doc} />
    </Screen>
  );
}
