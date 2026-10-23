import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { legalMoves } from '../../game';
import { useKnightTour } from '../../state/GameContext';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playMove, applyUndo, goHome, startNewGame, paused, pauseGame, resumeGame } =
    useKnightTour();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [focus, setFocus] = useState(() => session?.path[session.path.length - 1] ?? 0);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const currentCell = session?.path[session.path.length - 1] ?? 0;
  useEffect(() => {
    setFocus(currentCell);
  }, [currentCell]);
  const onUndo = () => {
    applyUndo();
    sounds.undo();
  };
  useGameKeys(
    (event) => {
      if (!isUndoKey(event)) return false;
      if (!event.repeat) onUndo();
      return true;
    },
    !!session && session.status === 'playing' && !confirmRestart && !paused,
  );
  if (!session) return null;
  const size = session.mode,
    over = session.status === 'won',
    legal = legalMoves(session),
    last = session.path[session.path.length - 1]!;
  const play = (cell: number) => {
    if (playMove(cell)) sounds.select();
  };
  const retry = () => startNewGame(size, session.seed),
    fresh = () => startNewGame(size);
  return (
    <div
      className="screen game-screen kt-screen"
      onKeyDownCapture={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      }}
    >
      <div className="game-content" inert={confirmRestart || over}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-title">{t('knightTourName')}</div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => {
              pauseGame();
              setConfirmRestart(true);
            }}
          >
            <IconRetry />
          </button>
        </header>
        <p className="kt-progress" role="status">
          {t('knightTourVisited', { count: session.path.length, total: size * size })}
        </p>
        <div
          className="kt-board"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
          role="group"
          aria-label={t('knightTourBoard')}
        >
          {Array.from({ length: size * size }, (_, cell) => {
            const visit = session.path.indexOf(cell),
              allowed = legal.includes(cell);
            const content =
              cell === last
                ? t('knightTourCurrent')
                : visit >= 0
                  ? t('knightTourVisitNumber', { count: visit + 1 })
                  : allowed
                    ? t('knightTourLegal')
                    : t('knightTourEmpty');
            return (
              <button
                type="button"
                key={cell}
                ref={(element) => {
                  cells.current[cell] = element;
                }}
                tabIndex={cell === focus ? 0 : -1}
                aria-disabled={!allowed || paused || over}
                aria-label={t('knightTourCell', {
                  row: Math.floor(cell / size) + 1,
                  col: (cell % size) + 1,
                  content,
                })}
                className={`kt-cell ${(Math.floor(cell / size) + (cell % size)) % 2 ? 'kt-dark' : ''} ${visit >= 0 ? 'kt-visited' : ''} ${allowed ? 'kt-legal' : ''} ${cell === last ? 'kt-current' : ''}`}
                onFocus={() => setFocus(cell)}
                onClick={() => {
                  if (allowed && !paused && !over) play(cell);
                }}
                onKeyDown={(event) => {
                  const offsets: Record<string, number> = {
                    ArrowUp: -size,
                    ArrowDown: size,
                    ArrowLeft: -1,
                    ArrowRight: 1,
                  };
                  const delta = offsets[event.key];
                  if (delta === undefined) return;
                  event.preventDefault();
                  const next = cell + delta;
                  if (
                    next < 0 ||
                    next >= size * size ||
                    (Math.abs(delta) === 1 && Math.floor(next / size) !== Math.floor(cell / size))
                  )
                    return;
                  setFocus(next);
                  cells.current[next]?.focus();
                }}
              >
                <span aria-hidden="true">
                  {cell === last ? '♘' : visit >= 0 ? visit + 1 : allowed ? '•' : ''}
                </span>
                {cell === last ? <small aria-hidden="true">{visit + 1}</small> : null}
              </button>
            );
          })}
        </div>
        <p className="kt-status" aria-live="polite">
          {paused
            ? t('knightTourPaused')
            : !over && !legal.length
              ? t('knightTourStuck')
              : t('knightTourInstruction')}
        </p>
        <div className="kt-actions">
          {paused ? (
            <button type="button" className="btn btn-primary" onClick={resumeGame}>
              {t('resume')}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={session.path.length <= 1}
            onClick={onUndo}
          >
            <IconUndo />
            {t('undo')}
          </button>
        </div>
        <BannerSlot />
      </div>
      <RestartDialog
        open={confirmRestart}
        onRetry={retry}
        newBoard={{ label: t('knightTourNewBoard'), start: fresh }}
        onClose={() => {
          setConfirmRestart(false);
          resumeGame();
        }}
      />
      <ResultOverlay
        session={session}
        onUndo={onUndo}
        onRetry={retry}
        onNewBoard={fresh}
        onHome={goHome}
      />
    </div>
  );
}
