// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { ActionGroup, BulkBar, SectionTabs, SidePanel } from './v2';

afterEach(cleanup);

const inRouter = (path: string, ui: React.ReactNode) =>
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </I18nProvider>,
  );

describe('SectionTabs', () => {
  it('shows the parts of the section the address belongs to, with the current one marked', () => {
    inRouter('/services', <SectionTabs />);
    const nav = screen.getByRole('navigation', { name: 'Catalogue sections' });
    expect([...nav.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Products', 'Services', 'Categories', 'Offers']);
    expect(within(nav).getByRole('link', { name: 'Services' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Products' }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps the tab of a record page (an order opened from the list)', () => {
    inRouter('/orders/abc', <SectionTabs />);
    expect(screen.getByRole('link', { name: 'Product orders' }).getAttribute('aria-current')).toBe('page');
  });

  it('shows nothing on a page whose section has no parts, or on no section at all', () => {
    inRouter('/companies', <SectionTabs />);
    expect(screen.queryByRole('navigation')).toBeNull();
    cleanup();
    inRouter('/design-system', <SectionTabs />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('SidePanel', () => {
  it('shows the record, and closes with the button or Escape', () => {
    const onClose = vi.fn();
    render(
      <SidePanel title="Order #1042" subtitle="Product order" status={<span>Processing</span>} closeLabel="Close" onClose={onClose}>
        <p>details</p>
      </SidePanel>,
    );
    const panel = screen.getByRole('complementary', { name: 'Order #1042' });
    expect(within(panel).getByText('Product order')).toBeTruthy();
    expect(within(panel).getByText('Processing')).toBeTruthy();
    expect(within(panel).getByText('details')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('stops listening for Escape once it is gone', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <SidePanel title="x" closeLabel="Close" onClose={onClose}>
        <p>d</p>
      </SidePanel>,
    );
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ActionGroup and BulkBar', () => {
  it('groups actions under a title, and the sensitive group is marked', () => {
    render(
      <>
        <ActionGroup title="Order actions">
          <button>Review</button>
        </ActionGroup>
        <ActionGroup title="Sensitive" danger>
          <button>Cancel order</button>
        </ActionGroup>
      </>,
    );
    const normal = screen.getByRole('region', { name: 'Order actions' });
    const danger = screen.getByRole('region', { name: 'Sensitive' });
    expect(normal.className).toBe('ds-group');
    expect(danger.className).toContain('ds-group--danger');
    expect(within(danger).getByRole('button', { name: 'Cancel order' })).toBeTruthy();
  });

  it('says how many are selected and offers what can be done', () => {
    render(
      <BulkBar label="2 selected">
        <button>Export</button>
      </BulkBar>,
    );
    const bar = screen.getByRole('region', { name: '2 selected' });
    expect(within(bar).getByRole('button', { name: 'Export' })).toBeTruthy();
  });
});
