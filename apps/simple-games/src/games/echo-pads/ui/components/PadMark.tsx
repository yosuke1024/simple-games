/**
 * The six pad marks as inline SVG (docs/ECHO_PADS_RULES.md §11): circle,
 * triangle, square, star, diamond, cross — the shape is what tells a pad
 * apart, so every mark has a distinct outline at any size, and none of them
 * is text. Drawn in `currentColor`; the pad decides the colour and whether
 * the mark is outlined (dark) or filled (lit).
 */
import type { PadMark as Mark } from '../../game';

const STAR =
  'M12 2.6 L14.75 8.6 L21.3 9.3 L16.4 13.75 L17.8 20.2 L12 16.9 L6.2 20.2 L7.6 13.75 L2.7 9.3 L9.25 8.6 Z';

function shape(mark: Mark) {
  switch (mark) {
    case 'circle':
      return <circle cx="12" cy="12" r="8.2" />;
    case 'triangle':
      return <path d="M12 3.4 L21 19.6 H3 Z" />;
    case 'square':
      return <rect x="4.4" y="4.4" width="15.2" height="15.2" />;
    case 'star':
      return <path d={STAR} />;
    case 'diamond':
      return <path d="M12 2.4 L21.6 12 L12 21.6 L2.4 12 Z" />;
    case 'cross':
      return <path d="M8.9 3.2 H15.1 V8.9 H20.8 V15.1 H15.1 V20.8 H8.9 V15.1 H3.2 V8.9 H8.9 Z" />;
  }
}

export function PadMark({ mark, className }: { mark: Mark; className?: string }) {
  return (
    <svg
      className={`ep-mark ${className ?? ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      data-mark={mark}
    >
      {shape(mark)}
    </svg>
  );
}
