import { useState } from 'react';
import { useCompanyData } from '../data/CompanyData';
import { createTechnician, setTechnicianActive, TechnicianError, updateTechnician } from '../data/company';
import { arCount, displayPhone } from '../data/format';
import { MIN_PASSWORD_LENGTH } from '../auth/AuthProvider';
import { useTechnicians } from '../data/technicians';
import type { Technician } from '../data/types';
import { Banner, Chip, Empty, Loading, Modal, PageHeader, Spinner, Switch } from '../ui/kit';
import { useToast } from '../ui/toast';

function randomPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `${[...bytes].map((b) => chars[b % chars.length]).join('')}-${(bytes[0] % 90) + 10}`;
}

export function TeamPage() {
  const { companyId } = useCompanyData();
  const technicians = useTechnicians(companyId);
  return (
    <main className="page">
      <PageHeader title="الفريق" subtitle="فنيو التركيب في شركتك" />
      <div className="g2">
        <TechniciansCard technicians={technicians} />
        <AddTechnicianCard companyId={companyId} />
      </div>
    </main>
  );
}

function TechniciansCard({ technicians }: { technicians: Technician[] | null }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Technician | null>(null);
  const toggle = async (t: Technician, on: boolean) => {
    try { await setTechnicianActive(t, on); toast(on ? 'فُعّل الفني' : 'عُطّل الفني ولن يستطيع الدخول', 'ok'); } catch { toast('تعذّر التحديث.', 'err'); }
  };
  if (technicians === null) return <section className="card"><Loading /></section>;
  const active = technicians.filter((t) => t.isActive).length;
  return (
    <section className="card" aria-label="الفنيون">
      <div className="card-h"><h2>الفنيون</h2><span className="sub">{arCount(technicians.length, 'فني واحد', 'فنيان', 'فنيين', 'فنيًا')} · {arCount(active, 'نشط واحد', 'نشطان', 'نشطون', 'نشطًا')}</span></div>
      {technicians.length === 0 ? <Empty icon="users" text="لا فنيين بعد. أضف أول فني من النموذج المجاور." /> : (
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>الفني</th><th>الحالة</th><th>نشط</th><th /></tr></thead>
            <tbody>
              {technicians.map((t) => (
                <tr key={t.id}>
                  <td><div className="row"><span className="av">{t.fullName.slice(0, 1)}</span><div><div className="b">{t.fullName}</div><div className="sub num">{displayPhone(t.phone)}</div><div className="sub num">{t.email}</div></div></div></td>
                  <td>{!t.isActive ? <Chip tone="n">معطّل</Chip> : t.isAvailable ? <Chip tone="ok">متاح</Chip> : <Chip tone="n">غير متاح</Chip>}</td>
                  <td><Switch on={t.isActive} onChange={(v) => void toggle(t, v)} label={`تفعيل ${t.fullName}`} /></td>
                  <td><button type="button" className="btn sm" onClick={() => setEditing(t)}>تعديل</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EditTechnician technician={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function EditTechnician({ technician, onClose }: { technician: Technician; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(technician.fullName);
  const [phone, setPhone] = useState(technician.phone);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await updateTechnician(technician, { fullName: name, phone }); toast('تم الحفظ', 'ok'); onClose(); } catch { toast('تعذّر الحفظ.', 'err'); setBusy(false); }
  };
  return (
    <Modal title="تعديل الفني" onClose={onClose} busy={busy}
      footer={<><button type="button" className="btn p" disabled={!name.trim() || busy} onClick={() => void save()}>{busy && <Spinner />}حفظ</button><button type="button" className="btn" disabled={busy} onClick={onClose}>إلغاء</button></>}>
      <div className="fld"><label htmlFor="et-name">الاسم الكامل</label><input id="et-name" className="inp" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="fld"><label htmlFor="et-phone">الهاتف</label><input id="et-phone" className="inp ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <p className="hint">البريد الإلكتروني لا يتغير لأنه اسم الدخول.</p>
    </Modal>
  );
}

function AddTechnicianCard({ companyId }: { companyId: string }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(randomPassword);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = name.trim().length > 0 && name.length <= 120 && emailOk && password.length >= MIN_PASSWORD_LENGTH;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      await createTechnician(companyId, { fullName: name, phone, email, password });
      setCreated({ email: email.trim().toLowerCase(), password });
      setName(''); setPhone(''); setEmail(''); setPassword(randomPassword());
      toast('أُنشئ حساب الفني', 'ok');
    } catch (e) {
      const p = e instanceof TechnicianError ? e.problem : 'failed';
      setError(p === 'email-in-use' ? 'هذا البريد مسجَّل من قبل.' : p === 'weak-password' ? 'كلمة المرور ضعيفة.' : p === 'invalid-email' ? 'البريد غير صحيح.' : 'تعذّر إنشاء الحساب، حاول مرة أخرى.');
    } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label="إضافة فني">
      <div className="card-h"><h2>إضافة فني</h2></div>
      <div className="card-b stack" style={{ gap: 14 }}>
        {created && (
          <Banner tone="ok" icon="check">
            <b>أُنشئ الحساب.</b> أبلغ الفني بهذه البيانات الآن، فلن تظهر كلمة المرور مرة أخرى:
            <div className="num b" style={{ marginTop: 4 }}>{created.email}</div>
            <div className="num b">{created.password}</div>
          </Banner>
        )}
        {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
        <div className="fld"><label htmlFor="t-name">الاسم الكامل</label><input id="t-name" className="inp" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="عبدالرحمن علي" /></div>
        <div className="fld"><label htmlFor="t-phone">الهاتف</label><input id="t-phone" className="inp ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+249…" /></div>
        <div className="fld"><label htmlFor="t-email">البريد الإلكتروني للدخول</label><input id="t-email" className="inp ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
        <div className="fld"><label htmlFor="t-pass">كلمة مرور مؤقتة</label>
          <div className="row"><input id="t-pass" className="inp ltr" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="btn" onClick={() => setPassword(randomPassword())}>توليد</button></div>
          <span className="hint">أبلغ بها الفني بنفسك. يُطلب منه تغييرها عند أول دخول، ولا نحفظها.</span></div>
        <button type="button" className="btn p lg" disabled={!valid || busy} onClick={() => void submit()}>{busy && <Spinner />}إنشاء حساب الفني</button>
      </div>
    </section>
  );
}
