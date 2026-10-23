import type { SVGProps } from 'react';
import { KnightArtwork } from '@/ui/components/KnightArtwork';

/** The same SVG artwork and physical colours as Chess, never a font glyph. */
export function KnightPiece({ className = '', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      className={`kt-piece ${className}`.trim()}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <KnightArtwork />
    </svg>
  );
}
