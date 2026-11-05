import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { ensureCustomerProfile, isAccountDeleted, isSigningUp, refreshVerification, resendVerification, saveLanguage } from '../data/account';
import { CatalogProvider } from '../data/DataProvider';
import { useProfile } from '../data/hooks';
import { needsTerms, useTerms } from '../data/terms';
import { recordActiveDay } from '../data/usage';
import { signOutHere } from '../firebase';
import { AuthCard } from './AuthCard';
import { CityPicker } from './CityPicker';
import { TermsGate } from './TermsGate';
import { applyLanguage, hasChosenLanguage, language, languageIsPending, markLanguagePending, t } from '../i18n';

function AccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <AuthCard title={title} subtitle={message}>
      <button className="btn ghost" onClick={signOutHere}>{t('تسجيل الخروج')}</button>
    </AuthCard>
  );
}

function VerifyEmail({ email }: { email: string }) {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  async function check() {
    setBusy(true);
    setNote(null);
    try {
      const verified = await refreshVerification(user!);
      if (verified) refresh();
      else setNote({ text: t('لم يتم التحقق بعد. يرجى الضغط على الرابط في الرسالة ثم المحاولة مرة أخرى.'), ok: false });
    } catch {
      setNote({ text: t('خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.'), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setNote(null);
    const error = await resendVerification(user!);
    setNote({ text: error ?? t('تم إرسال رسالة التحقق. يرجى مراجعة بريدك الوارد.'), ok: error === null });
    setBusy(false);
  }

  return (
    <AuthCard
      title={t('تحقق من بريدك الإلكتروني')}
      subtitle={email ? t('أرسلنا رابط التحقق إلى {0}. يرجى التحقق من بريدك الإلكتروني قبل المتابعة.', email) : t('يرجى التحقق من بريدك الإلكتروني قبل المتابعة.')}
    >
      {note && <div className={note.ok ? 'ok-note' : 'error'} role="status">{note.text}</div>}
      <button className="btn" disabled={busy} onClick={check}>{t('لقد تحققت من بريدي الإلكتروني')}</button>
      <button className="btn ghost" disabled={busy} onClick={resend}>{t('إعادة إرسال رسالة التحقق')}</button>
      <button className="btn ghost" onClick={signOutHere}>{t('تسجيل الخروج')}</button>
    </AuthCard>
  );
}

/** Asks for the city before the shop, as the app does: it cannot be dismissed. */
function NeedsCity({ uid }: { uid: string }) {
  return (
    <div className="login">
      <CityPicker uid={uid} selectedId={null} />
    </div>
  );
}

const Splash = () => <div className="login" aria-busy="true"><span className="spinner" aria-label={t('جارٍ التحميل')} /></div>;

/** A signed-in person reaches the shop only as an active, verified customer. */
export function AccountGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const { profile, loaded, failed } = useProfile(uid);
  const { terms, loaded: termsLoaded } = useTerms();
  const [missing, setMissing] = useState<'checking' | 'deleted' | 'failed' | 'noEmail'>('checking');

  useEffect(() => {
    if (!loaded || failed || profile !== null || isSigningUp()) return;
    let live = true;
    (async () => {
      if (await isAccountDeleted(uid)) {
        if (live) setMissing('deleted');
        return;
      }
      try {
        await ensureCustomerProfile(user!);
      } catch (e) {
        if (live) setMissing((e as Error).message === 'profile-missing-email' ? 'noEmail' : 'failed');
      }
    })();
    return () => {
      live = false;
    };
  }, [loaded, failed, profile, uid, user]);

  // As in the app: a language on the profile wins; otherwise this device's choice is saved to it.
  const profileLanguage = profile?.language;
  const hasProfile = profile !== null;
  useEffect(() => {
    if (!hasProfile) return;
    if (languageIsPending() || (!profileLanguage && hasChosenLanguage())) {
      void saveLanguage(uid, language).then((saved) => saved && markLanguagePending(false));
    } else if (profileLanguage) {
      applyLanguage(profileLanguage);
    }
  }, [hasProfile, profileLanguage, uid]);

  const activeCustomer = profile?.role === 'customer' && profile.isActive;
  useEffect(() => {
    if (activeCustomer) void recordActiveDay(uid, 'customer');
  }, [activeCustomer, uid]);

  if (!loaded) return <Splash />;
  if (failed) {
    return <AccessMessage title={t('تعذر تحميل ملفك الشخصي')} message={t('تعذر تحميل ملفك الشخصي. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.')} />;
  }
  if (profile === null) {
    if (missing === 'deleted') {
      return <AccessMessage title={t('تم حذف الحساب')} message={t('حذف فريق المنصة هذا الحساب ولا يمكن استخدامه بعد الآن. إن كنت ترى أن هذا خطأ فيرجى التواصل مع الدعم.')} />;
    }
    if (missing === 'noEmail') {
      return <AccessMessage title={t('تعذر إنشاء الحساب')} message={t('حسابك لا يحتوي على بريد إلكتروني، لذلك تعذر إنشاء ملف شخصي. يرجى التواصل مع الدعم.')} />;
    }
    if (missing === 'failed') {
      return <AccessMessage title={t('تعذر إنشاء الحساب')} message={t('تعذر حفظ ملفك الشخصي. يرجى المحاولة مرة أخرى.')} />;
    }
    return <Splash />;
  }
  if (profile.role === 'platform_admin') {
    return <AccessMessage title={t('مدير المنصة')} message={t('تتم إدارة المنصة من لوحة الأدمن ولا تتوفر في هذا الموقع.')} />;
  }
  if (profile.role !== 'customer') {
    return <AccessMessage title={t('هذا الموقع للعملاء')} message={t('حسابات الشركات والفنيين تعمل من التطبيق. سجّل الدخول من التطبيق لإدارة عملك.')} />;
  }
  if (!profile.isActive) {
    return <AccessMessage title={t('تم إلغاء تفعيل الحساب')} message={t('تم إلغاء تفعيل حسابك. يرجى التواصل مع الدعم لإعادة تفعيله.')} />;
  }
  // Google accounts come back already verified: this only stops e-mail sign-ups.
  if (!user!.emailVerified) return <VerifyEmail email={user!.email ?? ''} />;
  // Published terms must be accepted (once per version) before the shop.
  if (!termsLoaded) return <Splash />;
  if (needsTerms(terms, profile.termsVersion)) return <TermsGate uid={uid} terms={terms!} />;

  return (
    <CatalogProvider profile={profile}>
      {profile.cityId === null ? <NeedsCity uid={uid} /> : children}
    </CatalogProvider>
  );
}
