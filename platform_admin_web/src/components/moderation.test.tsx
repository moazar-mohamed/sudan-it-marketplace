// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelOrderAsAdmin, endProductOffer, setProductHidden } from '../data/actions';
import { mapProduct } from '../data/mappers';
import { hasRunningOffer } from '../data/stats';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { AdminOrderCancel } from './AdminOrderCancel';
import { ConfirmProvider, ToastProvider } from './feedback';
import { ProductModeration } from './ProductModeration';

vi.mock('../data/actions', () => ({
  setProductHidden: vi.fn(),
  endProductOffer: vi.fn(),
  cancelOrderAsAdmin: vi.fn(),
}));

const wrap = (node: React.ReactNode) =>
  render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>{node}</ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );

const day = (n: number) => new Date(Date.now() + n * 86_400_000);
const product = (extra: Record<string, unknown> = {}) =>
  mapProduct('p1', { name: 'Router', companyId: 'c1', companyName: 'Nile Co', price: 100, currency: 'SDG', stockCount: 5, ...extra });

beforeEach(() => {
  vi.mocked(setProductHidden).mockReset().mockResolvedValue(undefined);
  vi.mocked(endProductOffer).mockReset().mockResolvedValue(undefined);
  vi.mocked(cancelOrderAsAdmin).mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

const dialog = () => screen.getByRole('dialog');

describe('which offers are running', () => {
  const now = Date.now();
  it('needs a price below the normal one and an end time that has not passed', () => {
    expect(hasRunningOffer(product({ offerPrice: 80, offerEndsAt: day(2) }), now)).toBe(true);
    expect(hasRunningOffer(product({ offerPrice: 80 }), now)).toBe(true); // no end date
    expect(hasRunningOffer(product({ offerPrice: 80, offerEndsAt: day(-1) }), now)).toBe(false);
    expect(hasRunningOffer(product({ offerPrice: 100 }), now)).toBe(false);
    expect(hasRunningOffer(product({ offerPrice: 120 }), now)).toBe(false);
    expect(hasRunningOffer(product({}), now)).toBe(false);
    expect(hasRunningOffer(product({ price: undefined, offerPrice: 50 }), now)).toBe(false);
  });

  it('reads the moderation fields, tolerating their absence', () => {
    expect(product().hidden).toBe(false);
    expect(product().hiddenReason).toBe('');
    expect(product({ hidden: true, hiddenReason: 'Fake' })).toMatchObject({ hidden: true, hiddenReason: 'Fake' });
  });
});

describe('hiding a product', () => {
  it('asks for a reason first and will not send an empty one', async () => {
    wrap(<ProductModeration product={product()} />);
    fireEvent.click(screen.getByRole('button', { name: en['product.hide'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['product.hide'] }));
    expect(within(dialog()).getByText(en['moderation.reasonRequired'])).toBeTruthy();
    expect(setProductHidden).not.toHaveBeenCalled();
  });

  it('hides it with the trimmed reason and closes', async () => {
    wrap(<ProductModeration product={product()} />);
    fireEvent.click(screen.getByRole('button', { name: en['product.hide'] }));
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '  Counterfeit item ' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: en['product.hide'] }));
    await waitFor(() => expect(setProductHidden).toHaveBeenCalledTimes(1));
    expect(setProductHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', name: 'Router' }), true, 'Counterfeit item');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('stays open when saving fails, so the reason is not lost', async () => {
    vi.mocked(setProductHidden).mockRejectedValue(new Error('offline'));
    wrap(<ProductModeration product={product()} />);
    fireEvent.click(screen.getByRole('button', { name: en['product.hide'] }));
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Fake' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: en['product.hide'] }));
    await waitFor(() => expect(setProductHidden).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(en['error.action'])).toBeTruthy());
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect((within(dialog()).getByRole('textbox') as HTMLTextAreaElement).value).toBe('Fake');
  });

  it('shows the reason of a hidden product and offers to show it again, no reason needed', async () => {
    wrap(<ProductModeration product={product({ hidden: true, hiddenReason: 'Fake item' })} />);
    expect(screen.getByText('Fake item')).toBeTruthy();
    expect(screen.queryByRole('button', { name: en['product.hide'] })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en['product.show'] }));
    await waitFor(() => expect(setProductHidden).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), false));
  });
});

describe('ending an offer', () => {
  it('is offered only while an offer runs, and asks first', async () => {
    wrap(<ProductModeration product={product()} />);
    expect(screen.queryByRole('button', { name: en['product.endOffer'] })).toBeNull();
    cleanup();

    wrap(<ProductModeration product={product({ offerPrice: 80, offerEndsAt: day(3), offerBadge: 'discount' })} />);
    fireEvent.click(screen.getByRole('button', { name: en['product.endOffer'] }));
    expect(endProductOffer).not.toHaveBeenCalled();
    fireEvent.click(within(dialog()).getByRole('button', { name: en['product.endOffer'] }));
    await waitFor(() => expect(endProductOffer).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' })));
  });

  it('does nothing when the confirmation is cancelled', () => {
    wrap(<ProductModeration product={product({ offerPrice: 80 })} />);
    fireEvent.click(screen.getByRole('button', { name: en['product.endOffer'] }));
    fireEvent.click(within(dialog()).getByRole('button', { name: en['common.cancel'] }));
    expect(endProductOffer).not.toHaveBeenCalled();
  });
});

describe('cancelling a stuck order', () => {
  const open = () => {
    wrap(<AdminOrderCancel orderId="o1" />);
    fireEvent.click(screen.getByRole('button', { name: en['order.cancelAdmin'] }));
  };

  it('needs a reason, then cancels with it', async () => {
    open();
    fireEvent.click(within(dialog()).getByRole('button', { name: en['order.cancelAdmin'] }));
    expect(cancelOrderAsAdmin).not.toHaveBeenCalled();
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Customer asked, unreachable company' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: en['order.cancelAdmin'] }));
    await waitFor(() => expect(cancelOrderAsAdmin).toHaveBeenCalledWith('o1', 'Customer asked, unreachable company'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('explains that the company already moved the order on, and keeps the dialog open', async () => {
    vi.mocked(cancelOrderAsAdmin).mockRejectedValue(Object.assign(new Error('x'), { code: 'order/not-processing' }));
    open();
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: 'Stuck' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: en['order.cancelAdmin'] }));
    await waitFor(() => expect(screen.getByText(en['order.cancelAdmin.notProcessing'])).toBeTruthy());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('says what it does to the stock and the refund before anything is sent', () => {
    open();
    expect(within(dialog()).getByText(en['order.cancelAdminBody'])).toBeTruthy();
    expect(cancelOrderAsAdmin).not.toHaveBeenCalled();
  });
});
