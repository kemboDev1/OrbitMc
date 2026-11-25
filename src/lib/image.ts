import { AppError } from '../data/errors';

/**
 * Reads a picture, shrinks it and re-encodes still images as JPEG.
 * Animated GIFs can be passed through unchanged. Re-encoding still images also drops EXIF data.
 */
export async function fileToDataUrl(file: File, maxSide: number, maxChars: number, preserveGif = false): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new AppError('err.imgType');
  if (file.size > 12 * 1024 * 1024) throw new AppError('err.imgBig');
  if (preserveGif && file.type === 'image/gif') {
    if (file.size > maxChars * 0.74) throw new AppError('err.imgBig');
    const animatedGif = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new AppError('err.imgType'));
      reader.onerror = () => reject(new AppError('err.imgType'));
      reader.readAsDataURL(file);
    });
    if (animatedGif.length > maxChars) throw new AppError('err.imgBig');
    return animatedGif;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AppError('err.imgType');
  }
  let side = maxSide;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.84, 0.7, 0.55]) {
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= maxChars) {
        bitmap.close();
        return url;
      }
    }
    side = Math.round(side * 0.7);
  }
  bitmap.close();
  throw new AppError('err.imgBig');
}
