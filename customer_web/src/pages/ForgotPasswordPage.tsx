import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { EMAIL_PATTERN, passwordResetErrorMessage, requestPasswordReset } from '../data/account';

const COOLDOWN_SECONDS = 60;

/** The result never tells whether an account exists for the address. */
export function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function send(address: string) {
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(address);
      setSentTo(address);
      setSecondsLeft(COOLDOWN_SECONDS);
    } catch (err) {
      setError(passwordResetErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (address === '') setError('البريد الإلكتروني مطلوب.');
    else if (!EMAIL_PATTERN.test(address)) setError('أدخل بريدًا إلكترونيًا صالحًا.');
    else void send(address);
  }

  if (sentTo !== null) {
    return (
      <AuthCard
        title="تحقّق من بريدك الإلكتروني"
        subtitle={`إذا كان هناك حساب مرتبط بـ ${sentTo}، فقد أرسلنا رابطًا لإعادة تعيين كلمة مروره. تحقّق أيضًا من مجلد الرسائل غير المرغوب فيها.`}
      >
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn ghost" disabled={busy || secondsLeft > 0} onClick={() => send(sentTo)}>
          {secondsLeft > 0 ? `إعادة الإرسال بعد ${secondsLeft} ث` : 'إعادة إرسال الرسالة'}
        </button>
        <p className="auth-foot"><Link to="/" className="auth-link">العودة إلى تسجيل الدخول</Link></p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="إعادة تعيين كلمة المرور" subtitle="أدخل البريد الإلكتروني الذي سجّلت به. سنرسل لك رابطًا لاختيار كلمة مرور جديدة.">
      <form onSubmit={submit} noValidate>
        <label className="field">
          البريد الإلكتروني
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>إرسال رابط إعادة التعيين</button>
      </form>
      <p className="auth-foot"><Link to="/" className="auth-link">العودة إلى تسجيل الدخول</Link></p>
    </AuthCard>
  );
}
