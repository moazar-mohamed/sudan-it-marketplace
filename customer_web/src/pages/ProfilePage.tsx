import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { CityPicker } from '../components/CityPicker';
import { Icon, PATHS } from '../components/Icon';
import { PhoneInput, phoneError } from '../components/PhoneInput';
import { changePassword, hasPassword, PASSWORD_MIN, updateProfile } from '../data/account';
import { useCatalog } from '../data/DataProvider';
import { displayPhone, parsePhone, toE164 } from '../data/phone';
import { signOutHere } from '../firebase';
import { cityName } from '../data/cities';
import { t } from '../i18n';

function ChangePassword({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (current === '') return setError(t('أدخل كلمة المرور الحالية.'));
    if (next === '') return setError(t('أدخل كلمة مرور جديدة.'));
    if (next.length < PASSWORD_MIN) return setError(t('استخدم 6 أحرف على الأقل.'));
    if (confirm === '') return setError(t('أكّد كلمة المرور الجديدة.'));
    if (confirm !== next) return setError(t('كلمتا المرور غير متطابقتين.'));
    setBusy(true);
    setError('');
    const failure = await changePassword(user!, current, next);
    setBusy(false);
    if (failure) setError(failure);
    else onDone();
  }

  return (
    <form className="tile" onSubmit={submit} noValidate>
      <h2>{t('تغيير كلمة المرور')}</h2>
      <label className="field">
        {t('كلمة المرور الحالية')}
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} dir="ltr" />
      </label>
      <label className="field">
        {t('كلمة المرور الجديدة')}
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" />
      </label>
      <label className="field">
        {t('تأكيد كلمة المرور الجديدة')}
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
      </label>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="btn" type="submit" disabled={busy}>{t('تحديث كلمة المرور')}</button>
    </form>
  );
}

export function ProfilePage() {
  const { user } = useAuth();
  const { profile, cities, cityId } = useCatalog();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.fullName);
  const [phone, setPhone] = useState(parsePhone(profile.phone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const cityLabel = cityName(cities.find((c) => c.id === cityId));

  function startEditing() {
    setName(profile.fullName);
    setPhone(parsePhone(profile.phone));
    setError('');
    setNote('');
    setEditing(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') return setError(t('أدخل اسمك الكامل.'));
    const problem = phoneError(phone);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    const failure = await updateProfile(profile.id, name, toE164(phone));
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setEditing(false);
    setNote(t('تم تحديث الملف الشخصي بنجاح.'));
  }

  return (
    <main className="stack narrow">
      <section className="tile profile-head">
        <span className="profile-avatar">
          {profile.photoUrl ? <img src={profile.photoUrl} alt="" /> : [...profile.fullName][0]}
        </span>
        <h1>{profile.fullName}</h1>
        <span className="pmeta" dir="ltr">{profile.email}</span>
      </section>

      {note && <div className="ok-note" role="status">{note}</div>}

      {editing ? (
        <form className="tile" onSubmit={save} noValidate>
          <h2>{t('تعديل الملف الشخصي')}</h2>
          <label className="field">
            {t('الاسم الكامل')}
            <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </label>
          <label className="field">
            {t('البريد الإلكتروني')}
            <input value={profile.email} disabled dir="ltr" />
          </label>
          <PhoneInput label={t('رقم الهاتف (اختياري)')} value={phone} onChange={setPhone} disabled={busy} />
          {error && <div className="error" role="alert">{error}</div>}
          <div className="buy-row" style={{ marginTop: 20 }}>
            <button type="button" className="btn-line" disabled={busy} onClick={() => setEditing(false)}>{t('إلغاء')}</button>
            <button type="submit" className="btn-solid" disabled={busy}>{t('حفظ التغييرات')}</button>
          </div>
        </form>
      ) : (
        <section className="rows" aria-label={t('بيانات الحساب')}>
          <div className="row"><span className="pmeta">{t('رقم الهاتف')}</span><span dir="ltr">{displayPhone(profile.phone) || '—'}</span></div>
          <button className="row" onClick={() => setCityOpen(true)}>
            <Icon d={PATHS.pin} />
            <span className="grow">{t('مدينتي')}</span>
            <span className="pmeta">{cityLabel}</span>
          </button>
          <button className="row" onClick={startEditing}>
            <Icon d={PATHS.user} />
            <span className="grow">{t('تعديل الملف الشخصي')}</span>
          </button>
          {user && hasPassword(user) && (
            <button className="row" onClick={() => { setPasswordOpen((v) => !v); setNote(''); }} aria-expanded={passwordOpen}>
              <Icon d={PATHS.lock} />
              <span className="grow">{t('تغيير كلمة المرور')}</span>
            </button>
          )}
          <Link className="row" to="/favorites">
            <Icon d={PATHS.heart} />
            <span className="grow">{t('المفضلة')}</span>
          </Link>
          <Link className="row" to="/settings">
            <Icon d={PATHS.gear} />
            <span className="grow">{t('الإعدادات')}</span>
          </Link>
          <Link className="row" to="/notifications">
            <Icon d={PATHS.bell} />
            <span className="grow">{t('الإشعارات')}</span>
          </Link>
        </section>
      )}

      {passwordOpen && (
        <ChangePassword
          onDone={() => {
            setPasswordOpen(false);
            setNote(t('تم تغيير كلمة المرور بنجاح.'));
          }}
        />
      )}

      <button className="btn ghost" onClick={signOutHere}>{t('تسجيل الخروج')}</button>
      {cityOpen && <CityPicker uid={profile.id} selectedId={cityId} onClose={() => setCityOpen(false)} />}
    </main>
  );
}
