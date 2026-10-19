import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAdFreeUntil } from '../lib/adFree';
import { ADS_ENABLED } from '../lib/adsConfig';
import {
  BILLING_SUPPORTED,
  buy,
  type BuyResult,
  loadPlans,
  manageSubscription,
  type Plan,
  restorePurchases,
} from '../lib/billing';
import { localizeDigits } from '../lib/digits';
import { Body, Button, Card, Label, Notice } from './components';

/** Ad-free subscription (monthly / yearly) through Google Play. Android app only. */
export function RemoveAdsCard() {
  const { t } = useTranslation();
  const until = useAdFreeUntil();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<BuyResult | null>(null);

  useEffect(() => {
    if (BILLING_SUPPORTED && ADS_ENABLED) void loadPlans().then(setPlans);
  }, []);
  if (!BILLING_SUPPORTED || !ADS_ENABLED) return null;

  async function run(key: string, action: () => Promise<BuyResult>) {
    setBusy(key);
    setResult(null);
    setResult(await action());
    setBusy(null);
  }

  return (
    <Card>
      <Label>{t('adFree.title')}</Label>
      {until ? (
        <>
          <Notice tone="success">{t('adFree.active', { date: localizeDigits(until.slice(0, 10)) })}</Notice>
          <Button title={t('adFree.manage')} variant="link" onPress={() => void manageSubscription()} />
        </>
      ) : (
        <>
          <Body muted>{t('adFree.explain')}</Body>
          {plans && plans.length === 0 ? <Notice tone="info">{t('adFree.notAvailable')}</Notice> : null}
          {(plans ?? []).map((p) => (
            <Button
              key={p.id}
              title={t(p.id.endsWith('yearly') ? 'adFree.buyYearly' : 'adFree.buyMonthly', {
                price: p.price,
              })}
              variant={p.id.endsWith('yearly') ? 'primary' : 'secondary'}
              loading={busy === p.id}
              disabled={!!busy}
              onPress={() => void run(p.id, () => buy(p))}
            />
          ))}
          <Button
            title={t('adFree.restore')}
            variant="link"
            loading={busy === 'restore'}
            disabled={!!busy}
            onPress={() => void run('restore', restorePurchases)}
          />
        </>
      )}
      {result === 'ok' ? <Notice tone="success">{t('adFree.thanks')}</Notice> : null}
      {result === 'pending' ? <Notice tone="info">{t('adFree.pending')}</Notice> : null}
      {result === 'error' || result === 'not_configured' ? (
        <Notice tone="error">{t('adFree.error')}</Notice>
      ) : null}
    </Card>
  );
}
