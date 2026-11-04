import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase';
import { t } from '../i18n';

/** The same limits as storage.rules. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export type ImageProblem = 'type' | 'size';

/** Why [file] cannot be uploaded, or null. */
export function imageProblem(file: File): ImageProblem | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'type';
  if (file.size >= IMAGE_MAX_BYTES) return 'size';
  return null;
}

export const imageProblemText = (p: ImageProblem): string =>
  p === 'type' ? t('نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP أو GIF.') : t('الصورة أكبر من 5MB.');

export class UploadError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

/** True for http(s) links with a host. */
export function isImageUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Uploads [file] to Firebase Storage under [folder] as a NEW file (never an
 * overwrite) and returns its download URL. Needs the project's Storage bucket
 * (paid plan); until it exists the upload fails with an [UploadError].
 */
export function uploadImage(file: File, folder: string, onProgress?: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const target = ref(storage, `${folder}/${Date.now()}.${EXT[file.type] ?? 'jpg'}`);
    const task = uploadBytesResumable(target, file, { contentType: file.type });
    task.on(
      'state_changed',
      (s) => onProgress?.(Math.round((s.bytesTransferred / Math.max(1, s.totalBytes)) * 100)),
      (error) => reject(new UploadError(String((error as { code?: string }).code ?? 'upload-failed'))),
      () => {
        getDownloadURL(target).then(resolve, (e) => reject(new UploadError(String((e as { code?: string }).code ?? 'url-failed'))));
      },
    );
  });
}

export const uploadProblemText = (e: unknown): string => {
  const code = e instanceof UploadError ? e.code : '';
  if (code === 'storage/unauthorized') return t('غير مسموح لك برفع هذه الصورة.');
  if (code === 'storage/canceled') return t('أُلغي الرفع.');
  return t('تعذّر رفع الصورة. الرفع من الجهاز يحتاج تفعيل التخزين في المشروع (الخطة المدفوعة)؛ يمكنك استخدام رابط الصورة في الوقت الحالي.');
};
