import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Hand a generated file to the user: on the phone the system share sheet opens (save to Files,
 * WhatsApp, email…); in the browser the file downloads, and PDFs open the print dialog
 * ("Save as PDF").
 */

function webDownload(content: string, name: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function webPrint(html: string): void {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  }, 400);
}

/** HTML → PDF file → share sheet (phone) or print dialog (web). */
export async function sharePdf(html: string, name: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    webPrint(html);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  new File(uri).move(target);
  await Sharing.shareAsync(target.uri, { mimeType: 'application/pdf', dialogTitle, UTI: 'com.adobe.pdf' });
}

/** Text file (CSV / JSON) → share sheet (phone) or download (web). */
export async function shareText(
  content: string,
  name: string,
  mime: string,
  dialogTitle: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    webDownload(content, name, mime);
    return;
  }
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle });
}
