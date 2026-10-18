import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/AuthProvider';
import { useNetState } from '../lib/offlineStore';
import { discardItem, retryItem, runOutbox, useOutbox } from '../lib/outbox';
import { Badge, Body, Button, Card, Meta, Notice, Row, Screen, Spacer, Title } from '../ui/components';
import { confirm } from '../ui/hooks';

/** Everything saved on this phone that has not reached the server yet (PRD §17.2 rule 5). */
export function SyncScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const items = useOutbox().filter((i) => i.userId === session?.user.id);
  const { offline } = useNetState();

  async function discard(id: string) {
    if (await confirm(t('sync.discardConfirm'), t('common.yes'), t('common.no'))) await discardItem(id);
  }

  return (
    <Screen>
      <Title>{t('sync.title')}</Title>
      {offline ? <Notice tone="info">{t('sync.offlineBanner')}</Notice> : null}
      {items.length === 0 ? <Body muted>{t('sync.empty')}</Body> : null}
      {items.map((i) => (
        <Card key={i.id}>
          <Row>
            <Body>{i.label}</Body>
            {i.amountText ? <Meta>{i.amountText}</Meta> : null}
          </Row>
          <Meta>{t(`sync.type_${i.type}`)}</Meta>
          <Spacer size="sm" />
          {i.status === 'failed' ? (
            <>
              <Badge tone="bad">{t('sync.failed')}</Badge>
              {i.errorKey ? <Notice tone="error">{t(i.errorKey)}</Notice> : null}
              <Button title={t('sync.retry')} variant="secondary" onPress={() => void retryItem(i.id)} />
              <Button title={t('sync.discard')} variant="link" onPress={() => void discard(i.id)} />
            </>
          ) : (
            <>
              <Badge tone="warn">{t('sync.badge')}</Badge>
              <Button title={t('sync.syncNow')} variant="secondary" onPress={() => void runOutbox()} />
              <Button title={t('sync.discard')} variant="link" onPress={() => void discard(i.id)} />
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}
