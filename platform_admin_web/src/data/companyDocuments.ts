import {
  Bytes,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';

/**
 * A company's registration: its commercial registration / licence number and
 * a photo of the document, stored as compressed JPEG bytes in Firestore at
 * `company_documents/{companyId}` (there is no Cloud Storage on this plan).
 * Only Platform Admin can read or write it; the public `companies` document
 * never carries either. Required when a company is added.
 */
export interface CompanyDocument {
  companyId: string;
  registrationNumber: string;
  fileName: string;
  contentType: string;
  width: number;
  height: number;
  bytes: Uint8Array;
  updatedAt: Date | null;
}

/** A document photo ready to store: already compressed to a JPEG. */
export interface PreparedDocumentImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  fileName: string;
}

export interface RegistrationInput {
  registrationNumber: string;
  document: PreparedDocumentImage | null;
}

export const REGISTRATION_NUMBER_MAX = 60;
/** Firestore documents are capped at 1 MiB; the rules allow up to this. */
export const DOCUMENT_MAX_BYTES = 700_000;
/** Long enough side to keep the small print of a certificate readable. */
const MAX_SIDE = 2000;
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

export type RegistrationProblem = 'number-required' | 'number-too-long' | 'document-required';

export function registrationProblems(input: RegistrationInput): RegistrationProblem[] {
  const number = input.registrationNumber.trim();
  const problems: RegistrationProblem[] = [];
  if (!number) problems.push('number-required');
  else if (number.length > REGISTRATION_NUMBER_MAX) problems.push('number-too-long');
  if (!input.document) problems.push('document-required');
  return problems;
}

/** The Firestore fields, exactly as the rules expect them. */
export function companyDocumentData(
  companyId: string,
  registrationNumber: string,
  image: PreparedDocumentImage,
) {
  return {
    companyId,
    registrationNumber: registrationNumber.trim(),
    fileName: documentFileName(image.fileName),
    contentType: 'image/jpeg',
    image: Bytes.fromUint8Array(image.bytes),
    sizeBytes: image.bytes.length,
    width: image.width,
    height: image.height,
    updatedAt: serverTimestamp(),
  };
}

/** The picked file's name as a .jpg (it is re-encoded), at most 100 characters. */
export function documentFileName(original: string): string {
  const base = original.trim().replace(/\.[^./\\]+$/, '') || 'document';
  return `${base.slice(0, 95)}.jpg`;
}

/** Null when there is no stored document, or its data is unusable. */
export function mapCompanyDocument(
  companyId: string,
  data: DocumentData | undefined,
): CompanyDocument | null {
  if (!data) return null;
  const image = data.image as { toUint8Array?: () => Uint8Array } | undefined;
  if (!image || typeof image.toUint8Array !== 'function') return null;
  const bytes = image.toUint8Array();
  if (bytes.length === 0) return null;
  const updated = data.updatedAt as { toDate?: () => Date } | undefined;
  return {
    companyId,
    registrationNumber: typeof data.registrationNumber === 'string' ? data.registrationNumber : '',
    fileName: typeof data.fileName === 'string' && data.fileName ? data.fileName : 'document.jpg',
    contentType: typeof data.contentType === 'string' ? data.contentType : 'image/jpeg',
    width: typeof data.width === 'number' ? data.width : 0,
    height: typeof data.height === 'number' ? data.height : 0,
    bytes,
    updatedAt: typeof updated?.toDate === 'function' ? updated.toDate() : null,
  };
}

export async function fetchCompanyDocument(
  db: Firestore,
  companyId: string,
): Promise<CompanyDocument | null> {
  const snap = await getDoc(doc(db, 'company_documents', companyId));
  return snap.exists() ? mapCompanyDocument(companyId, snap.data()) : null;
}

/** Adds or replaces the registration of an existing company. */
export const saveCompanyDocument = (
  db: Firestore,
  companyId: string,
  registrationNumber: string,
  image: PreparedDocumentImage,
) =>
  setDoc(
    doc(db, 'company_documents', companyId),
    companyDocumentData(companyId, registrationNumber, image),
  );

export class DocumentImageError extends Error {
  constructor(readonly code: 'not-an-image' | 'unreadable' | 'too-large') {
    super(code);
    this.name = 'DocumentImageError';
  }
}

/**
 * Turns a picked photo or scan into a JPEG small enough to store: scaled so
 * its longer side is at most 2000 px, then saved at the best quality that
 * fits under DOCUMENT_MAX_BYTES (smaller again if it still does not fit).
 */
export async function prepareDocumentImage(file: File): Promise<PreparedDocumentImage> {
  if (!file.type.startsWith('image/')) throw new DocumentImageError('not-an-image');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new DocumentImageError('unreadable');
  }
  try {
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new DocumentImageError('unreadable');
      // White behind transparent PNGs, which JPEG would otherwise turn black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of QUALITIES) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality),
        );
        if (!blob) throw new DocumentImageError('unreadable');
        if (blob.size <= DOCUMENT_MAX_BYTES) {
          return {
            bytes: new Uint8Array(await blob.arrayBuffer()),
            width,
            height,
            fileName: documentFileName(file.name),
          };
        }
      }
      scale *= 0.75;
    }
    throw new DocumentImageError('too-large');
  } finally {
    bitmap.close();
  }
}
