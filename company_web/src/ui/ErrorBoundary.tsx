import { Component, type ErrorInfo, type ReactNode } from 'react';

// Each deploy replaces the hashed page files, so a tab opened before it asks for
// a file that no longer exists (the host answers with index.html instead).
const STALE_BUILD = /dynamically imported module|importing a module script failed|failed to fetch dynamically|loading chunk|unable to preload/i;
const RELOADED_AT = 'company-panel-reloaded-at';

export const isStaleBuildError = (error: unknown): boolean =>
  STALE_BUILD.test(error instanceof Error ? `${error.name} ${error.message}` : String(error));

/** Reloads once to pick up the new version; false when it already did in the last 30 seconds (no loop). */
export function reloadForNewVersion(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED_AT) ?? 0) < 30_000) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * A page that fails to load or render no longer blanks the whole screen: it
 * shows a message with a way out. A stale-version failure reloads by itself.
 * Give it a `key` that changes with the route to clear the message on navigation.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    if (isStaleBuildError(error)) reloadForNewVersion();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isStaleBuildError(error);
    return (
      <main className="page">
        <section className="card" role="alert">
          <div className="card-b stack" style={{ alignItems: 'center', textAlign: 'center', padding: '48px 24px', gap: 12 }}>
            <h2>{stale ? 'صدر إصدار جديد من اللوحة' : 'تعذّر عرض هذه الصفحة'}</h2>
            <p className="sub">{stale ? 'حدّث الصفحة لتحميل الإصدار الجديد.' : 'حدّث الصفحة، وإن تكرر الأمر فأخبرنا بما كنت تفعله.'}</p>
            <div className="row">
              <button type="button" className="btn p" onClick={() => window.location.reload()}>تحديث الصفحة</button>
              {!stale && <button type="button" className="btn" onClick={() => this.setState({ error: null })}>إعادة المحاولة</button>}
            </div>
          </div>
        </section>
      </main>
    );
  }
}
