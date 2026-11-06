import { useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { turnPushOff, turnPushOn, usePushState, type PushState } from '../data/webPush';
import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/dictionary';
import { Card } from './ui';

/** The kinds an admin can switch off, under the same pushPrefs keys the apps use. */
const KINDS: { key: string; label: TranslationKey }[] = [
  { key: 'reports', label: 'push.kind.reports' },
  { key: 'platform', label: 'push.kind.platform' },
];

const STATE_TEXT: Record<PushState, TranslationKey> = {
  on: 'push.on',
  off: 'push.off',
  blocked: 'push.blocked',
  unsupported: 'push.unsupported',
  homeScreen: 'push.homeScreen',
};

/** Pushes to this browser (new reports, low ratings), and which kinds the admin wants. */
export function PushSettings({ uid }: { uid: string }) {
  const { t } = useI18n();
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
    <Card
      title={t('push.title')}
      actions={
        state === 'on' || state === 'off' ? (
          <button type="button" className={state === 'on' ? 'btn btn--sm' : 'btn btn--primary btn--sm'} disabled={busy} onClick={() => void change(state !== 'on')}>
            {state === 'on' ? t('push.turnOff') : t('push.turnOn')}
          </button>
        ) : undefined
      }
    >
      <p className="muted">{t(STATE_TEXT[state])}</p>
      {prefs && (
        <fieldset className="option-list" aria-label={t('push.kinds')}>
          <p className="muted">{t('push.kinds')}</p>
          {KINDS.map((kind) => (
            <label key={kind.key} className="option">
              <input type="checkbox" checked={prefs[kind.key] !== false} onChange={(e) => void toggle(kind.key, e.target.checked)} />
              <span>{t(kind.label)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {failed && (
        <p className="field__error" role="alert">
          {t('push.failed')}
        </p>
      )}
    </Card>
  );
}
