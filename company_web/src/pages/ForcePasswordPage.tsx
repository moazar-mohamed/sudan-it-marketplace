import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, authErrorText, useAuth } from '../auth/AuthProvider';
import { Banner, Spinner } from '../ui/kit';

/** The first time in, a company admin created by Platform Admin must choose their own password. */
export function ForcePasswordPage() {
  const { completePasswordChange, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const problem =
    next.length > 0 && next.length < MIN_PASSWORD_LENGTH
      ? `كلمة المرور الجديدة ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`
      : confirm && next !== confirm
        ? 'كلمتا المرور غير متطابقتين.'
        : next && next === current
          ? 'اختر كلمة مرور مختلفة عن المؤقتة.'
          : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || problem || !current || !next) return;
    setBusy(true);
    setError('');
    try {
      await completePasswordChange(current, next);
    } catch (err) {
      setError(authErrorText(err));
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>اختر كلمة مرورك</h1>
          <p className="sub">أُنشئ حسابك بكلمة مرور مؤقتة. اختر كلمة مرور خاصة بك لتتابع.</p>
        </div>
        {error && <Banner tone="bad" icon="alert">{error}</Banner>}
        <div className="fld">
          <label htmlFor="cur">كلمة المرور المؤقتة</label>
          <input id="cur" className="inp ltr" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="fld">
          <label htmlFor="nw">كلمة المرور الجديدة</label>
          <input id="nw" className="inp ltr" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="fld">
          <label htmlFor="cf">تأكيد كلمة المرور</label>
          <input id="cf" className={`inp ltr${problem ? ' err' : ''}`} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {problem && <span className="errt">{problem}</span>}
        </div>
        <button className="btn p lg" type="submit" disabled={busy || !!problem || !current || !next || !confirm}>
          {busy && <Spinner />}
          حفظ ومتابعة
        </button>
        <button type="button" className="linkbtn" onClick={() => void signOut()}>
          تسجيل الخروج
        </button>
      </form>
    </div>
  );
}
