import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthCard } from '../components/AuthCard';
import { authErrorMessage, EMAIL_PATTERN, NAME_PATTERN, PASSWORD_MIN, signUp } from '../data/account';
import { useTerms } from '../data/terms';
import { t } from '../i18n';

function problemOf(name: string, email: string, password: string, confirm: string): string | null {
  if (name.trim() === '') return t('الاسم الكامل مطلوب.');
  if (!NAME_PATTERN.test(name.trim())) return t('يجب أن يحتوي الاسم الكامل على أحرف ومسافات فقط.');
  if (email.trim() === '') return t('البريد الإلكتروني مطلوب.');
  if (!EMAIL_PATTERN.test(email.trim())) return t('أدخل بريدًا إلكترونيًا صالحًا.');
  if (password === '') return t('كلمة المرور مطلوبة.');
  if (password.length < PASSWORD_MIN) return t('يجب ألا تقل كلمة المرور عن 6 أحرف.');
  if (confirm === '') return t('تأكيد كلمة المرور مطلوب.');
  if (confirm !== password) return t('كلمتا المرور غير متطابقتين.');
  return null;
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const { terms } = useTerms();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = problemOf(name, email, password, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    if (terms !== null && !agreed) {
      setError(t('يجب الموافقة على الشروط والأحكام لإنشاء الحساب.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signUp(name, email, password, terms?.version);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('إنشاء حساب')} subtitle={t('أنشئ حسابًا للبدء.')}>
      <form onSubmit={submit} noValidate>
        <label className="field">
          {t('الاسم الكامل')}
          <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          {t('البريد الإلكتروني')}
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="you@example.com" />
        </label>
        <label className="field">
          {t('كلمة المرور')}
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          <span className="pmeta">{t('6 أحرف على الأقل.')}</span>
        </label>
        <label className="field">
          {t('تأكيد كلمة المرور')}
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
        </label>
        {terms !== null && (
          <label className="check terms-check">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              {t('أوافق على')}{' '}
              <Link to="/terms" target="_blank" className="auth-link">{t('الشروط والأحكام')}</Link>
            </span>
          </label>
        )}
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? t('جارٍ الإنشاء...') : t('إنشاء حساب')}</button>
      </form>
      <p className="auth-foot">{t('لديك حساب بالفعل؟')}{' '}<Link to="/" className="auth-link">{t('تسجيل الدخول')}</Link></p>
    </AuthCard>
  );
}
