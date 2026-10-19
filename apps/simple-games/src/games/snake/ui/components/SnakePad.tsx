/**
 * The on-screen controls under the board (docs/SNAKE_RULES.md §13「操作」):
 * four direction buttons in a cross, and in its middle the one button that
 * starts, pauses and resumes the run. The path that needs nothing but taps,
 * and — being named buttons — the one a screen reader or a switch can press.
 *
 * A direction enters on the PRESS, not the release: a tap lasts long enough
 * that waiting for the click would be a tick late at Fast (100ms), the same
 * reason the swipe enters on its move (§13). The click a tap leaves behind is
 * then spent rather than played twice — but only a click that a press just
 * armed (`event.detail > 0` and within a second of it,
 * docs/ARCHITECTURE.md「押下の記録は誰のものか」). A keyboard or assistive
 * activation arrives as a click with no press before it, and plays.
 *
 * The buttons do not take focus from a mouse press: on a PC the Space bar is
 * Pause (§13), and a direction button left focused by a click would answer
 * Space itself.
 *
 * While the run waits (ready, paused), the direction straight back over the
 * neck does nothing (§5), so its button says so — `aria-disabled` and a
 * dashed outline, not only a fainter colour. While running it stays enabled:
 * what is straight back then depends on the queue and would flicker every
 * tick.
 *
 * The middle button is the board's only Start / Resume — nothing is laid
 * over the board (§13) — so it names its keys (`aria-keyshortcuts`: Space
 * and P do the same, §13「キーボード」), and the screen hands it focus when the
 * control that had focus goes away (a result card's retry, GameScreen.tsx).
 * The group is named for all five buttons, not for the four directions.
 */
import {
  memo,
  useCallback,
  useRef,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { OPPOSITE, type Direction, type RunStatus } from '../../game';

/** A click this long after its own press is not that press's trailing click. */
const TRAILING_CLICK_MS = 1000;

export interface SnakePadProps {
  status: RunStatus;
  /** The way the head faces, which decides the one direction that does nothing while waiting. */
  direction: Direction;
  onSteer: (direction: Direction) => void;
  onToggle: () => void;
  /** The Start / Pause / Resume button, for the screen to move focus to. */
  toggleRef?: RefObject<HTMLButtonElement | null>;
}

const ARROW_PATHS: Readonly<Record<Direction, string>> = {
  up: 'M12 6l7 9H5z',
  down: 'M12 18l-7-9h14z',
  left: 'M6 12l9-7v14z',
  right: 'M18 12l-9 7V5z',
};

function ArrowGlyph({ direction }: { direction: Direction }) {
  return (
    <svg className="sn-pad-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ARROW_PATHS[direction]} />
    </svg>
  );
}

function ToggleGlyph({ running }: { running: boolean }) {
  return (
    <svg className="sn-pad-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {running ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5l11 7-11 7z" />}
    </svg>
  );
}

interface DirectionButtonProps {
  direction: Direction;
  label: string;
  inert: boolean;
  onSteer: (direction: Direction) => void;
}

function DirectionButton({ direction, label, inert, onSteer }: DirectionButtonProps) {
  /** When this button's own press last entered its direction, or null. */
  const pressedAtRef = useRef<number | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pressedAtRef.current = performance.now();
    onSteer(direction);
  };

  /** The platform took the finger away: no click is coming, so nothing stays armed. */
  const onPointerCancel = () => {
    pressedAtRef.current = null;
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    const pressedAt = pressedAtRef.current;
    pressedAtRef.current = null;
    if (
      event.detail > 0 &&
      pressedAt !== null &&
      performance.now() - pressedAt < TRAILING_CLICK_MS
    ) {
      return;
    }
    onSteer(direction);
  };

  return (
    <button
      type="button"
      className={`sn-pad-btn sn-pad-${direction}${inert ? ' sn-pad-off' : ''}`}
      aria-label={label}
      aria-disabled={inert ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onPointerCancel={onPointerCancel}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <ArrowGlyph direction={direction} />
    </button>
  );
}

export const SnakePad = memo(function SnakePad({
  status,
  direction,
  onSteer,
  onToggle,
  toggleRef,
}: SnakePadProps) {
  const { t } = useSettings();
  const waiting = status === 'ready' || status === 'paused';
  const ended = status === 'over' || status === 'cleared';
  const back = OPPOSITE[direction];
  const steer = useCallback((next: Direction) => onSteer(next), [onSteer]);

  const toggleLabel =
    status === 'running' ? t('snakePause') : status === 'paused' ? t('resume') : t('snakeStart');

  const button = (dir: Direction) => (
    <DirectionButton
      direction={dir}
      label={t(`snakeDir_${dir}`)}
      inert={waiting && dir === back}
      onSteer={steer}
    />
  );

  return (
    <div className="sn-pad" role="group" aria-label={t('snakeControls')}>
      {button('up')}
      {button('left')}
      <button
        ref={toggleRef}
        type="button"
        className="sn-pad-btn sn-pad-toggle"
        aria-label={toggleLabel}
        aria-keyshortcuts="Space P"
        disabled={ended}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
      >
        <ToggleGlyph running={status === 'running'} />
      </button>
      {button('right')}
      {button('down')}
    </div>
  );
});
