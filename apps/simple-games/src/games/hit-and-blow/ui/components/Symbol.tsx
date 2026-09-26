/**
 * The eight symbols (docs/HIT_AND_BLOW_RULES.md §1, §10), drawn inline so
 * the board carries no text to translate. Each one is told apart by its
 * shape first; the fill — `--hb-sym-<index>` in hit-and-blow.css, measured
 * against the surface by ui/contrast.test.ts — is the second signal, never
 * the only one.
 *
 * Decorative by itself: whatever holds a symbol (a slot, a palette button, a
 * history row) carries the spoken name, so the drawing is aria-hidden.
 */
import { SYMBOL_IDS, type SymbolId } from '../../game';

/** One path per symbol, on a 24×24 grid. */
const SHAPES: Readonly<Record<SymbolId, string>> = {
  circle: 'M3 12 A9 9 0 1 0 21 12 A9 9 0 1 0 3 12 Z',
  triangle: 'M12 2.6 L21.8 20.4 H2.2 Z',
  square: 'M4.5 4.5 H19.5 V19.5 H4.5 Z',
  diamond: 'M12 1.8 L22.2 12 L12 22.2 L1.8 12 Z',
  star: 'M12 2.6 L14.53 9.32 L21.7 9.65 L16.09 14.13 L18 21.05 L12 17.1 L6 21.05 L7.91 14.13 L2.3 9.65 L9.47 9.32 Z',
  cross: 'M9 2.5 H15 V9 H21.5 V15 H15 V21.5 H9 V15 H2.5 V9 H9 Z',
  hexagon: 'M12 2 L20.66 7 L20.66 17 L12 22 L3.34 17 L3.34 7 Z',
  heart:
    'M12 21.2 C11.4 20.8 2.8 15.4 2.8 9.2 A4.9 4.9 0 0 1 12 6.8 A4.9 4.9 0 0 1 21.2 9.2 C21.2 15.4 12.6 20.8 12 21.2 Z',
};

export interface SymbolGlyphProps {
  /** The symbol's index (§1). */
  symbol: number;
  className?: string;
}

export function SymbolGlyph({ symbol, className }: SymbolGlyphProps) {
  const id = SYMBOL_IDS[symbol];
  if (id === undefined) return null;
  return (
    <svg
      className={`hb-symbol${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-symbol={id}
    >
      <path d={SHAPES[id]} fill={`var(--hb-sym-${symbol})`} />
    </svg>
  );
}

/**
 * The catalog key naming each symbol, for screen readers (§1). Written out
 * rather than assembled, so every key is visible to a grep and the type
 * checker.
 */
const SYMBOL_KEY = {
  circle: 'hitAndBlowSymbol_circle',
  triangle: 'hitAndBlowSymbol_triangle',
  square: 'hitAndBlowSymbol_square',
  diamond: 'hitAndBlowSymbol_diamond',
  star: 'hitAndBlowSymbol_star',
  cross: 'hitAndBlowSymbol_cross',
  hexagon: 'hitAndBlowSymbol_hexagon',
  heart: 'hitAndBlowSymbol_heart',
} as const satisfies Record<SymbolId, string>;

/** The i18n key naming the symbol at `symbol` (an index, §1). */
export const symbolKey = (symbol: number) => SYMBOL_KEY[SYMBOL_IDS[symbol] ?? 'circle'];
