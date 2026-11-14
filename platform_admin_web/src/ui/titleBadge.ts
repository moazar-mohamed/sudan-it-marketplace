/*
 * The browser tab's title: the page's own name, with "(3)" in front while
 * three records need attention, so a tab left in the background still says so.
 * The language provider sets the name; the layout sets the number.
 */

let base = '';
let badge = 0;

const render = () => {
  document.title = badge > 0 ? `(${badge}) ${base}` : base;
};

export function setBaseTitle(title: string): void {
  base = title;
  render();
}

export function setTitleBadge(count: number): void {
  badge = Math.max(0, Math.floor(count));
  render();
}
