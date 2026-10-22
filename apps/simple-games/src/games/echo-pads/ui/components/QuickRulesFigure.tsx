/**
 * The three Quick Rules pictures (docs/ECHO_PADS_RULES.md §10), drawn with the
 * game's own pad board (`PadBoard` in its `figure` form) so each shows a
 * position the game can actually be in, and an order strip of the marks the
 * round plays. No text: the strip's steps are told apart by the marks and by
 * the one that is current. The whole picture is decorative — the sentence
 * under it says what it shows.
 *
 * 1. ▶ was pressed: the triangle (top right) is lit, the first of three.
 * 2. The player's turn: the second press, the circle, lit as it is tapped.
 * 3. Returned: the next round plays the same three and one more.
 */
import { markOf } from '../labels';
import { PadBoard } from './PadBoard';
import { PadMark } from './PadMark';

const ORDER = [1, 0, 3] as const;

function Strip({ pads, current }: { pads: readonly number[]; current: number | null }) {
  return (
    <span className="ep-strip">
      {pads.map((pad, index) => (
        <span
          key={index}
          className={`ep-strip-step ${index === current ? 'ep-strip-current' : ''} ${
            current !== null && index < current ? 'ep-strip-done' : ''
          }`}
        >
          <PadMark mark={markOf(pad)} />
        </span>
      ))}
    </span>
  );
}

export function QuickRulesFigure({ step }: { step: number }) {
  const lit = step === 0 ? ORDER[0] : step === 1 ? ORDER[1] : null;
  return (
    <div className="ep-figure" aria-hidden="true">
      {step === 2 ? (
        <span className="ep-figure-rounds">
          <Strip pads={ORDER} current={null} />
          <Strip pads={[...ORDER, 2]} current={3} />
        </span>
      ) : (
        <Strip pads={ORDER} current={step === 0 ? 0 : 1} />
      )}
      {step === 0 ? (
        <span className="ep-figure-play">
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M8 5 L19 12 L8 19 Z" />
          </svg>
        </span>
      ) : null}
      <PadBoard padCount={4} litPad={lit} figure />
    </div>
  );
}
