import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';
import { extensionFor, type ImageSelection } from './imageRules';

/** Thrown when a picked image could not be stored; the message is not shown. */
export class ImageUploadError extends Error {
  readonly code = 'image-upload-failed';
}

/**
 * The value to store in the Firestore image field. A picked file is uploaded
 * to Firebase Storage under `folder` (client SDK, no server code) and its
 * download URL is returned; a URL is kept as typed; no image is ''.
 */
export async function resolveImageSelection(
  selection: ImageSelection,
  folder: string,
): Promise<string> {
  if (selection.kind === 'none') return '';
  if (selection.kind === 'url') return selection.url.trim();
  try {
    const { file } = selection;
    const target = ref(storage, `${folder}/${Date.now()}.${extensionFor(file.type)}`);
    await uploadBytes(target, file, { contentType: file.type });
    return await getDownloadURL(target);
  } catch (error) {
    throw new ImageUploadError(String((error as { code?: string } | null)?.code ?? 'upload-failed'));
  }
}
