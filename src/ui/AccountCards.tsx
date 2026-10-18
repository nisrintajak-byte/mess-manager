import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { isNetworkError } from '../lib/net';
import { buildExportHtml, type DataExport } from '../lib/report';
import { appReportFormat } from '../lib/reportFormat';
import { sharePdf, shareText } from '../lib/share';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Label, Notice } from './components';

/** PRD §18.5: download all my data; delete my account. */
export function AccountDataCard() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [busy, setBusy] = useState<'pdf' | 'json' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: 'pdf' | 'json') {
    setError(null);
    setBusy(kind);
    try {
      const x = (await api.myDataExport()) as unknown as DataExport;
      const name = `MessManager-my-data-${x.ref}.${kind}`;
      if (kind === 'pdf')
        await sharePdf(buildExportHtml(x, appReportFormat()), name, t('account.exportTitle'));
      else await shareText(JSON.stringify(x, null, 2), name, 'application/json', t('account.exportTitle'));
    } catch (e) {
      setError(isNetworkError(e) ? t('report.needsInternet') : t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <Label>{t('account.title')}</Label>
      <Body muted>{t('account.exportExplain')}</Body>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        title={t('account.exportPdf')}
        variant="secondary"
        loading={busy === 'pdf'}
        disabled={!!busy}
        onPress={() => void download('pdf')}
      />
      <Button
        title={t('account.exportJson')}
        variant="secondary"
        loading={busy === 'json'}
        disabled={!!busy}
        onPress={() => void download('json')}
      />
      <Button
        title={t('account.deleteTitle')}
        variant="danger"
        onPress={() => navigation.navigate('DeleteAccount')}
      />
    </Card>
  );
}
