import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DOCUMENT_MAX_BYTES,
  DocumentFileError,
  prepareDocumentFile,
  REGISTRATION_NUMBER_MAX,
  registrationProblems,
  type PreparedDocumentFile,
  type RegistrationInput,
} from '../data/companyDocuments';
import { useI18n } from '../i18n/I18nProvider';

const KB = 1024;
const formatKB = (bytes: number) => `${Math.max(1, Math.round(bytes / KB))} KB`;
const MAX_LABEL = formatKB(DOCUMENT_MAX_BYTES);

/**
 * The registration number and the document file (an image or a PDF). An
 * image is compressed as soon as it is picked, so what is previewed is
 * exactly what will be stored; a PDF is kept as picked and only shown by
 * name, since it is refused outright if it does not already fit.
 */
export function RegistrationFields({
  value,
  onChange,
  showErrors,
  disabled = false,
  prepare = prepareDocumentFile,
}: {
  value: RegistrationInput;
  onChange: (value: RegistrationInput) => void;
  showErrors: boolean;
  disabled?: boolean;
  /** Replaceable in tests, where there is no canvas. */
  prepare?: (file: File) => Promise<PreparedDocumentFile>;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const problems = registrationProblems(value);
  const document = value.document;
  const isImage = document?.contentType === 'image/jpeg';

  const preview = useMemo(
    () =>
      document && isImage
        ? URL.createObjectURL(new Blob([document.bytes as BlobPart], { type: 'image/jpeg' }))
        : null,
    [document, isImage],
  );
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    setPreparing(true);
    try {
      onChange({ ...value, document: await prepare(file) });
    } catch (error) {
      if (error instanceof DocumentFileError) {
        setFileError(
          error.code === 'too-large'
            ? t('registration.tooLarge', {
                size: formatKB(error.sizeBytes ?? file.size),
                max: MAX_LABEL,
              })
            : t(
                error.code === 'unsupported-type' ? 'registration.unsupportedType' : 'registration.unreadable',
              ),
        );
      } else {
        setFileError(t('registration.unreadable'));
      }
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
        {document && (
          <div className="document-preview">
            {preview ? (
              <img src={preview} alt={t('registration.alt')} />
            ) : (
              <p className="document-preview__file">📄 {document.fileName}</p>
            )}
            <small className="note">
              <bdi dir="ltr">
                {document.fileName} · {formatKB(document.bytes.length)}
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
              : document
                ? t('registration.change')
                : t('registration.choose')}
          </button>
          {document && !preparing && (
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
          accept="image/*,application/pdf"
          hidden
          data-testid="registration-file"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {fileError && <small className="field__error">{fileError}</small>}
        {!fileError && showErrors && problems.includes('document-required') && (
          <small className="field__error">{t('registration.documentRequired')}</small>
        )}
        <small className="note">{t('registration.documentHint', { max: MAX_LABEL })}</small>
      </div>
    </fieldset>
  );
}
