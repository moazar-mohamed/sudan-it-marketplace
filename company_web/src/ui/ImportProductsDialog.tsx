import { useRef, useState } from 'react';
import { downloadCsv } from '../data/csv';
import { importProducts, IMPORT_HEADERS, MAX_IMPORT_ROWS, readImport, type ImportReading } from '../data/importProducts';
import type { CategoryChoice } from '../data/categories';
import { money } from '../data/format';
import { Icon } from './Icon';
import { Banner, Chip, Modal, Spinner } from './kit';
import { useToast } from './toast';

const STATUS_LABEL = { published: 'منشور', draft: 'مسودة', archived: 'مؤرشف' } as const;

/**
 * Adds many products from one CSV file: pick the file, see every row checked,
 * then create the good ones. They arrive as drafts unless the file says «منشور»,
 * so nothing goes live by accident.
 */
export function ImportProductsDialog({
  companyId,
  companyName,
  choices,
  onClose,
}: {
  companyId: string;
  companyName: string;
  choices: CategoryChoice[];
  onClose: () => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<ImportReading | null>(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const running = progress !== null;
  const good = reading?.rows.filter((r) => r.draft).length ?? 0;
  const bad = (reading?.rows.length ?? 0) - good;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    try {
      setReading(readImport(await file.text(), choices));
    } catch {
      setReading({ rows: [], problem: 'تعذّرت قراءة الملف.' });
    }
  };

  const template = () => {
    const example = choices[0]?.label ?? 'اكتب اسم تصنيف موجود';
    downloadCsv('products-template.csv', [
      [...IMPORT_HEADERS],
      ['راوتر TP-Link AX55', 'TP-Link', example, 186000, 24, 'راوتر واي فاي 6', 'نعم', 'لا', '', 'مسودة', 'TP-AX55', ''],
    ]);
  };

  const run = async () => {
    if (!reading || good === 0) return;
    setProgress({ done: 0, total: good });
    const { created, failed } = await importProducts(companyId, companyName, reading.rows, (done, total) => setProgress({ done, total }));
    toast(
      failed.length ? `أُضيف ${created} منتجًا وتعذّر ${failed.length} (الصفوف: ${failed.join('، ')})` : `أُضيف ${created} منتجًا`,
      failed.length ? 'err' : 'ok',
    );
    onClose();
  };

  return (
    <Modal
      xl
      title="استيراد منتجات من ملف CSV"
      onClose={onClose}
      busy={running}
      footer={
        <>
          {reading && !reading.problem && (
            <button type="button" className="btn p" disabled={good === 0 || running} onClick={() => void run()}>
              {running ? <Spinner /> : <Icon name="upload" />}
              {running ? `جارٍ الإضافة… ${progress.done} من ${progress.total}` : `إضافة ${good} منتجًا`}
            </button>
          )}
          {reading && <button type="button" className="btn" disabled={running} onClick={() => { setReading(null); input.current?.click(); }}>اختيار ملف آخر</button>}
          <button type="button" className="btn g" disabled={running} onClick={onClose}>إلغاء</button>
        </>
      }
    >
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

      {!reading && (
        <>
          <p className="muted">
            جهّز المنتجات في ملف CSV (يفتحه Excel وGoogle Sheets)، بالأعمدة الموجودة في القالب. الحد الأقصى {MAX_IMPORT_ROWS} منتجًا في المرة. تُضاف المنتجات <b>مسودة</b> ما لم تكتب في عمود «الحالة» كلمة «منشور»، فلا يراها العملاء قبل أن تراجعها.
          </p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn p" onClick={() => input.current?.click()}><Icon name="upload" />اختيار ملف CSV</button>
            <button type="button" className="btn" onClick={template}><Icon name="download" />تنزيل القالب</button>
          </div>
          <details>
            <summary className="b" style={{ cursor: 'pointer' }}>التصنيفات المتاحة ({choices.length})</summary>
            <p className="sub" style={{ margin: '8px 0' }}>اكتب اسم التصنيف في عمود «التصنيف» كما يظهر هنا (أو اسمه الأخير إن لم يتكرر).</p>
            <ul className="sub" style={{ margin: 0, paddingInlineStart: 20, maxHeight: 160, overflow: 'auto' }}>
              {choices.map((c) => <li key={c.id}>{c.label}</li>)}
            </ul>
          </details>
        </>
      )}

      {reading?.problem && <Banner tone="bad" icon="alert">{reading.problem}</Banner>}

      {reading && !reading.problem && (
        <>
          <div className="row wrap" style={{ gap: 8 }}>
            <span className="sub">{fileName}</span>
            <Chip tone="ok" dot={false}>{good} صالحًا</Chip>
            {bad > 0 && <Chip tone="bad" dot={false}>{bad} فيها أخطاء (لن تُضاف)</Chip>}
          </div>
          <div className="scroll" style={{ maxHeight: 300, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 12 }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>الملاحظات</th></tr></thead>
              <tbody>
                {reading.rows.map((r) => (
                  <tr key={r.line}>
                    <td className="num">{r.line}</td>
                    <td>{r.name || '—'}</td>
                    <td className="sub">{r.categoryLabel || '—'}</td>
                    <td>{r.price === null ? <span className="sub">عند الطلب</span> : <span className="num">{money(r.price)}</span>}</td>
                    <td className="num">{r.stock}</td>
                    <td>{STATUS_LABEL[r.status]}</td>
                    <td>{r.errors.length === 0 ? <Chip tone="ok" dot={false} small>جاهز</Chip> : <span className="errt">{r.errors.join('، ')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
