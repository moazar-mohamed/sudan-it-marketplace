import { useState } from 'react';
import { useConfirm, useRunner } from '../components/feedback';
import { Card, PageHeader } from '../components/ui';
import { saveTerms } from '../data/actions';
import { MAX_TERMS_LENGTH, nextTermsVersion, termsProblem, useTerms } from '../data/terms';
import { SAMPLE_TERMS_AR, SAMPLE_TERMS_EN } from '../data/termsSample';
import { useI18n } from '../i18n/I18nProvider';

/** Platform Admin writes the terms and conditions and publishes them as a new version or a correction. */
export function TermsPage() {
  const { t, dateTime } = useI18n();
  const { status, terms } = useTerms();
  const { busy, run } = useRunner();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<{ textAr: string; textEn: string } | null>(null);
  const [askAgain, setAskAgain] = useState(true);

  // Until something is published the editor holds the sample, so it is never empty.
  const textAr = draft?.textAr ?? terms?.textAr ?? SAMPLE_TERMS_AR;
  const textEn = draft?.textEn ?? terms?.textEn ?? SAMPLE_TERMS_EN;
  const isSample = textAr === SAMPLE_TERMS_AR && textEn === SAMPLE_TERMS_EN;
  const problem = termsProblem(textAr, textEn);
  const version = nextTermsVersion(terms, askAgain);
  const changed = terms === null || textAr !== terms.textAr || textEn !== terms.textEn;

  const publish = async () => {
    if (problem || !changed) return;
    if (terms !== null && askAgain) {
      const ok = await confirm({
        title: t('terms.confirm.title'),
        body: t('terms.confirm.body', { version }),
        confirmLabel: t('terms.publish'),
      });
      if (!ok) return;
    }
    const done = await run('publish', () => saveTerms({ textAr, textEn, version, newVersion: terms === null || askAgain }), t('terms.saved'));
    if (done) setDraft(null);
  };

  return (
    <>
      <PageHeader
        title={t('terms.title')}
        subtitle={t('terms.subtitle')}
        actions={
          <button className="btn btn--primary" disabled={!changed || problem !== null || busy === 'publish' || status !== 'ready'} onClick={publish}>
            {busy === 'publish' ? t('common.saving') : t('terms.publish')}
          </button>
        }
      />
      <Card title={t('terms.status')}>
        {status === 'error' ? (
          <p className="field__error" role="alert">{t('terms.loadFailed')}</p>
        ) : status === 'loading' ? (
          <p className="muted">{t('common.loading')}</p>
        ) : terms === null ? (
          <p className="muted" role="status">{t('terms.none')}</p>
        ) : (
          <p role="status">{t('terms.current', { version: terms.version, time: terms.updatedAt ? dateTime(terms.updatedAt) : '' })}</p>
        )}
      </Card>
      <Card
        title={t('terms.text')}
        actions={
          !isSample ? (
            <button type="button" className="btn" onClick={() => setDraft({ textAr: SAMPLE_TERMS_AR, textEn: SAMPLE_TERMS_EN })}>
              {t('terms.useSample')}
            </button>
          ) : undefined
        }
      >
        {isSample && <p className="muted">{t('terms.sampleNote')}</p>}
        <label className="field">
          <span>{t('terms.textAr')}</span>
          <textarea dir="rtl" rows={14} value={textAr} onChange={(e) => setDraft({ textAr: e.target.value, textEn })} />
          <small className={textAr.length > MAX_TERMS_LENGTH ? 'field__error' : undefined}>{textAr.length}/{MAX_TERMS_LENGTH}</small>
        </label>
        <label className="field">
          <span>{t('terms.textEn')}</span>
          <textarea dir="ltr" rows={14} value={textEn} onChange={(e) => setDraft({ textAr, textEn: e.target.value })} />
          <small className={textEn.length > MAX_TERMS_LENGTH ? 'field__error' : undefined}>{textEn.length}/{MAX_TERMS_LENGTH}</small>
        </label>
        {problem && changed && <p className="field__error" role="alert">{t(problem)}</p>}
        {terms !== null && (
          <label className="option">
            <input type="checkbox" checked={askAgain} onChange={(e) => setAskAgain(e.target.checked)} />
            <span>
              {askAgain ? t('terms.askAgain', { version }) : t('terms.keepVersion', { version })}
              <small className="muted"> {t('terms.askAgainHint')}</small>
            </span>
          </label>
        )}
        <p className="muted">{t('terms.note')}</p>
      </Card>
    </>
  );
}
