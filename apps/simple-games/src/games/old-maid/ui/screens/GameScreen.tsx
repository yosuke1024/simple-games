import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';

import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { sourceSeat, type Action, type Card } from '../../game';
import { useOldMaid } from '../../state/GameContext';
import { CardFace, CardBack, cardClass, rankText, SUITS } from '../components/CardFace';
import { TableSeats } from '../components/TableSeats';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playback, play, goHome, restartCurrent, startNewBoard, nextRound, setPaused } =
    useOldMaid();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const handRef = useRef<HTMLDivElement>(null),
    drawRef = useRef<HTMLDivElement>(null),
    hadHandFocus = useRef(false);

  const blocked = confirmRestart;
  useEffect(() => {
    setPaused(blocked);
    return () => setPaused(false);
  }, [blocked, setPaused]);
  const send = (action: Action) => {
    if (play(action)) sounds.select();
  };
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      (event.target as HTMLElement)
        .closest('[aria-label]')
        ?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement),
      offset =
        event.key === 'ArrowLeft'
          ? -1
          : event.key === 'ArrowRight'
            ? 1
            : event.key === 'ArrowUp'
              ? -7
              : 7;
    buttons[(Math.max(0, current) + offset + buttons.length) % buttons.length]?.focus();
    event.preventDefault();
  };
  useGameKeys(
    (e) => {
      if (e.key === 'Escape') {
        return true;
      }
      return false;
    },
    session?.status === 'playing' && !confirmRestart,
  );
  useLayoutEffect(() => {
    if (
      hadHandFocus.current &&
      session?.turn === 0 &&
      !blocked &&
      !playback &&
      (document.activeElement === document.body || !document.activeElement?.isConnected)
    ) {
      (drawRef.current ?? handRef.current)
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
    }
  }, [session?.moves, session?.turn, blocked, playback]);
  if (!session) return null;
  const over = session.status !== 'playing',
    yourTurn = session.turn === 0 && !over;
  const seatName = (seat: number) => (seat === 0 ? t('oldMaidYou') : t('oldMaidCpu', { n: seat }));
  const cardLabel = (card: Card) =>
    card === 52
      ? t('oldMaidJoker')
      : t('oldMaidCard', { rank: rankText(card), suit: SUITS[Math.floor(card / 13)]! });
  const eventText = t(`oldMaidEvent_${session.event.kind}`, { name: seatName(session.event.seat) });
  const hand = [...session.hands[0]!].sort((a, b) => a - b),
    source = sourceSeat({ ...session, turn: 0 });
  const reset = (fn: () => void) => {
    fn();
  };
  return (
    <div className="screen game-screen om-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('oldMaidName')}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>
        <div
          className="om-body"
          onKeyDown={moveFocus}
          onFocusCapture={(e) => {
            hadHandFocus.current =
              !!handRef.current?.contains(e.target) || !!drawRef.current?.contains(e.target);
          }}
          onBlurCapture={(e) => {
            if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget))
              hadHandFocus.current = false;
          }}
        >
          <TableSeats session={session} />
          <section className="om-table om-draw-table" aria-label={t('oldMaidField')}>
            <p className="om-table-label">
              {yourTurn ? t('oldMaidDrawFrom', { name: seatName(source) }) : eventText}
            </p>
            <div className="om-draw-hand" aria-label={t('oldMaidHiddenHand')} ref={drawRef}>
              {Array.from({ length: session.hands[source]!.length }, (_, index) => (
                <button
                  type="button"
                  key={index}
                  className="om-card"
                  disabled={!yourTurn || !!playback}
                  aria-label={t('oldMaidHiddenCard', {
                    n: index + 1,
                    total: session.hands[source]!.length,
                  })}
                  onClick={() => send({ kind: 'draw', index })}
                >
                  <CardBack />
                </button>
              ))}
            </div>
            <div className="om-pair-preview" key={session.moves}>
              {session.event.cards.map((card) => (
                <span
                  key={card}
                  className={`${cardClass(card)} ${playback ? 'om-event-card' : ''}`}
                  role="img"
                  aria-label={cardLabel(card)}
                >
                  <CardFace card={card} />
                </span>
              ))}
            </div>
          </section>
          <p className={`om-status ${yourTurn ? 'is-yours' : ''}`} role="status">
            {yourTurn ? t('oldMaidYourTurn') : t('oldMaidTurn', { name: seatName(session.turn) })}
          </p>
          <div className="om-hand-heading">
            <strong>{t('oldMaidHand')}</strong>
            <span>{t('oldMaidCards', { n: hand.length })}</span>
          </div>
          <div className="om-hand" ref={handRef} aria-label={t('oldMaidHand')}>
            {hand.map((card) => (
              <span className={cardClass(card)} key={card} role="img" aria-label={cardLabel(card)}>
                <CardFace card={card} />
              </span>
            ))}
          </div>
          <p className="om-note">{t('oldMaidDrawNote')}</p>
        </div>
      </div>
      <BannerSlot />
      <ResultOverlay
        session={session}
        onRetry={() => reset(restartCurrent)}
        onNewBoard={() => reset(startNewBoard)}
        onNext={() => reset(nextRound)}
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
