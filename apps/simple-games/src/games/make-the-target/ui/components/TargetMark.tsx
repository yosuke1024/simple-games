/**
 * The small target the board puts before the number to make
 * (docs/MAKE_THE_TARGET_RULES.md §1): two rings and a dot, drawn in the
 * current ink. With the heavier frame, it is what tells the target from a
 * tile without colour (§12). Decoration only — the number's spoken name says
 * what it is.
 */
export function TargetMark() {
  return (
    <svg className="tg-target-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </svg>
  );
}
