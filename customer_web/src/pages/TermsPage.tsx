import { Link } from 'react-router-dom';
import { EmptyState, Skeleton } from '../components/Bits';
import { LanguageSwitch } from '../components/LanguageSwitch';
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

/** The same page for someone who has not signed in: a small header and the language switch. */
export function PublicTermsPage() {
  return (
    <div className="page">
      <Link to="/" className="brand">
        <span className="brand-mark">{t('س')}</span>
        {t('سوق السودان للتقنية')}
      </Link>
      <TermsPage />
      <LanguageSwitch />
    </div>
  );
}
