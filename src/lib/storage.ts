import { requireSupabase } from './supabase';
import { AppError } from '../data/errors';
import { uid } from './util';
import { fileToDataUrl } from './image';

export const UPLOADS_BUCKET = 'uploads';
export const STORAGE_URL_RE = /^https:\/\/[a-z0-9.-]+\/storage\/v1\/object\/public\/uploads\/[a-zA-Z0-9/_.-]+$/;

export function isStorageMediaUrl(value?: string | null): boolean {
  return !!value && value.length <= 500 && STORAGE_URL_RE.test(value);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = /^data:([^;]+);base64$/i.exec(header ?? '');
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Uploads an audio or binary Blob to Supabase Storage when authenticated on a server-backed
 * account, returning its CDN URL. Falls back cleanly to a compact Data URL for Demo accounts.
 */
export async function uploadMediaBlob(options: {
  userId: string;
  folder: 'voice' | 'chat' | 'avatars' | 'banners';
  blob: Blob;
  ext: string;
  serverBacked?: boolean;
  fallbackDataUrl?: string;
}): Promise<string> {
  if (!options.serverBacked) {
    if (options.fallbackDataUrl) return options.fallbackDataUrl;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new AppError('err.generic')));
      reader.onerror = () => reject(new AppError('err.generic'));
      reader.readAsDataURL(options.blob);
    });
  }

  const client = requireSupabase();
  const cleanExt = options.ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const objectPath = `${options.userId}/${options.folder}/${Date.now()}_${uid(8)}.${cleanExt}`;
  const { error } = await client.storage.from(UPLOADS_BUCKET).upload(objectPath, options.blob, {
    contentType: options.blob.type || undefined,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    // Graceful fallback if storage quota/network fails for smaller attachments
    if (options.fallbackDataUrl) return options.fallbackDataUrl;
    throw new AppError('err.messageSendFailed');
  }
  const { data } = client.storage.from(UPLOADS_BUCKET).getPublicUrl(objectPath);
  if (!data?.publicUrl) throw new AppError('err.messageSendFailed');
  return data.publicUrl;
}

/**
 * Resizes and strips EXIF metadata from an image file via `fileToDataUrl`, then uploads it
 * to Supabase Storage for server-backed accounts (or returns the Data URL for local Demo mode).
 */
export async function processAndUploadImage(options: {
  file: File;
  userId: string;
  folder: 'chat' | 'avatars' | 'banners';
  maxSide: number;
  maxChars: number;
  preserveGif?: boolean;
  serverBacked?: boolean;
}): Promise<string> {
  const dataUrl = await fileToDataUrl(options.file, options.maxSide, options.maxChars, options.preserveGif);
  if (!options.serverBacked) return dataUrl;
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === 'image/gif' ? 'gif' : 'jpg';
  return uploadMediaBlob({
    userId: options.userId,
    folder: options.folder,
    blob,
    ext,
    serverBacked: true,
    fallbackDataUrl: dataUrl,
  });
}
