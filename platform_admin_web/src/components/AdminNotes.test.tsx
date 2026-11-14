// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { AdminNotes } from './AdminNotes';
import { ConfirmProvider, ToastProvider } from './feedback';

const mock = vi.hoisted(() => ({
  notes: [] as unknown[],
  status: 'ready' as 'loading' | 'ready' | 'error',
  add: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../firebase', () => ({ auth: { currentUser: { uid: 'me' } }, db: {} }));
vi.mock('../data/adminNotes', async (original) => ({
  ...(await original<typeof import('../data/adminNotes')>()),
  useAdminNotes: () => ({ status: mock.status, notes: mock.notes }),
  addAdminNote: (...args: unknown[]) => mock.add(...args),
  deleteAdminNote: (...args: unknown[]) => mock.remove(...args),
}));

const note = (id: string, text: string, authorId: string, authorName: string) => ({
  id,
  targetType: 'order',
  targetId: 'o1',
  text,
  authorId,
  authorName,
  createdAt: new Date('2026-05-01T10:00:00'),
});

function renderNotes() {
  return render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AdminNotes targetType="order" targetId="o1" />
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.notes = [];
  mock.status = 'ready';
  mock.add.mockReset().mockResolvedValue(undefined);
  mock.remove.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('internal notes', () => {
  it('says who sees them and that there are none yet', () => {
    renderNotes();
    expect(screen.getByText(en['notes.hint'])).toBeTruthy();
    expect(screen.getByText(en['notes.empty'])).toBeTruthy();
  });

  it('lists the notes with their writer, and the count in the title', () => {
    mock.notes = [note('a', 'Called them', 'me', 'Moazer'), note('b', 'Refund asked', 'other', 'Sara')];
    renderNotes();
    expect(screen.getByRole('heading', { name: `${en['notes.title']} (2)` })).toBeTruthy();
    expect(screen.getByText('Called them')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('adds a note with the typed text, then clears the box', async () => {
    renderNotes();
    const box = screen.getByLabelText(en['notes.new']) as HTMLTextAreaElement;
    const add = screen.getByRole('button', { name: en['notes.add'] }) as HTMLButtonElement;
    expect(add.disabled).toBe(true); // nothing typed
    fireEvent.change(box, { target: { value: '  Delivery on Sunday  ' } });
    expect(add.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(add);
    });
    expect(mock.add).toHaveBeenCalledWith('order', 'o1', '  Delivery on Sunday  ');
    await waitFor(() => expect(box.value).toBe(''));
    expect(await screen.findByText(en['notes.added'])).toBeTruthy();
  });

  it('keeps the text when saving fails', async () => {
    mock.add.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    renderNotes();
    const box = screen.getByLabelText(en['notes.new']) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'Keep me' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en['notes.add'] }));
    });
    expect(box.value).toBe('Keep me');
  });

  it('refuses a note that is too long', () => {
    renderNotes();
    fireEvent.change(screen.getByLabelText(en['notes.new']), { target: { value: 'x'.repeat(1001) } });
    expect(screen.getByRole('alert').textContent).toContain('1000');
    expect((screen.getByRole('button', { name: en['notes.add'] }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets a writer delete their own note only, after asking', async () => {
    mock.notes = [note('a', 'Mine', 'me', 'Moazer'), note('b', 'Theirs', 'other', 'Sara')];
    renderNotes();
    const buttons = screen.getAllByRole('button', { name: en['notes.delete'] });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    const dialog = screen.getByRole('dialog', { name: en['notes.confirmDelete.title'] });
    expect(mock.remove).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: en['notes.delete'] }));
    });
    expect(mock.remove).toHaveBeenCalledWith('a');
  });

  it('says when the notes could not be loaded', () => {
    mock.status = 'error';
    renderNotes();
    expect(screen.getByText(en['notes.loadFailed'])).toBeTruthy();
  });
});
