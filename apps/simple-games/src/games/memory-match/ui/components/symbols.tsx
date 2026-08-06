/**
 * The card faces (docs/MEMORY_MATCH_RULES.md §1): fifteen filled SVG shapes,
 * drawn in-app so every platform renders the same silhouettes (text dingbats
 * differ per OS webview — the same reason the shell has icons.tsx).
 *
 * Shape is the identity and colour is the aid, never the other way around
 * (§1): no two symbols share a silhouette, so the board works in monochrome.
 * Colours live in memory-match.css (`.mm-symbol-<n>`), light and dark.
 *
 * Screen readers identify a symbol by its number (§12): a shape name would be
 * a translated string in fourteen locales for a detail sighted players never
 * see named.
 */
import type { ReactNode } from 'react';

const SHAPES: readonly ReactNode[] = [
  // 0 circle
  <circle key="s" cx="12" cy="12" r="7.5" />,
  // 1 square
  <rect key="s" x="5" y="5" width="14" height="14" rx="2.5" />,
  // 2 triangle
  <path key="s" d="M12 4.5 20 19.5H4z" />,
  // 3 diamond
  <path key="s" d="M12 3.5 20.5 12 12 20.5 3.5 12z" />,
  // 4 star
  <path
    key="s"
    d="m12 3.5 2.47 5.53 6.03.6-4.53 4.02 1.3 5.92L12 16.5l-5.27 3.07 1.3-5.92L3.5 9.63l6.03-.6z"
  />,
  // 5 heart
  <path
    key="s"
    d="M12 20.5S4 15.2 4 9.9C4 7.2 6.1 5 8.7 5c1.4 0 2.6.6 3.3 1.7C12.7 5.6 14 5 15.3 5 17.9 5 20 7.2 20 9.9c0 5.3-8 10.6-8 10.6z"
  />,
  // 6 crescent moon
  <path key="s" d="M14.5 3.6a9 9 0 1 0 5.9 11.8A7.5 7.5 0 0 1 14.5 3.6z" />,
  // 7 sun
  <path
    key="s"
    d="M12 7.4A4.6 4.6 0 1 1 12 16.6 4.6 4.6 0 0 1 12 7.4zM11 2h2v3h-2zm0 17h2v3h-2zM2 11h3v2H2zm17 0h3v2h-3zM4.9 6.3 6.3 4.9l2.1 2.1-1.4 1.4zm10.7 10.7 1.4-1.4 2.1 2.1-1.4 1.4zm1.4-9.6-1.4-1.4 2.1-2.1 1.4 1.4zM6.3 19.1l-1.4-1.4 2.1-2.1 1.4 1.4z"
  />,
  // 8 drop
  <path key="s" d="M12 3.5s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z" />,
  // 9 leaf
  <path
    key="s"
    d="M19.5 4.5C10 4.5 4.5 9.5 4.5 15.5c0 2.2 1.3 4 4 4 6.5 0 11-6.5 11-15zM6.8 17.6c2.6-4.4 6-7.6 9.7-9.9-4.8 1.4-8.4 4.6-10.6 9.2z"
  />,
  // 10 musical note
  <path key="s" d="M9 4.5 19 3v10.6a3.2 3.2 0 1 1-2-2.97V7.2l-6 .9v8.5A3.2 3.2 0 1 1 9 13.6z" />,
  // 11 lightning bolt
  <path key="s" d="M13.5 3 5.5 13.5H11L9.5 21l8-10.5H12z" />,
  // 12 hexagon
  <path key="s" d="M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6z" />,
  // 13 ring
  <path
    key="s"
    fillRule="evenodd"
    d="M12 3.8a8.2 8.2 0 1 1 0 16.4 8.2 8.2 0 0 1 0-16.4zm0 4.4a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z"
  />,
  // 14 plus
  <path key="s" d="M9.4 3.5h5.2v5.9h5.9v5.2h-5.9v5.9H9.4v-5.9H3.5V9.4h5.9z" />,
];

export interface MemorySymbolProps {
  /** Symbol index, 0..SYMBOL_COUNT-1 (game/types.ts). */
  symbol: number;
}

export function MemorySymbol({ symbol }: MemorySymbolProps) {
  return (
    <svg
      className={`mm-symbol mm-symbol-${symbol}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[symbol] ?? SHAPES[0]}
    </svg>
  );
}
