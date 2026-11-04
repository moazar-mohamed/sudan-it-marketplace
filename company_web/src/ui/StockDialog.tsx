import { useState } from 'react';
import { adjustStock, nextStock, StockError, type StockMode } from '../data/products';
import { parseNumber, unitsText } from '../data/format';
import type { Product } from '../data/types';
import { Banner, Modal, Spinner } from './kit';
import { useToast } from './toast';
import { ARROW, t } from '../i18n';

/**
 * Changes a product's stock from the number stored on the server right now, so
 * a sale confirmed while this dialog is open is never lost. [demand] is the
 * quantity waiting in orders whose payment is not confirmed yet.
 */
export function StockDialog({ product, demand, onClose }: { product: Product; demand: number; onClose: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<StockMode>('add');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const amount = parseNumber(text);
  const valid = amount !== null && Number.isInteger(amount) && amount >= 0 && amount <= 1_000_000;
  const result = valid ? nextStock(product.stockCount, mode, amount) : null;
  const negative = result !== null && result < 0;
  const short = result !== null && !negative && demand > result;

  const save = async () => {
    if (!valid || negative || busy) return;
    setBusy(true);
    setError('');
    try {
      const { before, after } = await adjustStock(product.id, mode, amount);
      toast(t('تم تحديث المخزون: {0} ← {1}', before, after), 'ok');
      onClose();
    } catch (e) {
      setError(
        e instanceof StockError
          ? e.problem === 'negative'
            ? t('لا يمكن أن ينزل المخزون عن صفر. المخزون الحالي على الخادم تغيّر، راجع الرقم.')
            : e.problem === 'gone'
              ? t('المنتج لم يعد موجودًا.')
              : t('اكتب عددًا صحيحًا.')
          : t('تعذّر حفظ المخزون، حاول مرة أخرى.'),
      );
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('تعديل مخزون: {0}', product.name)}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn p" disabled={!valid || negative || busy} onClick={() => void save()}>
            {busy && <Spinner />}{t('حفظ')}</button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>{t('إلغاء')}</button>
        </>
      }
    >
      <div className="seg full" role="group" aria-label={t('نوع التعديل')}>
        {([['add', t('إضافة')], ['subtract', t('خصم')], ['set', t('ضبط الرقم (جرد)')]] as const).map(([m, label]) => (
          <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>
      <div className="fld">
        <label htmlFor="stock-amount">{mode === 'set' ? t('الكمية الفعلية في المخزن') : t('الكمية')}</label>
        <input id="stock-amount" className="inp ltr" inputMode="numeric" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
      </div>
      <div className="row" style={{ background: 'var(--brand-tint)', color: 'var(--brand-ink)', borderRadius: 10, padding: '10px 14px', justifyContent: 'space-between' }}>
        <span>{t('الناتج')}</span>
        <b style={{ fontSize: 18 }}>
          <span className="num">{product.stockCount} {ARROW} {result === null ? '…' : result}</span>
        </b>
      </div>
      {negative && <span className="errt">{t('لا يمكن أن ينزل المخزون عن صفر.')}</span>}
      {short && (
        <Banner tone="warn" icon="alert" tight>{t('عليه {0} مطلوبة في طلبات تنتظر تأكيد الدفع، والناتج لا يغطيها.', unitsText(demand))}</Banner>
      )}
      {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
      <p className="hint">{t('يُحسب على الرقم الموجود وقت الحفظ، فلا يضيع أي بيع تم أثناء تعديلك.')}</p>
    </Modal>
  );
}
