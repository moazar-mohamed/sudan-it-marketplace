import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { money, parseNumber, productsText } from '../data/format';
import type { Company, Product } from '../data/types';
import { finishRepricing, isBigChange, isValidRate, needsRepricing, rateAge, saveUsdRate, usdPrice, usdText } from '../data/usdPricing';
import { db } from '../firebase';
import { Icon } from './Icon';
import { Banner, Modal, Spinner, Switch } from './kit';
import { useToast } from './toast';
import { ARROW, t } from '../i18n';

const daysText = (n: number) => (n === 1 ? t('يوم') : n === 2 ? t('يومين') : n <= 10 ? t('{0} أيام', n) : t('{0} يومًا', n));

function ageText(updatedAt: Date | null): string {
  if (!updatedAt) return t('سعر الدولار قديم، أسعار منتجاتك بالدولار ممكن تكون غلط');
  const time = updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(updatedAt)) / 86_400_000);
  return days <= 0 ? t('محدّث اليوم {0}', time) : days === 1 ? t('آخر تحديث أمس {0}', time) : t('آخر تحديث قبل {0}', daysText(days));
}

/**
 * The company's dollar rate: the first card on Today, and the one place it is
 * set, confirmed ("same rate") or changed. Once the company sells in dollars
 * its colour follows the rate's age: green, amber after a day, red after two.
 * It also finishes a rewrite of the dollar products that was cut short.
 */
export function UsdRateCard({ company, products }: { company: Company; products: Product[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const finishedFor = useRef<number | null>(null);
  const rate = company.usdRate;
  const usdCount = products.filter((p) => p.priceUsd !== null).length;

  useEffect(() => {
    if (rate === null || finishedFor.current === rate || !products.some((p) => needsRepricing(p, rate))) return;
    finishedFor.current = rate;
    void finishRepricing(rate, products);
  }, [rate, products]);

  const confirmSame = async () => {
    if (rate === null || busy) return;
    setBusy(true);
    try {
      await saveUsdRate(company.id, rate, products);
      toast(t('تم تأكيد سعر الدولار'), 'ok');
    } catch {
      toast(t('تعذّر حفظ سعر الدولار. حاول مرة أخرى.'), 'err');
    } finally {
      setBusy(false);
    }
  };

  const dialog = open && <UsdRateDialog company={company} products={products} onClose={() => setOpen(false)} />;

  if (rate === null) {
    return (
      <section className="card usd-card" aria-label={t('سعر الدولار')}>
        <div className="grow">
          <div className="lbl"><Icon name="dollar" />{t('حدّد سعر الدولار')}</div>
          <div className="sub">{t('سعّر منتجاتك بالدولار. كل مرة تغيّر السعر هنا، تتحدّث أسعارها كلها بالجنيه.')}</div>
        </div>
        <button type="button" className="btn p" onClick={() => setOpen(true)}>{t('حدّد السعر')}</button>
        {dialog}
      </section>
    );
  }

  const age = rateAge(company.usdRateUpdatedAt);
  // A company that does not sell in dollars is never warned.
  const tone = usdCount === 0 ? '' : age === 'fresh' ? ' ok' : age === 'due' ? ' warn' : ' bad';
  const warning = usdCount === 0 || age === 'fresh' ? null : age === 'due' ? t('حان وقت تحديث سعر الدولار') : t('سعر الدولار قديم، أسعار منتجاتك بالدولار ممكن تكون غلط');
  return (
    <section className={`card usd-card${tone}`} aria-label={t('سعر الدولار')}>
      <div className="grow">
        <div className="lbl"><Icon name="dollar" />{t('سعر الدولار')}</div>
        <div className="rate num" dir="ltr">{t('1$ = {0} SDG', usdText(rate))}</div>
        <div className="sub">
          {ageText(company.usdRateUpdatedAt)} · {usdCount === 0 ? t('لا توجد منتجات بالدولار بعد') : t('{0} بالدولار', productsText(usdCount))}
        </div>
        {warning && <div className="say" role="status"><Icon name="alert" />{warning}</div>}
      </div>
      <div className="row">
        <button type="button" className="btn" disabled={busy} onClick={() => void confirmSame()}>{busy && <Spinner />}{t('السعر نفسه')}</button>
        <button type="button" className="btn p" disabled={busy} onClick={() => setOpen(true)}><Icon name="edit" />{t('تعديل')}</button>
      </div>
      {dialog}
    </section>
  );
}

/**
 * Sets or changes the dollar rate. It shows what the new rate does to the
 * dollar products before saving, asks again when the rate jumps by more than
 * a fifth, and holds the switch of the 24-hour phone reminder.
 */
export function UsdRateDialog({ company, products, onClose }: { company: Company; products: Product[]; onClose: () => void }) {
  const toast = useToast();
  const { state } = useAuth();
  const uid = state.status === 'authorized' ? state.profile.uid : '';
  const [text, setText] = useState(company.usdRate === null ? '' : String(company.usdRate));
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [reminder, setReminder] = useState(true);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), (s) => setReminder(s.data()?.pushPrefs?.usdRate !== false), () => undefined);
  }, [uid]);

  const rate = parseNumber(text);
  const valid = isValidRate(rate);
  const old = company.usdRate;
  const usdProducts = products.filter((p) => p.priceUsd !== null);
  const changing = valid ? usdProducts.filter((p) => needsRepricing(p, rate)) : [];
  const example = changing[0];

  const save = async () => {
    if (!valid || busy) return;
    if (!asking && isBigChange(old, rate)) {
      setAsking(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveUsdRate(company.id, rate, products);
      toast(t('تم حفظ سعر الدولار'), 'ok');
      onClose();
    } catch {
      setError(t('تعذّر حفظ سعر الدولار. حاول مرة أخرى.'));
      setBusy(false);
    }
  };

  const switchReminder = (on: boolean) => {
    setReminder(on);
    if (uid) void updateDoc(doc(db, 'users', uid), { 'pushPrefs.usdRate': on }).catch(() => setReminder(!on));
  };

  return (
    <Modal
      title={t('سعر الدولار')}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn p" disabled={!valid || busy} onClick={() => void save()}>
            {busy && <Spinner />}{asking ? t('نعم، احفظه') : t('حفظ السعر')}</button>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>{t('إلغاء')}</button>
        </>
      }
    >
      <div className="fld">
        <label htmlFor="usd-rate">{t('كم جنيه في الدولار الواحد؟')}</label>
        <div className="sfx">
          <input id="usd-rate" className={`inp ltr${text.trim() && !valid ? ' err' : ''}`} inputMode="decimal" autoFocus value={text}
            onChange={(e) => { setText(e.target.value); setAsking(false); }} onKeyDown={(e) => e.key === 'Enter' && void save()} />
          <span>SDG</span>
        </div>
        {text.trim() && !valid && <span className="errt">{t('أدخل سعرًا بين 1 و1,000,000.')}</span>}
      </div>
      {usdProducts.length === 0 ? (
        <Banner tone="info" tight>{t('لا توجد منتجات بالدولار بعد: اختر «بالدولار» في صفحة المنتج.')}</Banner>
      ) : example ? (
        <Banner tone="info" tight>
          <b>{t('سيتغير سعر {0}.', productsText(changing.length))}</b>{' '}
          {t('مثلًا {0}:', example.name)}{' '}
          <span className="num">{money(example.price)} {ARROW} {money(usdPrice(example.priceUsd as number, rate as number))} SDG</span>
        </Banner>
      ) : null}
      {asking && old !== null && valid && (
        <Banner tone="warn" icon="alert">
          <b>{t('متأكد من السعر؟')}</b>
          <div>{t('السعر الجديد {0} يبعد عن {1} بنسبة {2}%.', usdText(rate), usdText(old), Math.round((Math.abs(rate - old) / old) * 100))}</div>
        </Banner>
      )}
      <div className="row">
        <Switch on={reminder} onChange={switchReminder} label={t('ذكّرني بتحديث سعر الدولار')} disabled={!uid} />
        <div className="grow">
          <div className="b">{t('ذكّرني بتحديث سعر الدولار')}</div>
          <div className="sub">{t('إشعار على الهاتف كل 24 ساعة ما دام السعر لم يُحدَّث')}</div>
        </div>
      </div>
      {error && <span className="errt">{error}</span>}
    </Modal>
  );
}
