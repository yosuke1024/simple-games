/**
 * The Quick Rules figures (docs/OVERTAKE_RULES.md §10): the route a figure
 * teaches never runs through traffic, and the figures follow the OS's dark
 * mode as the board does (§11「描画とループ」).
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas2d } from '@/test/lifecycle';
import { RaceFigure, figureScene, type FigureKind } from './RaceFigure';

/** Half the dotted line's width, logical px. */
const HALF_LINE = 1.5;

describe('the figures teach no Bump', () => {
  const kinds: FigureKind[] = ['lanes', 'ease', 'finish'];

  it.each(kinds)('%s: the route crosses no traffic', (kind) => {
    const scene = figureScene(kind);
    if (scene.route === null) return;
    const traffic = scene.cars.filter((car) => car.look === 'traffic');
    const hits: string[] = [];
    for (let i = 1; i < scene.route.length; i++) {
      const [x1, y1] = scene.route[i - 1]!;
      const [x2, y2] = scene.route[i]!;
      const samples = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 4);
      for (let k = 0; k <= samples; k++) {
        const x = x1 + ((x2 - x1) * k) / samples;
        const y = y1 + ((y2 - y1) * k) / samples;
        for (const car of traffic) {
          const left = car.centreX - car.width / 2 - HALF_LINE;
          const right = car.centreX + car.width / 2 + HALF_LINE;
          const top = car.frontY - HALF_LINE;
          const bottom = car.frontY + car.length + HALF_LINE;
          if (x > left && x < right && y > top && y < bottom) {
            hits.push(
              `(${x.toFixed(1)}, ${y.toFixed(1)}) in the car at ${car.centreX}, ${car.frontY}`,
            );
          }
        }
      }
    }
    expect(hits.slice(0, 3)).toEqual([]);
  });

  it('ease: the route ends in the far wall’s gap, past the near wall’s front', () => {
    const scene = figureScene('ease');
    const route = scene.route!;
    const end = route[route.length - 1]!;
    const fronts = [
      ...new Set(scene.cars.filter((c) => c.look === 'traffic').map((c) => c.frontY)),
    ];
    const far = Math.min(...fronts);
    const near = Math.max(...fronts);
    // The arrow's tip sits level with the far wall, the turn above the near one.
    expect(end[1]).toBeLessThan(far + 58);
    expect(route.some(([, y]) => y < near && y > far + 58)).toBe(true);
  });
});

describe('the figure follows the colour scheme', () => {
  let listeners: Array<() => void> = [];
  let restoreCanvas: () => void = () => undefined;
  const original = window.matchMedia;

  beforeEach(() => {
    listeners = [];
    restoreCanvas = stubCanvas2d();
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: (_type: string, listener: () => void) => {
        listeners = listeners.filter((l) => l !== listener);
      },
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
    restoreCanvas();
    window.matchMedia = original;
  });

  it('repaints when the OS flips dark mode, and lets go of the listener on unmount', () => {
    const view = render(<RaceFigure kind="ease" />);
    expect(listeners).toHaveLength(1);
    const canvas = view.container.querySelector('canvas')!;
    const spy = vi.spyOn(canvas, 'width', 'set');
    listeners[0]!();
    expect(spy).toHaveBeenCalled();
    view.unmount();
    expect(listeners).toHaveLength(0);
  });
});
