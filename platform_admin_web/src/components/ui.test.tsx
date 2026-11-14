// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { DataGate, LoadingState, StatCard } from './ui';

const inApp = (node: React.ReactNode) =>
  render(
    <I18nProvider>
      <MemoryRouter>{node}</MemoryRouter>
    </I18nProvider>,
  );

afterEach(cleanup);

describe('loading placeholders', () => {
  it('draw grey rows in the shape of a list instead of a spinner', () => {
    const { container } = inApp(<LoadingState />);
    expect(container.querySelector('.spinner')).toBeNull();
    expect(container.querySelectorAll('.skeleton-row')).toHaveLength(6);
    expect(container.querySelector('.skeleton--head')).not.toBeNull();
  });

  it('still tell a screen reader that something is loading, and that the region is busy', () => {
    inApp(<LoadingState />);
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toBe(en['common.loading']);
    expect(status.querySelector('.sr-only')).not.toBeNull();
    // The bars themselves are decoration.
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(5);
  });

  it('are what a page shows while its data is being read, and give way to the page', () => {
    const gate = (status: 'loading' | 'ready') => ({ status, error: null, retry: () => undefined });
    const { container } = inApp(
      <DataGate gates={[gate('loading')]}>
        <p>The page</p>
      </DataGate>,
    );
    expect(container.querySelector('.skeleton-list')).not.toBeNull();
    expect(screen.queryByText('The page')).toBeNull();
    cleanup();
    inApp(
      <DataGate gates={[gate('ready')]}>
        <p>The page</p>
      </DataGate>,
    );
    expect(screen.getByText('The page')).toBeTruthy();
  });
});

describe('a statistic card', () => {
  it('shows a shimmering bar for a figure still being read, and the figure itself otherwise', () => {
    const { container } = inApp(<StatCard icon="orders" label="Orders" value="…" />);
    expect(container.querySelector('.stat__value')!.classList.contains('skeleton')).toBe(true);
    cleanup();
    const shown = inApp(<StatCard icon="orders" label="Orders" value="12" />);
    expect(shown.container.querySelector('.stat__value')!.classList.contains('skeleton')).toBe(false);
  });

  it('draws a line only when there are at least two days to draw', () => {
    expect(inApp(<StatCard icon="orders" label="A" value="1" spark={[1, 2, 3]} />).container.querySelector('.stat__spark svg')).not.toBeNull();
    cleanup();
    expect(inApp(<StatCard icon="orders" label="A" value="1" spark={[1]} />).container.querySelector('.stat__spark')).toBeNull();
    cleanup();
    expect(inApp(<StatCard icon="orders" label="A" value="1" />).container.querySelector('.stat__spark')).toBeNull();
  });

  it('colours the line like the change under it', () => {
    const { container } = inApp(<StatCard icon="orders" label="A" value="1" hint="+5%" hintTone="up" spark={[1, 2]} />);
    expect(container.querySelector('.stat__spark')!.className).toContain('stat__spark--up');
  });

  it('points the arrow the way the figure moved, whatever the colour says', () => {
    const { container } = inApp(<StatCard icon="orders" label="A" value="1" hint="-3 points" hintTone="up" hintArrow="down" />);
    const hint = container.querySelector('.stat__hint')!;
    expect(hint.className).toContain('stat__hint--up');
    expect(hint.className).toContain('stat__hint--arrow-down');
  });
});
