import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { CONFIG, reachable } from '../../game';
import { useMarbleWeave } from '../../state/GameContext';
import { Marble } from '../components/Marble';
import { ResultOverlay } from '../components/ResultOverlay';
const beginMotion = (node: SVGAnimateMotionElement | null) => node?.beginElement?.();
export function GameScreen() {
  const { t } = useSettings();
  const { session, playback, play, applyUndo, goHome, restartCurrent, startNewBoard, setPaused } =
    useMarbleWeave();
  const [confirmRestart, setConfirmRestart] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [blocked, setBlocked] = useState(false),
    [focus, setFocus] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  const reset = (fn: () => void) => {
    setSelected(null);
    setBlocked(false);
    fn();
  };
  const undo = () => {
    if (applyUndo()) {
      setSelected(null);
      setBlocked(false);
      sounds.undo();
    }
  };
  const over = session?.status !== 'playing';
  useGameKeys(
    (e) => {
      if (isUndoKey(e)) {
        if (!e.repeat) undo();
        return true;
      }
      if (e.key === 'Escape' && selected !== null) {
        setSelected(null);
        setBlocked(false);
        return true;
      }
      return false;
    },
    !over && !confirmRestart && !playback,
  );
  if (!session) return null;
  const { size, target } = CONFIG[session.mode],
    shown = playback?.before ?? session;
  const destinations = selected === null ? [] : reachable(session.board, selected, size);
  const select = (cell: number) => {
    if (playback || over) return;
    if (session.board[cell]) {
      setSelected(selected === cell ? null : cell);
      setBlocked(false);
      sounds.select();
      return;
    }
    if (selected === null) return;
    if (play({ from: selected, to: cell })) {
      setSelected(null);
      setBlocked(false);
      sounds.select();
    } else setBlocked(true);
  };
  return (
    <div className="screen game-screen mw-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">
            {size} × {size} · {t('marbleWeaveTarget', { n: target })}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>
        <div className="mw-body">
          <div className="mw-metrics">
            <span>
              {t('score')} <strong>{session.score}</strong>
            </span>
            <span className="mw-preview" aria-label={t('marbleWeaveNext')}>
              {t('marbleWeaveNext')}
              {shown.next.map((color, i) => (
                <span
                  key={i}
                  className="mw-preview-ball"
                  aria-label={t(`marbleWeaveColor${color as 1 | 2 | 3 | 4 | 5 | 6 | 7}`)}
                >
                  <Marble color={color} />
                </span>
              ))}
            </span>
          </div>
          <div
            className="mw-board"
            style={{ gridTemplateColumns: `repeat(${size},1fr)` }}
            role="group"
            aria-label={t('marbleWeaveField')}
            onKeyDown={(e) => {
              if (
                !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
                e.ctrlKey ||
                e.metaKey ||
                e.altKey
              )
                return;
              e.preventDefault();
              const x = focus % size,
                y = Math.floor(focus / size);
              const nx = Math.max(
                  0,
                  Math.min(
                    size - 1,
                    x + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0),
                  ),
                ),
                ny = Math.max(
                  0,
                  Math.min(
                    size - 1,
                    y + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0),
                  ),
                );
              setFocus(ny * size + nx);
              buttons.current[ny * size + nx]?.focus();
            }}
          >
            {shown.board.map((color, cell) => {
              const moving = playback?.after.path[0] === cell;
              const label = color
                ? t(`marbleWeaveColor${color as 1 | 2 | 3 | 4 | 5 | 6 | 7}`)
                : t('marbleWeaveEmpty');
              return (
                <button
                  key={cell}
                  type="button"
                  ref={(node) => {
                    buttons.current[cell] = node;
                  }}
                  tabIndex={focus === cell ? 0 : -1}
                  onFocus={() => setFocus(cell)}
                  className={
                    'mw-cell ' +
                    (selected === cell ? 'is-selected ' : '') +
                    (destinations.includes(cell) ? 'is-reachable' : '')
                  }
                  aria-label={t('marbleWeaveCell', {
                    row: Math.floor(cell / size) + 1,
                    col: (cell % size) + 1,
                    color: label,
                  })}
                  aria-pressed={selected === cell}
                  aria-disabled={!!playback}
                  onClick={() => select(cell)}
                >
                  {color && !moving ? <Marble color={color} /> : null}
                  {!color && destinations.includes(cell) ? (
                    <span className="mw-reachable-dot" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
            {playback ? (
              <svg className="mw-motion" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <g className={'mw-color-' + playback.before.board[playback.after.path[0]!]}>
                  <circle r=".36" className="mw-moving-ball" />
                  <circle r=".1" fill="white" />
                  <animateMotion
                    ref={beginMotion}
                    begin="indefinite"
                    path={playback.after.path
                      .map(
                        (cell, i) =>
                          `${i ? 'L' : 'M'}${(cell % size) + 0.5} ${Math.floor(cell / size) + 0.5}`,
                      )
                      .join(' ')}
                    dur={`${playback.durationMs - 200}ms`}
                    fill="freeze"
                  />
                </g>
              </svg>
            ) : null}
          </div>
          <p className="mw-status" role="status">
            {t(
              blocked
                ? 'marbleWeaveBlocked'
                : playback
                  ? 'marbleWeaveMoving'
                  : selected === null
                    ? 'marbleWeaveSelect'
                    : 'marbleWeaveDestination',
            )}
          </p>
          <div className="action-bar mw-actions">
            <button
              type="button"
              className="action-btn"
              disabled={!!playback || !session.actions.length}
              onClick={undo}
            >
              <span className="action-icon">
                <IconUndo />
              </span>
              {t('undo')}
            </button>
          </div>
        </div>
      </div>
      <BannerSlot />
      <ResultOverlay
        session={playback?.before ?? session}
        onRetry={() => reset(restartCurrent)}
        onNewBoard={() => reset(startNewBoard)}
        onHome={goHome}
      />
      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={() => reset(restartCurrent)}
        newBoard={{ label: t('newGame'), start: () => reset(startNewBoard) }}
      />
    </div>
  );
}
