import { useState } from 'react';
import { acceptTerms, termsText } from '../data/terms';
import type { Terms } from '../data/terms';
import { signOutHere } from '../firebase';
import { language, t } from '../i18n';

/**
 * Between signing in and the shop, for someone who has not accepted the
 * published version (an account made before there were terms, a Google
 * sign-up, or a new version). It cannot be dismissed, only accepted or left.
 */
export function TermsGate({ uid, terms }: { uid: string; terms: Terms }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setBusy(true);
    setError('');
    if (!(await acceptTerms(uid, terms.version))) {
      setError(t('تعذر حفظ موافقتك. تحقق من اتصالك وحاول مرة أخرى.'));
      setBusy(false);
    }
    // On success the profile updates and the shop opens by itself.
  }

  return (
    <div className="login">
      <div className="login-card terms-card" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
        <h1 id="terms-gate-title" className="auth-title">{t('الشروط والأحكام')}</h1>
        <p className="auth-sub">{t('للمتابعة، اقرأ الشروط والأحكام ووافق عليها.')}</p>
        <div className="terms-scroll prose" tabIndex={0}>{termsText(terms, language)}</div>
        <label className="check terms-check">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>{t('قرأت الشروط والأحكام وأوافق عليها')}</span>
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn" type="button" disabled={!agreed || busy} onClick={accept}>
          {busy ? t('جارٍ الحفظ...') : t('أوافق وأتابع')}
        </button>
        <button className="btn ghost" type="button" onClick={signOutHere}>{t('تسجيل الخروج')}</button>
      </div>
    </div>
  );
}
