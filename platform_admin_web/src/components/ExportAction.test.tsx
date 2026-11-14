// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { en } from '../i18n/dictionary';
import { ExportAction } from './v2';

const show = (props: Partial<React.ComponentProps<typeof ExportAction>> = {}) => {
  const onExport = vi.fn();
  localStorage.setItem('platform_admin_locale', 'en');
  render(
    <I18nProvider>
      <ExportAction label="Export CSV" onExport={onExport} {...props} />
    </I18nProvider>,
  );
  return onExport;
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the export of a list', () => {

  it('sits inside the "..." menu in the redesign, so it does not stand alone in the header', () => {
    const onExport = show();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: en['common.actions'] }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export CSV' }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('keeps a disabled export disabled in the menu', () => {
    const onExport = show({ disabled: true });
    fireEvent.click(screen.getByRole('button', { name: en['common.actions'] }));
    expect((screen.getByRole('menuitem', { name: 'Export CSV' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onExport).not.toHaveBeenCalled();
  });
});
