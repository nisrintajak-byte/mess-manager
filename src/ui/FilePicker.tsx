import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';

import { FileError, pickImage, pickPdf, PickedFile, signedUrl, uploadRoomFile } from '../lib/files';
import { Button, Label, Meta, Notice, Row } from './components';
import { rowDirection } from './theme';

/**
 * Attach an image (camera/gallery, compressed) or PDF and upload it to the Room's private folder.
 * Calls onChange with the storage path (or null when removed).
 */
export function FilePicker({
  roomId,
  label,
  value,
  onChange,
  allowPdf = true,
}: {
  roomId: string;
  label: string;
  value: string | null;
  onChange: (path: string | null) => void;
  allowPdf?: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(pick: () => Promise<PickedFile | null>) {
    setError(null);
    try {
      const file = await pick();
      if (!file) return;
      setBusy(true);
      onChange(await uploadRoomFile(roomId, file));
    } catch (e) {
      setError(t(e instanceof FileError ? e.key : 'files.uploadFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Label>{label}</Label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {value ? (
        <Row>
          <Meta>{t('receipt.attached')}</Meta>
          <View style={{ flexDirection: rowDirection() }}>
            <ViewFileButton path={value} />
            <Button title={t('receipt.remove')} variant="link" onPress={() => onChange(null)} />
          </View>
        </Row>
      ) : busy ? (
        <Meta>{t('receipt.uploading')}</Meta>
      ) : (
        <View style={{ flexDirection: rowDirection(), gap: 8, flexWrap: 'wrap' }}>
          <Button
            title={t('receipt.camera')}
            variant="secondary"
            onPress={() => run(() => pickImage('camera'))}
          />
          <Button
            title={t('receipt.gallery')}
            variant="secondary"
            onPress={() => run(() => pickImage('gallery'))}
          />
          {allowPdf ? (
            <Button title={t('receipt.pdf')} variant="secondary" onPress={() => run(pickPdf)} />
          ) : null}
        </View>
      )}
    </View>
  );
}

/** Opens a private file through a short-lived signed link. */
export function ViewFileButton({ path, title }: { path: string; title?: string }) {
  const { t } = useTranslation();
  return (
    <Button
      title={title ?? t('receipt.view')}
      variant="link"
      onPress={async () => {
        const url = await signedUrl(path);
        if (url) await Linking.openURL(url);
      }}
    />
  );
}
