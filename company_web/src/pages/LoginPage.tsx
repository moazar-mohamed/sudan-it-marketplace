import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { authErrorText, noticeText, useAuth, type AccessNotice } from '../auth/AuthProvider';
import { Banner, Spinner } from '../ui/kit';
import { t } from '../i18n';

/** The platform's WhatsApp line, for companies that don't have an account yet. */
const SUPPORT_WHATSAPP = '249118424422';
const SUPPORT_WHATSAPP_SHOWN = '+249 118 424 422';
const MAIN_SITE = 'https://sictm.net';

const WHATSAPP_PATH =
  'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z';

export function LoginPage({ notice }: { notice: AccessNotice | null }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(authErrorText(err));
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError(t('اكتب بريدك الإلكتروني أولًا ثم اضغط «نسيت كلمة المرور».'));
      return;
    }
    try {
      // On company.sictm.net the e-mail's "Continue" button returns here, not to the old web.app link.
      const back = window.location.hostname === 'company.sictm.net' ? { url: 'https://company.sictm.net/' } : undefined;
      await sendPasswordResetEmail(auth, email.trim(), back);
      setInfo(t('إن كان البريد مسجَّلًا فقد أرسلنا إليه رابطًا لاختيار كلمة مرور جديدة.'));
    } catch (err) {
      setError(authErrorText(err));
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="row">
          <div className="logo login-logo"><img src="/icon-192.png" alt={t('سوق السودان للتقنية')} /></div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>{t('لوحة الشركة')}</h1>
            <p className="sub">{t('سجّل الدخول لإدارة منتجاتك وطلباتك')}</p>
          </div>
        </div>
        {notice && <Banner tone="bad" icon="alert">{noticeText[notice]}</Banner>}
        {error && <Banner tone="bad" icon="alert">{error}</Banner>}
        {info && <Banner tone="ok" icon="check">{info}</Banner>}
        <div className="fld">
          <label htmlFor="em">{t('البريد الإلكتروني')}</label>
          <input id="em" className="inp ltr" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="fld">
          <label htmlFor="pw">{t('كلمة المرور')}</label>
          <input id="pw" className="inp ltr" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn p lg" type="submit" disabled={busy}>
          {busy && <Spinner />}{t('دخول')}</button>
        <button type="button" className="linkbtn" onClick={() => void reset()}>{t('نسيت كلمة المرور')}</button>
        <div className="login-alt">
          <p>{t('لا تملك حساب شركة؟')}</p>
          <a
            className="login-wa"
            href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(t('مرحباً، أريد تسجيل شركتي في سوق السودان للتقنية (sictm.net).'))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={WHATSAPP_PATH} fill="currentColor" /></svg>
            {t('تواصل معنا عبر واتساب لتسجيل شركتك')}
            <span dir="ltr">{SUPPORT_WHATSAPP_SHOWN}</span>
          </a>
          <a className="login-back" href={MAIN_SITE}>{t('العودة إلى sictm.net')}</a>
        </div>
      </form>
    </div>
  );
}
