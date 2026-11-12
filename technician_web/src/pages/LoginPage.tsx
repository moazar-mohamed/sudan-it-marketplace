import { useState, type FormEvent } from 'react';
import { authErrorText, noticeText, useAuth, type AccessNotice } from '../auth/AuthProvider';
import { t } from '../i18n';
import { Icon } from '../ui/Icon';

export default function LoginPage({ notice }: { notice: AccessNotice | null }) {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError(t('اكتب البريد الإلكتروني وكلمة المرور.'));
      return;
    }
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(authErrorText(err));
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError(t('اكتب بريدك الإلكتروني أولًا، ثم اضغط «نسيت كلمة المرور؟».'));
      return;
    }
    try {
      await resetPassword(email);
      setInfo(t('إن كان البريد مسجّلًا فستصلك رسالة لتعيين كلمة مرور جديدة.'));
    } catch (err) {
      setError(authErrorText(err));
    }
  };

  const shown = error ?? (notice ? noticeText(notice) : null);

  return (
    <div className="app">
      <div className="scroll" style={{ display: 'flex', flexDirection: 'column' }}>
        <header className="hero" style={{ flex: 'none', minHeight: 320, padding: '40px 24px 76px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <img src="/og-logo.png" alt="Sudan ICT Marketplace" style={{ width: 96, height: 96, padding: 4, borderRadius: 22, objectFit: 'contain', background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.25)' }} />
          <span dir="ltr" style={{ marginTop: 6, fontSize: 15, fontWeight: 800, opacity: 0.9 }}>Sudan ICT Marketplace</span>
          <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3 }}>{t('بوابة الفني')}</h1>
          <p style={{ fontSize: 15, opacity: 0.88, maxWidth: 280 }}>{t('مهام التركيب من شركتك، في موبايلك')}</p>
        </header>
        <main className="lift" style={{ flex: 1, padding: '0 20px 20px', marginTop: -56, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <form className="card raised" onSubmit={submit} noValidate style={{ borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="fld">
              <label htmlFor="login-email" style={{ fontSize: 13 }}>{t('البريد الإلكتروني')}</label>
              <div className="box">
                <input id="login-email" type="email" dir="ltr" inputMode="email" autoComplete="username" placeholder="name@company.sd" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="fld">
              <label htmlFor="login-pass" style={{ fontSize: 13 }}>{t('كلمة المرور')}</label>
              <div className="box">
                <input id="login-pass" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="eye" aria-pressed={show} aria-label={show ? t('إخفاء كلمة المرور') : t('إظهار كلمة المرور')} onClick={() => setShow(!show)}>
                  <Icon name="eye" />
                </button>
              </div>
            </div>
            {shown && (
              <p className="err-text" role="alert">
                {shown}
              </p>
            )}
            {info && (
              <p className="strip ok" role="status">
                {info}
              </p>
            )}
            <button className="btn big" type="submit" disabled={busy}>
              {busy ? t('جارٍ الدخول…') : t('دخول')}
            </button>
            <button type="button" onClick={forgot} style={{ alignSelf: 'center', border: 0, background: 'none', color: 'var(--brand)', fontSize: 13, fontWeight: 700, padding: '6px 8px', minHeight: 44 }}>
              {t('نسيت كلمة المرور؟')}
            </button>
          </form>
          <div className="strip soft">
            <Icon name="info" />
            <p>{t('حسابك تنشئه شركتك. في أول دخول استخدم كلمة المرور المؤقتة التي أرسلتها الشركة، ثم اختر كلمة جديدة.')}</p>
          </div>
          <p style={{ marginTop: 'auto', textAlign: 'center', fontSize: 13, color: 'var(--muted)', paddingTop: 8 }}>
            {t('لست فنيًا؟')}{' '}
            <a href="https://sictm.net" style={{ fontWeight: 700 }}>
              {t('تسوّق في sictm.net')}
            </a>
          </p>
        </main>
      </div>
    </div>
  );
}
