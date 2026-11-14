import { useMemo, useRef, useState } from 'react';
import { useRunner } from '../components/feedback';
import { Modal } from '../components/ui';
import { importDefaultCategories } from '../data/actions';
import { categoryDisplayName } from '../data/categoryIcons';
import { planCategoryImport } from '../data/categoryImport';
import { DEFAULT_CATEGORY_TREE, type CategoryTemplate } from '../data/defaultCategoryTree';
import type { Category } from '../data/types';
import { useI18n } from '../i18n/I18nProvider';

const countNodes = (tree: readonly CategoryTemplate[]): number =>
  tree.reduce((sum, node) => sum + 1 + countNodes(node.children ?? []), 0);

const SHOWN_OTHERS = 8;

/** Adds the ready-made category tree; the other top-level categories can go to the trash (restorable). */
export function CategoryImportDialog({ all, onClose }: { all: readonly Category[]; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { run } = useRunner();
  // The plan is taken when the dialog opens; the page's live list changes while the import runs.
  const [plan] = useState(() => planCategoryImport(all, DEFAULT_CATEGORY_TREE));
  const snapshot = useRef(all);
  const total = useMemo(() => countNodes(DEFAULT_CATEGORY_TREE), []);
  const [trashOthers, setTrashOthers] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const busy = progress !== null;
  const nothingToDo = plan.toCreate === 0 && plan.others.length === 0;

  const start = async () => {
    setFailed(false);
    setProgress({ done: 0, total: plan.toCreate });
    const ok = await run(
      'import-categories',
      () =>
        importDefaultCategories(snapshot.current, {
          trashOthers,
          onStep: (done, all) => setProgress({ done, total: all }),
        }),
      (result) => t('categories.import.done', { created: result.created, trashed: result.trashed }),
    );
    if (ok) onClose();
    else {
      setProgress(null);
      setFailed(true);
    }
  };

  const names = plan.others.map((c) => categoryDisplayName(c, locale));

  return (
    <Modal title={t('categories.import.title')} onClose={busy ? () => undefined : onClose}>
      <p className="modal__text">
        {t('categories.import.intro', { top: DEFAULT_CATEGORY_TREE.length, total })}
      </p>
      <p>
        {plan.toCreate === 0
          ? t('categories.import.nothing')
          : t('categories.import.summary', { create: plan.toCreate, existing: plan.existing })}
      </p>
      {plan.others.length > 0 && (
        <>
          <p className="muted">
            {t('categories.import.others', {
              n: plan.others.length,
              names: names.slice(0, SHOWN_OTHERS).join('، ') + (names.length > SHOWN_OTHERS ? '…' : ''),
            })}
          </p>
          <label className="check">
            <input type="checkbox" checked={trashOthers} disabled={busy} onChange={(e) => setTrashOthers(e.target.checked)} />{' '}
            {t('categories.import.trashOthers')}
          </label>
        </>
      )}
      {busy && (
        <p role="status" className="muted">
          {t('categories.import.running', { done: progress.done, total: progress.total })}
        </p>
      )}
      {failed && (
        <p className="alert alert--error" role="alert">
          {t('categories.import.failed')}
        </p>
      )}
      <div className="modal__actions">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || nothingToDo || (plan.toCreate === 0 && !trashOthers)}
          onClick={() => void start()}
        >
          {t('categories.import.run')}
        </button>
      </div>
    </Modal>
  );
}
