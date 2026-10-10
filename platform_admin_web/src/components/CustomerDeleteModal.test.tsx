// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCustomer } from '../data/actions';
import type { Customer, Order, ServiceRequest } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CustomerDeleteModal } from './CustomerDeleteModal';
import { ToastProvider } from './feedback';

vi.mock('../data/actions', () => ({ deleteCustomer: vi.fn() }));

const customer = { id: 'cust1', fullName: 'Amna', email: 'Amna@x.test', isActive: true } as Customer;

const show = (props: { openOrders?: Order[]; openRequests?: ServiceRequest[] } = {}) => {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <CustomerDeleteModal
            customer={customer}
            openOrders={props.openOrders ?? []}
            openRequests={props.openRequests ?? []}
            onClose={onClose}
            onDeleted={onDeleted}
          />
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  return { onClose, onDeleted };
};

const confirmButton = () => screen.getByRole('button', { name: en['customer.delete.confirm'] }) as HTMLButtonElement;
const field = () => screen.getByLabelText(en['customer.delete.typeEmail'].replace('{email}', 'Amna@x.test'));

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  vi.mocked(deleteCustomer).mockReset().mockResolvedValue({ notificationsRemoved: 2, notificationsLeft: false });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('deleting a customer account', () => {
  it('says what goes, what stays and what cannot be done from here', () => {
    show();
    expect(screen.getByText(en['customer.delete.removed'])).toBeTruthy();
    expect(screen.getByText(en['customer.delete.kept'])).toBeTruthy();
    expect(screen.getByText(en['customer.delete.limit'])).toBeTruthy();
  });

  it('stays switched off until the account\'s email is typed', async () => {
    const { onDeleted } = show();
    expect(confirmButton().disabled).toBe(true);
    fireEvent.change(field(), { target: { value: 'someone@else.test' } });
    expect(confirmButton().disabled).toBe(true);
    // Case and spaces do not matter.
    fireEvent.change(field(), { target: { value: '  amna@X.test ' } });
    expect(confirmButton().disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(deleteCustomer).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deleteCustomer).mock.calls[0][0].id).toBe('cust1');
    expect(onDeleted).toHaveBeenCalled();
  });

  it('does not leave the page when the deletion fails', async () => {
    vi.mocked(deleteCustomer).mockRejectedValueOnce({ code: 'permission-denied' });
    const { onDeleted } = show();
    fireEvent.change(field(), { target: { value: 'amna@x.test' } });
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('lists what is still in progress instead of the form', () => {
    show({
      openOrders: [{ id: 'order-1234567', productName: 'Router X', orderStatus: 'processing' } as Order],
    });
    expect(screen.getByText(en['customer.delete.blocked.body'])).toBeTruthy();
    expect(screen.getByText('Router X')).toBeTruthy();
    expect(screen.queryByText(en['customer.delete.confirm'])).toBeNull();
  });
});
