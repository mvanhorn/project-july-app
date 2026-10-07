// Save or share the camera picture on screen. Live view's pictures are data: URIs
// (from the MJPEG stream) or the oven's latest.jpg URL (the stills fallback).
// Either becomes a JPEG in the cache first. URLs go through fetch, so the home
// certificate rules in modules/july-tls still apply.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { savePhoto } from './savePhoto';

function fileName(oven: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const slug = oven.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'oven';
  return `${slug}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}

async function toFile(src: string, name: string): Promise<File> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  if (src.startsWith('data:')) {
    file.write(src.slice(src.indexOf(',') + 1), { encoding: 'base64' });
  } else {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    file.write(new Uint8Array(await res.arrayBuffer()));
  }
  return file;
}

/** The web dev build: a download link stands in for the photo library. */
function downloadOnWeb(src: string, name: string) {
  const a = document.createElement('a');
  a.href = src;
  a.download = name;
  a.click();
}

export async function savePicture(src: string, oven: string): Promise<void> {
  const name = fileName(oven);
  if (Platform.OS === 'web') { downloadOnWeb(src, name); return; }
  const file = await toFile(src, name);
  try {
    await savePhoto(file.uri);
  } finally {
    file.delete();
  }
}

export async function sharePicture(src: string, oven: string): Promise<void> {
  const file = await toFile(src, fileName(oven));
  // The share sheet may still be reading the file, so it stays in the cache.
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: `${oven} camera` });
}

/** Sharing a file needs the native share sheet (not the web build). */
export const canShare = Platform.OS !== 'web';

/** Save and Share with a short message afterwards ("Saved to Photos"). */
export function usePictureActions(src: string | null, oven: string) {
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const say = (text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  };

  async function save() {
    if (!src || busy) return;
    setBusy('save');
    try {
      await savePicture(src, oven);
      say(Platform.OS === 'web' ? 'Downloaded' : 'Saved to Photos');
    } catch (e) {
      say(e instanceof Error && e.message === 'permission' ? 'Allow Photos access in Settings to save' : 'Couldn’t save the picture');
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!src || busy) return;
    setBusy('share');
    try {
      await sharePicture(src, oven);
    } catch {
      say('Couldn’t share the picture');
    } finally {
      setBusy(null);
    }
  }

  return { save, share, busy, message, ready: !!src };
}
