import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { turnPushOff, turnPushOn, usePushState } from '../data/webPush';
import type { PushState } from '../data/webPush';
import type { UserProfile } from '../data/types';
import { t } from '../i18n';

/** The kinds a customer can switch off; the same keys and the same switches as the app's Settings. */
const KINDS = [
  { key: 'orders', label: t('الطلبات والدفع والتقييمات') },
  { key: 'chat', label: t('رسائل المحادثات') },
  { key: 'serviceRequests', label: t('طلبات الخدمات') },
  { key: 'reports', label: t('ردود البلاغات') },
] as const;

function stateText(state: PushState): string {
  switch (state) {
    case 'on':
      return t('الإشعارات شغالة على هذا المتصفح، وتصلك حتى والموقع مقفول.');
    case 'blocked':
      return t('المتصفح ممنوع من الإشعارات. اسمح بها من رمز القفل جنب عنوان الموقع، ثم ارجع هنا.');
    case 'unsupported':
      return t('هذا المتصفح لا يدعم الإشعارات.');
    case 'homeScreen':
      return t('على الآيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتح الموقع من الأيقونة الجديدة، ثم فعّل الإشعارات من هنا.');
    default:
      return t('فعّل الإشعارات لتعرف بتحديثات طلباتك ورسائل الشركات حتى والموقع مقفول.');
  }
}

/** Turning pushes on or off for this browser. */
export function PushSwitch({ profile, compact = false }: { profile: UserProfile; compact?: boolean }) {
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (state === null || (compact && state !== 'off' && state !== 'homeScreen')) return null;

  const change = async (on: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      if (on) setState(await turnPushOn(profile.id));
      else {
        await turnPushOff(profile.id);
        setState('off');
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'tile push-invite' : undefined}>
      <p className="pmeta">{stateText(state)}</p>
      {state === 'off' && (
        <button className="btn" type="button" disabled={busy} onClick={() => void change(true)}>
          {t('تفعيل الإشعارات على هذا المتصفح')}
        </button>
      )}
      {state === 'on' && (
        <button className="btn ghost" type="button" disabled={busy} onClick={() => void change(false)}>
          {t('إيقاف الإشعارات على هذا المتصفح')}
        </button>
      )}
      {failed && <p className="error" role="alert">{t('تعذّر تغيير الإشعارات. تحقق من اتصالك وحاول مرة أخرى.')}</p>}
    </div>
  );
}

/** Pushes for this browser, then the kinds the person wants (on the phone too). */
export function PushSettings({ profile }: { profile: UserProfile }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(profile.pushPrefs ?? {});
  const [saveFailed, setSaveFailed] = useState(false);

  const toggle = async (key: string, on: boolean) => {
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    setSaveFailed(false);
    try {
      await updateDoc(doc(db, 'users', profile.id), { pushPrefs: next });
    } catch {
      setPrefs(prefs);
      setSaveFailed(true);
    }
  };

  return (
    <section className="tile" aria-label={t('الإشعارات')}>
      <h2>{t('الإشعارات')}</h2>
      <PushSwitch profile={profile} />
      <h3 className="pmeta" style={{ marginTop: 18 }}>{t('ما الذي يصلك (على الموبايل والمتصفح):')}</h3>
      {KINDS.map((kind) => (
        <label key={kind.key} className="check">
          <input type="checkbox" checked={prefs[kind.key] !== false} onChange={(e) => void toggle(kind.key, e.target.checked)} />
          <span>{kind.label}</span>
        </label>
      ))}
      {saveFailed && <p className="error" role="alert">{t('تعذّر حفظ الاختيار. حاول مرة أخرى.')}</p>}
    </section>
  );
}
