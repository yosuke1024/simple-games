/**
 * The tile classes a Crown Grid cell needs (docs/CROWN_GRID_RULES.md §13): a
 * side is a boundary when the neighbour in that direction is a different
 * region or off the board — the board's own edge counts as a boundary too, so
 * the outer rim rounds the same way an inter-region edge does — and a corner
 * is convex, and so rounded, exactly where both sides that meet there are
 * boundaries. A concave corner is never rounded on its own cell; the
 * neighbouring tile that IS convex there draws the notch.
 *
 * Shared by the real board (`CrownGridBoard`) and the Quick Rules figure
 * (`TutorialScreen`, §12), which draws the same cells at a fixed size from a
 * different region lookup, so the two can never drift apart.
 */
export function tileClasses(
  index: number,
  size: number,
  regionAt: (index: number) => number,
): string[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const own = regionAt(index);
  const top = row === 0 || regionAt(index - size) !== own;
  const right = col === size - 1 || regionAt(index + 1) !== own;
  const bottom = row === size - 1 || regionAt(index + size) !== own;
  const left = col === 0 || regionAt(index - 1) !== own;
  return [
    top ? 'cg-b-t' : '',
    right ? 'cg-b-r' : '',
    bottom ? 'cg-b-b' : '',
    left ? 'cg-b-l' : '',
    top && left ? 'cg-c-tl' : '',
    top && right ? 'cg-c-tr' : '',
    bottom && right ? 'cg-c-br' : '',
    bottom && left ? 'cg-c-bl' : '',
  ].filter(Boolean);
}
