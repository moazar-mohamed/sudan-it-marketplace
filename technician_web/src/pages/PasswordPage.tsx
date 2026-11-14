import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authErrorText, MIN_PASSWORD_LENGTH, useAuth, useProfile } from '../auth/AuthProvider';
import { firstName } from '../data/jobs';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';
import { BackButton } from '../ui/kit';
import { useToast } from '../ui/toast';

/**
 * first: forced on the first sign-in (mustChangePassword); the current password is
 * the temporary one the company sent. change: from the profile, with the current one asked for.
 */
export default function PasswordPage({ mode }: { mode: 'first' | 'change' }) {
  const { changePassword, signOut } = useAuth();
  const profile = useProfile();
  const navigate = useNavigate();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const longEnough = next.length >= MIN_PASSWORD_LENGTH;
  const matches = next.length > 0 && next === again;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'change' && !current) return setError(t('اكتب كلمة المرور الحالية.'));
    if (!longEnough || !matches) return setError(t('تأكد من الشرطين تحت الحقول.'));
    if (mode === 'change' && next === current) return setError(t('اختر كلمة مرور مختلفة عن الحالية.'));
    setBusy(true);
    try {
      await changePassword(mode === 'change' ? current : null, next);
      toast(t('حُفظت كلمة المرور الجديدة.'), 'ok');
      if (mode === 'change') navigate('/profile', { replace: true });
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? t('كلمة المرور الحالية غير صحيحة.')
          : code === 'auth/requires-recent-login'
            ? t('انتهت جلسة الدخول. سجّل الخروج ثم ادخل بكلمة المرور المؤقتة من جديد.')
            : authErrorText(err),
      );
      setBusy(false);
    }
  };

  const rule = (ok: boolean, text: string) => (
    <li style={{ display: 'flex', alignItems: 'center', gap: 8, color: ok ? 'var(--ok)' : 'var(--muted)' }}>
      <Icon name={ok ? 'check' : 'info'} small />
      {text}
      <span className="sr">{ok ? t('(متحقق)') : t('(غير متحقق)')}</span>
    </li>
  );

  return (
    <div className="app">
      {mode === 'change' && (
        <header className="bar">
          <BackButton to="/profile" label={t('رجوع إلى حسابي')} />
          <div className="bar-title">
            <h1>{t('تغيير كلمة المرور')}</h1>
          </div>
        </header>
      )}
      <div className="scroll">
        {mode === 'first' && (
          <section className="hero" style={{ padding: '40px 24px 76px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
            <img src="/og-logo.png" alt="Sudan ICT Marketplace" style={{ width: 64, height: 64, padding: 3, borderRadius: 16, background: '#fff', objectFit: 'contain' }} />
            <h1 style={{ marginTop: 6, fontSize: 23, fontWeight: 800 }}>{t('أهلاً بك يا {0}', firstName(profile.fullName) || t('فني'))}</h1>
            <p style={{ fontSize: 15, opacity: 0.88, maxWidth: 300 }}>{t('قبل البدء، اختر كلمة مرور خاصة بك بدل المؤقتة التي أرسلتها شركتك')}</p>
          </section>
        )}
        <main className="lift" style={{ padding: '0 20px 20px', marginTop: mode === 'first' ? -56 : 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <form className="card" onSubmit={submit} noValidate style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'change' && (
              <div className="fld">
                <label htmlFor="pw-old">{t('كلمة المرور الحالية')}</label>
                <div className="box">
                  <input id="pw-old" type={show ? 'text' : 'password'} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
                </div>
              </div>
            )}
            <div className="fld">
              <label htmlFor="pw-new">{t('كلمة المرور الجديدة')}</label>
              <div className="box">
                <input id="pw-new" type={show ? 'text' : 'password'} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-rules" />
                <button type="button" className="eye" aria-pressed={show} aria-label={show ? t('إخفاء كلمة المرور') : t('إظهار كلمة المرور')} onClick={() => setShow(!show)}>
                  <Icon name="eye" />
                </button>
              </div>
            </div>
            <div className="fld">
              <label htmlFor="pw-again">{t('أعد كتابتها')}</label>
              <div className="box">
                <input id="pw-again" type={show ? 'text' : 'password'} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
              </div>
            </div>
            <ul id="pw-rules" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
              {rule(longEnough, t('{0} أحرف على الأقل', MIN_PASSWORD_LENGTH))}
              {rule(matches, t('الكلمتان متطابقتان'))}
            </ul>
            {error && (
              <p className="err-text" role="alert">
                {error}
              </p>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? t('جارٍ الحفظ…') : mode === 'first' ? t('حفظ والمتابعة') : t('حفظ كلمة المرور')}
            </button>
          </form>
          <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            <Icon name="lock" small />
            {t('لا تشارك كلمة المرور مع أحد، ولا حتى مع الشركة.')}
          </p>
          {mode === 'first' && (
            <button type="button" className="btn-line" onClick={() => void signOut()}>
              {t('تسجيل الخروج')}
            </button>
          )}
        </main>
      </div>
    </div>
  );
}
