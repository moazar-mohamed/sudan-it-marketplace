import { EmptyState, Skeleton } from '../components/Bits';
import { formatDate } from '../data/format';
import { termsText, useTerms } from '../data/terms';
import { language, t } from '../i18n';

/** The terms and conditions Platform Admin published, in the reader's language. */
export function TermsPage() {
  const { terms, loaded } = useTerms();
  return (
    <main className="stack narrow">
      <h1 className="page-title">{t('الشروط والأحكام')}</h1>
      {!loaded ? (
        <Skeleton height={260} />
      ) : terms === null ? (
        <EmptyState title={t('لم تُنشر الشروط والأحكام بعد.')} />
      ) : (
        <section className="tile">
          <p className="pmeta">
            {t('الإصدار {0}', terms.version)}
            {terms.updatedAt && ` · ${t('آخر تحديث')}: ${formatDate(terms.updatedAt)}`}
          </p>
          <div className="prose terms-text">{termsText(terms, language)}</div>
        </section>
      )}
    </main>
  );
}
