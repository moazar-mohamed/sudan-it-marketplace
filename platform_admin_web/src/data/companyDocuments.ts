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
 * a photo or PDF of the document, stored as bytes in Firestore at
 * `company_documents/{companyId}` (there is no Cloud Storage on this plan).
 * Only Platform Admin can read or write it; the public `companies` document
 * never carries either. Required when a company is added.
 */
export interface CompanyDocument {
  companyId: string;
  registrationNumber: string;
  fileName: string;
  contentType: DocumentContentType;
  /** 0 for a PDF: it is stored as picked, never rasterized. */
  width: number;
  height: number;
  bytes: Uint8Array;
  updatedAt: Date | null;
}

export type DocumentContentType = 'image/jpeg' | 'application/pdf';

/** A document file ready to store: an image already compressed to a JPEG, or
 * a PDF kept exactly as picked (checked to already fit under the limit). */
export interface PreparedDocumentFile {
  bytes: Uint8Array;
  contentType: DocumentContentType;
  /** 0 for a PDF. */
  width: number;
  height: number;
  fileName: string;
}

export interface RegistrationInput {
  registrationNumber: string;
  document: PreparedDocumentFile | null;
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
  file: PreparedDocumentFile,
) {
  return {
    companyId,
    registrationNumber: registrationNumber.trim(),
    fileName: documentFileName(file.fileName, file.contentType),
    contentType: file.contentType,
    image: Bytes.fromUint8Array(file.bytes),
    sizeBytes: file.bytes.length,
    // Omitted for a PDF: the rules only require them for an image.
    ...(file.contentType === 'image/jpeg' ? { width: file.width, height: file.height } : {}),
    updatedAt: serverTimestamp(),
  };
}

/** The picked file's name with the right extension, at most 100 characters.
 * An image is re-encoded, so it is always named .jpg; a PDF keeps its name. */
export function documentFileName(original: string, contentType: DocumentContentType): string {
  const base = original.trim().replace(/\.[^./\\]+$/, '') || 'document';
  const ext = contentType === 'application/pdf' ? 'pdf' : 'jpg';
  return `${base.slice(0, 95)}.${ext}`;
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
  const contentType: DocumentContentType = data.contentType === 'application/pdf' ? 'application/pdf' : 'image/jpeg';
  return {
    companyId,
    registrationNumber: typeof data.registrationNumber === 'string' ? data.registrationNumber : '',
    fileName:
      typeof data.fileName === 'string' && data.fileName
        ? data.fileName
        : contentType === 'application/pdf'
          ? 'document.pdf'
          : 'document.jpg',
    contentType,
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
  file: PreparedDocumentFile,
) =>
  setDoc(
    doc(db, 'company_documents', companyId),
    companyDocumentData(companyId, registrationNumber, file),
  );

export class DocumentFileError extends Error {
  constructor(
    readonly code: 'unsupported-type' | 'unreadable' | 'too-large',
    /** Set for 'too-large': the picked file's actual size. */
    readonly sizeBytes?: number,
  ) {
    super(code);
    this.name = 'DocumentFileError';
  }
}

/**
 * Turns a picked photo, scan or PDF into what gets stored:
 * - An image is compressed to a JPEG whose longer side is at most 2000 px,
 *   at the best quality that fits under DOCUMENT_MAX_BYTES (smaller again if
 *   it still does not fit).
 * - A PDF is kept exactly as picked; it is refused with its size if it is
 *   already over DOCUMENT_MAX_BYTES, since it is not re-encoded.
 */
export async function prepareDocumentFile(file: File): Promise<PreparedDocumentFile> {
  if (file.type === 'application/pdf') {
    if (file.size > DOCUMENT_MAX_BYTES) throw new DocumentFileError('too-large', file.size);
    return {
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: 'application/pdf',
      width: 0,
      height: 0,
      fileName: file.name,
    };
  }
  if (!file.type.startsWith('image/')) throw new DocumentFileError('unsupported-type');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new DocumentFileError('unreadable');
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
      if (!context) throw new DocumentFileError('unreadable');
      // White behind transparent PNGs, which JPEG would otherwise turn black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      for (const quality of QUALITIES) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality),
        );
        if (!blob) throw new DocumentFileError('unreadable');
        if (blob.size <= DOCUMENT_MAX_BYTES) {
          return {
            bytes: new Uint8Array(await blob.arrayBuffer()),
            contentType: 'image/jpeg',
            width,
            height,
            fileName: file.name,
          };
        }
      }
      scale *= 0.75;
    }
    throw new DocumentFileError('too-large', file.size);
  } finally {
    bitmap.close();
  }
}
