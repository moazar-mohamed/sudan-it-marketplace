import type { CategoryChoice } from './categories';
import { parseCsv } from './csv';
import { parseNumber } from './format';
import { isImageUrl } from './images';
import { t } from '../i18n';
import { createProduct, type ProductDraft } from './products';
import type { ProductStatus } from './types';

/** The columns of the import file, in the order of the template. */
export const IMPORT_HEADERS = ['الاسم', 'العلامة', 'التصنيف', 'السعر', 'المخزون', 'الوصف', 'توصيل', 'تركيب', 'سعر التركيب', 'الحالة', 'رمز المنتج', 'رابط الصورة'] as const;
type Header = (typeof IMPORT_HEADERS)[number];

/** Other names a column may carry (an English sheet, or the export's own headers). */
const ALIASES: Record<string, Header> = {
  name: 'الاسم', brand: 'العلامة', category: 'التصنيف', price: 'السعر', stock: 'المخزون', description: 'الوصف',
  delivery: 'توصيل', installation: 'تركيب', installation_price: 'سعر التركيب', status: 'الحالة', sku: 'رمز المنتج', image: 'رابط الصورة',
  'العلامة التجارية': 'العلامة', 'اسم المنتج': 'الاسم', 'الكمية': 'المخزون',
};

export const MAX_IMPORT_ROWS = 200;

export interface ImportRow {
  /** The row's number in the file (the header is row 1). */
  line: number;
  name: string;
  categoryLabel: string;
  price: number | null;
  stock: number;
  status: ProductStatus;
  draft: ProductDraft | null;
  errors: string[];
}

export interface ImportReading {
  rows: ImportRow[];
  /** Why the file cannot be read at all. */
  problem: string | null;
}

const YES = ['نعم', 'yes', 'y', '1', 'true', 'ايوه', 'أيوه'];
const NO = ['لا', 'no', 'n', '0', 'false'];
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

const yesNo = (value: string, fallback: boolean): boolean | null => {
  const v = norm(value);
  if (v === '') return fallback;
  if (YES.includes(v)) return true;
  if (NO.includes(v)) return false;
  return null;
};

const STATUS: Record<string, ProductStatus> = { 'منشور': 'published', published: 'published', 'مسودة': 'draft', draft: 'draft', 'مؤرشف': 'archived', archived: 'archived' };

/** The category an import row names: its full path ("حواسيب › لابتوبات") or its own name when that is unambiguous. */
export function findCategory(text: string, choices: CategoryChoice[]): CategoryChoice | null {
  const wanted = norm(text.replace(/\s*[>›]\s*/g, ' › '));
  if (wanted === '') return null;
  const byPath = choices.find((c) => norm(c.label) === wanted);
  if (byPath) return byPath;
  const byName = choices.filter((c) => norm(c.label.split(' › ').pop() ?? '') === wanted);
  return byName.length === 1 ? byName[0] : null;
}

/** Reads the file's text into rows ready to create, each with its own problems listed. */
export function readImport(text: string, choices: CategoryChoice[]): ImportReading {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], problem: t('الملف فارغ.') };
  const columns = new Map<Header, number>();
  table[0].forEach((h, i) => {
    const key = h.trim();
    const header = (IMPORT_HEADERS as readonly string[]).includes(key) ? (key as Header) : ALIASES[key.toLowerCase()] ?? ALIASES[key];
    if (header && !columns.has(header)) columns.set(header, i);
  });
  if (!columns.has('الاسم')) return { rows: [], problem: t('لم نجد عمود «الاسم» في السطر الأول. حمّل القالب واستعمل أسماء أعمدته.') };
  const body = table.slice(1);
  if (body.length === 0) return { rows: [], problem: t('الملف يحتوي على العناوين فقط، ولا منتجات فيه.') };
  if (body.length > MAX_IMPORT_ROWS) return { rows: [], problem: t('الملف فيه {0} صفًا. الحد الأقصى {1} في المرة الواحدة، فقسّمه إلى ملفين.', body.length, MAX_IMPORT_ROWS) };

  const cell = (row: string[], h: Header) => (columns.has(h) ? (row[columns.get(h) as number] ?? '').trim() : '');
  const seen = new Set<string>();

  const rows = body.map<ImportRow>((row, i) => {
    const errors: string[] = [];
    const name = cell(row, 'الاسم');
    const brand = cell(row, 'العلامة');
    const sku = cell(row, 'رمز المنتج');
    if (!name) errors.push(t('الاسم فارغ'));
    else if (name.length > 200) errors.push(t('الاسم أطول من 200 حرف'));
    else if (seen.has(norm(name))) errors.push(t('الاسم مكرر في الملف'));
    seen.add(norm(name));
    if (brand.length > 60) errors.push(t('العلامة أطول من 60 حرفًا'));
    if (sku.length > 60) errors.push(t('رمز المنتج أطول من 60 حرفًا'));

    const categoryText = cell(row, 'التصنيف');
    const category = findCategory(categoryText, choices);
    if (!categoryText) errors.push(t('التصنيف فارغ'));
    else if (!category) errors.push(t('التصنيف «{0}» غير موجود', categoryText));

    const priceText = cell(row, 'السعر');
    let price: number | null = null;
    if (priceText !== '') {
      price = parseNumber(priceText);
      if (price === null || price <= 0) { errors.push(t('السعر يجب أن يكون أكبر من صفر (أو اتركه فارغًا لـ«عند الطلب»)')); price = null; }
    }

    const stockText = cell(row, 'المخزون');
    let stock = 0;
    if (stockText !== '') {
      const n = parseNumber(stockText);
      if (n === null || !Number.isInteger(n) || n < 0) errors.push(t('المخزون يجب أن يكون عددًا صحيحًا، صفرًا أو أكثر'));
      else stock = n;
    }

    const delivery = yesNo(cell(row, 'توصيل'), true);
    if (delivery === null) errors.push(t('عمود «توصيل» يقبل نعم أو لا'));
    const installation = yesNo(cell(row, 'تركيب'), false);
    if (installation === null) errors.push(t('عمود «تركيب» يقبل نعم أو لا'));
    let installationPrice: number | null = null;
    if (installation) {
      installationPrice = parseNumber(cell(row, 'سعر التركيب'));
      if (installationPrice === null || installationPrice <= 0) errors.push(t('اكتب «سعر التركيب» (أكبر من صفر) للمنتج الذي فيه تركيب'));
    }

    const statusText = norm(cell(row, 'الحالة'));
    const status = statusText === '' ? 'draft' : STATUS[statusText];
    if (!status) errors.push(t('الحالة تقبل: منشور أو مسودة أو مؤرشف'));

    const image = cell(row, 'رابط الصورة');
    if (image !== '' && !isImageUrl(image)) errors.push(t('رابط الصورة غير صحيح (يبدأ بـ https://)'));

    const ok = errors.length === 0;
    const draft: ProductDraft | null = ok
      ? {
          name, brand, imageUrl: image, imageUrls: image ? [image] : [], categoryId: category!.id, price,
          description: cell(row, 'الوصف'), specifications: {},
          isDeliveryAvailable: delivery as boolean, isInstallationAvailable: installation as boolean, installationPrice,
          inStock: true, status: status as ProductStatus, sku, lowStockThreshold: null,
        }
      : null;
    return { line: i + 2, name, categoryLabel: category?.label ?? categoryText, price, stock, status: (status ?? 'draft') as ProductStatus, draft, errors };
  });
  return { rows, problem: null };
}

/** Creates the products one after another; reports how many were made and which rows failed. */
export async function importProducts(
  companyId: string,
  companyName: string,
  rows: ImportRow[],
  onProgress: (done: number, total: number) => void,
): Promise<{ created: number; failed: number[] }> {
  const ready = rows.filter((r) => r.draft);
  let created = 0;
  const failed: number[] = [];
  for (const [i, row] of ready.entries()) {
    try {
      await createProduct(companyId, companyName, row.draft as ProductDraft, row.stock);
      created++;
    } catch {
      failed.push(row.line);
    }
    onProgress(i + 1, ready.length);
  }
  return { created, failed };
}
