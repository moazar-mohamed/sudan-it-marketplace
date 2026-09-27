import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DocumentImageError,
  prepareDocumentImage,
  REGISTRATION_NUMBER_MAX,
  registrationProblems,
  type PreparedDocumentImage,
  type RegistrationInput,
} from '../data/companyDocuments';
import type { TranslationKey } from '../i18n/dictionary';
import { useI18n } from '../i18n/I18nProvider';

const IMAGE_ERRORS: Record<DocumentImageError['code'], TranslationKey> = {
  'not-an-image': 'registration.notImage',
  unreadable: 'registration.unreadable',
  'too-large': 'registration.tooLarge',
};

/**
 * The registration number and the document photo. The photo is compressed as
 * soon as it is picked, so what is previewed is exactly what will be stored.
 */
export function RegistrationFields({
  value,
  onChange,
  showErrors,
  disabled = false,
  prepare = prepareDocumentImage,
}: {
  value: RegistrationInput;
  onChange: (value: RegistrationInput) => void;
  showErrors: boolean;
  disabled?: boolean;
  /** Replaceable in tests, where there is no canvas. */
  prepare?: (file: File) => Promise<PreparedDocumentImage>;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [imageError, setImageError] = useState<TranslationKey | null>(null);
  const problems = registrationProblems(value);

  const preview = useMemo(
    () =>
      value.document
        ? URL.createObjectURL(new Blob([value.document.bytes as BlobPart], { type: 'image/jpeg' }))
        : null,
    [value.document],
  );
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    setPreparing(true);
    try {
      onChange({ ...value, document: await prepare(file) });
    } catch (error) {
      setImageError(
        error instanceof DocumentImageError ? IMAGE_ERRORS[error.code] : 'registration.unreadable',
      );
    } finally {
      setPreparing(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <fieldset className="fieldset" disabled={disabled}>
      <legend>{t('registration.section')}</legend>
      <label className="field">
        <span>{t('registration.number')}</span>
        <input
          value={value.registrationNumber}
          onChange={(e) => onChange({ ...value, registrationNumber: e.target.value })}
          dir="auto"
          maxLength={REGISTRATION_NUMBER_MAX + 20}
          aria-invalid={showErrors && problems.some((p) => p.startsWith('number'))}
        />
        {showErrors && problems.includes('number-required') && (
          <small className="field__error">{t('registration.numberRequired')}</small>
        )}
        {showErrors && problems.includes('number-too-long') && (
          <small className="field__error">{t('registration.numberTooLong')}</small>
        )}
      </label>
      <div className="field">
        <span>{t('registration.document')}</span>
        {preview && value.document && (
          <div className="document-preview">
            <img src={preview} alt={t('registration.alt')} />
            <small className="note">
              <bdi dir="ltr">
                {value.document.fileName} · {Math.round(value.document.bytes.length / 1024)} KB
              </bdi>
            </small>
          </div>
        )}
        <div className="field-row">
          <button
            type="button"
            className="btn"
            disabled={disabled || preparing}
            onClick={() => input.current?.click()}
          >
            {preparing
              ? t('registration.preparing')
              : value.document
                ? t('registration.change')
                : t('registration.choose')}
          </button>
          {value.document && !preparing && (
            <button
              type="button"
              className="btn"
              disabled={disabled}
              onClick={() => onChange({ ...value, document: null })}
            >
              {t('registration.remove')}
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          data-testid="registration-file"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {imageError && <small className="field__error">{t(imageError)}</small>}
        {!imageError && showErrors && problems.includes('document-required') && (
          <small className="field__error">{t('registration.documentRequired')}</small>
        )}
        <small className="note">{t('registration.documentHint')}</small>
      </div>
    </fieldset>
  );
}
