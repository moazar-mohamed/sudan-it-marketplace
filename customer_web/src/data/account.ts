import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updatePassword,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { t } from '../i18n';

// Ports of the app's auth data layer (firebase_auth_remote_data_source.dart,
// auth_repository_impl.dart, firestore_user_profile_remote_data_source.dart).

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const NAME_PATTERN = /^[؀-ۿݐ-ݿࢠ-ࣿa-zA-Z\s'-]+$/;
export const PASSWORD_MIN = 6;

auth.languageCode = 'ar';

let signingUp = false;

/** True while sign-up is writing the profile itself, with the name the person typed. */
export const isSigningUp = (): boolean => signingUp;

const errorCode = (e: unknown): string =>
  e instanceof FirebaseError ? e.code.replace(/^auth\//, '') : 'unknown';

/** Sign-in and sign-up failures, in the app's words. */
export function authErrorMessage(e: unknown): string {
  switch (errorCode(e)) {
    case 'email-already-in-use': return t('هذا البريد الإلكتروني مسجّل بالفعل.');
    case 'invalid-email': return t('أدخل بريدًا إلكترونيًا صالحًا.');
    case 'weak-password': return t('اختر كلمة مرور أقوى.');
    case 'user-not-found':
    case 'wrong-password':
    case 'invalid-credential': return t('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    case 'user-disabled': return t('تم تعطيل هذا الحساب.');
    case 'too-many-requests': return t('محاولات كثيرة. يرجى الانتظار ثم المحاولة مرة أخرى.');
    case 'network-request-failed': return t('خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.');
    case 'operation-not-allowed': return t('تسجيل الدخول بالبريد الإلكتروني وكلمة المرور غير مفعّل.');
    case 'account-exists-with-different-credential': return t('يوجد حساب بهذا البريد الإلكتروني بطريقة تسجيل دخول مختلفة.');
    case 'popup-blocked': return t('منع المتصفح نافذة تسجيل الدخول باستخدام Google. اسمح بالنوافذ المنبثقة لهذا الموقع ثم حاول مرة أخرى.');
    case 'unauthorized-domain': return t('تسجيل الدخول باستخدام Google غير مفعّل لعنوان هذا الموقع.');
    case 'profile-create-failed': return t('تعذر حفظ ملفك الشخصي. يرجى المحاولة مرة أخرى.');
    default: return t('فشلت المصادقة. يرجى المحاولة مرة أخرى.');
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

/** [termsVersion]: the version accepted on the sign-up form, recorded with the profile. */
async function createCustomerProfile(uid: string, fullName: string, email: string, termsVersion?: number): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    id: uid,
    fullName,
    email,
    role: 'customer',
    isActive: true,
    createdAt: serverTimestamp(),
    ...(termsVersion === undefined ? {} : { termsVersion, termsAcceptedAt: serverTimestamp() }),
  });
}

/** Creates the account and its profile; a failed profile takes the account back. */
export async function signUp(fullName: string, email: string, password: string, termsVersion?: number): Promise<void> {
  signingUp = true;
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
    // The verification screen offers a resend, so a failed send does not fail sign-up.
    await sendEmailVerification(user).catch(() => undefined);
    try {
      await createCustomerProfile(user.uid, fullName.trim(), user.email ?? email.trim(), termsVersion);
    } catch {
      await deleteUser(user).catch(() => undefined);
      throw new FirebaseError('profile-create-failed', 'profile-create-failed');
    }
  } finally {
    signingUp = false;
  }
}

/** Resolves false when the person closed the Google window: nothing to show. */
export async function signInWithGoogle(): Promise<boolean> {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
    return true;
  } catch (e) {
    const code = errorCode(e);
    if (code === 'popup-closed-by-user' || code === 'cancelled-popup-request') return false;
    throw e;
  }
}

/** A signed-in account with no profile (a first Google sign-in) gets one. */
export async function ensureCustomerProfile(user: User): Promise<void> {
  const email = (user.email ?? '').trim();
  if (email === '') throw new Error('profile-missing-email');
  const name = (user.displayName ?? '').trim() || email.split('@')[0];
  try {
    await createCustomerProfile(user.uid, name, email);
  } catch (e) {
    // Another tab may have created it at the same moment.
    if (!(await getDoc(doc(db, 'users', user.uid))).exists()) throw e;
  }
}

/** Whether Platform Admin deleted this account; unreadable counts as not deleted. */
export async function isAccountDeleted(uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db, 'deleted_accounts', uid))).exists();
  } catch {
    return false;
  }
}

/** An address with no account reports like a success, so the form reveals nothing. */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    if (errorCode(e) !== 'user-not-found') throw e;
  }
}

export function passwordResetErrorMessage(e: unknown): string {
  switch (errorCode(e)) {
    case 'invalid-email': return t('أدخل بريدًا إلكترونيًا صالحًا.');
    case 'too-many-requests': return t('محاولات كثيرة. يرجى الانتظار ثم المحاولة مرة أخرى.');
    case 'network-request-failed': return t('خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.');
    default: return t('تعذّر إرسال رسالة إعادة التعيين. حاول مرة أخرى.');
  }
}

/** Null on success, otherwise what to show. */
export async function resendVerification(user: User): Promise<string | null> {
  try {
    await sendEmailVerification(user);
    return null;
  } catch (e) {
    return errorCode(e) === 'too-many-requests'
      ? t('محاولات كثيرة. يرجى الانتظار ثم المحاولة مرة أخرى.')
      : t('تعذر إرسال رسالة التحقق. يرجى المحاولة مرة أخرى.');
  }
}

/**
 * Reloads the account, and when the e-mail is verified fetches a new token too:
 * the held one still says `email_verified: false` for up to an hour, and the
 * security rules read the token.
 */
export async function refreshVerification(user: User): Promise<boolean> {
  await reload(user);
  if (user.emailVerified) await user.getIdToken(true);
  return user.emailVerified;
}

export const hasPassword = (user: User): boolean =>
  user.providerData.some((p) => p.providerId === 'password');

/** Null on success, otherwise what to show. */
export async function changePassword(user: User, current: string, next: string): Promise<string | null> {
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', current));
    await updatePassword(user, next);
    return null;
  } catch (e) {
    switch (errorCode(e)) {
      case 'wrong-password':
      case 'invalid-credential': return t('كلمة المرور الحالية غير صحيحة.');
      case 'weak-password': return t('كلمة المرور الجديدة ضعيفة. استخدم 6 أحرف على الأقل.');
      case 'requires-recent-login': return t('يرجى تسجيل الخروج ثم الدخول مجددًا قبل تغيير كلمة المرور.');
      case 'too-many-requests': return t('محاولات كثيرة. يرجى الانتظار ثم المحاولة مرة أخرى.');
      default: return t('تعذر تغيير كلمة المرور. يرجى المحاولة مرة أخرى.');
    }
  }
}

/** Null on success, otherwise what to show. An empty phone leaves the saved one. */
export async function updateProfile(uid: string, fullName: string, phone: string): Promise<string | null> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName: fullName.trim(),
      ...(phone ? { phone } : {}),
      updatedAt: serverTimestamp(),
    });
    return null;
  } catch {
    return t('تعذر تحديث ملفك الشخصي. يرجى المحاولة مرة أخرى.');
  }
}

/** The rules allow exactly this edit: `cityId`, nothing else with it. */
export async function saveCity(uid: string, cityId: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'users', uid), { cityId });
    return true;
  } catch {
    return false;
  }
}

/** The rules allow exactly this edit: `language`, nothing else with it. */
export async function saveLanguage(uid: string, language: 'ar' | 'en'): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'users', uid), { language });
    return true;
  } catch {
    return false;
  }
}
