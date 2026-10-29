/** Original silhouettes: geometry is authored here, never an external sprite. */
const INVADER_BODIES = [
  'M-10 2-7-5H-3L0-9 3-5H7L10 2 6 8H2V4H-2V8H-6Z',
  'M-11-3-6-7H6L11-3 8 4 11 8H6L3 4H-3L-6 8H-11L-8 4Z',
  'M0-9 5-5 9-6 11 1 7 7 3 5 0 8-3 5-7 7-11 1-9-6-5-5Z',
] as const;
const INVADER_EYES = ['M-5-1h2m6 0h2', 'M-5-1h3m4 0h3', 'M-5 0h3m4 0h3'] as const;
/**
 * Each invader is a cut-out standing on the floor (docs/INVADERS_RULES.md §8): the first
 * path is the same silhouette pushed 1.4 units down, a static cast shadow. It is a plain
 * fill — no filter, no blur — so it costs one more path on a group that already moves
 * every frame, and carries no meaning (the silhouette and the eyes do). The body is drawn in
 * currentColor, so mount it inside the `.iv-enemy` group that supplies the accent.
 */
export function Invader({ kind = 0 }: { kind?: number }) {
  const shape = kind % 3 === 0 ? 0 : kind % 3 === 1 ? 1 : 2;
  return (
    <g>
      <path d={INVADER_BODIES[shape]} transform="translate(0 1.4)" className="iv-shade" />
      <path d={INVADER_BODIES[shape]} fill="currentColor" className="iv-body" />
      <path d={INVADER_EYES[shape]} stroke="var(--paper)" strokeWidth="2" />
    </g>
  );
}
export function Ship() {
  return <path d="M0-13 4-6 4-2 12 5 12 10H5L0 7-5 10H-12V5L-4-2V-6Z" fill="currentColor" />;
}
