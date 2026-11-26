import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { applicationProblem, mapApplication, type ApplicationDraft } from './companyApplication';

const draft: ApplicationDraft = {
  companyName: 'Nile Networks',
  contactName: 'Amna Ali',
  phone: '+249912345678',
  cityId: 'khartoum',
  registrationNumber: 'CR-1144',
  about: '',
};

describe('applicationProblem', () => {
  it('a complete form can be sent (the about text is optional)', () => {
    expect(applicationProblem(draft)).toBeNull();
  });

  it.each([
    ['companyName', 'N'],
    ['contactName', '  '],
    ['phone', ''],
    ['cityId', ''],
    ['registrationNumber', ' '],
  ] as const)('stops a form whose %s is missing', (field, value) => {
    expect(applicationProblem({ ...draft, [field]: value })).not.toBeNull();
  });
});

describe('mapApplication', () => {
  it('reads a stored request', () => {
    const at = new Date('2026-11-26T08:00:00Z');
    const app = mapApplication('u1', {
      companyName: 'Nile Networks',
      status: 'rejected',
      decisionNote: 'Wrong number',
      createdAt: Timestamp.fromDate(at),
    });
    expect(app).toMatchObject({ id: 'u1', companyName: 'Nile Networks', status: 'rejected', decisionNote: 'Wrong number' });
    expect(app.createdAt?.getTime()).toBe(at.getTime());
  });

  it('an unknown or missing status reads as pending, missing texts as empty', () => {
    expect(mapApplication('u1', { status: 'weird' })).toMatchObject({ status: 'pending', companyName: '', about: '' });
  });
});
