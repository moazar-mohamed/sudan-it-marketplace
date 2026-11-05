// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './feedback';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { saveLanguage } from '../i18n/saveLanguage';
import { setTheme, THEME_STORAGE_KEY } from '../theme/theme';
import { UserMenu } from './UserMenu';

// The language and the appearance are chosen in the person menu of the top bar
// (the Settings page keeps to the notices).

const auth = vi.hoisted(() => ({
  state: { status: 'authorized', profile: { uid: 'admin-1' } } as { status: string; profile?: { uid: string } },
}));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ state: auth.state, signOut: vi.fn() }) }));
vi.mock('../i18n/saveLanguage', () => ({ saveLanguage: vi.fn() }));

const renderMenu = () => {
  render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter>
          <UserMenu name="Sara Admin" email="sara@example.com" />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
  fireEvent.click(document.querySelector('.v2-user__button')!);
};

const choice = (name: string) => screen.getByRole('menuitemradio', { name });
const isChosen = (name: string) => choice(name).getAttribute('aria-checked') === 'true';

beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveLanguage).mockReset().mockResolvedValue(true);
  auth.state = { status: 'authorized', profile: { uid: 'admin-1' } };
});
afterEach(cleanup);

describe('the language in the person menu', () => {
  it('offers English and العربية and marks the current one', () => {
    renderMenu();
    expect(isChosen('English')).toBe(true);
    expect(isChosen('العربية')).toBe(false);
  });

  it('choosing Arabic changes the page at once, flips to RTL, remembers it and saves it to the profile', async () => {
    renderMenu();
    fireEvent.click(choice('العربية'));

    expect(await screen.findByRole('menu', { name: ar['userMenu.title'] })).toBeTruthy();
    expect(isChosen('العربية')).toBe(true);
    expect(isChosen('English')).toBe(false);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(localStorage.getItem('platform_admin_locale')).toBe('ar');
    await waitFor(() => expect(saveLanguage).toHaveBeenCalledWith('admin-1', 'ar'));
  });

  it('choosing English again returns to LTR and saves en', async () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderMenu();
    fireEvent.click(choice('English'));

    expect(await screen.findByRole('menu', { name: en['userMenu.title'] })).toBeTruthy();
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('platform_admin_locale')).toBe('en');
    await waitFor(() => expect(saveLanguage).toHaveBeenCalledWith('admin-1', 'en'));
  });

  it('keeps the new language and tells the user when the profile could not be saved', async () => {
    vi.mocked(saveLanguage).mockResolvedValue(false);
    renderMenu();
    fireEvent.click(choice('العربية'));

    expect(await screen.findByText(ar['settings.languageSaveFailed'])).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('platform_admin_locale')).toBe('ar');
  });

  it('does not touch Firestore when nobody is signed in', async () => {
    auth.state = { status: 'signedOut' };
    renderMenu();
    fireEvent.click(choice('العربية'));

    expect(await screen.findByRole('menu', { name: ar['userMenu.title'] })).toBeTruthy();
    expect(saveLanguage).not.toHaveBeenCalled();
  });

  it('does nothing when the current language is picked again', () => {
    renderMenu();
    fireEvent.click(choice('English'));
    expect(saveLanguage).not.toHaveBeenCalled();
  });
});

describe('the appearance in the person menu', () => {
  beforeEach(() => setTheme('system'));
  afterEach(() => setTheme('system'));

  it('follows the device until another look is chosen', () => {
    renderMenu();
    expect(isChosen(en['settings.themeSystem'])).toBe(true);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('lets the admin force the dark or the light look, and remembers it in this browser', () => {
    renderMenu();
    fireEvent.click(choice(en['settings.themeDark']));
    expect(isChosen(en['settings.themeDark'])).toBe(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.click(choice(en['settings.themeLight']));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('goes back to the device with "same as the device"', () => {
    renderMenu();
    fireEvent.click(choice(en['settings.themeDark']));
    fireEvent.click(choice(en['settings.themeSystem']));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('is named in Arabic too', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderMenu();
    expect(choice(ar['settings.themeDark'])).toBeTruthy();
    expect(screen.getByText(ar['settings.theme'])).toBeTruthy();
  });
});
