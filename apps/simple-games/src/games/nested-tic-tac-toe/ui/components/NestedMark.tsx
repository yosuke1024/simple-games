/**
 * The two marks, drawn as shapes (docs/NESTED_TIC_TAC_TOE_RULES.md §1, §10):
 * cross = two diagonal strokes, circle = a ring. No character is ever used —
 * the board reads the same in every language, and ✕ is the web's "close".
 * The stroke is `currentColor`, so the role colour (you = accent, CPU = ink)
 * comes from the element it sits in; the shapes differ, so colour is never
 * the only cue. Decorative: the cell's own label names the mark.
 */
import { CROSS, type Mark } from '../../game/types';

export function NestedMark({
  mark,
  className,
  big = false,
}: {
  mark: Mark;
  className?: string;
  /**
   * The mark across a taken board (§10「小盤いっぱい(約 8 割)」): drawn to the
   * edge of its box, round caps and ring stroke included, where a cell's mark
   * keeps a margin. With `.nt-big`'s 80% box that is about 80% of the board.
   */
  big?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ? `nt-mark ${className}` : 'nt-mark'}
      aria-hidden="true"
      focusable="false"
    >
      {mark === CROSS ? (
        <path d={big ? 'M1.5 1.5 22.5 22.5M22.5 1.5 1.5 22.5' : 'M5 5 19 19M19 5 5 19'} />
      ) : (
        <circle cx="12" cy="12" r={big ? 10.5 : 7.5} />
      )}
    </svg>
  );
}
