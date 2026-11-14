import { useState } from 'react';
import { useCompanyData } from '../data/CompanyData';
import { createTechnician, setTechnicianActive, TechnicianError, updateTechnician } from '../data/company';
import { arCount, displayPhone } from '../data/format';
import { MIN_PASSWORD_LENGTH } from '../auth/AuthProvider';
import { useTechnicians } from '../data/technicians';
import type { Technician } from '../data/types';
import { Banner, Chip, Empty, Loading, Modal, PageHeader, Spinner, Switch } from '../ui/kit';
import { useToast } from '../ui/toast';
import { t } from '../i18n';

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
      <PageHeader title={t('الفريق')} subtitle={t('فنيو التركيب في شركتك')} />
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
  const toggle = async (tech: Technician, on: boolean) => {
    try { await setTechnicianActive(tech, on); toast(on ? t('فُعّل الفني') : t('عُطّل الفني ولن يستطيع الدخول'), 'ok'); } catch { toast(t('تعذّر التحديث.'), 'err'); }
  };
  if (technicians === null) return <section className="card"><Loading /></section>;
  const active = technicians.filter((tech) => tech.isActive).length;
  return (
    <section className="card" aria-label={t('الفنيون')}>
      <div className="card-h"><h2>{t('الفنيون')}</h2><span className="sub">{arCount(technicians.length, t('فني واحد'), t('فنيان'), t('فنيين'), t('فنيًا'))} · {arCount(active, t('نشط واحد'), t('نشطان'), t('نشطون'), t('نشطًا'))}</span></div>
      {technicians.length === 0 ? <Empty icon="users" text={t('لا فنيين بعد. أضف أول فني من النموذج المجاور.')} /> : (
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th>{t('الفني')}</th><th>{t('الحالة')}</th><th>{t('نشط')}</th><th /></tr></thead>
            <tbody>
              {technicians.map((tech) => (
                <tr key={tech.id}>
                  <td><div className="row"><span className="av">{tech.fullName.slice(0, 1)}</span><div><div className="b">{tech.fullName}</div><div className="sub num">{displayPhone(tech.phone)}</div><div className="sub num">{tech.email}</div></div></div></td>
                  <td>{!tech.isActive ? <Chip tone="n">{t('معطّل')}</Chip> : tech.isAvailable ? <Chip tone="ok">{t('متاح')}</Chip> : <Chip tone="n">{t('غير متاح')}</Chip>}</td>
                  <td><Switch on={tech.isActive} onChange={(v) => void toggle(tech, v)} label={t('تفعيل {0}', tech.fullName)} /></td>
                  <td><button type="button" className="btn sm" onClick={() => setEditing(tech)}>{t('تعديل')}</button></td>
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
    try { await updateTechnician(technician, { fullName: name, phone }); toast(t('تم الحفظ'), 'ok'); onClose(); } catch { toast(t('تعذّر الحفظ.'), 'err'); setBusy(false); }
  };
  return (
    <Modal title={t('تعديل الفني')} onClose={onClose} busy={busy}
      footer={<><button type="button" className="btn p" disabled={!name.trim() || busy} onClick={() => void save()}>{busy && <Spinner />}{t('حفظ')}</button><button type="button" className="btn" disabled={busy} onClick={onClose}>{t('إلغاء')}</button></>}>
      <div className="fld"><label htmlFor="et-name">{t('الاسم الكامل')}</label><input id="et-name" className="inp" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus /></div>
      <div className="fld"><label htmlFor="et-phone">{t('الهاتف')}</label><input id="et-phone" className="inp ltr" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      <p className="hint">{t('البريد الإلكتروني لا يتغير لأنه اسم الدخول.')}</p>
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
      toast(t('أُنشئ حساب الفني'), 'ok');
    } catch (e) {
      const p = e instanceof TechnicianError ? e.problem : 'failed';
      setError(p === 'email-in-use' ? t('هذا البريد مسجَّل من قبل.') : p === 'weak-password' ? t('كلمة المرور ضعيفة.') : p === 'invalid-email' ? t('البريد غير صحيح.') : t('تعذّر إنشاء الحساب، حاول مرة أخرى.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="card" aria-label={t('إضافة فني')}>
      <div className="card-h"><h2>{t('إضافة فني')}</h2></div>
      <div className="card-b stack" style={{ gap: 14 }}>
        {created && (
          <Banner tone="ok" icon="check">
            <b>{t('أُنشئ الحساب.')}</b>{' '}{t('أبلغ الفني بهذه البيانات الآن، فلن تظهر كلمة المرور مرة أخرى:')}<div className="num b" style={{ marginTop: 4 }}>{created.email}</div>
            <div className="num b">{created.password}</div>
          </Banner>
        )}
        {error && <Banner tone="bad" icon="alert" tight>{error}</Banner>}
        <div className="fld"><label htmlFor="t-name">{t('الاسم الكامل')}</label><input id="t-name" className="inp" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={t('عبدالرحمن علي')} /></div>
        <div className="fld"><label htmlFor="t-phone">{t('الهاتف')}</label><input id="t-phone" className="inp ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+249…" /></div>
        <div className="fld"><label htmlFor="t-email">{t('البريد الإلكتروني للدخول')}</label><input id="t-email" className="inp ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
        <div className="fld"><label htmlFor="t-pass">{t('كلمة مرور مؤقتة')}</label>
          <div className="row"><input id="t-pass" className="inp ltr" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="btn" onClick={() => setPassword(randomPassword())}>{t('توليد')}</button></div>
          <span className="hint">{t('أبلغ بها الفني بنفسك. يُطلب منه تغييرها عند أول دخول، ولا نحفظها.')}</span></div>
        <button type="button" className="btn p lg" disabled={!valid || busy} onClick={() => void submit()}>{busy && <Spinner />}{t('إنشاء حساب الفني')}</button>
      </div>
    </section>
  );
}
