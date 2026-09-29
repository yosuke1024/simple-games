/**
 * The two marks (docs/BINARY_BALANCE_RULES.md §1, §13): a sun — a filled
 * disc — and a moon — a crescent. Inline SVG rather than characters: a font
 * can substitute ☀ and ☾ for another weight or a fallback face, and the two
 * must read as shapes — never as text to translate — on every device and
 * theme.
 *
 * Shape is the meaning: a disc against a crescent reads without colour. The
 * two fills (`--bn-sun`, `--bn-moon`, binary-balance.css) are game content,
 * the way Minesweeper's numbers are — support that makes the board warmer,
 * not a second signal the meaning rests on — and the cell's warn state
 * overrides both with the warning colour. A given wears an ink outline the
 * player's marks do not (§13), so "fixed" is read from the line itself.
 */
import type { Cell } from '../../game';

export function MarkGlyph({ mark, fixed = false }: { mark: Cell; fixed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={fixed ? 'bn-mark bn-mark-fixed' : 'bn-mark'}
      aria-hidden="true"
      focusable="false"
    >
      {mark === 0 ? (
        <circle className="bn-sun" cx="12" cy="12" r="7.6" />
      ) : (
        // A crescent: the disc of the moon minus a second disc, offset to the
        // upper right, drawn as one path so the outline follows the whole rim.
        <path className="bn-moon" d="M13.4 4.2a8 8 0 1 0 6.4 12.9 6.4 6.4 0 0 1-6.4-12.9z" />
      )}
    </svg>
  );
}
