// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convertCustomerToCompany } from '../data/actions';
import type { Customer, Order, ServiceRequest } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CustomerConvertModal } from './CustomerConvertModal';
import { ConfirmProvider, ToastProvider } from './feedback';

vi.mock('../data/actions', () => ({ convertCustomerToCompany: vi.fn() }));
vi.mock('./MapPicker', () => ({ MapPicker: () => null }));
// The real fields compress a photo on a canvas, which jsdom does not have.
vi.mock('./RegistrationFields', () => ({
  RegistrationFields: ({
    onChange,
    requiredMarks,
  }: {
    onChange: (value: { registrationNumber: string; document: unknown }) => void;
    requiredMarks?: boolean;
  }) => (
    <button
      type="button"
      data-required-marks={String(Boolean(requiredMarks))}
      onClick={() =>
        onChange({
          registrationNumber: 'CR-1',
          document: { bytes: new Uint8Array([1]), contentType: 'image/jpeg', width: 1, height: 1, fileName: 'a.jpg' },
        })
      }
    >
      attach registration
    </button>
  ),
}));

const customer = {
  id: 'cust1',
  fullName: 'Amna Customer',
  email: 'amna@x.test',
  phone: '+249911111111',
  isActive: true,
} as Customer;

const show = (props: { openOrders?: Order[]; openRequests?: ServiceRequest[]; phone?: string } = {}) => {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <CustomerConvertModal
              customer={{ ...customer, phone: props.phone ?? customer.phone }}
              openOrders={props.openOrders ?? []}
              openRequests={props.openRequests ?? []}
              onClose={onClose}
            />
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  return onClose;
};

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  vi.mocked(convertCustomerToCompany).mockReset().mockResolvedValue({ companyId: 'c9', noticeId: 'n9' });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('converting a customer to a company', () => {
  it('asks for the company\'s details, shows the sign-in email and asks for no password', () => {
    show();
    expect(screen.getByLabelText(en['company.name'])).toBeTruthy();
    const email = screen.getByLabelText(en['customer.convert.signInEmail']) as HTMLInputElement;
    expect(email.value).toBe('amna@x.test');
    expect(email.disabled).toBe(true);
    expect(screen.queryByLabelText(en['companies.password'])).toBeNull();
  });

  it('marks what is required and what is optional beside each label', () => {
    show();
    const required = [...document.querySelectorAll('.field-mark--required')];
    // The name; the registration's own two are asked for through requiredMarks.
    expect(required).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'attach registration' }).getAttribute('data-required-marks')).toBe('true');
    expect(required.every((m) => m.getAttribute('aria-label') === en['field.required'])).toBe(true);
    const optional = [...document.querySelectorAll('.field-mark--optional')].map((m) => m.textContent);
    // Logo, description, city, pickup, service cities, location, phone.
    expect(optional).toHaveLength(7);
    expect(new Set(optional)).toEqual(new Set([en['field.optional']]));
    // The name's label carries a mark; the sign-in email (not asked for) none.
    expect(screen.getByLabelText(en['company.name']).closest('label')?.querySelector('.field-mark--required')).toBeTruthy();
    expect(screen.getByLabelText(en['customer.convert.signInEmail']).closest('label')?.querySelector('.field-mark')).toBeNull();
  });

  it('refuses an incomplete company and says what is missing', async () => {
    show();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['customer.convert'] }));
    });
    expect(convertCustomerToCompany).not.toHaveBeenCalled();
    expect(screen.getByText(en['companies.nameRequired'])).toBeTruthy();
  });

  it('asks once more, then converts with what was typed', async () => {
    const onClose = show();
    fireEvent.change(screen.getByLabelText(en['company.name']), { target: { value: 'Nile Systems' } });
    fireEvent.click(screen.getByRole('button', { name: 'attach registration' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['customer.convert'] }));
    });
    // The confirmation says who, and that it cannot be undone from here.
    expect(screen.getByText(en['customer.convert.confirm.title'])).toBeTruthy();
    expect(convertCustomerToCompany).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['customer.convert.confirm.action'] }));
    });
    expect(convertCustomerToCompany).toHaveBeenCalledTimes(1);
    const [who, form] = vi.mocked(convertCustomerToCompany).mock.calls[0];
    expect(who.id).toBe('cust1');
    expect(form).toMatchObject({ name: 'Nile Systems', registrationNumber: 'CR-1', phone: '+249911111111' });
    expect(onClose).toHaveBeenCalled();
  });

  it('asks for only the name and the registration: a customer with no phone converts with nothing else', async () => {
    show({ phone: '' });
    fireEvent.change(screen.getByLabelText(en['company.name']), { target: { value: 'Nile Systems' } });
    fireEvent.click(screen.getByRole('button', { name: 'attach registration' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['customer.convert'] }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['customer.convert.confirm.action'] }));
    });
    expect(convertCustomerToCompany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(convertCustomerToCompany).mock.calls[0][1]).toMatchObject({
      name: 'Nile Systems',
      description: '',
      city: '',
      address: '',
      phone: '',
      pickupAddress: '',
    });
  });

  it('refuses a missing registration, and says so', async () => {
    show();
    fireEvent.change(screen.getByLabelText(en['company.name']), { target: { value: 'Nile Systems' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['customer.convert'] }));
    });
    expect(convertCustomerToCompany).not.toHaveBeenCalled();
    expect(screen.queryByText(en['customer.convert.confirm.title'])).toBeNull();
  });

  it('does nothing when the confirmation is declined', async () => {
    const onClose = show();
    fireEvent.change(screen.getByLabelText(en['company.name']), { target: { value: 'Nile Systems' } });
    fireEvent.click(screen.getByRole('button', { name: 'attach registration' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['customer.convert'] }));
    });
    // The form has its own Cancel; the confirmation's is the one on top.
    const cancels = screen.getAllByRole('button', { name: en['common.cancel'] });
    await act(async () => {
      fireEvent.click(cancels[cancels.length - 1]);
    });
    expect(convertCustomerToCompany).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lists what is still in progress instead of the form', () => {
    show({
      openOrders: [{ id: 'order-1234567', productName: 'Router X', orderStatus: 'processing' } as Order],
      openRequests: [{ id: 'req-7654321', serviceName: 'Network setup', status: 'pending' } as ServiceRequest],
    });
    expect(screen.getByText(en['customer.convert.blocked.title'])).toBeTruthy();
    expect(screen.getByText('Router X')).toBeTruthy();
    expect(screen.getByText('Network setup')).toBeTruthy();
    expect(screen.queryByLabelText(en['company.name'])).toBeNull();
  });
});
