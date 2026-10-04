// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RowMenu } from './RowMenu';

const show = (onEdit = vi.fn(), onDelete = vi.fn()) =>
  render(
    <RowMenu
      label="More"
      items={[
        { key: 'edit', label: 'Edit', onSelect: onEdit },
        { key: 'up', label: 'Up', onSelect: () => undefined, disabled: true },
        { key: 'delete', label: 'Delete', onSelect: onDelete, danger: true, separated: true },
      ]}
    />,
  );
const opener = () => screen.getByRole('button', { name: 'More' });

afterEach(cleanup);

describe('the row menu', () => {
  it('is closed until the button is pressed, and says so to assistive tools', () => {
    show();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(opener().getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(opener());
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(opener().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Edit', 'Up', 'Delete']);
  });

  it('runs the chosen action once and closes', () => {
    const onEdit = vi.fn();
    show(onEdit);
    fireEvent.click(opener());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not run a disabled action', () => {
    show();
    fireEvent.click(opener());
    const up = screen.getByRole('menuitem', { name: 'Up' }) as HTMLButtonElement;
    expect(up.disabled).toBe(true);
  });

  it('closes with Escape, and with a press outside it', () => {
    show();
    fireEvent.click(opener());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(opener());
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when the button is pressed again', () => {
    show();
    fireEvent.click(opener());
    fireEvent.click(opener());
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
