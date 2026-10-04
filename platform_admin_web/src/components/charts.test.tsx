// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LineChart, Sparkline } from './charts';

afterEach(cleanup);

const points = (container: HTMLElement) =>
  (container.querySelector('.spark__line, .chart__line')!.getAttribute('d') ?? '')
    .split(/(?=[ML])/)
    .map((p) => p.slice(1).split(' ').map(Number));

describe('Sparkline', () => {
  it('draws one point per value, left to right, with the highest value on top', () => {
    const { container } = render(<Sparkline values={[0, 5, 10, 5]} />);
    const pts = points(container);
    expect(pts).toHaveLength(4);
    expect(pts.map((p) => p[0])).toEqual([0, 100 / 3, 200 / 3, 100].map((x) => Number(x.toFixed(2))));
    const ys = pts.map((p) => p[1]);
    expect(ys[2]).toBeLessThan(ys[1]); // 10 is above 5 (smaller y = higher)
    expect(ys[1]).toBe(ys[3]);
    expect(ys[0]).toBeGreaterThan(ys[1]);
  });

  it('draws a flat series along the bottom, inside the box', () => {
    const { container } = render(<Sparkline values={[0, 0, 0]} />);
    const ys = points(container).map((p) => p[1]);
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBeLessThan(100);
  });

  it('is decoration: hidden from assistive technology, and draws nothing for no data', () => {
    const { container } = render(<Sparkline values={[1, 2]} />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    cleanup();
    expect(render(<Sparkline values={[]} />).container.querySelector('svg')).toBeNull();
  });
});

describe('LineChart', () => {
  const show = (values: number[]) =>
    render(
      <LineChart
        values={values}
        pointLabels={values.map((v, i) => `day ${i}: ${v}`)}
        formatAxis={(n) => `#${n}`}
        startLabel="Sep 4"
        endLabel="Today"
        summary="Summary text"
      />,
    );

  it('labels the top, middle and zero of the axis and both ends of the time line', () => {
    show([0, 40, 80]);
    expect(screen.getByText('#80')).toBeTruthy();
    expect(screen.getByText('#40')).toBeTruthy();
    expect(screen.getByText('#0')).toBeTruthy();
    expect(screen.getByText('Sep 4')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('is one picture to a screen reader, described by its summary', () => {
    show([1, 2, 3]);
    expect(screen.getByRole('img', { name: 'Summary text' })).toBeTruthy();
  });

  it('gives every day a point with its own tooltip', () => {
    const { container } = show([5, 0, 9]);
    const dots = [...container.querySelectorAll('.chart__dot')];
    expect(dots.map((d) => d.getAttribute('title'))).toEqual(['day 0: 5', 'day 1: 0', 'day 2: 9']);
  });

  it('shows only the newest dot of a long period until a point is hovered', () => {
    const { container } = show(Array.from({ length: 30 }, (_, i) => i));
    const dots = [...container.querySelectorAll('.chart__dot')];
    expect(dots).toHaveLength(30);
    expect(dots.filter((d) => d.classList.contains('chart__dot--dense'))).toHaveLength(29);
    expect(dots[29].classList.contains('chart__dot--dense')).toBe(false);
  });

  it('is read left to right in either language', () => {
    expect(show([1, 2]).container.querySelector('figure')!.getAttribute('dir')).toBe('ltr');
  });

  it('copes with a period of zeros (axis at zero, no area)', () => {
    const { container } = show([0, 0, 0]);
    expect(screen.getAllByText('#0').length).toBe(3);
    expect(container.querySelector('.chart__line')).not.toBeNull();
  });
});
