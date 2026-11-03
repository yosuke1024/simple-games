import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo, IconHint } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { slide, solve, type Action } from '../../game';
import { useFrostRoute } from '../../state/GameContext';
import { ResultOverlay } from '../components/ResultOverlay';
const arrows = ['↑', '→', '↓', '←'];
export function GameScreen() {
  const { t } = useSettings();
  const { session, play, applyUndo, goHome, restartCurrent, startNewBoard, setPaused } =
    useFrostRoute();
  const [confirmRestart, setConfirmRestart] = useState(false),
    [hint, setHint] = useState<Action | null>(null),
    [stuck, setStuck] = useState(false);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  const move = useCallback(
    (d: Action) => {
      if (play(d)) {
        setHint(null);
        setStuck(false);
        sounds.select();
      }
    },
    [play],
  );
  const onUndo = useCallback(() => {
    if (applyUndo()) {
      setHint(null);
      setStuck(false);
      sounds.undo();
    }
  }, [applyUndo]);
  useGameKeys(
    (e) => {
      if (isUndoKey(e)) {
        if (!e.repeat) onUndo();
        return true;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      const map: Record<string, Action> = {
        ArrowUp: 0,
        ArrowRight: 1,
        ArrowDown: 2,
        ArrowLeft: 3,
        w: 0,
        d: 1,
        s: 2,
        a: 3,
      };
      const dir = map[e.key];
      if (dir !== undefined) {
        if (!e.repeat) move(dir);
        return true;
      }
      return false;
    },
    session?.status === 'playing' && !confirmRestart,
  );
  if (!session) return null;
  const { board } = session,
    over = session.status !== 'playing',
    dirs = ([0, 1, 2, 3] as const).map((d) => slide(board, session.position, session.mask, d));
  const reset = (fn: () => void) => {
    setHint(null);
    setStuck(false);
    fn();
  };
  return (
    <div className="screen game-screen fr-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">
            {board.size} × {board.size}
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
        <div className="fr-body">
          <div className="fr-metrics">
            <span>
              {t('movesLabel')} <strong>{session.actions.length}</strong>
            </span>
            <span
              className="fr-crystals"
              aria-label={t('frostRouteCrystals', {
                n: session.mask.toString(2).replaceAll('0', '').length,
              })}
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className={session.mask & (1 << i) ? 'is-collected' : ''}>
                  ◆
                </span>
              ))}
            </span>
            <span>
              {t('frostRoutePar')} <strong>{board.par}</strong>
            </span>
          </div>
          <div
            className="fr-board"
            style={{ gridTemplateColumns: `repeat(${board.size},1fr)` }}
            role="group"
            aria-label={t('frostRouteField')}
          >
            {Array.from({ length: board.size * board.size }, (_, cell) => {
              const wall = board.walls.includes(cell),
                gem = board.gems.indexOf(cell),
                present = gem >= 0 && !(session.mask & (1 << gem)),
                player = cell === session.position,
                exit = cell === board.exit,
                dir = dirs.findIndex((d) => d.path.length && d.position === cell),
                available = dir >= 0;
              const kind = t(
                player
                  ? 'frostRoutePlayer'
                  : wall
                    ? 'frostRouteRock'
                    : present
                      ? 'frostRouteCrystal'
                      : exit
                        ? 'frostRouteExit'
                        : 'frostRouteIce',
              );
              const cellLabel = `${t('frostRoutePosition', { row: Math.floor(cell / board.size) + 1, col: (cell % board.size) + 1 })} · ${kind}`;
              return (
                <div
                  key={cell}
                  className={`fr-cell ${wall ? 'fr-rock' : ''} ${exit ? 'fr-exit' : ''} ${player ? 'fr-player-cell' : ''} ${present || exit ? 'fr-special' : ''} ${hint !== null && dirs[hint]!.path.includes(cell) ? 'fr-hint-path' : ''}`}
                >
                  {!available ? <span className="visually-hidden">{cellLabel}</span> : null}
                  {wall ? (
                    <svg viewBox="0 0 40 40" aria-hidden="true">
                      <path d="M5 29 10 11 25 5 35 20 31 34 13 35Z" />
                      <path d="m10 11 13 9 12 0M23 20l-10 15" />
                    </svg>
                  ) : null}
                  {exit ? (
                    <svg className="fr-exit-mark" viewBox="0 0 40 40" aria-hidden="true">
                      <path d="M12 35V5h20l-5 6 5 6H12" />
                    </svg>
                  ) : null}
                  {present ? (
                    <span className="fr-gem" aria-hidden="true">
                      ◆
                    </span>
                  ) : null}
                  {player ? (
                    <span className="fr-puck" aria-hidden="true">
                      <span />
                    </span>
                  ) : null}
                  {available && !player ? (
                    <button
                      type="button"
                      className={`fr-destination ${dir === hint ? 'fr-hinted' : ''}`}
                      aria-label={
                        kind +
                        ' · ' +
                        t('frostRouteDestination', {
                          row: Math.floor(cell / board.size) + 1,
                          col: (cell % board.size) + 1,
                        })
                      }
                      onClick={() => move(dir as Action)}
                    >
                      <span aria-hidden="true">{arrows[dir]}</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="fr-status" role="status">
            <span className="visually-hidden">
              {t('frostRoutePosition', {
                row: Math.floor(session.position / board.size) + 1,
                col: (session.position % board.size) + 1,
              })}{' '}
              ·{' '}
              {t('frostRouteCrystals', { n: session.mask.toString(2).replaceAll('0', '').length })}
              .{' '}
            </span>
            {stuck
              ? t('frostRouteStuck')
              : hint !== null
                ? t('frostRouteHintNote')
                : t('frostRouteGoal')}
          </p>
          <div className="fr-directions" role="group" aria-label={t('frostRouteControls')}>
            {([0, 3, 2, 1] as const).map((d) => (
              <button
                type="button"
                key={d}
                className={`fr-direction ${d === hint ? 'is-hint' : ''}`}
                aria-label={t(`frostRouteDirection${d}`)}
                disabled={!dirs[d]!.path.length}
                onClick={() => move(d)}
              >
                {arrows[d]}
              </button>
            ))}
          </div>
          <div className="action-bar fr-actions">
            <button
              className="action-btn"
              type="button"
              onClick={onUndo}
              disabled={!session.actions.length}
            >
              <span className="action-icon">
                <IconUndo />
              </span>
              {t('undo')}
            </button>
            <button
              className="action-btn"
              type="button"
              onClick={() => {
                const route = solve(board, session.position, session.mask);
                setHint(route?.[0] ?? null);
                setStuck(route === null);
              }}
            >
              <span className="action-icon">
                <IconHint />
              </span>
              {t('hint')}
            </button>
          </div>
        </div>
      </div>
      <BannerSlot />
      <ResultOverlay
        session={session}
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
