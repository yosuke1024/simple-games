import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import type { Action } from '../../game';
const CONTROLS = [
  ['left', '←', 'fallingBlocksLeft'],
  ['rotate', '↻', 'fallingBlocksRotate'],
  ['right', '→', 'fallingBlocksRight'],
  ['softDrop', '↓', 'fallingBlocksSoftDrop'],
  ['hardDrop', '⇓', 'fallingBlocksHardDrop'],
] as const;
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
      {CONTROLS.map(([action, symbol, label]) => (
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
            {symbol}
          </span>
          <span className="fb-control-label">{t(label)}</span>
        </button>
      ))}
    </div>
  );
}
