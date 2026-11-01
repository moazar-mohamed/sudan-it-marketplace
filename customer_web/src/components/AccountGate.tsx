import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../auth';
import { ensureCustomerProfile, isAccountDeleted, isSigningUp, refreshVerification, resendVerification } from '../data/account';
import { CatalogProvider } from '../data/DataProvider';
import { useProfile } from '../data/hooks';
import { recordActiveDay } from '../data/usage';
import { auth } from '../firebase';
import { AuthCard } from './AuthCard';
import { CityPicker } from './CityPicker';

function AccessMessage({ title, message }: { title: string; message: string }) {
  return (
    <AuthCard title={title} subtitle={message}>
      <button className="btn ghost" onClick={() => signOut(auth)}>تسجيل الخروج</button>
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
      else setNote({ text: 'لم يتم التحقق بعد. يرجى الضغط على الرابط في الرسالة ثم المحاولة مرة أخرى.', ok: false });
    } catch {
      setNote({ text: 'خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.', ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setNote(null);
    const error = await resendVerification(user!);
    setNote({ text: error ?? 'تم إرسال رسالة التحقق. يرجى مراجعة بريدك الوارد.', ok: error === null });
    setBusy(false);
  }

  return (
    <AuthCard
      title="تحقق من بريدك الإلكتروني"
      subtitle={email ? `أرسلنا رابط التحقق إلى ${email}. يرجى التحقق من بريدك الإلكتروني قبل المتابعة.` : 'يرجى التحقق من بريدك الإلكتروني قبل المتابعة.'}
    >
      {note && <div className={note.ok ? 'ok-note' : 'error'} role="status">{note.text}</div>}
      <button className="btn" disabled={busy} onClick={check}>لقد تحققت من بريدي الإلكتروني</button>
      <button className="btn ghost" disabled={busy} onClick={resend}>إعادة إرسال رسالة التحقق</button>
      <button className="btn ghost" onClick={() => signOut(auth)}>تسجيل الخروج</button>
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

const Splash = () => <div className="login" aria-busy="true"><span className="spinner" aria-label="جارٍ التحميل" /></div>;

/** A signed-in person reaches the shop only as an active, verified customer. */
export function AccountGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const { profile, loaded, failed } = useProfile(uid);
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

  const activeCustomer = profile?.role === 'customer' && profile.isActive;
  useEffect(() => {
    if (activeCustomer) void recordActiveDay(uid, 'customer');
  }, [activeCustomer, uid]);

  if (!loaded) return <Splash />;
  if (failed) {
    return <AccessMessage title="تعذر تحميل ملفك الشخصي" message="تعذر تحميل ملفك الشخصي. تحقق من اتصالك بالإنترنت وحاول مرة أخرى." />;
  }
  if (profile === null) {
    if (missing === 'deleted') {
      return <AccessMessage title="تم حذف الحساب" message="حذف فريق المنصة هذا الحساب ولا يمكن استخدامه بعد الآن. إن كنت ترى أن هذا خطأ فيرجى التواصل مع الدعم." />;
    }
    if (missing === 'noEmail') {
      return <AccessMessage title="تعذر إنشاء الحساب" message="حسابك لا يحتوي على بريد إلكتروني، لذلك تعذر إنشاء ملف شخصي. يرجى التواصل مع الدعم." />;
    }
    if (missing === 'failed') {
      return <AccessMessage title="تعذر إنشاء الحساب" message="تعذر حفظ ملفك الشخصي. يرجى المحاولة مرة أخرى." />;
    }
    return <Splash />;
  }
  if (profile.role === 'platform_admin') {
    return <AccessMessage title="مدير المنصة" message="تتم إدارة المنصة من لوحة الأدمن ولا تتوفر في هذا الموقع." />;
  }
  if (profile.role !== 'customer') {
    return <AccessMessage title="هذا الموقع للعملاء" message="حسابات الشركات والفنيين تعمل من التطبيق. سجّل الدخول من التطبيق لإدارة عملك." />;
  }
  if (!profile.isActive) {
    return <AccessMessage title="تم إلغاء تفعيل الحساب" message="تم إلغاء تفعيل حسابك. يرجى التواصل مع الدعم لإعادة تفعيله." />;
  }
  // Google accounts come back already verified: this only stops e-mail sign-ups.
  if (!user!.emailVerified) return <VerifyEmail email={user!.email ?? ''} />;

  return (
    <CatalogProvider profile={profile}>
      {profile.cityId === null ? <NeedsCity uid={uid} /> : children}
    </CatalogProvider>
  );
}
