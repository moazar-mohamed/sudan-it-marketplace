import { describe, expect, it } from 'vitest';
import { evaluateAccess } from './access';

describe('evaluateAccess', () => {
  it('allows an active platform_admin', () => {
    const d = evaluateAccess('u1', {
      role: 'platform_admin',
      isActive: true,
      fullName: 'Admin',
      email: 'a@b.c',
    });
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.profile).toMatchObject({ uid: 'u1', role: 'platform_admin' });
  });

  it.each(['customer', 'company_admin', 'technician', '', 'PLATFORM_ADMIN'])(
    'denies role %j',
    (role) => {
      expect(evaluateAccess('u1', { role, isActive: true })).toEqual({
        ok: false,
        reason: 'not_admin',
      });
    },
  );

  it('denies a platform_admin that is not active', () => {
    expect(evaluateAccess('u1', { role: 'platform_admin', isActive: false })).toEqual({
      ok: false,
      reason: 'inactive',
    });
  });

  it('denies when isActive is missing or not a boolean true', () => {
    expect(evaluateAccess('u1', { role: 'platform_admin' }).ok).toBe(false);
    expect(evaluateAccess('u1', { role: 'platform_admin', isActive: 'true' }).ok).toBe(false);
  });

  it('denies a user with no profile document', () => {
    expect(evaluateAccess('u1', undefined)).toEqual({ ok: false, reason: 'not_found' });
  });
});
