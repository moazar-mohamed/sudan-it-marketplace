export interface AdminProfile {
  uid: string;
  fullName: string;
  email: string;
  role: 'platform_admin';
}

export type AccessDenialReason = 'not_found' | 'not_admin' | 'inactive';

export type AccessDecision =
  | { ok: true; profile: AdminProfile }
  | { ok: false; reason: AccessDenialReason };

/**
 * Decides whether a signed-in user's users/{uid} document grants access to the
 * dashboard: role must be exactly "platform_admin" AND isActive must be
 * exactly true. Anything else (customer, company_admin, technician, missing
 * profile, missing/false isActive) is denied.
 *
 * This is a UX gate only. The real enforcement is the Firestore security
 * rules, which independently refuse platform-wide data to non-admins.
 */
export function evaluateAccess(
  uid: string,
  data: Record<string, unknown> | undefined,
): AccessDecision {
  if (!data) return { ok: false, reason: 'not_found' };
  if (data.role !== 'platform_admin') return { ok: false, reason: 'not_admin' };
  if (data.isActive !== true) return { ok: false, reason: 'inactive' };
  return {
    ok: true,
    profile: {
      uid,
      fullName: typeof data.fullName === 'string' ? data.fullName : '',
      email: typeof data.email === 'string' ? data.email : '',
      role: 'platform_admin',
    },
  };
}
