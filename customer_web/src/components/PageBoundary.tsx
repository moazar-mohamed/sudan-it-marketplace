import { Component, Suspense } from 'react';
import type { ReactNode } from 'react';
import { Skeleton } from './Bits';
import { t } from '../i18n';

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="stack narrow">
        <div className="empty-state">
          <h2>{t('تعذر فتح هذه الصفحة')}</h2>
          <p className="pmeta">{t('تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.')}</p>
          <button className="pill" onClick={() => window.location.reload()}>{t('إعادة المحاولة')}</button>
        </div>
      </main>
    );
  }
}

/** One page that fails to load or to draw leaves the rest of the site working. */
export const PageBoundary = ({ children }: { children: ReactNode }) => (
  <Boundary>
    <Suspense fallback={<main className="stack"><Skeleton height={320} /></main>}>{children}</Suspense>
  </Boundary>
);
