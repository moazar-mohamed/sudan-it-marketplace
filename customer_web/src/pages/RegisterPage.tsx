import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { authErrorMessage, EMAIL_PATTERN, NAME_PATTERN, PASSWORD_MIN, signUp } from '../data/account';

function problemOf(name: string, email: string, password: string, confirm: string): string | null {
  if (name.trim() === '') return 'الاسم الكامل مطلوب.';
  if (!NAME_PATTERN.test(name.trim())) return 'يجب أن يحتوي الاسم الكامل على أحرف ومسافات فقط.';
  if (email.trim() === '') return 'البريد الإلكتروني مطلوب.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'أدخل بريدًا إلكترونيًا صالحًا.';
  if (password === '') return 'كلمة المرور مطلوبة.';
  if (password.length < PASSWORD_MIN) return 'يجب ألا تقل كلمة المرور عن 6 أحرف.';
  if (confirm === '') return 'تأكيد كلمة المرور مطلوب.';
  if (confirm !== password) return 'كلمتا المرور غير متطابقتين.';
  return null;
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = problemOf(name, email, password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signUp(name, email, password);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard title="إنشاء حساب" subtitle="أنشئ حسابًا للبدء.">
      <form onSubmit={submit} noValidate>
        <label className="field">
          الاسم الكامل
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          البريد الإلكتروني
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="you@example.com" />
        </label>
        <label className="field">
          كلمة المرور
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          <span className="pmeta">6 أحرف على الأقل.</span>
        </label>
        <label className="field">
          تأكيد كلمة المرور
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'جارٍ الإنشاء...' : 'إنشاء حساب'}</button>
      </form>
      <p className="auth-foot">لديك حساب بالفعل؟ <Link to="/" className="auth-link">تسجيل الدخول</Link></p>
    </AuthCard>
  );
}
