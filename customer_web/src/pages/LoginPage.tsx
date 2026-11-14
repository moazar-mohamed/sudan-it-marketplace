import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { authErrorMessage, signIn, signInWithGoogle } from '../data/account';
import { safeNext, withNext } from '../data/nextPath';
import { t } from '../i18n';
import { BusyLabel } from '../components/BusyLabel';

/** Reached only when an account is needed (checkout, chats...); afterwards back to `?next=`. */
export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [viaGoogle, setViaGoogle] = useState(false);
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
    setViaGoogle(true);
    setError('');
    try {
      if (await signInWithGoogle()) return;
    } catch (err) {
      setError(authErrorMessage(err));
    }
    setBusy(false);
    setViaGoogle(false);
  }

  return (
    <AuthCard
      title={t('تسجيل الدخول')}
      subtitle={next.startsWith('/checkout/') ? t('سجّل الدخول أو أنشئ حسابًا لإتمام طلبك. يبقى طلبك كما هو.') : t('مرحبًا بعودتك. سجّل الدخول للمتابعة.')}
      back={next}
    >
      <form onSubmit={submit}>
        <label className="field">
          {t('البريد الإلكتروني')}
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </label>
        <label className="field">
          {t('كلمة المرور')}
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        </label>
        <Link to={`${withNext('/forgot-password', next)}${next === '/' ? '?' : '&'}email=${encodeURIComponent(email)}`} className="auth-link end">{t('نسيت كلمة المرور؟')}</Link>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy} aria-busy={busy && !viaGoogle}><BusyLabel busy={busy && !viaGoogle} busyText={t('جارٍ الدخول...')}>{t('تسجيل الدخول')}</BusyLabel></button>
      </form>
      <button className="btn ghost" disabled={busy} aria-busy={viaGoogle} onClick={google}><BusyLabel busy={viaGoogle} busyText={t('جارٍ فتح Google…')}>{t('المتابعة باستخدام Google')}</BusyLabel></button>
      <p className="auth-foot">{t('ليس لديك حساب؟')}{' '}<Link to={withNext('/register', next)} className="auth-link">{t('إنشاء حساب')}</Link></p>
    </AuthCard>
  );
}
