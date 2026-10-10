// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { RegistrationFields } from './RegistrationFields';

const show = (requiredMarks?: boolean) =>
  render(
    <I18nProvider>
      <RegistrationFields
        value={{ registrationNumber: '', document: null }}
        onChange={() => undefined}
        showErrors={false}
        requiredMarks={requiredMarks}
      />
    </I18nProvider>,
  );

beforeEach(() => localStorage.setItem('platform_admin_locale', 'en'));
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the registration fields', () => {
  it('mark the number and the document as required when asked to', () => {
    show(true);
    expect(document.querySelectorAll('.field-mark--required')).toHaveLength(2);
  });

  it('look as they always did when not asked', () => {
    show();
    expect(document.querySelectorAll('.field-mark')).toHaveLength(0);
  });
});
