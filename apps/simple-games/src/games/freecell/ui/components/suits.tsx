/**
 * The four suit marks (docs/FREECELL_RULES.md §1): filled SVG shapes drawn
 * in-app so every platform renders the same silhouettes (text suit glyphs
 * render differently per OS webview — the same reason the shell has
 * icons.tsx). Shape tells the suits apart; the red/black coloring is the
 * aid, never the identity (§1).
 */
import type { ReactNode } from 'react';
import type { Suit } from '../../game';

const SHAPES: readonly ReactNode[] = [
  // 0 spade
  <path
    key="s"
    d="M12 3C9.8 6.2 5 9.2 5 12.8c0 2 1.6 3.6 3.6 3.6 1 0 1.9-.4 2.5-1-.3 1.8-1 3.1-2.1 4.1V21h6v-1.5c-1.1-1-1.8-2.3-2.1-4.1.6.6 1.5 1 2.5 1 2 0 3.6-1.6 3.6-3.6C19 9.2 14.2 6.2 12 3z"
  />,
  // 1 heart
  <path
    key="s"
    d="M12 20.5S4 15.2 4 9.9C4 7.2 6.1 5 8.7 5c1.4 0 2.6.6 3.3 1.7C12.7 5.6 14 5 15.3 5 17.9 5 20 7.2 20 9.9c0 5.3-8 10.6-8 10.6z"
  />,
  // 2 diamond
  <path key="s" d="M12 2.8 19 12l-7 9.2L5 12z" />,
  // 3 club
  <path
    key="s"
    d="M12 3a3.4 3.4 0 0 0-3.4 3.4c0 .8.3 1.5.7 2.1a3.4 3.4 0 1 0 1.6 6.3c-.2 1.9-.9 3.3-2 4.3V21h6.2v-1.9c-1.1-1-1.8-2.4-2-4.3a3.4 3.4 0 1 0 1.6-6.3c.4-.6.7-1.3.7-2.1A3.4 3.4 0 0 0 12 3z"
  />,
];

export interface SuitIconProps {
  suit: Suit;
}

export function SuitIcon({ suit }: SuitIconProps) {
  return (
    <svg
      className="fc-suit"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[suit]}
    </svg>
  );
}
