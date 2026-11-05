// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setTheme } from '../theme/theme';
import { setDensity, setUi } from '../theme/ui';
import { DesignSystemPage } from './DesignSystemPage';

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  act(() => {
    setUi('v1');
    setDensity('comfortable');
    setTheme('system');
  });
});
afterEach(cleanup);

describe('design-system page', () => {
  it('shows the tokens and the component seeds', () => {
    render(<DesignSystemPage />);
    expect(screen.getByRole('heading', { name: 'سيستم التصميم (v2)' })).toBeTruthy();
    expect(screen.getByTestId('swatch-color-brand-primary')).toBeTruthy();
    expect(screen.getByTestId('swatch-color-bg-app')).toBeTruthy();
    expect(screen.getByRole('menu', { name: 'قائمة الإجراءات' })).toBeTruthy();
    expect(screen.getAllByRole('menuitem').length).toBe(4);
  });

  it('says the new look is off until it is switched on', () => {
    render(<DesignSystemPage />);
    expect(screen.getByText(/الشكل الجديد مطفي الآن/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /تشغيل الشكل الجديد/ }));
    expect(root.getAttribute('data-ui')).toBe('v2');
    expect(screen.queryByText(/الشكل الجديد مطفي الآن/)).toBeNull();
  });

  it('density and appearance switches change <html>', () => {
    render(<DesignSystemPage />);
    const density = screen.getByRole('group', { name: 'الكثافة' });
    expect(density.querySelector('[aria-pressed="true"]')?.textContent).toBe('مريح');
    fireEvent.click(screen.getByRole('button', { name: 'مضغوط' }));
    expect(root.getAttribute('data-density')).toBe('compact');
    fireEvent.click(screen.getByRole('button', { name: 'داكن' }));
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('tabs and chips keep one choice at a time', () => {
    render(<DesignSystemPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'التصنيفات' }));
    expect(screen.getByRole('tab', { name: 'التصنيفات' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'المنتجات' }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /مكتمل/ }));
    expect(screen.getByRole('button', { name: /مكتمل/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /الكل/ }).getAttribute('aria-pressed')).toBe('false');
  });
});
