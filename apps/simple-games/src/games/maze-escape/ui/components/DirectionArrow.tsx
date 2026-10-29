import type { Direction } from '../../game';
/**
 * The four direction-key arrows as inline SVG, in the voice of
 * ui/components/icons.tsx (24-unit grid, 1.75 stroke, round caps, sized in em):
 * the shared set has a left arrow (IconBack) but no up, down or right, and the
 * text arrows they replace are drawn differently by each platform's webview.
 * Decorative: the key's aria-label names the move.
 */
const SHAPES: Record<Direction, readonly [shaft: string, head: string]> = {
  up: ['M12 19V5', 'm5 12 7-7 7 7'],
  left: ['M19 12H5', 'm12 19-7-7 7-7'],
  down: ['M12 5v14', 'm19 12-7 7-7-7'],
  right: ['M5 12h14', 'm12 5 7 7-7 7'],
};
export function DirectionArrow({ direction }: { direction: Direction }) {
  const [shaft, head] = SHAPES[direction];
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={shaft} />
      <path d={head} />
    </svg>
  );
}
