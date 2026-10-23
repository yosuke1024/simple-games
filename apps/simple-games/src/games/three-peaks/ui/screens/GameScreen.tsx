import { useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canTake, isExposed, POSITIONS, rankText, remaining, suit } from '../../game';
import { useThreePeaks } from '../../state/GameContext';
import { ThreePeaksResultOverlay } from '../components/ResultOverlay';
const SYMBOLS = ['♠', '♥', '♦', '♣'];
const SUIT_KEYS = [
  'threePeaksSpades',
  'threePeaksHearts',
  'threePeaksDiamonds',
  'threePeaksClubs',
] as const;
export function ThreePeaksGameScreen() {
  const { t } = useSettings();
  const { session, act, applyUndo, goHome, startGame, retryGame } = useThreePeaks();
  const [confirmNew, setConfirmNew] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const finished = session?.status !== 'playing';
  useGameKeys((event) => {
    if (!session) return false;
    if (isUndoKey(event)) {
      if (!event.repeat) applyUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key.toLowerCase() === 'd') {
      if (!event.repeat) act({ kind: 'draw' });
      return true;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
    const exposed = POSITIONS.map((_, index) => index).filter((index) => isExposed(session, index));
    if (!exposed.length) return false;
    const focused = buttons.current.findIndex((button) => button === document.activeElement);
    const offset = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const current = exposed.indexOf(focused);
    const next =
      current === -1 ? exposed[0]! : exposed[(current + offset + exposed.length) % exposed.length]!;
    buttons.current[next]?.focus();
    return true;
  }, !confirmNew && !finished);
  if (!session) return null;
  const suitLabel = (card: number) => t(SUIT_KEYS[suit(card)]!);
  const face = (card: number) => (
    <>
      <span>{rankText(card)}</span>
      <span aria-hidden="true">{SYMBOLS[suit(card)]}</span>
    </>
  );
  return (
    <div
      className="screen game-screen tp-game"
      onKeyDownCapture={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      }}
    >
      <div className="game-content" inert={finished || confirmNew || undefined}>
        <header className="screen-header">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <h1>{t('threePeaksName')}</h1>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmNew(true)}
          >
            <IconRetry />
          </button>
        </header>
        <div className="tp-status" aria-live="polite">
          {t('threePeaksCardsLeft')}: {remaining(session)}
        </div>
        <div className="tp-tableau" role="group" aria-label={t('threePeaksBoard')}>
          {POSITIONS.map((position, index) => {
            if (session.removed[index]) return null;
            const exposed = isExposed(session, index);
            const playable = canTake(session, index);
            const card = session.deck[index]!;
            return (
              <button
                key={index}
                ref={(element) => {
                  buttons.current[index] = element;
                }}
                type="button"
                className={`tp-card ${exposed ? 'tp-face' : 'tp-covered'} ${playable ? 'tp-playable' : ''} ${suit(card) === 1 || suit(card) === 2 ? 'tp-red' : ''}`}
                style={{ left: `${position.x * 10}%`, top: `${position.y * 24}%` }}
                disabled={!exposed}
                aria-disabled={!playable}
                aria-label={
                  exposed
                    ? t('threePeaksCardLabel', {
                        position: index + 1,
                        rank: rankText(card),
                        suit: suitLabel(card),
                        state: t(playable ? 'threePeaksCanMove' : 'threePeaksCannotMove'),
                      })
                    : t('threePeaksCovered', { position: index + 1 })
                }
                onClick={() => {
                  if (playable) act({ kind: 'take', index });
                }}
              >
                {exposed ? face(card) : <span aria-hidden="true">⋀</span>}
              </button>
            );
          })}
        </div>
        <div className="tp-piles">
          <div className="tp-pile">
            <span>{t('threePeaksStock')}</span>
            <button
              type="button"
              className="tp-stock"
              disabled={session.stockIndex === 52}
              aria-label={t('threePeaksDrawCount', { count: 52 - session.stockIndex })}
              onClick={() => act({ kind: 'draw' })}
            >
              <span aria-hidden="true">▧</span>
              <span>{52 - session.stockIndex}</span>
            </button>
            <span>{t('threePeaksDraw')}</span>
          </div>
          <div className="tp-pile">
            <span>{t('threePeaksWaste')}</span>
            <div
              className={`tp-waste ${suit(session.waste) === 1 || suit(session.waste) === 2 ? 'tp-red' : ''}`}
              role="img"
              aria-label={`${rankText(session.waste)} ${suitLabel(session.waste)}`}
            >
              {face(session.waste)}
            </div>
          </div>
        </div>
        <div className="tp-controls">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!session.actions.length}
            onClick={applyUndo}
          >
            <IconUndo /> {t('undo')}
          </button>
        </div>
        <p className="tp-help">{t('threePeaksUndoHint')}</p>
        <p className="tp-keyboard">{t('threePeaksKeyboard')}</p>
      </div>
      <RestartDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        onRetry={retryGame}
        newBoard={{ label: t('newGame'), start: startGame }}
      />
      <ThreePeaksResultOverlay
        session={session}
        onUndo={applyUndo}
        onNewDeal={startGame}
        onRetry={retryGame}
        onHome={goHome}
      />
    </div>
  );
}
