/**
 * The gem kinds as game content (docs/GEM_SWAP_RULES.md §10): kind index →
 * cut silhouette. The SVG paths and the colour tokens belong to the UI; the
 * order lives here because it is part of what a seed means — kind 2 is
 * always the drop. The heart is last, so it appears only on six-colour
 * boards (§10: it can read as a "like" symbol, and the other five cuts are
 * enough for Easy).
 *
 * None of these is one of Bubble Pop's six marks (circle, triangle, square,
 * diamond, star, crescent).
 */
export const GEM_SHAPES = ['hexagon', 'octagon', 'pear', 'marquise', 'shield', 'heart'] as const;

export type GemShape = (typeof GEM_SHAPES)[number];

export const gemShape = (kind: number): GemShape | null => GEM_SHAPES[kind] ?? null;
