import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useProfile } from '../auth/AuthProvider';
import { savePushPrefs, setAvailability } from '../data/actions';
import { sdg } from '../data/format';
import { initial, monthFees } from '../data/jobs';
import { useTechData } from '../data/TechData';
import { applyLanguage, language, t } from '../i18n';
import { useTheme } from '../theme';
import { Icon } from '../ui/Icon';
import { Switch } from '../ui/kit';
import { useToast } from '../ui/toast';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** The browser's own "install this page" offer, when it has one (Chrome on Android, desktop). */
function useInstallPrompt(): [InstallPrompt | null, () => void] {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const installed = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', on);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  return [prompt, () => setPrompt(null)];
}

export default function ProfilePage() {
  const profile = useProfile();
  const { signOut, patchProfile } = useAuth();
  const { technician, company, jobs } = useTechData();
  const theme = useTheme();
  const toast = useToast();
  const [install, clearInstall] = useInstallPrompt();
  const name = technician?.fullName || profile.fullName;
  const phone = technician?.phone || profile.phone;
  const done = jobs.filter((j) => j.orderStatus === 'completed').length;

  const queuedNote = (r: string) => r === 'queued' && toast(t('حُفظ التغيير على الجهاز، وسيُرسل عند عودة الاتصال.'));
  const failed = () => toast(t('تعذّر حفظ التغيير، حاول مرة أخرى.'), 'err');

  const setPref = (key: 'orders' | 'chat', on: boolean) => {
    const next = { ...profile.pushPrefs, [key]: on };
    patchProfile({ pushPrefs: next });
    savePushPrefs(profile.uid, next)
      .then(queuedNote)
      .catch(() => {
        patchProfile({ pushPrefs: profile.pushPrefs });
        failed();
      });
  };

  const companyMap =
    company && company.latitude !== null && company.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${company.latitude},${company.longitude}`
      : company?.address
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([company.address, company.city].filter(Boolean).join(' '))}`
        : null;

  return (
    <main className="scroll">
      <section className="hero" style={{ padding: 'calc(22px + env(safe-area-inset-top)) 16px 58px' }}>
        <div className="row" style={{ gap: 12 }}>
          <span aria-hidden="true" style={{ flex: 'none', width: 62, height: 62, borderRadius: 31, background: '#fff', color: '#063b73', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 4px rgba(255,255,255,.18)' }}>
            {initial(name)}
          </span>
          <div className="minw">
            <h1 style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.35 }}>{name || t('فني')}</h1>
            <p style={{ fontSize: 14, opacity: 0.88 }}>
              {t('فني تركيب')}
              {company?.name ? ` · ${company.name}` : ''}
            </p>
          </div>
        </div>
      </section>
      <div className="lift" style={{ padding: '0 16px 16px', marginTop: -42, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card grid2" style={{ padding: 4, gap: 0 }}>
          <div style={{ padding: '10px 12px', borderInlineEnd: '1px solid var(--surface-2)' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--brand)' }}>{done}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('مهمة منجزة')}</div>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div dir="ltr" style={{ fontSize: 22, fontWeight: 800, color: 'var(--action)', textAlign: 'end' }} className="ell">
              {sdg(monthFees(jobs))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('رسوم هذا الشهر')}</div>
          </div>
        </div>

        {technician && (
          <section className="card" aria-label={t('حالتي')} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="minw">
              <div style={{ fontSize: 15, fontWeight: 800 }}>{t('أنا متاح للمهام')}</div>
              <div className="sub">{t('عند إيقافه تراك الشركة غير متاح عند إسناد المهام')}</div>
            </div>
            <Switch on={technician.isAvailable} label={t('أنا متاح للمهام')} onChange={(on) => setAvailability(technician.id, on).then(queuedNote).catch(failed)} />
          </section>
        )}

        <section className="card" aria-labelledby="t-me" style={{ padding: '12px 14px 2px' }}>
          <h2 id="t-me" className="sec">
            {t('بياناتي')}
          </h2>
          <div className="lrow">
            <span className="minw">
              <span className="lbl">{t('الاسم')}</span>
              <span className="val">{name || '—'}</span>
            </span>
          </div>
          <div className="lrow">
            <span className="minw">
              <span className="lbl">{t('رقم الهاتف')}</span>
              <span className="val" dir="ltr">
                {phone || '—'}
              </span>
            </span>
          </div>
          <div className="lrow">
            <span className="minw">
              <span className="lbl">{t('البريد الإلكتروني')}</span>
              <span className="val ell" dir="ltr" style={{ display: 'block' }}>
                {profile.email || technician?.email || '—'}
              </span>
            </span>
          </div>
          <p className="sub" style={{ padding: '8px 0' }}>
            {t('الاسم والهاتف تعدّلهما شركتك.')}
          </p>
          <Link className="lrow" to="/profile/password">
            <span className="minw val">{t('تغيير كلمة المرور')}</span>
            <Icon name="chevron" small />
          </Link>
        </section>

        {company && (
          <section className="card card-b stack" aria-labelledby="t-company">
            <h2 id="t-company" className="sec">
              {t('شركتي')}
            </h2>
            <div className="row" style={{ gap: 12 }}>
              <span aria-hidden="true" style={{ flex: 'none', width: 46, height: 46, borderRadius: 14, background: '#063b73', color: '#fff', fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {initial(company.name)}
              </span>
              <span className="minw">
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800 }}>{company.name}</span>
                <span className="sub">{[company.city, company.address].filter(Boolean).join('، ') || '—'}</span>
              </span>
              {companyMap && (
                <a className="mini" href={companyMap} target="_blank" rel="noreferrer">
                  <Icon name="pin" small />
                  {t('الموقع')}
                </a>
              )}
            </div>
          </section>
        )}

        <section className="card" aria-labelledby="t-notif" style={{ padding: '12px 14px 2px' }}>
          <h2 id="t-notif" className="sec">
            {t('الإشعارات على هذا الجهاز')}
          </h2>
          <div className="lrow">
            <span className="minw" style={{ fontSize: 15, fontWeight: 600 }}>
              {t('المهام: جديدة، جاهزة، ملغاة')}
            </span>
            <Switch on={profile.pushPrefs.orders !== false} label={t('إشعارات المهام')} onChange={(on) => setPref('orders', on)} />
          </div>
          <div className="lrow">
            <span className="minw" style={{ fontSize: 15, fontWeight: 600 }}>
              {t('رسائل الشركة')}
            </span>
            <Switch on={profile.pushPrefs.chat !== false} label={t('إشعارات الرسائل')} onChange={(on) => setPref('chat', on)} />
          </div>
          <Link className="lrow sub" to="/notifications" style={{ minHeight: 48 }}>
            <span className="minw">{t('تفعيل الإشعارات في هذا المتصفح')}</span>
            <Icon name="chevron" small />
          </Link>
        </section>

        <section className="card card-b stack" aria-labelledby="t-page" style={{ gap: 12 }}>
          <h2 id="t-page" className="sec">
            {t('الصفحة')}
          </h2>
          <div className="row">
            <span className="minw" style={{ fontSize: 15, fontWeight: 600 }}>
              {t('المظهر')}
            </span>
            <div className="seg" role="group" aria-label={t('المظهر')}>
              <button type="button" aria-pressed={theme.resolved === 'light'} onClick={() => theme.set('light')}>
                {t('فاتح')}
              </button>
              <button type="button" aria-pressed={theme.resolved === 'dark'} onClick={() => theme.set('dark')}>
                {t('داكن')}
              </button>
            </div>
          </div>
          <div className="row">
            <span className="minw" style={{ fontSize: 15, fontWeight: 600 }}>
              {t('اللغة')}
            </span>
            <div className="seg" role="group" aria-label={t('اللغة')}>
              <button type="button" lang="ar" aria-pressed={language === 'ar'} onClick={() => applyLanguage('ar')}>
                العربية
              </button>
              <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => applyLanguage('en')}>
                English
              </button>
            </div>
          </div>
          {install && (
            <button
              type="button"
              className="btn-line"
              onClick={() => {
                void install.prompt();
                void install.userChoice.finally(clearInstall);
              }}
            >
              <Icon name="download" small />
              {t('ثبّت الصفحة على الشاشة الرئيسية')}
            </button>
          )}
        </section>

        <button type="button" className="btn-danger" onClick={() => void signOut()}>
          <Icon name="logout" small />
          {t('تسجيل الخروج')}
        </button>
      </div>
    </main>
  );
}
