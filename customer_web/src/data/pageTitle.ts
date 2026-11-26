import { useEffect } from 'react';
import { t } from '../i18n';

const COUNT = /^\(\d+\+?\)\s*/;

/**
 * "Page | سوق السودان للتقنية"; for the home page (no [page]) the site's name
 * with the SICTM brand, so a Google search for "SICTM" finds it.
 */
export function pageTitle(page: string | null | undefined): string {
  const site = t('سوق السودان للتقنية');
  const name = page?.trim();
  return name ? `${name} | ${site}` : `${site} | SICTM`;
}

/** [title] with the "(3) " waiting-count of [current] kept in front. */
export function withCountOf(current: string, title: string): string {
  const count = current.match(COUNT)?.[0] ?? '';
  return count + title;
}

/**
 * The browser tab names the page. The unread count the header puts in front
 * stays; leaving the page gives the tab back the site's name.
 */
export function usePageTitle(page: string | null | undefined): void {
  useEffect(() => {
    document.title = withCountOf(document.title, pageTitle(page));
    return () => {
      document.title = withCountOf(document.title, pageTitle(null));
    };
  }, [page]);
}
