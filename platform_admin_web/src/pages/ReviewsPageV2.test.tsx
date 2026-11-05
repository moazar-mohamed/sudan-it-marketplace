// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, ToastProvider } from '../components/feedback';
import type { Review } from '../data/types';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { ReviewsPage } from './ReviewsPage';

const mock = vi.hoisted(() => ({ reviews: [] as unknown[] }));

vi.mock('../data/hooks', () => ({
  useReviews: () => ({ status: 'ready', error: null, retry: () => undefined, data: mock.reviews }),
}));
vi.mock('../data/actions', () => ({ setReviewHidden: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../data/useNow', () => ({ useNow: () => Date.now() }));

const review = (id: string, rating: number, extra: Partial<Review> = {}): Review =>
  ({
    id,
    sourceType: 'order',
    customerName: `Customer ${id}`,
    companyId: 'c1',
    companyName: 'Alpha Tech',
    targetType: 'product',
    targetId: 'p1',
    targetName: 'Router',
    rating,
    comment: `comment ${id}`,
    orderId: '',
    reply: '',
    hidden: false,
    createdAt: new Date(2026, 9, Number(id.replace(/\D/g, '')) || 1),
    ...extra,
  }) as unknown as Review;

const show = () =>
  render(
    <I18nProvider>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter>
            <ReviewsPage />
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </I18nProvider>,
  );

const cards = () => [...document.querySelectorAll('.review-card')] as HTMLElement[];

beforeEach(() => {
  localStorage.setItem('platform_admin_locale', 'en');
  mock.reviews = [review('1', 5), review('2', 2), review('3', 4, { hidden: true, reply: 'thanks' })];
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the reviews page in the redesign', () => {
  it('shows an overview (average of the visible ones, count, hidden) and one card per review', () => {
    show();
    const summary = screen.getByRole('region', { name: en['reviews.average'] });
    expect(within(summary).getByText('3.5')).toBeTruthy();
    expect(within(summary).getByText(/3 reviews · 1 hidden/)).toBeTruthy();
    expect(cards()).toHaveLength(3);
    expect(screen.getByText('thanks')).toBeTruthy();
  });

  it('filters by stars and by visibility from the pills, and clears them', () => {
    show();
    const group = screen.getByRole('group', { name: en['common.filters'] });
    fireEvent.change(within(group).getByRole('combobox', { name: en['col.rating'] }), { target: { value: '2' } });
    expect(cards()).toHaveLength(1);
    fireEvent.click(within(group).getByRole('button', { name: en['common.clearFilters'] }));
    expect(cards()).toHaveLength(3);
    fireEvent.change(within(group).getByRole('combobox', { name: en['col.status'] }), { target: { value: 'hidden' } });
    expect(cards()).toHaveLength(1);
  });

  it('sorts by the lowest or the highest rating', () => {
    show();
    const sort = screen.getByRole('combobox', { name: en['reviews.sortLabel'] });
    fireEvent.change(sort, { target: { value: 'lowest' } });
    expect(within(cards()[0]).getByText('comment 2')).toBeTruthy();
    fireEvent.change(sort, { target: { value: 'highest' } });
    expect(within(cards()[0]).getByText('comment 1')).toBeTruthy();
  });

  it('still hides a review after a confirmation, and can show it again at once', async () => {
    const { setReviewHidden } = await import('../data/actions');
    show();
    fireEvent.click(within(cards().find((c) => c.textContent?.includes('comment 1')) as HTMLElement).getByRole('button', { name: en['reviews.hide'] }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: en['reviews.hide'] }));
    await waitFor(() => expect(setReviewHidden).toHaveBeenCalledTimes(1));
    fireEvent.click(within(cards().find((c) => c.textContent?.includes('comment 3')) as HTMLElement).getByRole('button', { name: en['reviews.show'] }));
    await waitFor(() => expect(setReviewHidden).toHaveBeenCalledTimes(2));
  });
});
