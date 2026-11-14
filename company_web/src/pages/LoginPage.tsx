import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { authErrorText, noticeText, useAuth, type AccessNotice } from '../auth/AuthProvider';
import { Banner, Spinner } from '../ui/kit';
import { t } from '../i18n';

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
          <div className="logo">{t('ش')}</div>
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
      </form>
    </div>
  );
}
