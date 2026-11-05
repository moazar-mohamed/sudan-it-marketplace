// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import { saveTerms } from '../data/actions';
import { SAMPLE_TERMS_AR, SAMPLE_TERMS_EN } from '../data/termsSample';
import type { Terms, TermsState } from '../data/terms';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { TermsPage } from './TermsPage';

const mock = vi.hoisted(() => ({ state: { status: 'ready', terms: null } as unknown }));

vi.mock('../data/terms', async () => ({
  ...(await vi.importActual<typeof import('../data/terms')>('../data/terms')),
  useTerms: () => mock.state as TermsState,
}));
vi.mock('../data/actions', () => ({ saveTerms: vi.fn() }));

const published = (version: number): Terms => ({ version, textAr: 'نص قديم', textEn: 'Old text', updatedAt: new Date(2026, 10, 1) });

const show = () =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <ToastProvider>
          <ConfirmProvider>
            <TermsPage />
          </ConfirmProvider>
        </ToastProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
const arabic = () => screen.getByLabelText(/^Terms in Arabic/) as HTMLTextAreaElement;
const publishButton = () => screen.getByRole('button', { name: en['terms.publish'] }) as HTMLButtonElement;

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.state = { status: 'ready', terms: null };
  vi.mocked(saveTerms).mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the terms page', () => {
  it('says nothing is published and starts from the sample, ready to publish as version 1', async () => {
    show();
    expect(screen.getByText(en['terms.none'])).toBeTruthy();
    expect(screen.getByText(en['terms.sampleNote'])).toBeTruthy();
    expect(arabic().value).toBe(SAMPLE_TERMS_AR);
    expect(publishButton().disabled).toBe(false);
    fireEvent.click(publishButton());
    await waitFor(() => expect(saveTerms).toHaveBeenCalledWith({ textAr: SAMPLE_TERMS_AR, textEn: SAMPLE_TERMS_EN, version: 1, newVersion: true }));
  });

  it('refuses a cleared Arabic text even when English is there', () => {
    show();
    fireEvent.change(arabic(), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toBe(en['terms.problem.empty']);
    expect(publishButton().disabled).toBe(true);
  });

  it('can bring the sample back over what was typed', () => {
    mock.state = { status: 'ready', terms: published(2) };
    show();
    expect(screen.queryByText(en['terms.sampleNote'])).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en['terms.useSample'] }));
    expect(arabic().value).toBe(SAMPLE_TERMS_AR);
    expect(screen.getByText(en['terms.sampleNote'])).toBeTruthy();
  });

  it('shows what is published and asks before a new version asks everyone again', async () => {
    mock.state = { status: 'ready', terms: published(2) };
    show();
    expect(screen.getByText(/Version 2 is published/)).toBeTruthy();
    expect(arabic().value).toBe('نص قديم');
    expect(publishButton().disabled).toBe(true);
    fireEvent.change(arabic(), { target: { value: 'نص جديد' } });
    fireEvent.click(publishButton());
    expect(await screen.findByText(en['terms.confirm.title'])).toBeTruthy();
    expect(saveTerms).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole('button', { name: en['terms.publish'] });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(saveTerms).toHaveBeenCalledWith({ textAr: 'نص جديد', textEn: 'Old text', version: 3, newVersion: true }));
  });

  it('keeps the version, without asking, for a correction', async () => {
    mock.state = { status: 'ready', terms: published(2) };
    show();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(arabic(), { target: { value: 'نص مصحح' } });
    fireEvent.click(publishButton());
    await waitFor(() => expect(saveTerms).toHaveBeenCalledWith({ textAr: 'نص مصحح', textEn: 'Old text', version: 2, newVersion: false }));
    expect(screen.queryByText(en['terms.confirm.title'])).toBeNull();
  });
});
