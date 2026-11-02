import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { authErrorMessage, signIn, signInWithGoogle } from '../data/account';
import { t } from '../i18n';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setError('');
    try {
      if (await signInWithGoogle()) return;
    } catch (err) {
      setError(authErrorMessage(err));
    }
    setBusy(false);
  }

  return (
    <AuthCard title={t('تسجيل الدخول')} subtitle={t('مرحبًا بعودتك. سجّل الدخول للمتابعة.')}>
      <form onSubmit={submit}>
        <label className="field">
          {t('البريد الإلكتروني')}
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </label>
        <label className="field">
          {t('كلمة المرور')}
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </label>
        <Link to={`/forgot-password?email=${encodeURIComponent(email)}`} className="auth-link end">{t('نسيت كلمة المرور؟')}</Link>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? t('جارٍ الدخول...') : t('تسجيل الدخول')}</button>
      </form>
      <button className="btn ghost" disabled={busy} onClick={google}>{t('المتابعة باستخدام Google')}</button>
      <p className="auth-foot">{t('ليس لديك حساب؟')}{' '}<Link to="/register" className="auth-link">{t('إنشاء حساب')}</Link></p>
    </AuthCard>
  );
}
