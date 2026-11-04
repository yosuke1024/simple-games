import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { canPlay, type Action, type Card } from '../../game';
import { useSevens } from '../../state/GameContext';
import { CardFace, cardClass, rankText, SUITS } from '../components/CardFace';
import { TableSeats } from '../components/TableSeats';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playback, play, goHome, restartCurrent, startNewBoard, nextRound, setPaused } =
    useSevens();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmPass, setConfirmPass] = useState(false);
  const [passRequested, setPassRequested] = useState(false);
  const handRef = useRef<HTMLDivElement>(null),
    drawRef = useRef<HTMLDivElement>(null),
    hadHandFocus = useRef(false);

  const blocked = confirmRestart || confirmPass;
  useEffect(() => {
    setPaused(blocked);
    return () => setPaused(false);
  }, [blocked, setPaused]);
  useEffect(() => {
    if (passRequested && !blocked && play({ kind: 'pass' })) setPassRequested(false);
  }, [passRequested, blocked, play]);
  const send = (action: Action) => {
    if (play(action)) sounds.select();
  };
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(
      (event.target as HTMLElement)
        .closest('.sv-hand, .sv-draw-hand')
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
    buttons[
      (((Math.max(0, current) + offset) % buttons.length) + buttons.length) % buttons.length
    ]?.focus();
    event.preventDefault();
  };
  useGameKeys(
    (e) => {
      if (e.key === 'Escape') {
        return true;
      }
      return false;
    },
    session?.status === 'playing' && !confirmRestart && !confirmPass,
  );
  useLayoutEffect(() => {
    if (
      hadHandFocus.current &&
      session?.turn === 0 &&
      !blocked &&
      !playback &&
      (document.activeElement === document.body || !document.activeElement?.isConnected)
    ) {
      handRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  }, [session?.moves, session?.turn, blocked, playback]);
  if (!session) return null;
  const over = session.status !== 'playing',
    yourTurn = session.turn === 0 && !over;
  const seatName = (seat: number) => (seat === 0 ? t('sevensYou') : t('sevensCpu', { n: seat }));
  const cardLabel = (card: Card) =>
    card === 52
      ? t('sevensJoker')
      : t('sevensCard', { rank: rankText(card), suit: SUITS[Math.floor(card / 13)]! });
  const eventText = t(`sevensEvent_${session.event.kind}`, { name: seatName(session.event.seat) });
  const hand = [...session.hands[0]!].sort((a, b) => a - b);
  const reset = (fn: () => void) => {
    fn();
  };
  return (
    <div className="screen game-screen sv-screen">
      <div className="game-content" inert={over || confirmRestart || confirmPass}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('sevensName')}</span>
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
          className="sv-body"
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
          <div className="sv-arena">
            <TableSeats
              session={session}
              activeSeat={playback ? session.event.seat : session.turn}
            />
            <section className="sv-table sv-sevens-table" aria-label={t('sevensField')}>
              <div className="sv-sevens-grid">
                {[0, 1, 2, 3].flatMap((suit) =>
                  Array.from({ length: 13 }, (_, r) => {
                    const card = suit * 13 + r,
                      laid = session.table.includes(card),
                      legal = hand.includes(card) && canPlay(card, session.table);
                    return laid ? (
                      <span
                        className={`${cardClass(card)} ${session.event.cards.includes(card) ? 'sv-last-card' : ''} ${session.event.cards.includes(card) && playback ? 'sv-event-card' : ''}`}
                        key={card}
                        role="img"
                        aria-label={cardLabel(card)}
                      >
                        <CardFace card={card} />
                      </span>
                    ) : legal ? (
                      <button
                        type="button"
                        className="sv-slot is-target"
                        key={card}
                        disabled={!yourTurn || !!playback}
                        aria-label={t('sevensPlaceCard', { card: cardLabel(card) })}
                        onClick={() => send({ kind: 'play', card })}
                      >
                        {rankText(card)}
                      </button>
                    ) : (
                      <span className="sv-slot" key={card} aria-hidden="true">
                        {rankText(card)}
                      </span>
                    );
                  }),
                )}
              </div>
              <p className="sv-table-label">{eventText}</p>
            </section>
          </div>
          <p className={`sv-status ${yourTurn && !playback ? 'is-yours' : ''}`} role="status">
            {playback
              ? eventText
              : yourTurn
                ? t('sevensYourTurn')
                : t('sevensTurn', { name: seatName(session.turn) })}
          </p>
          <div className="sv-hand-heading">
            <strong>{t('sevensHand')}</strong>
            <span>{t('sevensCards', { n: hand.length })}</span>
          </div>
          <div className="sv-hand" ref={handRef} aria-label={t('sevensHand')}>
            {hand.map((card) => (
              <button
                type="button"
                key={card}
                className={`${cardClass(card)} ${canPlay(card, session.table) ? 'is-legal' : 'is-unplayable'}`}
                disabled={!yourTurn || !!playback || !canPlay(card, session.table)}
                aria-label={cardLabel(card)}
                onClick={() => send({ kind: 'play', card })}
              >
                <CardFace card={card} />
              </button>
            ))}
          </div>
          <div className="sv-controls">
            <span className="sv-pass-track">
              <span className="sv-pass-dots" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <i key={i} className={i < 3 - session.passes[0]! ? 'is-available' : ''} />
                ))}
              </span>
              {t('sevensPasses', { n: Math.max(0, 3 - session.passes[0]!) })}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!yourTurn || !!playback}
              onClick={() =>
                session.passes[0] === 3 ? setConfirmPass(true) : send({ kind: 'pass' })
              }
            >
              {t('sevensPass')}
            </button>
          </div>
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
      <ConfirmDialog
        open={confirmPass}
        title={t('sevensPassOutTitle')}
        body={t('sevensPassOutBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('sevensPass')}
        onCancel={() => setConfirmPass(false)}
        onConfirm={() => {
          setConfirmPass(false);
          setPassRequested(true);
        }}
      />
    </div>
  );
}
