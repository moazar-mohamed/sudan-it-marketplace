// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider, readStoredLocale, useI18n } from './I18nProvider';

// Holds the latest context value so tests can call setLocale / read locale.
const holder: { current: ReturnType<typeof useI18n> | null } = { current: null };
const api = () => holder.current!;
function Probe() {
  const i18n = useI18n();
  useEffect(() => {
    holder.current = i18n;
  });
  return <p data-testid="text">{i18n.t('common.signOut')}</p>;
}

const mount = () =>
  render(
    <I18nProvider>
      <Probe />
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});
afterEach(cleanup);

describe('I18nProvider', () => {
  it('starts in English, left-to-right, when nothing was chosen', () => {
    mount();
    expect(api().locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(api().t('common.signOut')).toBe('Sign out');
    expect(readStoredLocale()).toBeNull();
  });

  it('ignores the browser language (English is the default)', () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'language');
    Object.defineProperty(window.navigator, 'language', { value: 'ar-SD', configurable: true });
    try {
      mount();
      expect(api().locale).toBe('en');
    } finally {
      if (original) Object.defineProperty(window.navigator, 'language', original);
    }
  });

  it('switches to Arabic and RTL at once, and remembers it', () => {
    const { getByTestId } = mount();
    act(() => api().setLocale('ar'));
    expect(getByTestId('text').textContent).toBe('تسجيل الخروج');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('platform_admin_locale')).toBe('ar');
    expect(readStoredLocale()).toBe('ar');
  });

  it('switches back to English and LTR', () => {
    mount();
    act(() => api().setLocale('ar'));
    act(() => api().setLocale('en'));
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('platform_admin_locale')).toBe('en');
  });

  it('restores the remembered language when the app is opened again', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    mount();
    expect(api().locale).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('ignores an unsupported stored value', () => {
    localStorage.setItem('platform_admin_locale', 'fr');
    mount();
    expect(api().locale).toBe('en');
  });

  it('updates the page title with the language', () => {
    mount();
    expect(document.title).toBe('Sudan ICT Marketplace - Platform Admin');
    act(() => api().setLocale('ar'));
    expect(document.title).toBe('سوق السودان لتقنية المعلومات - مدير المنصة');
  });

  it('formats money without breaking the amount in RTL text', () => {
    mount();
    act(() => api().setLocale('ar'));
    expect(api().money(45000)).toMatch(/^⁦.*45.?000 SDG⁩$/);
  });
});
