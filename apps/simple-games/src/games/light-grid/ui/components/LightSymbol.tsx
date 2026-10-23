/** Flat lamp marks shared by the board and the illustrated rules. */
export function LightSymbol({ on }: { on: boolean }) {
  return (
    <svg className="lg-light-symbol" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={on ? 4 : 3} />
      {on ? <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" /> : null}
    </svg>
  );
}
