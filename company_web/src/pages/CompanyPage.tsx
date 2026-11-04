import { useState } from 'react';
import { useCompanyData } from '../data/CompanyData';
import { saveServiceCities, saveProfile, savePaymentAccounts, savePickupPoints } from '../data/company';
import { cityChoicesFor, useCities } from '../data/cities';
import { parseNumber } from '../data/format';
import type { Company, PaymentAccount, PickupPoint } from '../data/types';
import { Icon } from '../ui/Icon';
import { ImageField } from '../ui/ImageField';
import { Banner, Chip, ConfirmDialog, Loading, Modal, PageHeader, Spinner } from '../ui/kit';
import { useToast } from '../ui/toast';

const MAX = 5;

export function CompanyPage() {
  const { company } = useCompanyData();
  if (!company) return <main className="page"><Loading /></main>;
  return (
    <main className="page">
      <PageHeader
        title="ملف الشركة"
        subtitle="ما يراه العملاء عنك، وأين يحوّلون أموالهم، وأين يستلمون"
        actions={<Chip tone={company.status === 'active' ? 'ok' : 'warn'}>{company.status === 'active' ? 'شركة نشطة · ظاهرة للعملاء' : 'غير ظاهرة للعملاء'}</Chip>}
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
  const [lat, setLat] = useState(company.latitude === null ? '' : String(company.latitude));
  const [lng, setLng] = useState(company.longitude === null ? '' : String(company.longitude));
  const [busy, setBusy] = useState(false);

  const latN = lat.trim() === '' ? null : parseNumber(lat);
  const lngN = lng.trim() === '' ? null : parseNumber(lng);
  const coordsOk = (latN === null && lngN === null) || (latN !== null && lngN !== null && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180);
  const valid = name.trim().length > 0 && name.trim().length <= 120 && coordsOk;
  const dirty = name !== company.name || logoUrl !== company.logoUrl || phone !== company.phone || description !== company.description || address !== company.address || lat !== (company.latitude === null ? '' : String(company.latitude)) || lng !== (company.longitude === null ? '' : String(company.longitude));

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    try { await saveProfile(company, { name, logoUrl, description, address, phone, latitude: latN, longitude: lngN }); toast('تم حفظ الملف التعريفي', 'ok'); }
    catch { toast('تعذّر الحفظ، حاول مرة أخرى.', 'err'); } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label="الملف التعريفي">
      <div className="card-h"><h2>الملف التعريفي والموقع</h2></div>
      <div className="card-b stack" style={{ gap: 16 }}>
        <ImageField value={logoUrl} onChange={setLogoUrl} folder={`company-logos/${company.id}`} label="شعار الشركة" emptyText="لم تضف شعارًا بعد" round />
        <div className="row wrap" style={{ alignItems: 'flex-start' }}>
          <div className="fld grow"><label htmlFor="c-name">اسم الشركة</label><input id="c-name" className={`inp${name.trim() ? '' : ' err'}`} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fld grow"><label htmlFor="c-phone">هاتف الشركة</label><input id="c-phone" className="inp ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+249…" /></div>
        </div>
        <div className="fld"><label htmlFor="c-email">البريد الإلكتروني</label><input id="c-email" className="inp ltr" value={company.email} disabled /><span className="hint">بريد الشركة، يغيّره مدير المنصة.</span></div>
        <div className="fld"><label htmlFor="c-desc">نبذة عن الشركة</label><textarea id="c-desc" className="inp" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="fld"><label htmlFor="c-addr">العنوان المكتوب</label><input id="c-addr" className="inp" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
        <div className="row wrap" style={{ alignItems: 'flex-start' }}>
          <div className="fld grow"><label htmlFor="c-lat">خط العرض (اختياري)</label><input id="c-lat" className="inp ltr" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="15.5007" /></div>
          <div className="fld grow"><label htmlFor="c-lng">خط الطول (اختياري)</label><input id="c-lng" className="inp ltr" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="32.5599" /></div>
        </div>
        {!coordsOk && <span className="errt">اكتب خطَّي العرض والطول معًا بقيم صحيحة، أو اتركهما فارغين.</span>}
        <div className="row"><button type="button" className="btn p" disabled={!valid || !dirty || busy} onClick={() => void save()}>{busy && <Spinner />}حفظ</button></div>
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
    catch { toast('تعذّر الحفظ، حاول مرة أخرى.', 'err'); return false; } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label="حسابات الدفع">
      <div className="card-h">
        <h2>حسابات الدفع</h2><span className="sub">{accounts.length} من {MAX}</span><span className="grow" />
        <button type="button" className="btn sm" disabled={accounts.length >= MAX} onClick={() => setEditing({ index: null, account: { bankName: '', accountName: '', accountNumber: '', phoneNumber: '' } })}><Icon name="plus" size="sm" />إضافة حساب</button>
      </div>
      <div className="card-b stack t">
        <Banner tone="warn" icon="alert" tight>تظهر هذه الحسابات للعميل في صفحة الدفع. راجع الأرقام جيدًا: الخطأ فيها يحوّل أموال عملائك إلى غيرك.</Banner>
        {accounts.length === 0 && <p className="muted">لم تضف حساب دفع بعد. لن يعرف العملاء أين يحوّلون.</p>}
        {accounts.map((a, i) => (
          <div key={i} className="row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
            <div className="ico-c" style={{ background: 'var(--brand-tint)', color: 'var(--brand-ink)' }}><Icon name="wallet" /></div>
            <div className="grow"><div className="b">{a.bankName}</div><div className="sub">{a.accountName} · <span className="num">{a.accountNumber}</span>{a.phoneNumber ? <> · <span className="num">{a.phoneNumber}</span></> : null}</div></div>
            <button type="button" className="btn sm" onClick={() => setEditing({ index: i, account: a })}>تعديل</button>
            <button type="button" className="btn sm d" onClick={() => setRemoving(i)}>حذف</button>
          </div>
        ))}
      </div>
      {editing && <AccountDialog initial={editing.account} busy={busy} onClose={() => setEditing(null)} onSave={async (a) => {
        const next = editing.index === null ? [...accounts, a] : accounts.map((x, i) => (i === editing.index ? a : x));
        if (await persist(next, editing.index === null ? 'أُضيف الحساب' : 'تم تحديث الحساب')) setEditing(null);
      }} />}
      {removing !== null && <ConfirmDialog title="حذف حساب الدفع؟" body={`${accounts[removing]?.bankName} · ${accounts[removing]?.accountNumber}. لن يظهر للعملاء بعد الآن.`} confirmLabel="حذف" danger busy={busy} onClose={() => setRemoving(null)} onConfirm={async () => { if (await persist(accounts.filter((_, i) => i !== removing), 'حُذف الحساب')) setRemoving(null); }} />}
    </section>
  );
}

function AccountDialog({ initial, busy, onSave, onClose }: { initial: PaymentAccount; busy: boolean; onSave: (a: PaymentAccount) => void; onClose: () => void }) {
  const [a, setA] = useState(initial);
  const valid = a.bankName.trim().length > 0 && a.bankName.length <= 80 && a.accountNumber.trim().length > 0 && a.accountNumber.length <= 40 && a.accountName.length <= 120 && a.phoneNumber.length <= 30;
  const set = (k: keyof PaymentAccount, v: string) => setA((now) => ({ ...now, [k]: v }));
  return (
    <Modal title={initial.bankName ? 'تعديل حساب الدفع' : 'حساب دفع جديد'} onClose={onClose} busy={busy}
      footer={<><button type="button" className="btn p" disabled={!valid || busy} onClick={() => onSave(a)}>{busy && <Spinner />}حفظ</button><button type="button" className="btn" disabled={busy} onClick={onClose}>إلغاء</button></>}>
      <div className="fld"><label htmlFor="a-bank">البنك أو المحفظة</label><input id="a-bank" className="inp" value={a.bankName} maxLength={80} onChange={(e) => set('bankName', e.target.value)} autoFocus placeholder="بنك الخرطوم (بنكك)" /></div>
      <div className="fld"><label htmlFor="a-name">اسم صاحب الحساب</label><input id="a-name" className="inp" value={a.accountName} maxLength={120} onChange={(e) => set('accountName', e.target.value)} /></div>
      <div className="fld"><label htmlFor="a-num">رقم الحساب</label><input id="a-num" className="inp ltr" value={a.accountNumber} maxLength={40} onChange={(e) => set('accountNumber', e.target.value)} /></div>
      <div className="fld"><label htmlFor="a-phone">الهاتف المرتبط <span className="muted">(اختياري)</span></label><input id="a-phone" className="inp ltr" value={a.phoneNumber} maxLength={30} onChange={(e) => set('phoneNumber', e.target.value)} /></div>
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
    catch { toast('تعذّر الحفظ، حاول مرة أخرى.', 'err'); return false; } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label="نقاط الاستلام">
      <div className="card-h">
        <h2>نقاط الاستلام</h2><span className="sub">{points.length} من {MAX}</span><span className="grow" />
        <button type="button" className="btn sm" disabled={points.length >= MAX} onClick={() => setEditing({ index: null, point: { name: '', address: '', latitude: null, longitude: null } })}><Icon name="plus" size="sm" />إضافة نقطة</button>
      </div>
      <div className="card-b stack t">
        {points.length === 0 && <p className="muted">بلا نقاط استلام: يستلم العميل من موقع شركتك المكتوب في الملف.</p>}
        {points.map((p, i) => (
          <div key={i} className="row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
            <div className="ico-c" style={{ background: 'var(--neutral-bg)' }}><Icon name="pin" /></div>
            <div className="grow"><div className="b">{p.name}</div><div className="sub">{p.address || 'بلا عنوان مكتوب'}{p.latitude !== null ? ' · موقع على الخريطة' : ''}</div></div>
            <button type="button" className="btn sm" onClick={() => setEditing({ index: i, point: p })}>تعديل</button>
            <button type="button" className="btn sm d" onClick={() => setRemoving(i)}>حذف</button>
          </div>
        ))}
      </div>
      {editing && <PickupDialog initial={editing.point} busy={busy} onClose={() => setEditing(null)} onSave={async (p) => {
        const next = editing.index === null ? [...points, p] : points.map((x, i) => (i === editing.index ? p : x));
        if (await persist(next, editing.index === null ? 'أُضيفت النقطة' : 'تم تحديث النقطة')) setEditing(null);
      }} />}
      {removing !== null && <ConfirmDialog title="حذف نقطة الاستلام؟" body={points[removing]?.name} confirmLabel="حذف" danger busy={busy} onClose={() => setRemoving(null)} onConfirm={async () => { if (await persist(points.filter((_, i) => i !== removing), 'حُذفت النقطة')) setRemoving(null); }} />}
    </section>
  );
}

function PickupDialog({ initial, busy, onSave, onClose }: { initial: PickupPoint; busy: boolean; onSave: (p: PickupPoint) => void; onClose: () => void }) {
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [lat, setLat] = useState(initial.latitude === null ? '' : String(initial.latitude));
  const [lng, setLng] = useState(initial.longitude === null ? '' : String(initial.longitude));
  const latN = lat.trim() === '' ? null : parseNumber(lat);
  const lngN = lng.trim() === '' ? null : parseNumber(lng);
  const coordsOk = (latN === null && lngN === null) || (latN !== null && lngN !== null && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180);
  const valid = name.trim().length > 0 && name.length <= 60 && address.length <= 200 && coordsOk;
  return (
    <Modal title={initial.name ? 'تعديل نقطة الاستلام' : 'نقطة استلام جديدة'} onClose={onClose} busy={busy}
      footer={<><button type="button" className="btn p" disabled={!valid || busy} onClick={() => onSave({ name, address, latitude: latN, longitude: lngN })}>{busy && <Spinner />}حفظ</button><button type="button" className="btn" disabled={busy} onClick={onClose}>إلغاء</button></>}>
      <div className="fld"><label htmlFor="pk-name">اسم النقطة</label><input id="pk-name" className="inp" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus placeholder="المعرض الرئيسي" /></div>
      <div className="fld"><label htmlFor="pk-addr">العنوان</label><input id="pk-addr" className="inp" value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} /></div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="fld grow"><label htmlFor="pk-lat">خط العرض</label><input id="pk-lat" className="inp ltr" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
        <div className="fld grow"><label htmlFor="pk-lng">خط الطول</label><input id="pk-lng" className="inp ltr" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
      </div>
      {!coordsOk && <span className="errt">اكتب خطَّي العرض والطول معًا بقيم صحيحة، أو اتركهما فارغين.</span>}
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
    try { await saveServiceCities(company, chosen); toast('تم حفظ مدن الخدمة', 'ok'); } catch { toast('تعذّر الحفظ.', 'err'); } finally { setBusy(false); }
  };
  return (
    <section className="card" aria-label="مدن الخدمة">
      <div className="card-h"><h2>مدن الخدمة</h2><span className="sub">تظهر شركتك أولًا للعملاء في هذه المدن</span></div>
      <div className="card-b stack t">
        <div className="pills" role="group" aria-label="مدن الخدمة">
          {cityChoicesFor(cities, chosen).map((c) => <button key={c.id} type="button" className={`pill${chosen.includes(c.id) ? ' on' : ''}`} aria-pressed={chosen.includes(c.id)} onClick={() => toggle(c.id)}>{c.ar}</button>)}
        </div>
        <p className="hint">إن لم تحدد مدنًا تظهر شركتك في كل المدن، ولا يُخفى شيء عن أحد.</p>
        <div className="row"><button type="button" className="btn p" disabled={!dirty || busy} onClick={() => void save()}>{busy && <Spinner />}حفظ</button></div>
      </div>
    </section>
  );
}
