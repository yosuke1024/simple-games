/**
 * The app's icon set: a handful of inline SVGs so every platform draws the
 * same glyphs (text arrows and dingbats render differently per OS webview).
 *
 * All icons share one voice: 24-unit grid, 1.75 stroke, round caps. They size
 * with the surrounding font-size (1em) so existing icon slots keep working.
 * Decorative by default (aria-hidden); a labelled parent button names them.
 *
 * App-local on purpose — promote to packages/brand only when a second title
 * actually needs them.
 */
import type { ReactNode, SVGProps } from 'react';

function Icon({ children, ...props }: { children: ReactNode } & SVGProps<SVGSVGElement>) {
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
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconBack(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </Icon>
  );
}

export function IconRetry(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </Icon>
  );
}

export function IconUndo(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m9 14-5-5 5-5" />
      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
    </Icon>
  );
}

export function IconHint(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.7 10.7c.6.5 1 1.2 1.2 2l.1.8h4.8l.1-.8c.2-.8.6-1.5 1.2-2A6 6 0 0 0 12 3z" />
    </Icon>
  );
}

export function IconAdd(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

export function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function IconCalendar(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 11h18" />
    </Icon>
  );
}

export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </Icon>
  );
}

export function IconGear(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Icon>
  );
}

export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function IconChevronRight(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Icon>
  );
}

/**
 * Favourite: the one mark a pinned item wears in every app anyone has used,
 * which is why it is a star and not a nicer idea of our own. Outlined means
 * "not pinned" and filled means "pinned", so the same glyph says both — but
 * it never says it alone: every control that uses it carries a text label or
 * `aria-pressed` beside it (issue #109).
 */
export function IconStar({
  filled = false,
  ...props
}: { filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path
        d="M12 3 14.12 9.09 20.56 9.22 15.42 13.11 17.29 19.28 12 15.6 6.71 19.28 8.58 13.11 3.44 9.22 9.88 9.09Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </Icon>
  );
}

/**
 * Share: a link leaving the device. The arrow out of an open box is the one
 * share mark both platforms' users read the same way — Android's three-node
 * graph means nothing on iOS, and iOS's own glyph is a system asset we may
 * not draw.
 */
export function IconShare(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M20 14v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5" />
    </Icon>
  );
}

/**
 * Add to Home Screen (issue #110): a rounded tile standing in for an app
 * icon, with a plus inside it. Every launcher's own "add to home screen"
 * reaches for this exact picture, so it is the one glyph that reads as
 * itself without a caption.
 */
export function IconAddToHome(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 9v6" />
      <path d="M9 12h6" />
    </Icon>
  );
}
