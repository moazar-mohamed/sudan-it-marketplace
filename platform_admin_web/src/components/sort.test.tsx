// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { SortTh, useSortedRows } from './sort';

interface Row {
  name: string;
  qty: number | null;
  at: Date | null;
}

const rows: Row[] = [
  { name: 'b', qty: 10, at: new Date('2026-01-02') },
  { name: 'a', qty: 2, at: null },
  { name: 'c', qty: null, at: new Date('2026-01-01') },
  { name: 'd', qty: 2, at: new Date('2026-01-03') },
];
const SORTS = { name: (r: Row) => r.name, qty: (r: Row) => r.qty, at: (r: Row) => r.at };

const wrapper = ({ children }: { children: React.ReactNode }) => <I18nProvider>{children}</I18nProvider>;
const names = (list: Row[]) => list.map((r) => r.name).join('');

afterEach(cleanup);

describe('click-to-sort', () => {
  it('keeps the incoming order until a heading is clicked', () => {
    const { result } = renderHook(() => useSortedRows(rows, SORTS), { wrapper });
    expect(names(result.current.rows)).toBe('bacd');
    expect(result.current.sort).toBeNull();
  });

  it('cycles ascending, descending, then back to the incoming order', () => {
    const { result } = renderHook(() => useSortedRows(rows, SORTS), { wrapper });
    act(() => result.current.toggle('name'));
    expect(names(result.current.rows)).toBe('abcd');
    act(() => result.current.toggle('name'));
    expect(names(result.current.rows)).toBe('dcba');
    act(() => result.current.toggle('name'));
    expect(names(result.current.rows)).toBe('bacd');
    expect(result.current.sort).toBeNull();
  });

  it('sorts numbers by value, not as text, and keeps equal rows in their incoming order', () => {
    const { result } = renderHook(() => useSortedRows(rows, SORTS), { wrapper });
    act(() => result.current.toggle('qty'));
    // 2, 2 (a before d, as they came), 10, then the empty one last.
    expect(names(result.current.rows)).toBe('adbc');
  });

  it('puts empty values last whichever way it sorts', () => {
    const { result } = renderHook(() => useSortedRows(rows, SORTS), { wrapper });
    act(() => result.current.toggle('qty'));
    act(() => result.current.toggle('qty'));
    expect(names(result.current.rows)).toBe('badc');
    act(() => result.current.toggle('at'));
    expect(names(result.current.rows)).toBe('cbda');
  });

  it('sorts dates by time', () => {
    const { result } = renderHook(() => useSortedRows(rows, SORTS), { wrapper });
    act(() => result.current.toggle('at'));
    act(() => result.current.toggle('at'));
    expect(names(result.current.rows)).toBe('dbca');
  });

  it('starting on another column begins ascending again', () => {
    const { result } = renderHook(() => useSortedRows(rows, SORTS), { wrapper });
    act(() => result.current.toggle('name'));
    act(() => result.current.toggle('name'));
    act(() => result.current.toggle('qty'));
    expect(result.current.sort).toEqual({ key: 'qty', dir: 'asc' });
  });

  it('never changes the list it was given', () => {
    const copy = [...rows];
    const { result } = renderHook(() => useSortedRows(rows, SORTS), { wrapper });
    act(() => result.current.toggle('name'));
    expect(rows).toEqual(copy);
  });
});

describe('a sortable heading', () => {
  const show = (sort: { key: 'a' | 'b'; dir: 'asc' | 'desc' } | null, onSort: (key: 'a' | 'b') => void = () => undefined) =>
    render(
      <I18nProvider>
        <table>
          <thead>
            <tr>
              <SortTh label="Name" sortKey="a" sort={sort} onSort={onSort} />
              <SortTh label="Total" sortKey="b" sort={sort} onSort={onSort} />
            </tr>
          </thead>
        </table>
      </I18nProvider>,
    );

  it('tells assistive tech which column is sorted and which way', () => {
    show({ key: 'b', dir: 'desc' });
    expect(screen.getByText('Name').closest('th')!.getAttribute('aria-sort')).toBe('none');
    expect(screen.getByText('Total').closest('th')!.getAttribute('aria-sort')).toBe('descending');
    cleanup();
    show({ key: 'a', dir: 'asc' });
    expect(screen.getByText('Name').closest('th')!.getAttribute('aria-sort')).toBe('ascending');
  });

  it('is a button that reports its column when clicked, and its text stays just the label', () => {
    const clicked: string[] = [];
    show(null, (key) => void clicked.push(key));
    fireEvent.click(screen.getByRole('button', { name: 'Total' }));
    expect(clicked).toEqual(['b']);
    expect(screen.getByText('Total').closest('th')!.textContent).toBe('Total');
  });
});
