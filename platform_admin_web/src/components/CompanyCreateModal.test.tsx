// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCompany } from '../data/actions';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { CompanyCreateModal } from './CompanyCreateModal';
import { ToastProvider } from './feedback';

vi.mock('../data/actions', () => ({ createCompany: vi.fn() }));
vi.mock('./MapPicker', () => ({ MapPicker: () => null }));

const show = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <CompanyCreateModal onClose={() => undefined} />
      </ToastProvider>
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  vi.mocked(createCompany).mockReset().mockResolvedValue(undefined as never);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the add-company form', () => {
  it('groups its fields under four titled sections', () => {
    show();
    const titles = [...document.querySelectorAll('.form-card')].map(
      (card) => card.querySelector('.form-card__title, legend')?.textContent,
    );
    expect(titles).toEqual([
      en['companies.section.basic'],
      en['companies.section.place'],
      en['companies.section.account'],
      en['registration.section'],
    ]);
  });

  it('keeps every field it always had', () => {
    show();
    for (const label of ['company.name', 'company.description', 'company.city', 'company.pickup', 'company.email'] as const) {
      expect(screen.getByLabelText(en[label])).toBeTruthy();
    }
    expect(screen.getByLabelText(en['companies.password'])).toBeTruthy();
    expect(screen.getByPlaceholderText(en['location.enterAddress'])).toBeTruthy();
    expect(screen.getByLabelText(en['registration.number'])).toBeTruthy();
  });

  it('shows and hides the password with the eye inside the field', () => {
    show();
    const password = screen.getByLabelText(en['companies.password']) as HTMLInputElement;
    expect(password.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: en['companies.passwordShow'] }));
    expect(password.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: en['companies.passwordHide'] }));
    expect(password.type).toBe('password');
  });

  it('still refuses to save an incomplete company, and says what is missing', async () => {
    show();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['common.save'] }));
    });
    expect(createCompany).not.toHaveBeenCalled();
    expect(screen.getByText(en['companies.nameRequired'])).toBeTruthy();
    expect(screen.getByText(en['companies.passwordRequired'])).toBeTruthy();
  });
});
