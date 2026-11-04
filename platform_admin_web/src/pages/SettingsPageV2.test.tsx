// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/feedback';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { setUi } from '../theme/ui';
import { SettingsPage } from './SettingsPage';

vi.mock('../auth/AuthProvider', () => ({ useAuth: () => ({ state: { status: 'authorized', profile: { uid: 'admin-1' } } }) }));
vi.mock('../i18n/saveLanguage', () => ({ saveLanguage: vi.fn() }));
vi.mock('../components/NoticesCard', () => ({ NoticesSection: () => <p>notices and maintenance</p> }));

const renderPage = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('platform_admin_locale', 'en');
});
afterEach(() => {
  cleanup();
  act(() => setUi('v1'));
});

describe('the settings page in the redesign', () => {
  it('keeps to the notices: the language and the appearance moved to the person menu', () => {
    act(() => setUi('v2'));
    renderPage();
    expect(screen.getByText('notices and maintenance')).toBeTruthy();
    expect(screen.queryByText(en['settings.theme'])).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(en['common.language']) })).toBeNull();
  });

  it('shows the language and the appearance cards with the redesign off', () => {
    act(() => setUi('v1'));
    renderPage();
    expect(screen.getByText(en['settings.theme'])).toBeTruthy();
    expect(screen.getByText(en['common.language'])).toBeTruthy();
  });
});
