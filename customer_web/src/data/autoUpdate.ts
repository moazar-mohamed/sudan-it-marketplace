// A web page has nothing to install, so a new version is picked up by itself: a
// tab that was left open would otherwise ask for page files that are gone.

const BUILD = import.meta.env.VITE_BUILD_ID as string | undefined;
const RELOADED_KEY = 'reloaded_for_build';

/** Whether [latest] is a different build from [running]. Unknown builds change nothing. */
export const isNewer = (running: string | undefined, latest: unknown): latest is string =>
  !!running && typeof latest === 'string' && latest !== '' && latest !== running;

/** The newer build that is out, or null. */
export async function newerBuild(): Promise<string | null> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return null;
    const latest = ((await response.json()) as { build?: unknown }).build;
    return isNewer(BUILD, latest) ? latest : null;
  } catch {
    return null;
  }
}

/** Reloads once per marker, so a page that keeps failing can never reload forever. */
export function reloadOnce(marker: string): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === marker) return false;
    sessionStorage.setItem(RELOADED_KEY, marker);
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Whether the customer has typed something or has a window open that a reload would lose. */
export function hasUnsavedInput(root: ParentNode = document): boolean {
  if (root.querySelector('.scrim')) return true;
  return [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([type=radio]):not([type=checkbox]):not([type=search]), textarea')]
    .some((field) => field.value.trim() !== '');
}
