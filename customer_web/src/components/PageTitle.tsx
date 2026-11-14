import { usePageTitle } from '../data/pageTitle';

/**
 * Names the browser tab after the page ("طلباتي | سوق السودان للتقنية").
 * A component rather than a hook call, so a page can place it after its early
 * returns (loading, not found).
 */
export function PageTitle({ title }: { title: string | null }) {
  usePageTitle(title);
  return null;
}
