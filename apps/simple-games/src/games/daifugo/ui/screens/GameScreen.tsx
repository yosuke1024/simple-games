import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';

import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { beats, legalGroups, sortedHand, exchangeCount, type Action, type Card } from '../../game';
import { useDaifugo } from '../../state/GameContext';
import { CardFace, cardClass, rankText, SUITS } from '../components/CardFace';
import { TableSeats } from '../components/TableSeats';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playback, play, goHome, restartCurrent, startNewBoard, nextRound, setPaused } =
    useDaifugo();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const handRef = useRef<HTMLDivElement>(null),
    drawRef = useRef<HTMLDivElement>(null),
    hadHandFocus = useRef(false);
  const [choice, setChoice] = useState<{ key: string; cards: number[] }>({ key: '', cards: [] });
  const choiceKey = `${session?.seed}:${session?.moves}`;
  const selected = choice.key === choiceKey ? choice.cards : [];
  const selectCard = (card: number) =>
    setChoice({
      key: choiceKey,
      cards: selected.includes(card) ? selected.filter((c) => c !== card) : [...selected, card],
    });
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
        setChoice({ key: '', cards: [] });
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
      handRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    }
  }, [session?.moves, session?.turn, blocked, playback]);
  if (!session) return null;
  const over = session.status !== 'playing',
    yourTurn = session.turn === 0 && !over;
  const seatName = (seat: number) => (seat === 0 ? t('daifugoYou') : t('daifugoCpu', { n: seat }));
  const cardLabel = (card: Card) =>
    card === 52
      ? t('daifugoJoker')
      : t('daifugoCard', { rank: rankText(card), suit: SUITS[Math.floor(card / 13)]! });
  const eventText = t(`daifugoEvent_${session.event.kind}`, { name: seatName(session.event.seat) });
  const exchange = session.phase === 'exchange',
    count = exchangeCount(session),
    options = legalGroups(session.hands[0]!, session.table, session.revolution),
    possible = new Set(options.flat()),
    hand = sortedHand(session.hands[0]!, session.revolution);
  const tableCards = session.table.length
    ? session.table
    : playback && session.event.kind === 'clear'
      ? session.event.cards
      : [];
  const valid = exchange
    ? selected.length === count
    : selected.every((c) => hand.includes(c)) && beats(selected, session.table, session.revolution);
  const reset = (fn: () => void) => {
    setChoice({ key: '', cards: [] });
    fn();
  };
  return (
    <div className="screen game-screen df-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('daifugoName')}</span>
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
          className="df-body"
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
          <section className="df-table" aria-label={t('daifugoField')}>
            <p className="df-table-label">
              {exchange
                ? t('daifugoExchangeCount', { n: count })
                : session.event.kind === 'deal'
                  ? t('daifugoTable')
                  : eventText}
            </p>
            <div className="df-table-cards" key={session.moves}>
              {tableCards.length ? (
                tableCards.map((card) => (
                  <span
                    key={card}
                    className={`${cardClass(card)} ${playback ? 'df-event-card' : ''}`}
                    role="img"
                    aria-label={cardLabel(card)}
                  >
                    <CardFace card={card} />
                  </span>
                ))
              ) : (
                <span className="df-empty-mark" aria-hidden="true">
                  {exchange ? '⇄' : '♧'}
                </span>
              )}
            </div>
            <span className="df-badge">
              {t(session.revolution ? 'daifugoReversed' : 'daifugoNormal')}
            </span>
          </section>
          <p className={`df-status ${yourTurn ? 'is-yours' : ''}`} role="status">
            {yourTurn ? t('daifugoYourTurn') : t('daifugoTurn', { name: seatName(session.turn) })}
          </p>
          <div className="df-hand-heading">
            <strong>{t('daifugoHand')}</strong>
            <span>{t('daifugoCards', { n: hand.length })}</span>
          </div>
          <div className="df-hand" ref={handRef} aria-label={t('daifugoHand')}>
            {hand.map((card) => (
              <button
                type="button"
                key={card}
                className={`${cardClass(card)} ${selected.includes(card) ? 'is-selected' : ''} ${!exchange && !possible.has(card) ? 'is-unplayable' : ''}`}
                disabled={!yourTurn || !!playback}
                aria-pressed={selected.includes(card)}
                aria-label={cardLabel(card)}
                onClick={() => selectCard(card)}
              >
                <CardFace card={card} />
              </button>
            ))}
          </div>
          <div className="df-controls">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!yourTurn || !!playback || !valid}
              onClick={() =>
                send(
                  exchange
                    ? { kind: 'exchange', cards: selected }
                    : { kind: 'play', cards: selected },
                )
              }
            >
              {t(exchange ? 'daifugoExchange' : 'daifugoPlay')}
            </button>
            {!exchange ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!yourTurn || !!playback || !session.table.length}
                onClick={() => send({ kind: 'pass' })}
              >
                {t('daifugoPass')}
              </button>
            ) : null}
          </div>
          <p className="df-note">{exchange ? t('daifugoExchangeNote') : t('daifugoSelectNote')}</p>
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
