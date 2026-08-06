/**
 * The tube rack (docs/WATER_SORT_RULES.md §1, §3, §12).
 *
 * Every tube is one button: the first tap selects a source (lifted, not just
 * recolored — §12), the second picks the destination. The screen owns that
 * little state machine; the board only draws and reports taps.
 *
 * Two things here are about looking like liquid rather than like stacked
 * boxes. The rack is a grid whose column count comes from the tube count, so
 * the glasses grow to fill the screen instead of sitting at one hard-coded
 * size. And each unit knows whether its neighbours share its colour, so a run
 * of the same colour is drawn as one body of water — rounded only where the
 * colour actually ends, and at the tube's floor.
 *
 * A tube read aloud gives its number and contents, so the board works without
 * any of that.
 */
import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { isTubeComplete, type Pour, type Tubes } from '../../game';

/**
 * Above this, the rack goes to two rows. Two rows of fat tubes fill a phone
 * far better than one row of thin ones, and a tube has to look like a vessel
 * you could pour from — that is mostly a question of how wide it gets.
 */
const MAX_SINGLE_ROW = 4;

/**
 * A pour that just happened, for the look of it only (§12). The board state
 * has already changed — this replays the gesture on top of it: the source
 * lifts, carries over to the destination's mouth, tips, pours, and comes
 * back.
 *
 * `parity` flips on every pour so that pouring twice from the same tube
 * replays the animation; a CSS animation only restarts when the class list
 * actually changes.
 */
export interface PourEffect {
  readonly from: number;
  readonly to: number;
  readonly dir: 'left' | 'right';
  readonly parity: 0 | 1;
}

/** How far the tube tips over the destination. */
const TIP_DEGREES = 62;
/** Where the tipped mouth hovers above the destination's rim. */
const MOUTH_CLEARANCE_PX = 16;

/**
 * The measured shape of one pour: how far the source has to travel, and how
 * far to turn, to get its mouth over the destination.
 */
interface PourGeometry {
  readonly tx: number;
  readonly ty: number;
  readonly rot: number;
  readonly parity: 0 | 1;
}

/**
 * Works out that shape from the live layout. The tube turns about its own
 * foot, so its mouth swings out on an arc — the translation is whatever puts
 * the far end of that arc over the destination. Measured rather than guessed
 * because the rack reflows with the tube count and the screen size.
 */
function measurePour(rack: HTMLElement, pour: PourEffect): PourGeometry | null {
  const source = rack.querySelector<HTMLElement>(`[data-tube="${pour.from}"] .ws-tube-glass`);
  const dest = rack.querySelector<HTMLElement>(`[data-tube="${pour.to}"] .ws-tube-glass`);
  if (!source || !dest) return null;

  const from = source.getBoundingClientRect();
  const to = dest.getBoundingClientRect();

  const sign = pour.dir === 'right' ? 1 : -1;
  const radians = (TIP_DEGREES * Math.PI) / 180;
  const height = from.height;

  // The foot stays put and the mouth swings to here:
  const footX = from.left + from.width / 2;
  const footY = from.bottom;
  const mouthX = footX + sign * height * Math.sin(radians);
  const mouthY = footY - height * Math.cos(radians);

  // …and we want the mouth over the destination's rim instead.
  const targetX = to.left + to.width / 2;
  const targetY = to.top - MOUTH_CLEARANCE_PX;

  return {
    tx: targetX - mouthX,
    ty: targetY - mouthY,
    rot: sign * TIP_DEGREES,
    parity: pour.parity,
  };
}

export interface WaterBoardProps {
  tubes: Tubes;
  selected: number | null;
  /** The solver's suggestion to highlight, or null (§8). */
  hint: Pour | null;
  pour: PourEffect | null;
  onTubeTap: (index: number) => void;
}

export const WaterBoard = memo(function WaterBoard({
  tubes,
  selected,
  hint,
  pour,
  onTubeTap,
}: WaterBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const rackRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<PourGeometry | null>(null);

  const rows = tubes.length <= MAX_SINGLE_ROW ? 1 : 2;
  const cols = Math.ceil(tubes.length / rows);

  // Measured after the board has laid out with the new water, and before
  // paint, so the tube starts moving on the very first frame.
  useLayoutEffect(() => {
    if (!pour || reducedMotion || !rackRef.current) {
      setGeometry(null);
      return;
    }
    setGeometry(measurePour(rackRef.current, pour));
  }, [pour, reducedMotion]);

  const pouring = geometry !== null && pour !== null;

  return (
    <div
      ref={rackRef}
      className={`ws-rack ${reducedMotion ? 'ws-rack-still' : ''}`}
      style={{ '--ws-cols': cols, '--ws-rows': rows } as CSSProperties}
      role="group"
      aria-label={t('waterBoardLabel')}
    >
      {tubes.map((tube, index) => {
        // Colors are announced 1-based: "color 0" reads like an error.
        const contents =
          tube.length === 0 ? t('waterTubeEmpty') : tube.map((color) => color + 1).join(' ');
        // The carry only plays on the tube that poured, and only while
        // Reduced Motion is off (§12).
        const tipping = pouring && pour.from === index;
        const classes = [
          'ws-tube',
          selected === index ? 'ws-tube-selected' : '',
          hint?.from === index ? 'ws-tube-hint' : '',
          hint?.to === index ? 'ws-tube-hint' : '',
          isTubeComplete(tube) ? 'ws-tube-complete' : '',
          tipping ? `ws-tip-${geometry.parity}` : '',
        ]
          .filter(Boolean)
          .join(' ');

        // Water that has just landed here: the whole top run of the
        // destination, so a two-unit pour arrives together.
        const arrival =
          pouring && pour.to === index && tube.length > 0
            ? { color: tube[tube.length - 1]!, parity: geometry.parity }
            : null;

        return (
          <button
            key={index}
            type="button"
            data-tube={index}
            className={classes}
            style={
              tipping
                ? ({
                    '--ws-tx': `${geometry.tx}px`,
                    '--ws-ty': `${geometry.ty}px`,
                    '--ws-rot': `${geometry.rot}deg`,
                  } as CSSProperties)
                : undefined
            }
            aria-label={t('waterTubeLabel', { n: index + 1, colors: contents })}
            aria-pressed={selected === index}
            onClick={() => onTubeTap(index)}
          >
            <span className="ws-tube-glass">
              {tube.map((color, height) => {
                // Only the surface of a run is marked (a lit edge and the
                // colour's symbol), so a run reads as one body of water
                // rather than as stacked tiles.
                const capTop = height === tube.length - 1 || tube[height + 1] !== color;
                // Part of the run that just landed: everything from the
                // surface down to where the colour changes.
                const arriving =
                  arrival !== null &&
                  color === arrival.color &&
                  tube.slice(height).every((above) => above === arrival.color);
                const unitClasses = [
                  'ws-unit',
                  `ws-color-${color}`,
                  capTop ? 'ws-unit-top' : '',
                  height === 0 ? 'ws-unit-floor' : '',
                  arriving ? `ws-unit-arrive-${arrival.parity}` : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return <span key={height} className={unitClasses} />;
              })}
              {/* The glass itself: rim, and a single light stripe down the
                  left side so the tube reads as round (§12). */}
              <span className="ws-glass-shine" aria-hidden="true" />
            </span>
          </button>
        );
      })}
    </div>
  );
});
