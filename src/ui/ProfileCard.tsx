import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { FileError, pickAndUploadAvatar } from '../lib/files';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';
import { Button, Card, Field, Label, Notice } from './components';
import { rowDirection, space } from './theme';

/** My profile (PRD §7.7): name and photo that Room members see. */
export function ProfileCard() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const uid = session?.user.id ?? '';
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ name: string; photo: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!uid) return;
    void api
      .myProfile(uid)
      .then((p) => {
        setName(p.display_name);
        setPhoto(p.avatar_url);
        setSaved({ name: p.display_name, photo: p.avatar_url });
      })
      .catch(() => undefined);
  }, [uid]);

  async function choose(source: 'camera' | 'gallery') {
    setMsg(null);
    try {
      const path = await pickAndUploadAvatar(uid, source);
      if (path) setPhoto(path);
    } catch (e) {
      setMsg({ tone: 'error', text: t(e instanceof FileError ? e.key : 'files.uploadFailed') });
    }
  }

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      await api.updateProfile(name.trim(), photo);
      // keep the greeting on Home in step
      await supabase.auth.updateUser({ data: { display_name: name.trim() } }).catch(() => undefined);
      setSaved({ name: name.trim(), photo });
      setMsg({ tone: 'success', text: t('profile.saved') });
    } catch (e) {
      setMsg({ tone: 'error', text: t(dbErrorKey(e as { message?: string })) });
    } finally {
      setBusy(false);
    }
  }

  const changed = !!saved && (saved.name !== name.trim() || saved.photo !== photo);
  return (
    <Card>
      <Label>{t('profile.title')}</Label>
      <View
        style={{ flexDirection: rowDirection(), alignItems: 'center', gap: space.md, marginBottom: space.md }}
      >
        <Avatar name={name || '?'} photo={photo} size={64} />
        <View style={{ flex: 1 }}>
          <Button title={t('profile.gallery')} variant="secondary" onPress={() => void choose('gallery')} />
          <Button title={t('profile.camera')} variant="secondary" onPress={() => void choose('camera')} />
          {photo ? (
            <Button title={t('profile.removePhoto')} variant="link" onPress={() => setPhoto(null)} />
          ) : null}
        </View>
      </View>
      <Field label={t('profile.name')} value={name} onChangeText={setName} maxLength={80} />
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button
        title={t('profile.save')}
        loading={busy}
        disabled={!changed || !name.trim()}
        onPress={() => void save()}
      />
    </Card>
  );
}
