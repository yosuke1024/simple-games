import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconRetry } from '@/ui/components/icons';
import type { Action } from '../../game';
const CONTROLS = [
  ['left', 'fallingBlocksLeft'],
  ['rotate', 'fallingBlocksRotate'],
  ['right', 'fallingBlocksRight'],
  ['softDrop', 'fallingBlocksSoftDrop'],
  ['hardDrop', 'fallingBlocksHardDrop'],
] as const;

/**
 * Hard drop: an arrow onto a floor. The shell's icon set has no such glyph and
 * one title needs it, so it stays here in the set's voice (24 grid, 1.75
 * stroke, round caps) instead of being promoted to icons.tsx.
 */
function IconDrop() {
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
    >
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

/**
 * Drawn arrows rather than the ← ↻ → ↓ ⇓ characters, which each WebView sets in
 * its own font and weight (icons.tsx). The shell has one arrow, pointing left;
 * right and down turn it with a class, so every direction has the same stroke.
 */
function ControlIcon({ action }: { action: Action }) {
  switch (action) {
    case 'left':
      return <IconBack />;
    case 'right':
      return <IconBack className="fb-ico-right" />;
    case 'softDrop':
      return <IconBack className="fb-ico-down" />;
    case 'rotate':
      return <IconRetry />;
    case 'hardDrop':
      return <IconDrop />;
  }
}
export function Controls({ enabled, play }: { enabled: boolean; play: (action: Action) => void }) {
  const { t } = useSettings();
  const timeoutRef = useRef<number | null>(null);
  const pointerRef = useRef<number | null>(null);
  const spentRef = useRef<Action | null>(null);
  const actionRef = useRef(play);
  actionRef.current = play;
  const stop = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    pointerRef.current = null;
  }, []);
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    stop();
  };
  const cancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    spentRef.current = null;
    stop();
  };
  useEffect(() => {
    if (!enabled) {
      stop();
      spentRef.current = null;
    }
    return stop;
  }, [enabled, stop]);
  return (
    <div className="fb-controls">
      {CONTROLS.map(([action, label]) => (
        <button
          key={action}
          type="button"
          className={`fb-control ${action === 'hardDrop' ? 'fb-drop' : ''}`}
          disabled={!enabled}
          aria-label={t(label)}
          onPointerDown={(event) => {
            if (!enabled || event.button !== 0 || pointerRef.current !== null) return;
            event.preventDefault();
            stop();
            pointerRef.current = event.pointerId;
            spentRef.current = action;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            actionRef.current(action);
            if (action === 'left' || action === 'right' || action === 'softDrop') {
              const repeat = () => {
                actionRef.current(action);
                timeoutRef.current = window.setTimeout(repeat, 100);
              };
              timeoutRef.current = window.setTimeout(repeat, 260);
            }
          }}
          onPointerUp={release}
          onPointerCancel={cancel}
          onLostPointerCapture={release}
          onClick={(event) => {
            const spent = event.detail > 0 && spentRef.current === action;
            spentRef.current = null;
            if (!spent) play(action);
          }}
        >
          <span className="fb-control-symbol" aria-hidden="true">
            <ControlIcon action={action} />
          </span>
          <span className="fb-control-label">{t(label)}</span>
        </button>
      ))}
    </div>
  );
}
