/** "(3) " in front of the tab's title while something is waiting; nothing once it is all seen. */
export function titleWithCount(title: string, count: number): string {
  const plain = title.replace(/^\(\d+\+?\)\s*/, '');
  if (count <= 0) return plain;
  return `(${count > 99 ? '99+' : count}) ${plain}`;
}

/** Puts [count] in the tab's title, and takes it off again when the page goes. */
export function showCountInTitle(count: number): () => void {
  document.title = titleWithCount(document.title, count);
  return () => {
    document.title = titleWithCount(document.title, 0);
  };
}
