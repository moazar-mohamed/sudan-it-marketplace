import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore,
  type Query,
} from 'firebase/firestore';

/*
 * Deleting a company together with everything that belongs to it, EXCEPT ORDERS.
 *
 * The collections that hold company-owned data are listed here explicitly; there
 * is no "delete everything that matches companyId" sweep, and nothing in this
 * file reads or writes the `orders` collection except one read-only COUNT after
 * the delete (to confirm the history is still there). The security rules also
 * make deleting an order impossible for everyone (`orders` allow delete: if false).
 *
 *   companies/{id}                         the company
 *   users            role company_admin    the company admin's profile
 *   users            role technician       employees' profiles
 *   technicians      companyId == id       employee records
 *   technicianInvites companyId == id      pending / claimed invitations
 *   products         companyId == id       the catalogue
 *   company_services companyId == id       services offered
 *   reviews          companyId == id       reviews of the company
 *   notifications    company_admin -> id   the admin's notifications
 *   notifications    technician -> tech    the employees' notifications
 *
 * Kept on purpose: orders (history) and their payment receipts
 * (`order_receipts`, part of the order history and immutable in the rules),
 * customers' own notifications, customer
 * profiles, other companies. Firebase Authentication accounts cannot be deleted
 * from a browser (that needs the Admin SDK); only their Firestore profiles go.
 *
 * Two stages, because Platform Admin may not read the profiles of a LIVE
 * company's people (only those of a company that no longer exists):
 *   1. delete the company together with everything findable while it exists;
 *   2. with the company gone, find its now-orphaned admin / employee profiles
 *      (and the employees' notifications) and delete them.
 *
 * Safe to run again: it only ever deletes what it finds, so a run that stopped
 * part-way (or a company that is already gone, like data left under a
 * hand-typed id) is finished by running it again. The security rules only allow
 * each dependent delete when the company is gone after the same batch, so a live
 * company's data can never be removed alone, and the company itself can only be
 * deleted once it is not active.
 */

export interface CompanyOwnedData {
  company: DocumentReference | null;
  admins: DocumentReference[];
  technicianProfiles: DocumentReference[];
  technicians: DocumentReference[];
  invites: DocumentReference[];
  products: DocumentReference[];
  services: DocumentReference[];
  reviews: DocumentReference[];
  adminNotifications: DocumentReference[];
  technicianNotifications: DocumentReference[];
}

export interface CompanyDeletionSummary {
  companyDeleted: boolean;
  admins: number;
  technicians: number; // employee records + their profiles
  invites: number;
  products: number;
  other: number; // services, reviews, notifications
  /** Orders that still exist for this company after the delete; null if it could not be counted. */
  ordersKept: number | null;
}

/** Firestore allows 500 writes per batch. */
const BATCH_LIMIT = 500;
/** `in` filters accept up to 30 values; stay well inside it. */
const IN_LIMIT = 10;

const refsOf = async (q: Query<DocumentData>): Promise<DocumentReference<DocumentData>[]> =>
  (await getDocs(q)).docs.map((d) => d.ref);

const chunk = <T,>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const byCompany = (db: Firestore, name: string, id: string) =>
  refsOf(query(collection(db, name), where('companyId', '==', id)));

const staffWithRole = (db: Firestore, id: string, role: string) =>
  refsOf(query(collection(db, 'users'), where('companyId', '==', id), where('role', '==', role)));

/** Stage 1 lookups: everything Platform Admin can read while the company still exists. */
async function findWhileCompanyExists(db: Firestore, id: string) {
  const companyRef = doc(db, 'companies', id);
  const company = (await getDoc(companyRef)).exists() ? companyRef : null;
  const [technicians, invites, products, services, reviews] = await Promise.all([
    byCompany(db, 'technicians', id),
    byCompany(db, 'technicianInvites', id),
    byCompany(db, 'products', id),
    byCompany(db, 'company_services', id),
    byCompany(db, 'reviews', id),
  ]);
  const adminNotifications = await refsOf(
    query(
      collection(db, 'notifications'),
      where('recipientType', '==', 'company_admin'),
      where('recipientId', '==', id),
    ),
  );
  return { company, technicians, invites, products, services, reviews, adminNotifications };
}

/** Stage 2 lookups: the admin / employee profiles of a company that is gone. */
async function findAfterCompanyGone(db: Firestore, id: string) {
  const [admins, technicianProfiles] = await Promise.all([
    staffWithRole(db, id, 'company_admin'),
    staffWithRole(db, id, 'technician'),
  ]);
  return { admins, technicianProfiles };
}

async function notificationsForTechnicians(db: Firestore, technicianIds: string[]) {
  const refs: DocumentReference[] = [];
  for (const ids of chunk([...new Set(technicianIds)], IN_LIMIT)) {
    refs.push(
      ...(await refsOf(
        query(
          collection(db, 'notifications'),
          where('recipientType', '==', 'technician'),
          where('recipientId', 'in', ids),
        ),
      )),
    );
  }
  return refs;
}

/**
 * Reads (never writes) what belongs to the company. While the company still
 * exists the admin and employee PROFILES cannot be read (see above), so they are
 * only listed once the company is gone.
 */
export async function findCompanyOwnedData(db: Firestore, companyId: string): Promise<CompanyOwnedData> {
  const id = companyId.trim();
  if (!id) throw new Error('A company id is required.');

  const stage1 = await findWhileCompanyExists(db, id);
  const staff = stage1.company ? { admins: [], technicianProfiles: [] } : await findAfterCompanyGone(db, id);
  const technicianNotifications = await notificationsForTechnicians(
    db,
    [...stage1.technicians, ...staff.technicianProfiles].map((r) => r.id),
  );
  return { ...stage1, ...staff, technicianNotifications };
}

async function countOrders(db: Firestore, companyId: string): Promise<number | null> {
  try {
    const snap = await getCountFromServer(query(collection(db, 'orders'), where('companyId', '==', companyId)));
    return snap.data().count;
  } catch {
    return null;
  }
}

const unique = (refs: DocumentReference[]): DocumentReference[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => (seen.has(ref.path) ? false : seen.add(ref.path)));
};

export async function deleteCompanyCascade(db: Firestore, companyId: string): Promise<CompanyDeletionSummary> {
  const id = companyId.trim();
  if (!id) throw new Error('A company id is required.');

  // ---- Stage 1: the company and everything findable while it exists.
  const one = await findWhileCompanyExists(db, id);
  const stage1 = unique([
    ...one.technicians,
    ...one.invites,
    ...one.products,
    ...one.services,
    ...one.reviews,
    ...one.adminNotifications,
  ]);

  // The company goes in the FIRST batch, so every dependent delete (in that
  // batch and after it) happens with the company gone, as the rules require.
  const held = one.company ? 1 : 0;
  const first = writeBatch(db);
  if (one.company) first.delete(one.company);
  stage1.slice(0, BATCH_LIMIT - held).forEach((ref) => first.delete(ref));
  await first.commit();
  for (const refs of chunk(stage1.slice(BATCH_LIMIT - held), BATCH_LIMIT)) {
    const batch = writeBatch(db);
    refs.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  // ---- Stage 2: the company is gone, so its people's profiles can be found.
  const staff = await findAfterCompanyGone(db, id);
  const technicianIds = [...one.technicians, ...staff.technicianProfiles].map((r) => r.id);
  const technicianNotifications = await notificationsForTechnicians(db, technicianIds);
  const stage2 = unique([...staff.technicianProfiles, ...staff.admins, ...technicianNotifications]);
  for (const refs of chunk(stage2, BATCH_LIMIT)) {
    const batch = writeBatch(db);
    refs.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  return {
    companyDeleted: one.company !== null,
    admins: staff.admins.length,
    technicians: new Set(technicianIds).size,
    invites: one.invites.length,
    products: one.products.length,
    other:
      one.services.length + one.reviews.length + one.adminNotifications.length + technicianNotifications.length,
    ordersKept: await countOrders(db, id),
  };
}
