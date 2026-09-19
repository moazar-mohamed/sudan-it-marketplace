// @vitest-environment jsdom
/*
 * The real Platform Admin company list, driven with clicks, on top of the REAL
 * cascade delete and the project's Firestore rules (Firestore emulator).
 * Nothing about the deletion is mocked: it proves the row disappears, the
 * company's employees / products / invites / admin profile are removed, and
 * every order is left exactly as it was. Local emulator only (npm run test:rules).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url'; // (jsdom replaces the global URL)
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../src/components/feedback';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { en } from '../src/i18n/dictionary';
import { CompaniesPage } from '../src/pages/CompaniesPage';

const holder = vi.hoisted(() => ({ db: null as unknown as Firestore }));

// Real actions on the emulator database (the same functions the dashboard uses).
vi.mock('../src/data/actions', async () => {
  const { deleteCompanyCascade } = await import('../src/data/deleteCompany');
  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
  return {
    deleteCompany: (id: string) => deleteCompanyCascade(holder.db, id),
    setCompanyStatus: (id: string, status: string) =>
      updateDoc(doc(holder.db, 'companies', id), { status, updatedAt: serverTimestamp() }),
  };
});

// Live lists from the emulator, as the dashboard's own snapshot listeners provide them.
vi.mock('../src/data/hooks', async () => {
  const { useEffect, useState } = await import('react');
  const { collection, onSnapshot } = await import('firebase/firestore');
  const { mapCompany, mapProduct } = await import('../src/data/mappers');
  const live = (name: string, map: (id: string, d: never) => unknown) => () => {
    const [data, setData] = useState<unknown[]>([]);
    const [ready, setReady] = useState(false);
    useEffect(
      () =>
        onSnapshot(collection(holder.db, name), (snap) => {
          setData(snap.docs.map((d) => map(d.id, d.data() as never)));
          setReady(true);
        }),
      [],
    );
    return { status: ready ? ('ready' as const) : ('loading' as const), error: null, retry: () => undefined, data: data as never[] };
  };
  return {
    useCompanies: live('companies', mapCompany as never),
    useProducts: live('products', mapProduct as never),
  };
});
vi.mock('../src/components/CompanyCreateModal', () => ({ CompanyCreateModal: () => null }));

const PROJECT = 'demo-sudan-rules';
const now = new Date();
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync(
        process.env.RULES_FILE ?? fileURLToPath(new NodeURL('../../firestore.rules', import.meta.url)),
        'utf8',
      ),
    },
  });
});
afterAll(async () => {
  await env?.cleanup();
});

const productDoc = (id: string, companyId: string) => ({
  id,
  companyId,
  companyName: 'x',
  name: `Product ${id}`,
  imageUrl: '',
  price: 100,
  currency: 'SDG',
  stockCount: 5,
  inStock: true,
  description: '',
  specifications: {},
  isDeliveryAvailable: true,
  isInstallationAvailable: false,
  installationPrice: null,
  createdAt: now,
  updatedAt: now,
});

const order = (id: string, companyId: string, tag: string) => ({
  id,
  customerId: 'cust1',
  companyId,
  companyName: `Company ${tag}`,
  productId: `${tag}-p1`,
  productName: `Product ${tag}-p1`,
  quantity: 1,
  unitPrice: 100,
  productSubtotal: 100,
  installationSelected: true,
  installationFee: 10,
  deliveryFee: 5,
  totalAmount: 115,
  deliveryAddress: 'Somewhere',
  contactPhone: '1',
  deliveryMethod: 'delivery',
  paymentStatus: 'confirmed',
  orderStatus: 'completed',
  technicianId: `${tag}-t1`,
  technicianName: `${tag} Tech One`,
  createdAt: now,
  updatedAt: now,
});

/** Two ACTIVE companies, each with people, catalogue, invitations and order history. */
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (col: string, id: string, data: Record<string, unknown>) => setDoc(doc(db, col, id), data);
    await put('users', 'admin', { id: 'admin', role: 'platform_admin', isActive: true, fullName: 'a', email: 'a@x.test', createdAt: now });
    await put('users', 'cust1', { id: 'cust1', role: 'customer', isActive: true, fullName: 'c', email: 'c@x.test', createdAt: now });
    for (const [id, name, tag] of [
      ['coA', 'Alpha Tech', 'A'],
      ['coB', 'Beta Corp', 'B'],
    ] as const) {
      await put('companies', id, {
        name, logoUrl: '', description: '', city: 'Khartoum', address: `${name} Street`, phone: '', email: `${tag.toLowerCase()}@x.test`,
        pickupAddress: '', rating: 4, reviewCount: 0, status: 'active', createdAt: now, updatedAt: now,
      });
      await put('users', `${tag}-admin`, { id: `${tag}-admin`, role: 'company_admin', companyId: id, isActive: true, fullName: name, email: `${tag.toLowerCase()}@x.test`, createdAt: now });
      await put('users', `${tag}-t1`, { id: `${tag}-t1`, role: 'technician', companyId: id, isActive: true, fullName: `${tag} Tech One`, email: `${tag.toLowerCase()}.t1@x.test`, createdAt: now });
      await put('technicians', `${tag}-t1`, { id: `${tag}-t1`, companyId: id, fullName: `${tag} Tech One`, phone: '1', email: `${tag.toLowerCase()}.t1@x.test`, isActive: true, createdAt: now, updatedAt: now });
      await put('technicianInvites', `${tag.toLowerCase()}.t1@x.test`, { email: `${tag.toLowerCase()}.t1@x.test`, fullName: 'x', phone: '1', companyId: id, status: 'claimed', createdAt: now });
      await put('products', `${tag}-p1`, productDoc(`${tag}-p1`, id));
      await put('products', `${tag}-p2`, productDoc(`${tag}-p2`, id));
      await put('notifications', `${tag}-n-admin`, { id: `${tag}-n-admin`, recipientType: 'company_admin', recipientId: id, orderId: `${tag}-o1`, isRead: false, createdAt: now });
      await put('notifications', `${tag}-n-tech`, { id: `${tag}-n-tech`, recipientType: 'technician', recipientId: `${tag}-t1`, orderId: `${tag}-o1`, isRead: false, createdAt: now });
      await put('orders', `${tag}-o1`, order(`${tag}-o1`, id, tag));
      await put('orders', `${tag}-o2`, { ...order(`${tag}-o2`, id, tag), orderStatus: 'processing', paymentStatus: 'pending_verification' });
    }
  });
  holder.db = env.authenticatedContext('admin').firestore();
}

const dump = async (name: string) => {
  const out: Record<string, unknown> = {};
  await env.withSecurityRulesDisabled(async (ctx) => {
    (await getDocs(collection(ctx.firestore(), name))).forEach((d) => (out[d.id] = d.data()));
  });
  return out;
};
const exists = async (col: string, id: string) => {
  let found = false;
  await env.withSecurityRulesDisabled(async (ctx) => {
    found = (await getDoc(doc(ctx.firestore(), col, id))).exists();
  });
  return found;
};

function Details() {
  const { id } = useParams();
  return <div data-testid="details">Company details {id}</div>;
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/companies']}>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/companies/:id" element={<Details />} />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  localStorage.setItem('platform_admin_locale', 'en');
  await seed();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const rowOf = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('company list, end to end on the emulator', () => {
  it('lists the companies with Delete | Deactivate and no View button', async () => {
    renderList();
    await screen.findByText('Alpha Tech');
    const buttons = within(rowOf('Alpha Tech')).getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual([en['companies.delete'], en['companies.deactivate']]);
    expect(screen.queryByText(en['common.view'])).toBeNull();
  });

  it('clicking a row opens that company', async () => {
    renderList();
    await screen.findByText('Alpha Tech');
    fireEvent.click(within(rowOf('Beta Corp')).getByText(/Beta Corp Street/));
    expect(screen.getByTestId('details').textContent).toBe('Company details coB');
  });

  it('Delete runs the real cascade: row gone, people and catalogue deleted, orders untouched', async () => {
    const ordersBefore = await dump('orders');
    const customersBefore = await dump('users');
    renderList();
    await screen.findByText('Alpha Tech');

    fireEvent.click(within(rowOf('Alpha Tech')).getByRole('button', { name: en['companies.delete'] }));
    expect(screen.queryByTestId('details')).toBeNull(); // did not navigate
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Orders and order history will NOT be deleted');
    fireEvent.click(within(dialog).getByRole('button', { name: en['companies.delete'] }));

    // the live list drops the row as soon as the company document is gone...
    await waitFor(() => expect(screen.queryByText('Alpha Tech')).toBeNull(), { timeout: 15000 });
    expect(screen.getByText('Beta Corp')).toBeTruthy();
    expect(screen.queryByTestId('details')).toBeNull();
    // ...and the success message means the WHOLE cascade has finished.
    const toast = await screen.findByText(/Company deleted/, undefined, { timeout: 15000 });
    expect(toast.textContent).toContain('2 order(s) kept');

    // everything company A owned is gone...
    expect(await exists('companies', 'coA')).toBe(false);
    for (const [col, id] of [
      ['users', 'A-admin'], ['users', 'A-t1'], ['technicians', 'A-t1'], ['technicianInvites', 'a.t1@x.test'],
      ['products', 'A-p1'], ['products', 'A-p2'], ['notifications', 'A-n-admin'], ['notifications', 'A-n-tech'],
    ] as const) {
      expect(await exists(col, id), `${col}/${id}`).toBe(false);
    }

    // ...every order is exactly as it was (A's history included)...
    expect(await dump('orders')).toEqual(ordersBefore);
    expect(await exists('orders', 'A-o1')).toBe(true);
    expect(await exists('orders', 'A-o2')).toBe(true);

    // ...and company B and the customers are untouched.
    expect(await exists('companies', 'coB')).toBe(true);
    for (const [col, id] of [
      ['users', 'B-admin'], ['users', 'B-t1'], ['technicians', 'B-t1'], ['technicianInvites', 'b.t1@x.test'],
      ['products', 'B-p1'], ['products', 'B-p2'], ['notifications', 'B-n-admin'], ['notifications', 'B-n-tech'],
    ] as const) {
      expect(await exists(col, id), `${col}/${id}`).toBe(true);
    }
    const customersAfter = await dump('users');
    expect(customersAfter.cust1).toEqual(customersBefore.cust1);

  });

  it('Deactivate still works from the list and leaves the data alone', async () => {
    renderList();
    await screen.findByText('Alpha Tech');
    fireEvent.click(within(rowOf('Alpha Tech')).getByRole('button', { name: en['companies.deactivate'] }));
    expect(screen.queryByTestId('details')).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['companies.deactivate'] }));

    await waitFor(async () => {
      let status: unknown;
      await env.withSecurityRulesDisabled(async (ctx) => {
        status = (await getDoc(doc(ctx.firestore(), 'companies', 'coA'))).data()?.status;
      });
      expect(status).toBe('inactive');
    });
    expect(await exists('products', 'A-p1')).toBe(true);
    expect(await exists('orders', 'A-o1')).toBe(true);
    expect(screen.queryByTestId('details')).toBeNull();
  });

  it('cancelling the confirmation deletes nothing', async () => {
    const before = {
      products: await dump('products'),
      orders: await dump('orders'),
      users: await dump('users'),
    };
    renderList();
    await screen.findByText('Alpha Tech');
    fireEvent.click(within(rowOf('Alpha Tech')).getByRole('button', { name: en['companies.delete'] }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['common.cancel'] }));

    expect(screen.getByText('Alpha Tech')).toBeTruthy();
    expect(await dump('products')).toEqual(before.products);
    expect(await dump('orders')).toEqual(before.orders);
    expect(await dump('users')).toEqual(before.users);
    expect(await exists('companies', 'coA')).toBe(true);
  });
});
