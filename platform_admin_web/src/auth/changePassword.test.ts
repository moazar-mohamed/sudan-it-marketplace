import { beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  user: { email: 'a@x.test' } as { email: string } | null,
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: fb.reauthenticateWithCredential,
  updatePassword: fb.updatePassword,
}));
vi.mock('../firebase', () => ({
  auth: {
    get currentUser() {
      return fb.user;
    },
  },
}));

import { changeOwnPassword, passwordChangeProblem } from './changePassword';

beforeEach(() => {
  fb.user = { email: 'a@x.test' };
  fb.reauthenticateWithCredential.mockReset().mockResolvedValue(undefined);
  fb.updatePassword.mockReset().mockResolvedValue(undefined);
});

describe('checking the three fields', () => {
  it('needs the current password first', () => {
    expect(passwordChangeProblem('', 'newpass1', 'newpass1')).toBe('current-required');
  });
  it('needs at least six characters', () => {
    expect(passwordChangeProblem('old', '12345', '12345')).toBe('too-short');
    expect(passwordChangeProblem('old', '123456', '123456')).toBeNull();
  });
  it('needs the two new passwords to match', () => {
    expect(passwordChangeProblem('old', 'newpass1', 'newpass2')).toBe('mismatch');
  });
  it('needs the new password to differ from the current one', () => {
    expect(passwordChangeProblem('samepass', 'samepass', 'samepass')).toBe('same');
  });
  it('accepts a good change', () => {
    expect(passwordChangeProblem('oldpass', 'newpass1', 'newpass1')).toBeNull();
  });
});

describe('changing it', () => {
  it('checks the current password again, then sets the new one', async () => {
    await changeOwnPassword('oldpass', 'newpass1');
    expect(fb.reauthenticateWithCredential).toHaveBeenCalledWith(fb.user, { email: 'a@x.test', password: 'oldpass' });
    expect(fb.updatePassword).toHaveBeenCalledWith(fb.user, 'newpass1');
  });

  it('does not change anything when the current password is wrong', async () => {
    fb.reauthenticateWithCredential.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    await expect(changeOwnPassword('bad', 'newpass1')).rejects.toMatchObject({ code: 'auth/invalid-credential' });
    expect(fb.updatePassword).not.toHaveBeenCalled();
  });

  it('refuses when nobody is signed in', async () => {
    fb.user = null;
    await expect(changeOwnPassword('a', 'newpass1')).rejects.toMatchObject({ code: 'auth/no-current-user' });
  });
});
