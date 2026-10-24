/**
 * The pads (docs/ECHO_PADS_RULES.md §1, §5, §11): four in 2 × 2 or six in
 * 2 rows × 3 columns, the same arrangement in every orientation. Each pad is
 * a `<button>` read out as its mark and position; a lit pad changes in
 * lightness (the accent fill) AND in shape (its mark turns solid and larger),
 * never in hue alone and never red. After a miss, the pad that came next
 * wears a dashed ring and says so in its name (§5) — no time limit on that.
 *
 * Presses arrive through `onClick` only — one path for a finger, a mouse and
 * a key on a focused pad — so a press holds nothing a `pointercancel` would
 * have to release (src/test/pointerContractWiring.test.ts asks for a cancel
 * only where a board hears `onPointerDown`). The instant feedback a finger
 * wants comes from the `:active` style; the light itself follows the press.
 *
 * The same component draws the Quick Rules figures (`figure`): then nothing
 * is a button and the whole board is hidden from assistive technology.
 */
import { PAD_GRID, type PadCount } from '../../game';
import { markOf, padName, type Translate } from '../labels';
import { PadMark } from './PadMark';

export interface PadBoardProps {
  padCount: PadCount;
  litPad: number | null;
  /** The pad that came next, after a miss (§5); null otherwise. */
  expectedPad?: number | null;
  /** Whether a press counts right now (§5); pads stay focusable either way. */
  pressable?: boolean;
  onPress?: (pad: number) => void;
  t?: Translate;
  /** A Quick Rules picture: no buttons, nothing read out. */
  figure?: boolean;
}

export function PadBoard({
  padCount,
  litPad,
  expectedPad = null,
  pressable = false,
  onPress,
  t,
  figure = false,
}: PadBoardProps) {
  const { cols } = PAD_GRID[padCount];
  const pads = Array.from({ length: padCount }, (_, pad) => pad);
  const className = `ep-board ep-board-${cols}`;

  if (figure || !t) {
    return (
      <div className={`${className} ep-board-figure`} aria-hidden="true">
        {pads.map((pad) => (
          <span key={pad} className={`ep-pad ${pad === litPad ? 'ep-pad-lit' : ''}`} data-pad={pad}>
            <PadMark mark={markOf(pad)} />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={className} role="group" aria-label={t('echoPadsPadsLabel')}>
      {pads.map((pad) => {
        const name = padName(t, padCount, pad);
        const expected = pad === expectedPad;
        return (
          <button
            key={pad}
            type="button"
            className={`ep-pad ${pad === litPad ? 'ep-pad-lit' : ''} ${expected ? 'ep-pad-expected' : ''}`}
            data-pad={pad}
            aria-label={expected ? t('echoPadsExpectedLabel', { pad: name }) : name}
            aria-disabled={!pressable}
            onClick={() => onPress?.(pad)}
          >
            <PadMark mark={markOf(pad)} />
          </button>
        );
      })}
    </div>
  );
}
