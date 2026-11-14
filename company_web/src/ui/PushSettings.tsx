import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { turnPushOff, turnPushOn, usePushState, type PushState } from '../data/webPush';
import { Switch } from './kit';
import { t } from '../i18n';

/** The kinds a company admin can switch off; the same keys and switches as the app's Settings. */
const KINDS = [
  { key: 'orders', label: t('الطلبات والتقييمات') },
  { key: 'chat', label: t('رسائل العملاء') },
  { key: 'serviceRequests', label: t('طلبات الخدمات') },
  { key: 'platform', label: t('ما تفعله المنصة بمنتجاتك وطلباتك') },
  { key: 'reports', label: t('ردود البلاغات') },
] as const;

function stateText(state: PushState): string {
  switch (state) {
    case 'on':
      return t('التنبيهات شغالة على هذا المتصفح، وتصلك حتى واللوحة مقفولة.');
    case 'blocked':
      return t('المتصفح ممنوع من التنبيهات. اسمح بها من رمز القفل جنب عنوان الموقع، ثم ارجع هنا.');
    case 'unsupported':
      return t('هذا المتصفح لا يدعم التنبيهات.');
    case 'homeScreen':
      return t('على الآيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»، وافتح اللوحة من الأيقونة الجديدة، ثم شغّل التنبيهات من هنا.');
    default:
      return t('فعّل التنبيهات ليصلك كل طلب جديد ورسالة عميل حتى واللوحة مقفولة.');
  }
}

/** Pushes to this browser, then the kinds the admin wants (on their phone too). */
export function PushSettings({ uid }: { uid: string }) {
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let live = true;
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        const stored = snap.data()?.pushPrefs;
        if (live) setPrefs(stored && typeof stored === 'object' ? (stored as Record<string, boolean>) : {});
      })
      .catch(() => live && setPrefs({}));
    return () => {
      live = false;
    };
  }, [uid]);

  if (state === null) return null;

  const change = async (on: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      if (on) setState(await turnPushOn(uid));
      else {
        await turnPushOff(uid);
        setState('off');
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: string, on: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    setFailed(false);
    try {
      await updateDoc(doc(db, 'users', uid), { pushPrefs: next });
    } catch {
      setPrefs(prefs);
      setFailed(true);
    }
  };

  return (
    <section className="card" aria-label={t('تنبيهات المتصفح')} style={{ padding: 16, marginBottom: 16 }}>
      <div className="lr" style={{ padding: 0 }}>
        <div className="grow">
          <div className="b">{t('تنبيهات المتصفح')}</div>
          <div className="sub">{stateText(state)}</div>
        </div>
        {(state === 'on' || state === 'off') && (
          <Switch on={state === 'on'} disabled={busy} label={t('تنبيهات المتصفح')} onChange={(on) => void change(on)} />
        )}
      </div>
      {prefs && (
        <>
          <div className="hint" style={{ marginTop: 12 }}>{t('ما الذي يصلك (على الموبايل والمتصفح):')}</div>
          {KINDS.map((kind) => (
            <div key={kind.key} className="lr" style={{ padding: '6px 0' }}>
              <div className="grow">{kind.label}</div>
              <Switch on={prefs[kind.key] !== false} label={kind.label} onChange={(on) => void toggle(kind.key, on)} />
            </div>
          ))}
        </>
      )}
      {failed && <div className="hint" role="alert" style={{ color: 'var(--bad)' }}>{t('تعذّر حفظ التغيير. تحقق من اتصالك وحاول مرة أخرى.')}</div>}
    </section>
  );
}
