/*
 * Platform-wide notices (platform_settings/public): everyone reads them, even
 * before signing in; only an active Platform Admin writes them, in a fixed
 * shape: maintenance, an announcement (a kind, an audience), a required update,
 * each with its limits. Local emulator only (npm run test:rules).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sudan-rules',
    firestore: {
      rules: readFileSync(
        process.env.RULES_FILE ?? fileURLToPath(new URL('../../firestore.rules', import.meta.url)),
        'utf8',
      ),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const put = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));

beforeEach(async () => {
  await env.clearFirestore();
  const user = (id: string, role: string, extra: Record<string, unknown> = {}) =>
    put(`users/${id}`, { id, fullName: id, email: `${id}@x.test`, role, isActive: true, ...extra });
  await user('pa', 'platform_admin');
  await user('pa_off', 'platform_admin', { isActive: false });
  await user('cust1', 'customer');
  await user('ca1', 'company_admin', { companyId: 'c1' });
});

const at = (iso: string) => Timestamp.fromDate(new Date(iso));
const notice = (extra: Record<string, unknown> = {}) => ({
  enabled: false,
  messageAr: '',
  messageEn: '',
  startsAt: null,
  endsAt: null,
  linkUrl: '',
  linkLabelAr: '',
  linkLabelEn: '',
  ...extra,
});
const announcement = (extra: Record<string, unknown> = {}) => notice({ audience: 'all', kind: 'info', ...extra });
const update = (extra: Record<string, unknown> = {}) => ({ minBuild: 0, url: '', messageAr: '', messageEn: '', ...extra });
const settings = (extra: Record<string, unknown> = {}, uid = 'pa') => ({
  maintenance: notice(),
  announcement: announcement(),
  update: update(),
  updatedAt: serverTimestamp(),
  updatedBy: uid,
  ...extra,
});
const ref = (db: ReturnType<typeof as>, id = 'public') => doc(db, 'platform_settings', id);

describe('reading', () => {
  beforeEach(async () => {
    await put('platform_settings/public', {
      maintenance: notice({ enabled: true, messageAr: 'صيانة', messageEn: 'Maintenance' }),
      announcement: announcement(),
      update: update(),
      updatedAt: new Date(),
      updatedBy: 'pa',
    });
  });

  it('is open to everyone, signed in or not', async () => {
    for (const db of [anon(), as('cust1'), as('ca1'), as('pa'), as('pa_off')]) {
      await assertSucceeds(getDoc(ref(db)));
    }
  });

  it('is only the one document, never a listing or another id', async () => {
    await assertFails(getDocs(collection(as('pa'), 'platform_settings')));
    await assertFails(getDoc(ref(as('pa'), 'other')));
  });
});

describe('writing', () => {
  it('lets an active Platform Admin save the notices', async () => {
    await assertSucceeds(setDoc(ref(as('pa')), settings()));
    await assertSucceeds(
      setDoc(
        ref(as('pa')),
        settings({
          maintenance: notice({ enabled: true, messageAr: 'صيانة قصيرة', messageEn: 'Short maintenance' }),
          announcement: announcement({ enabled: true, messageAr: 'عرض', audience: 'companies', kind: 'success' }),
        }),
      ),
    );
  });

  it('refuses everyone but an active Platform Admin', async () => {
    for (const [db, uid] of [[as('pa_off'), 'pa_off'], [as('cust1'), 'cust1'], [as('ca1'), 'ca1'], [anon(), 'x']] as const) {
      await assertFails(setDoc(ref(db), settings({}, uid)));
    }
  });

  it('refuses another id, a delete, and a signature that is not the writer', async () => {
    await assertFails(setDoc(ref(as('pa'), 'other'), settings()));
    await assertSucceeds(setDoc(ref(as('pa')), settings()));
    await assertFails(deleteDoc(ref(as('pa'))));
    await assertFails(setDoc(ref(as('pa')), settings({ updatedBy: 'someone_else' })));
    await assertFails(setDoc(ref(as('pa')), settings({ updatedAt: new Date('2020-01-01') })));
  });

  it('refuses a notice that is on with no text, a text that is too long, or a bad audience or kind', async () => {
    await assertFails(setDoc(ref(as('pa')), settings({ maintenance: notice({ enabled: true }) })));
    await assertSucceeds(setDoc(ref(as('pa')), settings({ maintenance: notice({ enabled: true, messageEn: 'only English' }) })));
    await assertFails(setDoc(ref(as('pa')), settings({ announcement: announcement({ messageEn: 'x'.repeat(301) }) })));
    await assertSucceeds(setDoc(ref(as('pa')), settings({ announcement: announcement({ messageEn: 'x'.repeat(300) }) })));
    await assertFails(setDoc(ref(as('pa')), settings({ announcement: announcement({ audience: 'technicians' }) })));
    await assertFails(setDoc(ref(as('pa')), settings({ announcement: announcement({ kind: 'danger' }) })));
    for (const kind of ['info', 'warning', 'success']) {
      await assertSucceeds(setDoc(ref(as('pa')), settings({ announcement: announcement({ kind }) })));
    }
  });

  it('refuses extra or missing fields', async () => {
    await assertFails(setDoc(ref(as('pa')), settings({ extra: 1 })));
    await assertFails(setDoc(ref(as('pa')), settings({ maintenance: notice({ extra: 1 }) })));
    const { announcement: _announcement, ...missing } = settings();
    void _announcement;
    await assertFails(setDoc(ref(as('pa')), missing));
    const { update: _update, ...noUpdate } = settings();
    void _update;
    await assertFails(setDoc(ref(as('pa')), noUpdate));
    await assertFails(setDoc(ref(as('pa')), settings({ maintenance: { enabled: 'yes', messageAr: '', messageEn: '' } })));
    // The notice of an older app, without a schedule or a button, is no longer the shape.
    await assertFails(setDoc(ref(as('pa')), settings({ maintenance: { enabled: false, messageAr: '', messageEn: '' } })));
  });

  it('can be changed again and saved together with its activity entry', async () => {
    await assertSucceeds(setDoc(ref(as('pa')), settings()));
    const db = as('pa');
    const batch = writeBatch(db);
    batch.set(ref(db), settings({ maintenance: notice({ enabled: true, messageEn: 'Back soon' }) }));
    batch.set(doc(collection(db, 'admin_audit_log')), {
      actorId: 'pa',
      actorName: 'Mona',
      action: 'settings.maintenance',
      targetType: 'settings',
      targetId: 'public',
      targetName: '',
      detail: 'on',
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(batch.commit());
    await assertFails(updateDoc(ref(as('cust1')), { updatedBy: 'cust1' }));
  });
});

describe('the schedule', () => {
  it('takes a start, an end, both or neither', async () => {
    const a = (extra: Record<string, unknown>) => settings({ maintenance: notice({ enabled: true, messageEn: 'Soon', ...extra }) });
    await assertSucceeds(setDoc(ref(as('pa')), a({ startsAt: at('2026-10-05T10:00:00Z') })));
    await assertSucceeds(setDoc(ref(as('pa')), a({ endsAt: at('2026-10-05T12:00:00Z') })));
    await assertSucceeds(setDoc(ref(as('pa')), a({ startsAt: at('2026-10-05T10:00:00Z'), endsAt: at('2026-10-05T12:00:00Z') })));
    await assertSucceeds(setDoc(ref(as('pa')), a({})));
  });

  it('refuses an end that is not after the start, and a value that is not a time', async () => {
    const a = (extra: Record<string, unknown>) => settings({ announcement: announcement({ enabled: true, messageEn: 'Hi', ...extra }) });
    await assertFails(setDoc(ref(as('pa')), a({ startsAt: at('2026-10-05T12:00:00Z'), endsAt: at('2026-10-05T12:00:00Z') })));
    await assertFails(setDoc(ref(as('pa')), a({ startsAt: at('2026-10-05T12:00:00Z'), endsAt: at('2026-10-05T10:00:00Z') })));
    await assertFails(setDoc(ref(as('pa')), a({ startsAt: '2026-10-05' })));
    await assertFails(setDoc(ref(as('pa')), a({ endsAt: 12 })));
  });
});

describe('the button under a notice', () => {
  const a = (extra: Record<string, unknown>) => settings({ announcement: announcement({ enabled: true, messageEn: 'Hi', ...extra }) });

  it('is an https link with a label in at least one language', async () => {
    await assertSucceeds(setDoc(ref(as('pa')), a({ linkUrl: 'https://example.com/offers', linkLabelEn: 'See offers' })));
    await assertSucceeds(setDoc(ref(as('pa')), a({ linkUrl: 'https://example.com', linkLabelAr: 'شاهد العروض' })));
  });

  it('refuses a link that is not https, has spaces, is too long, or has no label', async () => {
    await assertFails(setDoc(ref(as('pa')), a({ linkUrl: 'http://example.com', linkLabelEn: 'Open' })));
    await assertFails(setDoc(ref(as('pa')), a({ linkUrl: 'javascript:alert(1)', linkLabelEn: 'Open' })));
    await assertFails(setDoc(ref(as('pa')), a({ linkUrl: 'https://exa mple.com', linkLabelEn: 'Open' })));
    await assertFails(setDoc(ref(as('pa')), a({ linkUrl: `https://example.com/${'a'.repeat(300)}`, linkLabelEn: 'Open' })));
    await assertFails(setDoc(ref(as('pa')), a({ linkUrl: 'https://example.com' })));
  });

  it('limits a label to 40 characters', async () => {
    await assertSucceeds(setDoc(ref(as('pa')), a({ linkUrl: 'https://example.com', linkLabelEn: 'x'.repeat(40) })));
    await assertFails(setDoc(ref(as('pa')), a({ linkUrl: 'https://example.com', linkLabelEn: 'x'.repeat(41) })));
  });

  it('also works on the maintenance notice (a status or support page)', async () => {
    await assertSucceeds(
      setDoc(ref(as('pa')), settings({ maintenance: notice({ enabled: true, messageEn: 'Down', linkUrl: 'https://status.example.com', linkLabelEn: 'Status page' }) })),
    );
    await assertFails(
      setDoc(ref(as('pa')), settings({ maintenance: notice({ enabled: true, messageEn: 'Down', linkUrl: 'ftp://status.example.com', linkLabelEn: 'Status page' }) })),
    );
  });
});

describe('the required update', () => {
  const u = (extra: Record<string, unknown>) => settings({ update: update(extra) });

  it('is a lowest build, with the page to get the update from', async () => {
    await assertSucceeds(setDoc(ref(as('pa')), u({ minBuild: 6, url: 'https://example.com/app.apk' })));
    await assertSucceeds(setDoc(ref(as('pa')), u({ minBuild: 6, url: 'https://example.com/app.apk', messageAr: 'حدّث', messageEn: 'Update' })));
    await assertSucceeds(setDoc(ref(as('pa')), u({ minBuild: 0 })));
  });

  it('refuses a requirement with no page to update from, or a page that is not https', async () => {
    await assertFails(setDoc(ref(as('pa')), u({ minBuild: 6 })));
    await assertFails(setDoc(ref(as('pa')), u({ minBuild: 6, url: 'http://example.com/app.apk' })));
    await assertFails(setDoc(ref(as('pa')), u({ minBuild: 0, url: 'http://example.com' })));
  });

  it('refuses a build that is not a whole number from 0 to a million', async () => {
    await assertFails(setDoc(ref(as('pa')), u({ minBuild: -1, url: 'https://example.com' })));
    await assertFails(setDoc(ref(as('pa')), u({ minBuild: 5.5, url: 'https://example.com' })));
    await assertFails(setDoc(ref(as('pa')), u({ minBuild: '6', url: 'https://example.com' })));
    await assertFails(setDoc(ref(as('pa')), u({ minBuild: 1_000_001, url: 'https://example.com' })));
    await assertSucceeds(setDoc(ref(as('pa')), u({ minBuild: 1_000_000, url: 'https://example.com' })));
  });

  it('refuses a message that is too long and keys that are not in the shape', async () => {
    await assertFails(setDoc(ref(as('pa')), u({ messageEn: 'x'.repeat(301) })));
    await assertFails(setDoc(ref(as('pa')), u({ extra: 1 })));
    await assertFails(setDoc(ref(as('pa')), settings({ update: { minBuild: 0, url: '' } })));
  });

  it('is readable by every app, even before sign-in', async () => {
    await assertSucceeds(setDoc(ref(as('pa')), u({ minBuild: 6, url: 'https://example.com/app.apk' })));
    await assertSucceeds(getDoc(ref(anon())));
  });
});
