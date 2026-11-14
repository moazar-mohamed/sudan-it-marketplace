// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { PhoneField, phoneValueProblem } from './PhoneField';

let saved = '';

function Harness({ initial = '', showError = false }: { initial?: string; showError?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <I18nProvider>
      <PhoneField
        label="Phone"
        value={value}
        onChange={(next) => {
          saved = next;
          setValue(next);
        }}
        required
        showError={showError}
      />
    </I18nProvider>
  );
}

const input = () => screen.getByLabelText('Phone') as HTMLInputElement;
const select = () => screen.getByLabelText('Country code') as HTMLSelectElement;

afterEach(() => {
  cleanup();
  localStorage.clear();
  saved = '';
});

describe('PhoneField', () => {
  it('starts on Sudan and saves the number with +249', () => {
    const { container } = render(<Harness />);
    expect(select().value).toBe('SD');
    expect(container.querySelector('.phone-input__code > span')?.textContent).toBe('🇸🇩 +249');
    fireEvent.change(input(), { target: { value: '0912 345 678' } });
    expect(saved).toBe('+249912345678');
  });

  it('opens a saved number on its own country', () => {
    render(<Harness initial="+966501234567" />);
    expect(select().value).toBe('SA');
    expect(input().value).toBe('501234567');
  });

  it('changing the country keeps the typed number', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '501234567' } });
    fireEvent.change(select(), { target: { value: 'AE' } });
    expect(saved).toBe('+971501234567');
  });

  it('a pasted number with its code picks the country', () => {
    render(<Harness />);
    fireEvent.change(input(), { target: { value: '+20 10 1234 5678' } });
    expect(select().value).toBe('EG');
    expect(input().value).toBe('1012345678');
    expect(saved).toBe('+201012345678');
  });

  it('shows why a number cannot be saved', () => {
    render(<Harness initial="+24991234" showError />);
    expect(screen.getByText(/Enter 9 digits after/)).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(phoneValueProblem('+24991234')).not.toBeNull();
  });

  it('the number box reads left to right in Arabic too', () => {
    localStorage.setItem('platform_admin_locale', 'ar');
    const { container } = render(<Harness />);
    expect(container.querySelector('.phone-input')?.getAttribute('dir')).toBe('ltr');
    expect(screen.getByLabelText('مفتاح الدولة')).toBeTruthy();
  });
});
