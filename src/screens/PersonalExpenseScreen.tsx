import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, PERSONAL_CATEGORIES, type PersonalCategory } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { formatMinor, parseAmount } from '../lib/money';
import { isNetworkError } from '../lib/net';
import { cleanCurrency, currencyDecimals, defaultCurrency, deviceToday } from '../lib/personal';
import { getPref, setPref } from '../lib/prefs';
import { isIsoDate, shiftDay, uuid } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Chip, ChipRow, Field, Label, Notice, Screen, Spacer } from '../ui/components';
import { DateInput } from '../ui/DateInput';
import { confirm } from '../ui/hooks';

type Props = NativeStackScreenProps<AppStackParamList, 'PersonalExpense'>;

const CURRENCY_PREF = 'personalCurrency';

/** Add or edit one personal expense (v1.1). Private to the member; never shared with a Room. */
export function PersonalExpenseScreen({ navigation, route }: Props) {
  const id = route.params?.id ?? null;
  const editing = !!id;
  const { t } = useTranslation();

  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [choices, setChoices] = useState<string[]>([]);
  const [otherCurrency, setOtherCurrency] = useState('');
  const [showOther, setShowOther] = useState(false);
  const [category, setCategory] = useState<PersonalCategory | null>(null);
  const [date, setDate] = useState(deviceToday());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null);
  // one key per form: a double tap or a retry never saves twice
  const clientId = useRef(uuid()).current;

  useEffect(() => {
    navigation.setOptions({ title: t(editing ? 'personal.editTitle' : 'personal.addTitle') });
  }, [navigation, editing, t]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [last, rooms] = await Promise.all([
        getPref(CURRENCY_PREF),
        api.myRoomsOverview().catch(() => []),
      ]);
      const roomCurrencies = rooms.map((r) => r.currency);
      const start = defaultCurrency(last, roomCurrencies[0] ?? null);
      let cur = start;
      if (id) {
        const x = await api.personalExpense(id);
        if (!alive) return;
        if (!x) {
          setServerError(t('errors.not_found'));
          return;
        }
        setTitle(x.title);
        setAmount(formatMinor(x.amount, x.currency_decimals));
        setCategory(x.category);
        setDate(x.expense_date);
        setNotes(x.notes ?? '');
        cur = x.currency;
      }
      if (!alive) return;
      setCurrency(cur);
      setChoices([...new Set([cur, start, ...roomCurrencies])]);
      setReady(true);
    })().catch(() => alive && setServerError(t('common.genericError')));
    return () => {
      alive = false;
    };
  }, [id, t]);

  const decimals = currency ? currencyDecimals(currency) : 2;

  function pickOther() {
    const code = cleanCurrency(otherCurrency);
    if (!code) {
      setErrors((e) => ({ ...e, currency: t('personal.currencyInvalid') }));
      return;
    }
    setErrors(({ currency: _drop, ...rest }) => rest);
    setCurrency(code);
    setChoices((c) => [...new Set([code, ...c])]);
    setShowOther(false);
    setOtherCurrency('');
  }

  async function save() {
    const e: Record<string, string> = {};
    const minor = parseAmount(amount, decimals);
    if (!title.trim()) e.title = t('personal.titleRequired');
    if (!amount.trim() || (minor !== null && minor <= 0)) e.amount = t('errors.personal_amount_invalid');
    else if (minor === null) e.amount = t('expense.amountInvalid', { decimals });
    if (!isIsoDate(date)) e.date = t('expense.dateInvalid');
    else if (date > deviceToday()) e.date = t('errors.future_date');
    setErrors(e);
    if (Object.keys(e).length > 0 || minor === null) return;
    setServerError(null);
    setBusy('save');
    try {
      await api.savePersonalExpense(id, clientId, {
        title: title.trim(),
        amount: minor,
        currency,
        decimals,
        category,
        date,
        notes,
      });
      await setPref(CURRENCY_PREF, currency);
      navigation.goBack();
    } catch (err) {
      setServerError(
        isNetworkError(err) ? t('report.needsInternet') : t(dbErrorKey(err as { message?: string })),
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!id) return;
    const ok = await confirm(t('personal.deleteConfirm'), t('expense.delete'), t('common.cancel'));
    if (!ok) return;
    setServerError(null);
    setBusy('delete');
    try {
      await api.deletePersonalExpense(id);
      navigation.goBack();
    } catch (err) {
      setServerError(
        isNetworkError(err) ? t('report.needsInternet') : t(dbErrorKey(err as { message?: string })),
      );
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return (
      <Screen>
        {serverError ? <Notice tone="error">{serverError}</Notice> : <Body muted>{t('common.loading')}</Body>}
      </Screen>
    );
  }

  const today = deviceToday();
  const yesterday = shiftDay(today, -1);

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('personal.save')}
            onPress={() => void save()}
            loading={busy === 'save'}
            disabled={!!busy}
          />
          {editing ? (
            <Button
              title={t('expense.delete')}
              variant="danger"
              onPress={() => void remove()}
              loading={busy === 'delete'}
              disabled={!!busy}
            />
          ) : null}
        </>
      }
    >
      <Body muted>{t('personal.privateNote')}</Body>
      <Spacer size="md" />
      {serverError ? <Notice tone="error">{serverError}</Notice> : null}
      <Field
        label={t('expense.title')}
        placeholder={t('personal.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
        error={errors.title}
      />
      <Field
        big
        label={t('expense.amount', { currency })}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={formatMinor(0, decimals)}
        error={errors.amount}
      />

      <Label>{t('personal.currency')}</Label>
      <ChipRow>
        {choices.map((c) => (
          <Chip key={c} on={c === currency} onPress={() => setCurrency(c)} label={c} />
        ))}
        <Chip on={showOther} onPress={() => setShowOther((v) => !v)} label={t('personal.otherCurrency')} />
      </ChipRow>
      {showOther ? (
        <>
          <Field
            label={t('personal.currencyCode')}
            placeholder="USD"
            value={otherCurrency}
            onChangeText={setOtherCurrency}
            autoCapitalize="characters"
            maxLength={3}
            error={errors.currency}
            onSubmitEditing={pickOther}
          />
          <Button title={t('personal.useCurrency')} variant="secondary" onPress={pickOther} />
        </>
      ) : null}
      <Spacer size="md" />

      <Label>{t('personal.category')}</Label>
      <ChipRow>
        {PERSONAL_CATEGORIES.map((c) => (
          <Chip
            key={c}
            on={category === c}
            onPress={() => setCategory(category === c ? null : c)}
            label={t(`personal.cat_${c}`)}
          />
        ))}
      </ChipRow>
      <Spacer size="md" />

      <Label>{t('expense.date')}</Label>
      <ChipRow>
        <Chip on={date === today} onPress={() => setDate(today)} label={t('expense.today')} />
        <Chip on={date === yesterday} onPress={() => setDate(yesterday)} label={t('expense.yesterday')} />
      </ChipRow>
      <DateInput label={t('expense.otherDate')} value={date} onChange={setDate} error={errors.date} />

      <Field label={t('expense.notes')} value={notes} onChangeText={setNotes} multiline maxLength={1000} />
    </Screen>
  );
}
