import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  registrationProblems,
  type CompanyDocument,
  type PreparedDocumentFile,
  type RegistrationInput,
} from '../data/companyDocuments';
import { useI18n } from '../i18n/I18nProvider';
import { useRunner } from './feedback';
import { RegistrationFields } from './RegistrationFields';
import { Card, KeyValue, Modal, Text } from './ui';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; document: CompanyDocument | null };

/**
 * The company's registration on its details page: the number, the document
 * photo on request, and adding or updating both. Everything here is
 * Platform Admin only (see companyDocuments.ts).
 */
export function CompanyRegistrationCard({
  companyId,
  load,
  save,
}: {
  companyId: string;
  load: (companyId: string) => Promise<CompanyDocument | null>;
  save: (companyId: string, number: string, file: PreparedDocumentFile) => Promise<void>;
}) {
  const { t, date } = useI18n();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [showImage, setShowImage] = useState(false);
  const [editing, setEditing] = useState(false);

  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    load(companyId).then(
      (document) => active && setState({ status: 'ready', document }),
      () => active && setState({ status: 'error' }),
    );
    return () => {
      active = false;
    };
  }, [companyId, load, reloads]);

  const refresh = () => {
    setState({ status: 'loading' });
    setReloads((n) => n + 1);
  };

  const current = state.status === 'ready' ? state.document : null;
  const isImage = current?.contentType === 'image/jpeg';
  const imageUrl = useMemo(
    () =>
      current && isImage && showImage
        ? URL.createObjectURL(new Blob([current.bytes as BlobPart], { type: current.contentType }))
        : null,
    [current, isImage, showImage],
  );
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  // A PDF is opened in a new tab (the browser renders it natively) instead
  // of being embedded; an image toggles inline, as before.
  const openDocument = () => {
    if (!current) return;
    if (isImage) {
      setShowImage((s) => !s);
      return;
    }
    const url = URL.createObjectURL(new Blob([current.bytes as BlobPart], { type: current.contentType }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Card
      title={t('registration.section')}
      actions={
        state.status === 'ready' ? (
          <button type="button" className="btn btn--sm" onClick={() => setEditing(true)}>
            {current ? t('registration.replace') : t('registration.add')}
          </button>
        ) : undefined
      }
    >
      {state.status === 'loading' && <p className="muted">{t('common.loading')}</p>}
      {state.status === 'error' && (
        <p className="alert alert--error" role="alert">
          {t('registration.loadError')}{' '}
          <button type="button" className="btn btn--sm" onClick={refresh}>
            {t('common.retry')}
          </button>
        </p>
      )}
      {state.status === 'ready' && !current && (
        <p className="alert alert--warning">{t('registration.missing')}</p>
      )}
      {current && (
        <>
          <dl className="kv-list">
            <KeyValue label={t('registration.number')}>
              <Text>{current.registrationNumber}</Text>
            </KeyValue>
            <KeyValue label={t('registration.updated')}>
              {current.updatedAt ? date(current.updatedAt) : '—'}
            </KeyValue>
          </dl>
          <button type="button" className="btn btn--sm" onClick={openDocument}>
            {isImage && showImage ? t('registration.hide') : t('registration.view')}
          </button>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="receipt__link">
              <img src={imageUrl} alt={t('registration.alt')} className="receipt__image" />
            </a>
          )}
        </>
      )}
      {editing && (
        <RegistrationEditModal
          initial={{
            registrationNumber: current?.registrationNumber ?? '',
            document: current
              ? {
                  bytes: current.bytes,
                  contentType: current.contentType,
                  width: current.width,
                  height: current.height,
                  fileName: current.fileName,
                }
              : null,
          }}
          onSave={async (value) => {
            await save(companyId, value.registrationNumber, value.document!);
          }}
          onClose={(saved) => {
            setEditing(false);
            if (saved) {
              setShowImage(false);
              refresh();
            }
          }}
        />
      )}
    </Card>
  );
}

function RegistrationEditModal({
  initial,
  onSave,
  onClose,
}: {
  initial: RegistrationInput;
  onSave: (value: RegistrationInput) => Promise<void>;
  onClose: (saved: boolean) => void;
}) {
  const { t } = useI18n();
  const { busy, run } = useRunner();
  const [value, setValue] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (registrationProblems(value).length > 0) {
      setShowErrors(true);
      return;
    }
    const ok = await run('registration', () => onSave(value), t('registration.saved'));
    if (ok) onClose(true);
  };

  return (
    <Modal title={t('registration.section')} onClose={() => onClose(false)}>
      <form onSubmit={onSubmit} noValidate>
        <RegistrationFields
          value={value}
          onChange={setValue}
          showErrors={showErrors}
          disabled={busy === 'registration'}
        />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy === 'registration'}>
            {busy === 'registration' ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
