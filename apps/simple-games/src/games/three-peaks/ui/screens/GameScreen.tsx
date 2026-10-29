import { useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canTake, isExposed, POSITIONS, rankText, remaining, suit } from '../../game';
import { useThreePeaks } from '../../state/GameContext';
import { ThreePeaksResultOverlay } from '../components/ResultOverlay';
import { CardBack, CardFace } from '../components/CardArtwork';
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
  // The waste settles when it changes (take, draw, Undo), never when the screen
  // opens: `settles` turns on the first time the card differs from the one this
  // screen mounted with, and the key below remounts the element on every change
  // so each one plays once (§6). Adjusting state during render is React's
  // pattern for this; an effect would show the new card for a frame first.
  const [shownWaste, setShownWaste] = useState(session?.waste);
  const [settles, setSettles] = useState(false);
  if (session && session.waste !== shownWaste) {
    setShownWaste(session.waste);
    if (shownWaste !== undefined) setSettles(true);
  }
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
        <div className="tp-body">
          <div className="tp-playfield">
            <div className="tp-status" aria-live="polite">
              <span>{t('threePeaksCardsLeft')}</span>
              <strong>
                {remaining(session)}
                <span aria-hidden="true"> / 28</span>
              </strong>
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
                    className={`tp-card ${exposed ? 'tp-face' : 'tp-covered'} ${playable ? 'tp-playable' : ''} ${exposed && (suit(card) === 1 || suit(card) === 2) ? 'tp-red' : ''}`}
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
                    {exposed ? <CardFace card={card} /> : <CardBack />}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="tp-piles">
            <div className="tp-pile">
              <span className="tp-pile-label">
                {t('threePeaksStock')}{' '}
                <span className="tp-stock-count">{52 - session.stockIndex}</span>
              </span>
              <button
                type="button"
                className="tp-stock"
                disabled={session.stockIndex === 52}
                aria-label={t('threePeaksDrawCount', { count: 52 - session.stockIndex })}
                onClick={() => act({ kind: 'draw' })}
              >
                {session.stockIndex < 52 ? (
                  <CardBack />
                ) : (
                  <span aria-hidden="true" className="tp-empty-stock">
                    —
                  </span>
                )}
              </button>
              <span className="tp-pile-caption">
                {t('threePeaksDraw')} <span aria-hidden="true">↗</span>
              </span>
            </div>
            <div className="tp-pile">
              <span className="tp-pile-label">{t('threePeaksWaste')}</span>
              <div
                key={session.waste}
                className={`tp-waste ${settles ? 'tp-waste-settle' : ''} ${suit(session.waste) === 1 || suit(session.waste) === 2 ? 'tp-red' : ''}`}
                role="img"
                aria-label={`${rankText(session.waste)} ${suitLabel(session.waste)}`}
              >
                <CardFace card={session.waste} />
              </div>
            </div>
            <div className="tp-controls">
              <button
                type="button"
                className="tp-undo"
                disabled={!session.actions.length}
                onClick={applyUndo}
              >
                <span className="tp-undo-icon">
                  <IconUndo />
                </span>
                <span>{t('undo')}</span>
              </button>
            </div>
          </div>
          <p className="tp-help">{t('threePeaksUndoHint')}</p>
          <p className="tp-keyboard">{t('threePeaksKeyboard')}</p>
        </div>
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
