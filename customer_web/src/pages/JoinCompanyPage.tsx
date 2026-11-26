import { useState } from 'react';
import type { FormEvent } from 'react';
import { BusyLabel } from '../components/BusyLabel';
import { ErrorState, Skeleton } from '../components/Bits';
import { PageTitle } from '../components/PageTitle';
import { PhoneInput, phoneError } from '../components/PhoneInput';
import { Select } from '../components/Select';
import { cityName } from '../data/cities';
import {
  ABOUT_MAX,
  APPLICATION_STATUS,
  applicationProblem,
  COMPANY_NAME_MAX,
  CONTACT_NAME_MAX,
  REGISTRATION_MAX,
  submitApplication,
  useMyApplication,
  type CompanyApplication,
} from '../data/companyApplication';
import { useAccount, useCatalog } from '../data/DataProvider';
import { formatDate } from '../data/format';
import { parsePhone, toE164 } from '../data/phone';
import { t } from '../i18n';

const COMPANY_PORTAL = 'https://company.sictm.net';

/** «سجّل شركتك»: a company asks to join, then follows the answer here. */
export function JoinCompanyPage() {
  const profile = useAccount();
  const { application, failed } = useMyApplication(profile.id);
  const [editing, setEditing] = useState(false);

  let body;
  if (profile.role !== 'customer') {
    body = (
      <div className="tile">
        <p className="prose" style={{ margin: 0 }}>{t('حسابك حساب شركة بالفعل. أدر منتجاتك وطلباتك من بوابة الشركات.')}</p>
        <a className="btn" href={COMPANY_PORTAL} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12 }}>{t('بوابة الشركات')}</a>
      </div>
    );
  } else if (failed) {
    body = <ErrorState />;
  } else if (application === undefined) {
    body = <Skeleton height={260} />;
  } else if (application === null || (application.status === 'rejected' && editing)) {
    body = <ApplicationForm previous={application} onSent={() => setEditing(false)} />;
  } else {
    body = <ApplicationStatus application={application} onEdit={() => setEditing(true)} />;
  }

  return (
    <main className="stack narrow">
      <PageTitle title={t('سجّل شركتك')} />
      <h1 className="page-title">{t('سجّل شركتك')}</h1>
      {body}
    </main>
  );
}

function ApplicationStatus({ application, onEdit }: { application: CompanyApplication; onEdit: () => void }) {
  const status = APPLICATION_STATUS[application.status];
  return (
    <article className="tile report">
      <header>
        <strong className="grow">{application.companyName}</strong>
        <span className={`status ${status.tone}`}>{status.label}</span>
      </header>
      {application.createdAt && <div className="pmeta">{t('أُرسل في')} {formatDate(application.createdAt)}</div>}
      {application.status === 'pending' && (
        <p className="prose">{t('وصل طلبك. يراجعه فريق المنصة ويتواصل معك على رقم الهاتف الذي كتبته. ستظهر النتيجة هنا.')}</p>
      )}
      {application.status === 'approved' && (
        <>
          <p className="prose">{t('تم قبول شركتك. حسابك الآن حساب شركة: ادخل إلى بوابة الشركات بنفس البريد وكلمة المرور.')}</p>
          <a className="btn" href={COMPANY_PORTAL} target="_blank" rel="noopener noreferrer">{t('بوابة الشركات')}</a>
        </>
      )}
      {application.status === 'rejected' && (
        <>
          <div className="reply">
            <strong>{t('سبب الرفض')}</strong>
            <p>{application.decisionNote}</p>
          </div>
          <button className="btn" type="button" onClick={onEdit}>{t('تعديل الطلب وإرساله مرة أخرى')}</button>
        </>
      )}
    </article>
  );
}

function ApplicationForm({ previous, onSent }: { previous: CompanyApplication | null; onSent: () => void }) {
  const profile = useAccount();
  const { cities } = useCatalog();
  const [companyName, setCompanyName] = useState(previous?.companyName ?? '');
  const [contactName, setContactName] = useState(previous?.contactName ?? profile.fullName);
  const [phone, setPhone] = useState(parsePhone(previous?.phone ?? profile.phone));
  const [cityId, setCityId] = useState(previous?.cityId ?? profile.cityId ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(previous?.registrationNumber ?? '');
  const [about, setAbout] = useState(previous?.about ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cityChoices = cities.filter((c) => c.active);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const phoneProblem = phoneError(phone, true);
    if (phoneProblem) return setError(phoneProblem);
    const draft = { companyName, contactName, phone: toE164(phone), cityId, registrationNumber, about };
    const problem = applicationProblem(draft);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    try {
      await submitApplication(profile, draft);
      onSent();
    } catch {
      setError(t('تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="tile" onSubmit={submit} noValidate>
      <p className="prose" style={{ marginTop: 0 }}>
        {t('اعرض منتجات شركتك وخدماتها على عملاء سوق السودان للتقنية. أرسل بياناتك، ويراجعها فريق المنصة ويتواصل معك. عند القبول يصبح حسابك هذا حساب الشركة.')}
      </p>
      <label className="field">
        {t('اسم الشركة')}
        <input value={companyName} maxLength={COMPANY_NAME_MAX} onChange={(e) => setCompanyName(e.target.value)} dir="auto" />
      </label>
      <label className="field">
        {t('اسم المسؤول')}
        <input value={contactName} maxLength={CONTACT_NAME_MAX} onChange={(e) => setContactName(e.target.value)} dir="auto" />
      </label>
      <PhoneInput label={t('رقم هاتف الشركة')} value={phone} onChange={setPhone} />
      <label className="field">
        {t('مدينة الشركة')}
        <Select
          ariaLabel={t('مدينة الشركة')}
          value={cityId}
          onChange={setCityId}
          options={[{ value: '', label: t('اختر مدينة') }, ...cityChoices.map((c) => ({ value: c.id, label: cityName(c) }))]}
        />
      </label>
      <label className="field">
        {t('رقم السجل التجاري')}
        <input value={registrationNumber} maxLength={REGISTRATION_MAX} onChange={(e) => setRegistrationNumber(e.target.value)} dir="ltr" />
        <span className="pmeta">{t('يطلب منك فريق المنصة صورة الشهادة عند التواصل.')}</span>
      </label>
      <label className="field">
        {t('نبذة عن الشركة (اختياري)')}
        <textarea rows={4} value={about} maxLength={ABOUT_MAX} placeholder={t('ماذا تبيعون أو تقدمون من خدمات؟')} onChange={(e) => setAbout(e.target.value)} dir="auto" />
      </label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" type="submit" disabled={busy} aria-busy={busy}>
        <BusyLabel busy={busy} busyText={t('جارٍ الإرسال…')}>{t('إرسال الطلب')}</BusyLabel>
      </button>
    </form>
  );
}
