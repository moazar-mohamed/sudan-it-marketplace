// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { labelTableCells } from './tableLabels';

describe('labelTableCells', () => {
  it('copies each heading onto the cells of its column', () => {
    document.body.innerHTML = `
      <table class="data">
        <thead><tr><th>Name</th><th>Status</th><th></th></tr></thead>
        <tbody><tr><td>A</td><td>Active</td><td><button>Open</button></td></tr></tbody>
      </table>`;
    const table = document.querySelector('table')!;
    labelTableCells(table);
    const cells = table.querySelectorAll('td');
    expect(cells[0].getAttribute('data-label')).toBe('Name');
    expect(cells[1].getAttribute('data-label')).toBe('Status');
    // A column without a heading (row actions) gets no label.
    expect(cells[2].hasAttribute('data-label')).toBe(false);
  });
});
