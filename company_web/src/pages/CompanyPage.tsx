import { useState } from 'react';
import { useCompanyData } from '../data/CompanyData';
import { saveServiceCities, saveProfile, savePaymentAccounts, savePickupPoints } from '../data/company';
import { cityChoicesFor, cityLabel, useCities } from '../data/cities';
import type { Company, PaymentAccount, PickupPoint } from '../data/types';
import { Icon } from '../ui/Icon';
import { ImageField } from '../ui/ImageField';
import { LocationField } from '../ui/LocationField';
import { Banner, Chip, ConfirmDialog, Loading, Modal, PageHeader, Spinner } from '../ui/kit';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

const MAX = 5;

export function CompanyPage() {
  const { company } = useCompanyData();
  if (!company) return <main className="page"><Loading /></main>;
  return (
    <main className="page">
      <PageHeader
        title={t('ملف الشركة')}
        subtitle={t('ما يراه العملاء عنك، وأين يحوّلون أموالهم، وأين يستلمون')}
        actions={<Chip tone={company.status === 'active' ? 'ok' : 'warn'}>{company.status === 'active' ? t('شركة نشطة · ظاهرة للعملاء') : t('غير ظاهرة للعملاء')}</Chip>}
      />
      <div className="stack">
        <ProfileCard company={company} />
        <AccountsCard company={company} />
        <PickupCard company={company} />
        <CitiesCard company={company} />
      </div>
    </main>
  );
}

function ProfileCard({ company }: { company: Company }) {
  const toast = useToast();
  const [name, setName] = useState(company.name);
  const [logoUrl, setLogoUrl] = useState(company.logoUrl);
  const [phone, setPhone] = useState(company.phone);
  const [description, setDescription] = useState(company.description);
  const [address, setAddress] = useState(company.address);
  const [latN, setLatN] = useState<number | null>(company.latitude);
  const [lngN, setLngN] = useState<number | null>(company.longitude);
  const [busy, setBusy] = useState(false);

  const valid = name.trim().length > 0 && name.trim().length <= 120;
  const dirty = name !== company.name || logoUrl !== company.logoUrl || phone !== company.phone || description !== company.description || address !== company.address || latN !== company.latitude || lngN !== company.longitude;

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try { await saveProfile(company, { name, logoUrl, description, address, phone, latitude: latN, longitude: lngN }); toast(t('تم حفظ الملف التعريفي'), 'ok'); }
    catch { toast(t('تعذّر الحفظ، حاول مرة أخرى.'), 'err'); } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label={t('الملف التعريفي')}>
      <div className="card-h"><h2>{t('الملف التعريفي والموقع')}</h2></div>
      <div className="card-b stack" style={{ gap: 16 }}>
        <ImageField value={logoUrl} onChange={setLogoUrl} folder={`company-logos/${company.id}`} label={t('شعار الشركة')} emptyText={t('لم تضف شعارًا بعد')} round />
        <div className="row wrap" style={{ alignItems: 'flex-start' }}>
          <div className="fld grow"><label htmlFor="c-name">{t('اسم الشركة')}</label><input id="c-name" className={`inp${name.trim() ? '' : ' err'}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld grow"><label htmlFor="c-phone">{t('هاتف الشركة')}</label><input id="c-phone" className="inp ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+249…" /></div>
        </div>
        <div className="fld"><label htmlFor="c-email">{t('البريد الإلكتروني')}</label><input id="c-email" className="inp ltr" value={company.email} disabled /><span className="hint">{t('بريد الشركة، يغيّره مدير المنصة.')}</span></div>
        <div className="fld"><label htmlFor="c-desc">{t('نبذة عن الشركة')}</label><textarea id="c-desc" className="inp" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="fld"><label htmlFor="c-addr">{t('العنوان المكتوب')}</label><input id="c-addr" className="inp" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <LocationField latitude={latN} longitude={lngN} onChange={(la, lo) => { setLatN(la); setLngN(lo); }} />
        <div className="row"><button type="button" className="btn p" disabled={!valid || !dirty || busy} onClick={() => void save()}>{busy && <Spinner />}{t('حفظ')}</button></div>
      </div>
    </section>
  );
}

function AccountsCard({ company }: { company: Company }) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ index: number | null; account: PaymentAccount } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const accounts = company.paymentAccounts;

  const persist = async (next: PaymentAccount[], done: string) => {
    setBusy(true);
    try { await savePaymentAccounts(company, next); toast(done, 'ok'); return true; }
    catch { toast(t('تعذّر الحفظ، حاول مرة أخرى.'), 'err'); return false; } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label={t('حسابات الدفع')}>
      <div className="card-h">
        <h2>{t('حسابات الدفع')}</h2><span className="sub">{t('{0} من {1}', accounts.length, MAX)}</span><span className="grow" />
        <button type="button" className="btn sm" disabled={accounts.length >= MAX} onClick={() => setEditing({ index: null, account: { bankName: '', accountName: '', accountNumber: '', phoneNumber: '' } })}><Icon name="plus" size="sm" />{t('إضافة حساب')}</button>
      </div>
      <div className="card-b stack t">
        <Banner tone="warn" icon="alert" tight>{t('تظهر هذه الحسابات للعميل في صفحة الدفع. راجع الأرقام جيدًا: الخطأ فيها يحوّل أموال عملائك إلى غيرك.')}</Banner>
        {accounts.length === 0 && <p className="muted">{t('لم تضف حساب دفع بعد. لن يعرف العملاء أين يحوّلون.')}</p>}
        {accounts.map((a, i) => (
          <div key={i} className="row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
            <div className="ico-c" style={{ background: 'var(--brand-tint)', color: 'var(--brand-ink)' }}><Icon name="wallet" /></div>
            <div className="grow"><div className="b">{a.bankName}</div><div className="sub">{a.accountName} · <span className="num">{a.accountNumber}</span>{a.phoneNumber ? <> · <span className="num">{a.phoneNumber}</span></> : null}</div></div>
            <button type="button" className="btn sm" onClick={() => setEditing({ index: i, account: a })}>{t('تعديل')}</button>
            <button type="button" className="btn sm d" onClick={() => setRemoving(i)}>{t('حذف')}</button>
          </div>
        ))}
      </div>
      {editing && <AccountDialog initial={editing.account} busy={busy} onClose={() => setEditing(null)} onSave={async (a) => {
        const next = editing.index === null ? [...accounts, a] : accounts.map((x, i) => (i === editing.index ? a : x));
        if (await persist(next, editing.index === null ? t('أُضيف الحساب') : t('تم تحديث الحساب'))) setEditing(null);
      }} />}
      {removing !== null && <ConfirmDialog title={t('حذف حساب الدفع؟')} body={t('{0} · {1}. لن يظهر للعملاء بعد الآن.', accounts[removing]?.bankName, accounts[removing]?.accountNumber)} confirmLabel={t('حذف')} danger busy={busy} onClose={() => setRemoving(null)} onConfirm={async () => { if (await persist(accounts.filter((_, i) => i !== removing), t('حُذف الحساب'))) setRemoving(null); }} />}
    </section>
  );
}

function AccountDialog({ initial, busy, onSave, onClose }: { initial: PaymentAccount; busy: boolean; onSave: (a: PaymentAccount) => void; onClose: () => void }) {
  const [a, setA] = useState(initial);
  const valid = a.bankName.trim().length > 0 && a.bankName.length <= 80 && a.accountNumber.trim().length > 0 && a.accountNumber.length <= 40 && a.accountName.length <= 120 && a.phoneNumber.length <= 30;
  const set = (k: keyof PaymentAccount, v: string) => setA((now) => ({ ...now, [k]: v }));
  return (
    <Modal title={initial.bankName ? t('تعديل حساب الدفع') : t('حساب دفع جديد')} onClose={onClose} busy={busy}
      footer={<><button type="button" className="btn p" disabled={!valid || busy} onClick={() => onSave(a)}>{busy && <Spinner />}{t('حفظ')}</button><button type="button" className="btn" disabled={busy} onClick={onClose}>{t('إلغاء')}</button></>}>
      <div className="fld"><label htmlFor="a-bank">{t('البنك أو المحفظة')}</label><input id="a-bank" className="inp" value={a.bankName} maxLength={80} onChange={(e) => set('bankName', e.target.value)} autoFocus placeholder={t('بنك الخرطوم (بنكك)')} /></div>
      <div className="fld"><label htmlFor="a-name">{t('اسم صاحب الحساب')}</label><input id="a-name" className="inp" value={a.accountName} maxLength={120} onChange={(e) => set('accountName', e.target.value)} /></div>
      <div className="fld"><label htmlFor="a-num">{t('رقم الحساب')}</label><input id="a-num" className="inp ltr" value={a.accountNumber} maxLength={40} onChange={(e) => set('accountNumber', e.target.value)} /></div>
      <div className="fld"><label htmlFor="a-phone">{t('الهاتف المرتبط')}{' '}<span className="muted">{t('(اختياري)')}</span></label><input id="a-phone" className="inp ltr" value={a.phoneNumber} maxLength={30} onChange={(e) => set('phoneNumber', e.target.value)} /></div>
    </Modal>
  );
}

function PickupCard({ company }: { company: Company }) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ index: number | null; point: PickupPoint } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const points = company.pickupPoints;

  const persist = async (next: PickupPoint[], done: string) => {
    setBusy(true);
    try { await savePickupPoints(company, next); toast(done, 'ok'); return true; }
    catch { toast(t('تعذّر الحفظ، حاول مرة أخرى.'), 'err'); return false; } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label={t('نقاط الاستلام')}>
      <div className="card-h">
        <h2>{t('نقاط الاستلام')}</h2><span className="sub">{t('{0} من {1}', points.length, MAX)}</span><span className="grow" />
        <button type="button" className="btn sm" disabled={points.length >= MAX} onClick={() => setEditing({ index: null, point: { name: '', address: '', latitude: null, longitude: null } })}><Icon name="plus" size="sm" />{t('إضافة نقطة')}</button>
      </div>
      <div className="card-b stack t">
        {points.length === 0 && <p className="muted">{t('بلا نقاط استلام: يستلم العميل من موقع شركتك المكتوب في الملف.')}</p>}
        {points.map((p, i) => (
          <div key={i} className="row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
            <div className="ico-c" style={{ background: 'var(--neutral-bg)' }}><Icon name="pin" /></div>
            <div className="grow"><div className="b">{p.name}</div><div className="sub">{p.address || t('بلا عنوان مكتوب')}{p.latitude !== null ? t(' · موقع على الخريطة') : ''}</div></div>
            <button type="button" className="btn sm" onClick={() => setEditing({ index: i, point: p })}>{t('تعديل')}</button>
            <button type="button" className="btn sm d" onClick={() => setRemoving(i)}>{t('حذف')}</button>
          </div>
        ))}
      </div>
      {editing && <PickupDialog initial={editing.point} busy={busy} onClose={() => setEditing(null)} onSave={async (p) => {
        const next = editing.index === null ? [...points, p] : points.map((x, i) => (i === editing.index ? p : x));
        if (await persist(next, editing.index === null ? t('أُضيفت النقطة') : t('تم تحديث النقطة'))) setEditing(null);
      }} />}
      {removing !== null && <ConfirmDialog title={t('حذف نقطة الاستلام؟')} body={points[removing]?.name} confirmLabel={t('حذف')} danger busy={busy} onClose={() => setRemoving(null)} onConfirm={async () => { if (await persist(points.filter((_, i) => i !== removing), t('حُذفت النقطة'))) setRemoving(null); }} />}
    </section>
  );
}

function PickupDialog({ initial, busy, onSave, onClose }: { initial: PickupPoint; busy: boolean; onSave: (p: PickupPoint) => void; onClose: () => void }) {
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [latN, setLatN] = useState<number | null>(initial.latitude);
  const [lngN, setLngN] = useState<number | null>(initial.longitude);
  const valid = name.trim().length > 0 && name.length <= 60 && address.length <= 200;
  return (
    <Modal title={initial.name ? t('تعديل نقطة الاستلام') : t('نقطة استلام جديدة')} onClose={onClose} busy={busy}
      footer={<><button type="button" className="btn p" disabled={!valid || busy} onClick={() => onSave({ name, address, latitude: latN, longitude: lngN })}>{busy && <Spinner />}{t('حفظ')}</button><button type="button" className="btn" disabled={busy} onClick={onClose}>{t('إلغاء')}</button></>}>
      <div className="fld"><label htmlFor="pk-name">{t('اسم النقطة')}</label><input id="pk-name" className="inp" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus placeholder={t('المعرض الرئيسي')} /></div>
      <div className="fld"><label htmlFor="pk-addr">{t('العنوان')}</label><input id="pk-addr" className="inp" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} /></div>
      <LocationField latitude={latN} longitude={lngN} onChange={(la, lo) => { setLatN(la); setLngN(lo); }} />
    </Modal>
  );
}

function CitiesCard({ company }: { company: Company }) {
  const toast = useToast();
  const cities = useCities();
  const [chosen, setChosen] = useState<string[]>(company.serviceCityIds);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify([...chosen].sort()) !== JSON.stringify([...company.serviceCityIds].sort());
  const toggle = (id: string) => setChosen((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  const save = async () => {
    setBusy(true);
    try { await saveServiceCities(company, chosen); toast(t('تم حفظ مدن الخدمة'), 'ok'); } catch { toast(t('تعذّر الحفظ.'), 'err'); } finally { setBusy(false); }
  };
  return (
    <section className="card" aria-label={t('مدن الخدمة')}>
      <div className="card-h"><h2>{t('مدن الخدمة')}</h2><span className="sub">{t('تظهر شركتك أولًا للعملاء في هذه المدن')}</span></div>
      <div className="card-b stack t">
        <div className="pills" role="group" aria-label={t('مدن الخدمة')}>
          {cityChoicesFor(cities, chosen).map((c) => <button key={c.id} type="button" className={`pill${chosen.includes(c.id) ? ' on' : ''}`} aria-pressed={chosen.includes(c.id)} onClick={() => toggle(c.id)}>{cityLabel(c)}</button>)}
        </div>
        <p className="hint">{t('إن لم تحدد مدنًا تظهر شركتك في كل المدن، ولا يُخفى شيء عن أحد.')}</p>
        <div className="row"><button type="button" className="btn p" disabled={!dirty || busy} onClick={() => void save()}>{busy && <Spinner />}{t('حفظ')}</button></div>
      </div>
    </section>
  );
}
