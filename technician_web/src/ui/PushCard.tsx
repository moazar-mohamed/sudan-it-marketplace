import { useState } from 'react';
import { useProfile } from '../auth/AuthProvider';
import { turnPushOn, usePushState } from '../data/webPush';
import { t } from '../i18n';
import { Icon } from './Icon';
import { useToast } from './toast';

/** Turning browser pushes on for this device, or how to on an iPhone (Home Screen first). Hidden once on. */
export function PushCard() {
  const profile = useProfile();
  const toast = useToast();
  const [state, setState] = usePushState();
  const [busy, setBusy] = useState(false);

  if (state === null || state === 'unsupported') return null;
  if (state === 'on') {
    return (
      <p role="status" className="strip ok" style={{ alignItems: 'center', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
        <Icon name="check" small />
        {t('الإشعارات مفعّلة على هذا الجهاز')}
      </p>
    );
  }
  if (state === 'homeScreen') {
    return (
      <section className="hero" aria-labelledby="ios-title" style={{ borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 6 }}>
        <div className="row">
          <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mobile" />
          </span>
          <div>
            <div id="ios-title" style={{ fontSize: 15, fontWeight: 800 }}>
              {t('في الآيفون: ثبّت الصفحة أولاً')}
            </div>
            <div style={{ fontSize: 13, opacity: 0.88 }}>{t('الآيفون لا يرسل الإشعارات إلا للصفحة المثبّتة')}</div>
          </div>
        </div>
        <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 14, lineHeight: 1.9 }}>
          <li>
            {t('في Safari اضغط زر المشاركة')} <Icon name="share" small />
          </li>
          <li>{t('اختر «إضافة إلى الشاشة الرئيسية»')}</li>
          <li>{t('افتح الصفحة من الأيقونة الجديدة، ثم اضغط «تفعيل»')}</li>
        </ol>
      </section>
    );
  }
  if (state === 'blocked') {
    return (
      <div className="strip warn" style={{ marginBottom: 6 }}>
        <Icon name="alert" />
        <p>{t('منعت المتصفح من إرسال الإشعارات لهذه الصفحة. اسمح بها من إعدادات الموقع في المتصفح، ثم أعد فتح الصفحة.')}</p>
      </div>
    );
  }
  const enable = async () => {
    setBusy(true);
    try {
      const next = await turnPushOn(profile.uid);
      setState(next);
      if (next === 'on') toast(t('ستصلك الإشعارات على هذا الجهاز.'), 'ok');
    } catch {
      toast(t('تعذّر تفعيل الإشعارات. تأكد من الاتصال وحاول مرة أخرى.'), 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="hero" aria-label={t('تفعيل إشعارات المتصفح')} style={{ borderRadius: 18, padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <span style={{ flex: 'none', width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" />
      </span>
      <div className="minw">
        <div style={{ fontSize: 15, fontWeight: 800 }}>{t('فعّل الإشعارات على موبايلك')}</div>
        <div style={{ fontSize: 13, opacity: 0.88 }}>{t('تصلك حتى والصفحة مغلقة: مهمة جديدة، تأكيد دفع، رسالة')}</div>
      </div>
      <button type="button" className="btn" style={{ flex: 'none', minHeight: 44, padding: '0 16px', fontSize: 14, fontWeight: 800, borderRadius: 10 }} onClick={enable} disabled={busy}>
        {t('تفعيل')}
      </button>
    </section>
  );
}
