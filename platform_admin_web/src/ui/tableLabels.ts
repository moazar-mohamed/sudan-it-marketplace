/**
 * Copies each column heading onto the cells of its column (`data-label`), so
 * on a phone the stylesheet can turn a table row into a labelled card without
 * every page having to repeat its headings.
 */
export function labelTableCells(table: HTMLTableElement): void {
  const headings = Array.from(table.querySelectorAll('thead th')).map(
    (th) => th.textContent?.trim() ?? '',
  );
  for (const row of Array.from(table.querySelectorAll('tbody tr'))) {
    Array.from(row.children).forEach((cell, index) => {
      const label = headings[index] ?? '';
      if (label && cell.getAttribute('data-label') !== label) {
        cell.setAttribute('data-label', label);
      }
    });
  }
}

/** Labels every data table under [root] now and whenever its content changes. */
export function watchTables(root: HTMLElement): () => void {
  const run = () => root.querySelectorAll<HTMLTableElement>('table.data').forEach(labelTableCells);
  run();
  const observer = new MutationObserver(run);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}
