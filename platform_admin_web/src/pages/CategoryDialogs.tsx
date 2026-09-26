import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRunner } from '../components/feedback';
import { Modal, Text } from '../components/ui';
import {
  createCategory,
  deleteCategoryTree,
  moveCategory,
  summarizeCategoryDeletion,
  updateCategory,
  type DeletionSummary,
  type Progress,
} from '../data/actions';
import { CATEGORY_ICONS, categoryDisplayName, findCategoryIcon } from '../data/categoryIcons';
import { buildIndex, moveProblem, pathLabel } from '../data/categoryTree';
import type { Category } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';

const ARABIC_LETTER = /[؀-ۿ]/;

/** Fills the two name fields of a category that only has the single old name. */
function initialNames(category: Category | null): { ar: string; en: string } {
  if (!category) return { ar: '', en: '' };
  const legacy = category.name;
  return {
    ar: category.nameAr || (ARABIC_LETTER.test(legacy) ? legacy : ''),
    en: category.nameEn || (ARABIC_LETTER.test(legacy) ? '' : legacy),
  };
}

export type FormTarget =
  | { kind: 'create'; parent: Category | null }
  | { kind: 'edit'; category: Category };

/** Add a top-level or sub-category, or edit a category's names, description and icon. */
export function CategoryForm({
  target,
  all,
  onClose,
  onCreated,
}: {
  target: FormTarget;
  all: readonly Category[];
  onClose: () => void;
  /** Called with the parent id after a category is added, so the tree can open it. */
  onCreated?: (parentId: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const { busy, run } = useRunner();
  const category = target.kind === 'edit' ? target.category : null;
  const initial = initialNames(category);
  const [nameAr, setNameAr] = useState(initial.ar);
  const [nameEn, setNameEn] = useState(initial.en);
  const [description, setDescription] = useState(category?.description ?? '');
  const [iconName, setIconName] = useState(category?.iconName ?? '');
  const [showError, setShowError] = useState(false);

  const index = useMemo(() => buildIndex(all), [all]);
  const parent = target.kind === 'create' ? target.parent : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim() || !nameEn.trim()) {
      setShowError(true);
      return;
    }
    const fields = { nameAr, nameEn, description, iconName };
    const ok = await run(
      'save',
      async () => {
        if (target.kind === 'edit') {
          await updateCategory(target.category.id, fields);
        } else {
          await createCategory({ ...fields, parentId: parent?.id ?? null }, all);
        }
      },
      t(target.kind === 'edit' ? 'categories.updated' : 'categories.saved'),
    );
    if (ok) {
      if (target.kind === 'create') onCreated?.(parent?.id ?? null);
      onClose();
    }
  };

  // An icon typed by hand before icons were a list keeps showing as it is.
  const unknownIcon = iconName.trim() && !findCategoryIcon(iconName) ? iconName : null;
  const title =
    target.kind === 'edit'
      ? t('categories.editTitle')
      : parent
        ? t('categories.addTitleChild')
        : t('categories.addTitle');

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate>
        {target.kind === 'create' && (
          <p className="muted" style={{ margin: '0 0 12px' }}>
            {t('categories.underLabel')}:{' '}
            <strong>
              <Text>{parent ? pathLabel(index, parent.id, locale) : t('categories.topLevel')}</Text>
            </strong>
          </p>
        )}
        <label className="field">
          <span>{t('categories.nameArLabel')}</span>
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            autoFocus
            dir="rtl"
            maxLength={100}
            aria-invalid={showError && !nameAr.trim()}
          />
          {showError && !nameAr.trim() && (
            <small className="field__error">{t('categories.nameArRequired')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('categories.nameEnLabel')}</span>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            dir="ltr"
            maxLength={100}
            aria-invalid={showError && !nameEn.trim()}
          />
          {showError && !nameEn.trim() ? (
            <small className="field__error">{t('categories.nameEnRequired')}</small>
          ) : (
            <small className="muted">{t('categories.nameHint')}</small>
          )}
        </label>
        <label className="field">
          <span>{t('categories.descriptionLabel')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            dir="auto"
          />
        </label>
        <label className="field">
          <span>{t('categories.iconLabel')}</span>
          <select value={iconName} onChange={(e) => setIconName(e.target.value)}>
            <option value="">{t('categories.iconAuto')}</option>
            {unknownIcon && <option value={unknownIcon}>{unknownIcon}</option>}
            {CATEGORY_ICONS.map((icon) => (
              <option key={icon.key} value={icon.key}>
                {icon.emoji} {locale === 'ar' ? icon.ar : icon.en}
              </option>
            ))}
          </select>
        </label>
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy === 'save'}>
            {busy === 'save' ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Choose a new parent for a category: any category except itself and its own descendants. */
export function MoveDialog({
  category,
  all,
  onClose,
}: {
  category: Category;
  all: readonly Category[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { busy, run } = useRunner();
  const index = useMemo(() => buildIndex(all), [all]);

  const options = useMemo(() => {
    const list = all
      .filter((c) => moveProblem(index, category.id, c.id) === null)
      .map((c) => ({ id: c.id, label: pathLabel(index, c.id, locale) }));
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [all, category, index, locale]);
  const canGoToTop = moveProblem(index, category.id, null) === null;
  const [target, setTarget] = useState<string>(canGoToTop ? '' : (options[0]?.id ?? ''));
  const nowhere = options.length === 0 && !canGoToTop;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(
      'move',
      () => moveCategory(all, category.id, target === '' ? null : target),
      t('categories.moved'),
    );
    if (ok) onClose();
  };

  return (
    <Modal
      title={t('categories.moveTitle', { name: categoryDisplayName(category, locale) })}
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <p className="muted">{t('categories.moveHint')}</p>
        {nowhere ? (
          <p>{t('categories.moveNone')}</p>
        ) : (
          <label className="field">
            <span>{t('categories.moveTo')}</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {canGoToTop && <option value="">{t('categories.topLevel')}</option>}
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn btn--primary" disabled={nowhere || busy === 'move'}>
            {busy === 'move' ? t('common.saving') : t('categories.move')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

type DeleteState =
  | { status: 'counting' }
  | { status: 'ready'; summary: DeletionSummary }
  | { status: 'countFailed' }
  | { status: 'deleting'; summary: DeletionSummary; progress: Progress | null }
  | { status: 'failed'; summary: DeletionSummary };

/**
 * Confirms deleting a category tree: says how many categories, products,
 * services and company offers will go (and what is kept), needs an explicit
 * tick, and shows progress. The same dialog finishes an interrupted deletion.
 */
export function DeleteDialog({
  category,
  all,
  onClose,
}: {
  category: Category;
  all: readonly Category[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { run } = useRunner();
  const [state, setState] = useState<DeleteState>({ status: 'counting' });
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    let cancelled = false;
    summarizeCategoryDeletion(all, category.id).then(
      (summary) => !cancelled && setState({ status: 'ready', summary }),
      () => !cancelled && setState({ status: 'countFailed' }),
    );
    return () => {
      cancelled = true;
    };
    // The counts are taken once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = state.status === 'deleting';
  const start = async () => {
    if (state.status !== 'ready' && state.status !== 'failed') return;
    const summary = state.summary;
    setState({ status: 'deleting', summary, progress: null });
    const ok = await run(
      'delete',
      () =>
        deleteCategoryTree(all, category.id, {
          onProgress: (progress) => setState({ status: 'deleting', summary, progress }),
        }),
      (done) =>
        t('categories.deleted', {
          categories: done.categories,
          products: done.products,
          services: done.services,
        }),
    );
    if (ok) onClose();
    else setState({ status: 'failed', summary });
  };

  const summary =
    state.status === 'ready' || state.status === 'deleting' || state.status === 'failed'
      ? state.summary
      : null;

  return (
    <Modal
      title={t('categories.deleteTitle', { name: categoryDisplayName(category, locale) })}
      onClose={busy ? () => undefined : onClose}
    >
      {state.status === 'counting' && <p className="muted">{t('categories.deleteCounting')}</p>}
      {state.status === 'countFailed' && (
        <p className="alert alert--error" role="alert">
          {t('categories.deleteCountFailed')}
        </p>
      )}
      {summary && (
        <>
          <p className="modal__text">{t('categories.deleteIntro')}</p>
          <ul className="impact-list">
            <li>{t('categories.deleteCats', { n: summary.categories })}</li>
            <li>{t('categories.deleteProducts', { n: summary.products })}</li>
            <li>{t('categories.deleteServices', { n: summary.services })}</li>
            <li>{t('categories.deleteLinks', { n: summary.serviceLinks })}</li>
          </ul>
          <p className="muted">{t('categories.deleteKept')}</p>
          <label className="check">
            <input
              type="checkbox"
              checked={understood}
              disabled={busy}
              onChange={(e) => setUnderstood(e.target.checked)}
            />{' '}
            {t('categories.deleteUndone')}
          </label>
        </>
      )}
      {state.status === 'deleting' && (
        <p role="status" className="muted">
          {state.progress
            ? t('categories.deleting', {
                phase: t(`categories.phase.${state.progress.phase}`),
                done: state.progress.done,
                total: state.progress.total,
              })
            : t('categories.deleteCounting')}
        </p>
      )}
      {state.status === 'failed' && (
        <p className="alert alert--error" role="alert">
          {t('categories.deleteFailed')}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn--danger"
          disabled={!summary || !understood || busy}
          onClick={() => void start()}
        >
          {t('categories.deleteEverything')}
        </button>
      </div>
    </Modal>
  );
}
