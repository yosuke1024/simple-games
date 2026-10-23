/** Original silhouettes: geometry is authored here, never an external sprite. */
export function Invader({ kind = 0 }: { kind?: number }) {
  if (kind % 3 === 0)
    return (
      <g>
        <path d="M-10 2-7-5H-3L0-9 3-5H7L10 2 6 8H2V4H-2V8H-6Z" fill="currentColor" />
        <path d="M-5-1h2m6 0h2" stroke="var(--paper)" strokeWidth="2" />
      </g>
    );
  if (kind % 3 === 1)
    return (
      <g>
        <path d="M-11-3-6-7H6L11-3 8 4 11 8H6L3 4H-3L-6 8H-11L-8 4Z" fill="currentColor" />
        <path d="M-5-1h3m4 0h3" stroke="var(--paper)" strokeWidth="2" />
      </g>
    );
  return (
    <g>
      <path d="M0-9 5-5 9-6 11 1 7 7 3 5 0 8-3 5-7 7-11 1-9-6-5-5Z" fill="currentColor" />
      <path d="M-5 0h3m4 0h3" stroke="var(--paper)" strokeWidth="2" />
    </g>
  );
}
export function Ship() {
  return <path d="M0-13 4-6 4-2 12 5 12 10H5L0 7-5 10H-12V5L-4-2V-6Z" fill="currentColor" />;
}
