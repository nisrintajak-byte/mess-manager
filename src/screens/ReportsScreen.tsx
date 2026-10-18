import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import { dbErrorKey } from '../lib/errors';
import { isNetworkError } from '../lib/net';
import { buildReportCsv, buildReportHtml, reportFileName } from '../lib/report';
import { appReportFormat } from '../lib/reportFormat';
import { sharePdf, shareText } from '../lib/share';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Chip, ChipRow, Field, Label, Notice, Screen, Title } from '../ui/components';
import { useLoader } from '../ui/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'Reports'>;

/** PRD §15: members download their own report; Admins can also download the full Room. */
export function ReportsScreen({ route }: Props) {
  const { roomId, cycleId: initialCycle } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [scope, setScope] = useState<'mine' | 'room'>('mine');
  const [cycleId, setCycleId] = useState<string | null>(initialCycle ?? null);
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState('');
  const [verify, setVerify] = useState<string | null>(null);

  const { data } = useLoader(async () => {
    const [room, members, cycles] = await Promise.all([
      api.room(roomId),
      api.members(roomId),
      api.cycles(roomId),
    ]);
    return { room, members, cycles };
  }, roomId);

  const isAdmin = !!data?.members.some(
    (m) => m.user_id === me && m.status === 'approved' && m.role === 'admin',
  );

  async function make(kind: 'pdf' | 'csv') {
    setError(null);
    setBusy(kind);
    try {
      const report = await api.reportData(roomId, cycleId, isAdmin ? scope : 'mine');
      if (kind === 'pdf') {
        await sharePdf(
          buildReportHtml(report, appReportFormat()),
          reportFileName(report, 'pdf'),
          t('report.title'),
        );
      } else {
        await shareText(
          buildReportCsv(report, appReportFormat().t),
          reportFileName(report, 'csv'),
          'text/csv',
          t('report.title'),
        );
      }
    } catch (e) {
      setError(isNetworkError(e) ? t('report.needsInternet') : t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(null);
    }
  }

  async function check() {
    setVerify(null);
    try {
      const r = await api.verifyReport(ref);
      setVerify(
        r.found
          ? t('report.verifyFound', {
              date: localizeDigits((r.generated_at ?? '').slice(0, 16).replace('T', ' ')),
            })
          : t('report.verifyNotFound'),
      );
    } catch (e) {
      setVerify(isNetworkError(e) ? t('report.needsInternet') : t('common.genericError'));
    }
  }

  const cycles = (data?.cycles ?? []).filter((c) => !c.purged_at);

  return (
    <Screen>
      <Title>{t('report.title')}</Title>
      <Body muted>{t('report.explain')}</Body>
      {error ? <Notice tone="error">{error}</Notice> : null}

      {isAdmin ? (
        <Card>
          <Label>{t('report.scope')}</Label>
          <ChipRow>
            <Chip on={scope === 'mine'} label={t('report.scopeMine')} onPress={() => setScope('mine')} />
            <Chip on={scope === 'room'} label={t('report.scopeRoom')} onPress={() => setScope('room')} />
          </ChipRow>
        </Card>
      ) : null}

      <Card>
        <Label>{t('report.cycles')}</Label>
        <ChipRow>
          <Chip on={cycleId === null} label={t('report.allCycles')} onPress={() => setCycleId(null)} />
          {cycles.map((c) => (
            <Chip
              key={c.id}
              on={cycleId === c.id}
              label={localizeDigits(t('cycle.range', { from: c.starts_on, to: c.ends_on }))}
              onPress={() => setCycleId(c.id)}
            />
          ))}
        </ChipRow>
      </Card>

      <Button
        title={t('report.downloadPdf')}
        loading={busy === 'pdf'}
        disabled={!!busy}
        onPress={() => void make('pdf')}
      />
      <Button
        title={t('report.downloadCsv')}
        variant="secondary"
        loading={busy === 'csv'}
        disabled={!!busy}
        onPress={() => void make('csv')}
      />
      <Body muted>{t('report.retentionNote')}</Body>

      <Card>
        <Label>{t('report.verifyTitle')}</Label>
        <Field
          label={t('report.refLabel')}
          placeholder="MM-20261019-XXXXXXXX"
          value={ref}
          onChangeText={setRef}
          autoCapitalize="characters"
        />
        <Button
          title={t('report.verify')}
          variant="secondary"
          disabled={ref.trim().length < 8}
          onPress={() => void check()}
        />
        {verify ? <Body>{verify}</Body> : null}
      </Card>
    </Screen>
  );
}
