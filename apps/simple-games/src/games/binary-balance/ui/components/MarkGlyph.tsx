/**
 * The two marks (docs/BINARY_BALANCE_RULES.md §1, §13), drawn as inline SVG
 * rather than as characters: a font can substitute ○ and □ for a different
 * weight or a fallback face, and the two must read as shapes — never as text
 * to translate — on every device and theme.
 *
 * Shape is the meaning; the stroke weight is the one other thing a mark says.
 * A given is drawn heavier than a mark the player wrote (§13), so "fixed" is
 * read from the line itself rather than from a colour.
 *
 * `currentColor` so the ink follows the cell's own colour (the ink, or the
 * warning colour on a mark that breaks a rule) without knowing about either.
 */
import type { Cell } from '../../game';

export function MarkGlyph({ mark, fixed = false }: { mark: Cell; fixed?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={fixed ? 3.4 : 2.1}
      aria-hidden="true"
      focusable="false"
    >
      {mark === 0 ? (
        <circle cx="12" cy="12" r="7.4" />
      ) : (
        <rect x="5.1" y="5.1" width="13.8" height="13.8" rx="1.4" />
      )}
    </svg>
  );
}
