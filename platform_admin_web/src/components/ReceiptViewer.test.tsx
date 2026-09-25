// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderReceipt } from '../data/receipts';
import { I18nProvider } from '../i18n/I18nProvider';
import { ar, en } from '../i18n/dictionary';
import { ReceiptViewer } from './ReceiptViewer';

const receipt: OrderReceipt = {
  orderId: 'o1',
  fileName: 'slip.jpg',
  contentType: 'image/jpeg',
  width: 400,
  height: 800,
  bytes: new Uint8Array(2048).fill(1),
};

const urls = { created: [] as string[], revoked: [] as string[] };

beforeEach(() => {
  localStorage.clear();
  urls.created = [];
  urls.revoked = [];
  // jsdom has no object URLs
  URL.createObjectURL = vi.fn((blob: Blob) => {
    const url = `blob:test/${urls.created.length}-${(blob as Blob).size}`;
    urls.created.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    urls.revoked.push(url);
  });
});
afterEach(cleanup);

const renderViewer = (load: (id: string) => Promise<OrderReceipt | null>) =>
  render(
    <I18nProvider>
      <ReceiptViewer orderId="o1" load={load} />
    </I18nProvider>,
  );

const click = async (name: string) =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });

describe('Receipt viewer (Platform Admin)', () => {
  it('reads nothing until asked', () => {
    const load = vi.fn();
    renderViewer(load);
    expect(screen.getByRole('button', { name: en['receipt.view'] })).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
  });

  it('shows the receipt image with its name and size, from a temporary URL', async () => {
    const load = vi.fn().mockResolvedValue(receipt);
    renderViewer(load);
    await click(en['receipt.view']);

    expect(load).toHaveBeenCalledWith('o1');
    const img = screen.getByRole('img', { name: en['receipt.alt'] }) as HTMLImageElement;
    expect(img.src).toBe(urls.created[0]);
    expect(screen.getByText(/slip\.jpg · 2 KB/)).toBeTruthy();
    // the button to open it is gone while it is shown
    expect(screen.queryByRole('button', { name: en['receipt.view'] })).toBeNull();
  });

  it('an order without a stored image (placed before this feature) says so', async () => {
    renderViewer(vi.fn().mockResolvedValue(null));
    await click(en['receipt.view']);
    expect(screen.getByText(en['receipt.none'])).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull(); // not an error
  });

  it('a failed read shows an error and can be tried again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('permission-denied')).mockResolvedValueOnce(receipt);
    renderViewer(load);
    await click(en['receipt.view']);
    expect(screen.getByRole('alert').textContent).toBe(en['receipt.error']);

    await click(en['receipt.view']);
    expect(screen.getByRole('img', { name: en['receipt.alt'] })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('a failed read is not retried by itself (every read costs free quota)', async () => {
    vi.useFakeTimers();
    const load = vi.fn().mockRejectedValue(new Error('unavailable'));
    renderViewer(load);
    await click(en['receipt.view']);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    vi.useRealTimers();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('hiding releases the temporary URL', async () => {
    renderViewer(vi.fn().mockResolvedValue(receipt));
    await click(en['receipt.view']);
    await click(en['receipt.hide']);
    expect(urls.revoked).toEqual([urls.created[0]]);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button', { name: en['receipt.view'] })).toBeTruthy();
  });

  it('leaving the page releases the temporary URL too', async () => {
    const { unmount } = renderViewer(vi.fn().mockResolvedValue(receipt));
    await click(en['receipt.view']);
    unmount();
    expect(urls.revoked).toEqual([urls.created[0]]);
  });

  it('works in Arabic', async () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    renderViewer(vi.fn().mockResolvedValue(receipt));
    await click(ar['receipt.view']);
    expect(screen.getByRole('img', { name: ar['receipt.alt'] })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
  });
});
