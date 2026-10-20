/**
 * Receipts and payment proofs (PRD §10.3): camera, gallery or PDF; max 10 MB;
 * images compressed on device; stored privately at <roomId>/<uuid>.<ext>.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { isNetworkError } from './net';
import { supabase } from './supabase';
import { uuid } from './util';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const BUCKET = 'room-files';

export interface PickedFile {
  uri: string;
  mime: 'image/jpeg' | 'image/png' | 'application/pdf';
  name: string;
}

export class FileError extends Error {
  constructor(public key: string) {
    super(key);
  }
}

async function compress(uri: string): Promise<PickedFile> {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, mime: 'image/jpeg', name: 'image.jpg' };
}

export async function pickImage(source: 'camera' | 'gallery'): Promise<PickedFile | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new FileError('files.cameraDenied');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  return compress(res.assets[0].uri);
}

export async function pickPdf(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if (a.size && a.size > MAX_FILE_BYTES) throw new FileError('files.tooLarge');
  return { uri: a.uri, mime: 'application/pdf', name: a.name };
}

/** Upload and return the storage path to save with the expense/payment. */
export async function uploadRoomFile(roomId: string, file: PickedFile): Promise<string> {
  const body = await (await fetch(file.uri)).arrayBuffer();
  if (body.byteLength > MAX_FILE_BYTES) throw new FileError('files.tooLarge');
  const ext = file.mime === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${roomId}/${uuid()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: file.mime,
    upsert: false,
  });
  if (error) throw new FileError(isNetworkError(error) ? 'files.offline' : 'files.uploadFailed');
  return path;
}

/** Short-lived link (5 minutes) to view a private file. */
export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

// ---- offline: keep the picked file on the phone and upload it when the network is back ----
const LOCAL = 'local::';

/** A receipt picked while offline is stored as `local::<mime>::<uri>` until it can be uploaded. */
export function encodeLocalFile(file: PickedFile): string {
  return `${LOCAL}${file.mime}::${file.uri}`;
}

export function isLocalFile(path: string | null | undefined): path is string {
  return !!path && path.startsWith(LOCAL);
}

/** Upload a locally kept file; returns the real storage path. */
export async function uploadLocalFile(roomId: string, local: string): Promise<string> {
  const [mime, ...rest] = local.slice(LOCAL.length).split('::');
  const uri = rest.join('::');
  const m = mime === 'application/pdf' ? 'application/pdf' : 'image/jpeg';
  return uploadRoomFile(roomId, { uri, mime: m, name: m === 'application/pdf' ? 'file.pdf' : 'image.jpg' });
}

// ---- profile photos (PRD §7.7): private 'avatars' bucket, <userId>/<uuid>.jpg ----
export const AVATAR_BUCKET = 'avatars';

/** Pick a square-ish photo, shrink it to 512 px and upload it; returns the storage path. */
export async function pickAndUploadAvatar(
  userId: string,
  source: 'camera' | 'gallery',
): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new FileError('files.cameraDenied');
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: true,
    aspect: [1, 1],
  };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const out = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 512 } }], {
    compress: 0.75,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const body = await (await fetch(out.uri)).arrayBuffer();
  const path = `${userId}/${uuid()}.jpg`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new FileError(isNetworkError(error) ? 'files.offline' : 'files.uploadFailed');
  return path;
}

const avatarLinks = new Map<string, { url: string; until: number }>();

/** Short-lived link for a profile photo (cached for 50 minutes). */
export async function avatarUrl(path: string): Promise<string | null> {
  const hit = avatarLinks.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  avatarLinks.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
