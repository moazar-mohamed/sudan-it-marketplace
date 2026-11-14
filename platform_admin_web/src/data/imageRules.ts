/*
 * Rules shared by every image input. The type list and size limit match
 * storage.rules, which enforces them again on the server.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

export type ImageFileProblem = 'unsupported' | 'tooLarge';

export function checkImageFile(file: { type: string; size: number }): ImageFileProblem | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return 'unsupported';
  if (file.size > MAX_IMAGE_BYTES) return 'tooLarge';
  return null;
}

/** True for a non-empty http(s) link with a host. */
export function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}

/** What an image input currently holds; a picked file is uploaded on save. */
export type ImageSelection =
  | { kind: 'none' }
  | { kind: 'url'; url: string }
  | { kind: 'file'; file: File; preview: string };

export const NO_IMAGE: ImageSelection = { kind: 'none' };

export function extensionFor(type: string): string {
  switch (type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}
