import type { ReceiptImage } from './types';
import { t } from '../i18n';

// Port of receipt_image_compressor.dart: receipts live in Firestore as JPEG
// bytes (no Storage on this plan), so they must stay small.

/** Largest the rules accept. */
const MAX_BYTES = 700000;
/** What to aim for: 150-350 KB is typical for a screenshot of a bank receipt. */
const TARGET_BYTES = 350000;
/** Largest original worth trying to decode. */
const MAX_PICKED_BYTES = 25 * 1024 * 1024;
const MAX_FILE_NAME = 100;

/** (longest side, JPEG quality), from best quality to smallest size. */
const LADDER: readonly [number, number][] = [
  [1280, 70],
  [1280, 55],
  [1024, 55],
  [1024, 45],
  [800, 45],
  [640, 40],
];

export class ReceiptProblem extends Error {}

const TOO_LARGE = t('ما زالت الصورة كبيرة جدًا بعد الضغط. اختر صورة أصغر.');
const UNREADABLE = t('تعذّرت قراءة هذا الملف كصورة. اختر صورة أو لقطة شاشة للإيصال.');

/** The stored name: the file's base name, always ending in `.jpg`, within the limit. */
export function jpegName(name: string): string {
  let base = (name.split(/[\\/]/).pop() ?? '').trim();
  const dot = base.lastIndexOf('.');
  if (dot > 0) base = base.slice(0, dot);
  if (base === '') base = 'receipt';
  return `${base.slice(0, MAX_FILE_NAME - 4)}.jpg`;
}

/** [width]×[height] fitted within [longEdge], never enlarged. */
export function fitWithin(width: number, height: number, longEdge: number): { width: number; height: number } {
  const scale = Math.min(1, longEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function encode(bitmap: ImageBitmap, longEdge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const size = fitWithin(bitmap.width, bitmap.height, longEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new ReceiptProblem(UNREADABLE));
  // JPEG has no transparency: flatten onto white, like a printed receipt.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, ...size }) : reject(new ReceiptProblem(UNREADABLE))),
      'image/jpeg',
      quality / 100,
    );
  });
}

/**
 * Decodes [file] (whether it is an image is decided by decoding it, never by its
 * name) and shrinks it step by step until it is within the target.
 */
export async function prepareReceipt(file: File): Promise<ReceiptImage> {
  if (file.size === 0) throw new ReceiptProblem(UNREADABLE);
  if (file.size > MAX_PICKED_BYTES) throw new ReceiptProblem(TOO_LARGE);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ReceiptProblem(UNREADABLE);
  }
  try {
    let result: Awaited<ReturnType<typeof encode>> | null = null;
    for (const [longEdge, quality] of LADDER) {
      result = await encode(bitmap, longEdge, quality);
      if (result.blob.size <= TARGET_BYTES) break;
    }
    if (!result || result.blob.size > MAX_BYTES) throw new ReceiptProblem(TOO_LARGE);
    return {
      fileName: jpegName(file.name),
      bytes: new Uint8Array(await result.blob.arrayBuffer()),
      width: result.width,
      height: result.height,
    };
  } finally {
    bitmap.close();
  }
}
