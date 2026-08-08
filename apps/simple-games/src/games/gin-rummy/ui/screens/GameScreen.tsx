/**
 * The Gin Rummy game screen (the plan's「Game 画面の設計」).
 *
 * Owns the two-tap machine: the first tap lifts a card, the second puts it
 * down (Gomoku's precedent, and the answer to a fan where the cards overlap).
 * Drawing is a single tap — the stock and the pile are one card each and
 * there is nothing to mistake them for.
 *
 * HELP HERE IS THE ARITHMETIC, NOT THE MOVE. The hand is arranged into its
 * best melds and the deadwood total is on screen at all times, and the Knock
 * button exists only while a knock is actually available. All three are rules
 * being made visible — the plan's 助けの形 — and none of them says which card
 * to keep. There is no hint, and there is **no Undo**: this game has hidden
 * information, and taking a move back after seeing the reply would hand back a
 * card you now know the opponent wanted (game/session.ts).
 *
 * The clock is not on screen. Neither is anything that counts down.
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { CPU, deadwoodOf, knockableDiscards, YOU, type Card, type PublicEvent } from '../../game';
import { useGinRummy } from '../../state/GameContext';
import { cardLabel } from '../components/cardText';
import { GinRummyResultOverlay } from '../components/GinRummyResultOverlay';
import { GinRummyTable } from '../components/GinRummyTable';
import { HandResultOverlay } from '../components/HandResultOverlay';

/** How long the CPU's last action stays named — read at a glance, then gone. */
const NOTICE_MS = 2400;

export function GinRummyGameScreen() {
  const {
    session,
    stats,
    lastEvent,
    handResult,
    canDealNextHand,
    lastResult,
    takeUpcard,
    passUpcard,
    drawStock,
    drawDiscard,
    discard,
    knock,
    dealNextHand,
    goHome,
    startNewGame,
  } = useGinRummy();
  const { t } = useSettings();
  const noticeTimeout = useTransientTimeout();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  /** The card lifted by the first tap, waiting for the second. */
  const [selected, setSelected] = useState<Card | null>(null);
  /** The knock has been asked for; the next card put down declares. */
  const [knockMode, setKnockMode] = useState(false);
  /** What the CPU just did, in words, for the beat it stays worth saying. */
  const [notice, setNotice] = useState<string | null>(null);

  const hand = session?.hand ?? null;

  // A new position — anyone's action, a fresh deal — retires both. A lifted
  // card that is no longer in the hand must not stay lifted, and a knock asked
  // for on one turn is not a knock asked for on the next.
  useEffect(() => {
    setSelected(null);
    setKnockMode(false);
  }, [hand]);

  const acted = useCallback(() => {
    sounds.select();
    void haptics.tap();
  }, []);

  /**
   * The two-tap confirm. The first tap lifts; the second commits. A tap that
   * the rules refuse cannot get here — the table sinks those cards — and a tap
   * on a different card simply moves the lift, without a sound of complaint
   * (the plan: 無効操作を叱らない).
   */
  const onCardTap = useCallback(
    (card: Card) => {
      if (selected !== card) {
        setSelected(card);
        acted();
        return;
      }
      if (knockMode ? knock(card) : discard(card)) acted();
    },
    [acted, discard, knock, knockMode, selected],
  );

  const onDrawStock = useCallback(() => {
    if (drawStock()) acted();
  }, [acted, drawStock]);

  const onDrawDiscard = useCallback(() => {
    if (drawDiscard()) acted();
  }, [acted, drawDiscard]);

  const onTakeUpcard = useCallback(() => {
    if (takeUpcard()) acted();
  }, [acted, takeUpcard]);

  const onPassUpcard = useCallback(() => {
    if (passUpcard()) acted();
  }, [acted, passUpcard]);

  const onKnockToggle = useCallback(() => {
    setSelected(null);
    setKnockMode((on) => !on);
    acted();
  }, [acted]);

  // The CPU's actions arrive outside any tap of ours, so their sound and their
  // announcement are played off the event record. One effect run per action:
  // the move count is the identity, and a replay of the same event is not one.
  useEffect(() => {
    if (!lastEvent) return;
    const said = noticeFor(lastEvent.event, (card) => cardLabel(t, card));
    if (said === null) return;
    sounds.select();
    setNotice(t(said.key, said.vars));
    noticeTimeout(() => setNotice(null), NOTICE_MS);
  }, [lastEvent, noticeTimeout, t]);

  // A hand settling is its own small event, distinct from the match ending.
  useEffect(() => {
    if (handResult && canDealNextHand) sounds.match();
  }, [handResult, canDealNextHand]);

  const status = session?.status;
  useEffect(() => {
    if (status === 'won') {
      sounds.clear();
      void haptics.clear();
    } else if (status === 'lost') {
      sounds.gameOver();
      void haptics.invalid();
    }
  }, [status]);

  if (!session || !hand) return null;

  const matchOver = session.status !== 'playing';
  const handOver = hand.phase === 'over';
  const yourTurn = !matchOver && !handOver && hand.turn === YOU;
  const knockable = yourTurn && hand.phase === 'discard' && knockableDiscards(hand).length > 0;
  const deciding = canDealNextHand && handResult !== null;

  const line = knockMode
    ? t('ginKnockPrompt')
    : (notice ??
      (!yourTurn
        ? t('ginCpuTurn')
        : hand.phase === 'upcard'
          ? t('ginUpcardPrompt')
          : hand.phase === 'draw'
            ? t('ginDrawPrompt')
            : t('ginDiscardPrompt')));

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={matchOver || deciding || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          {/* The match score and the deadwood total: the position, not a
              target being counted down, and never a clock. */}
          <div className="gr-status">
            <span className="gr-score">
              {t('ginYou')} {session.scores[YOU]}
            </span>
            <span className="gr-score">
              {t('ginCpu')} {session.scores[CPU]}
            </span>
            <span className="gr-deadwood">
              {t('ginDeadwood')} {deadwoodOf(hand, YOU)}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="gr-body">
          <GinRummyTable
            hand={hand}
            active={yourTurn}
            knockMode={knockMode}
            selected={selected}
            onDrawStock={onDrawStock}
            onDrawDiscard={onDrawDiscard}
            onCardTap={onCardTap}
          />

          {/* One line, always present, so the table never jumps: what to do
              now, or — for a beat — what the CPU just did. */}
          <p className="gr-line" role="status">
            {line}
          </p>
        </div>

        {/* The upcard is the one choice a hand opens with, and it is a yes or a
            no rather than a card to pick — so it is two named buttons, not a
            tap on the pile. */}
        <div className="action-bar gr-actions">
          {yourTurn && hand.phase === 'upcard' ? (
            <>
              <button type="button" className="action-btn" onClick={onTakeUpcard}>
                {t('ginTake')}
              </button>
              <button type="button" className="action-btn" onClick={onPassUpcard}>
                {t('ginPass')}
              </button>
            </>
          ) : null}

          {/* Present only while a knock is genuinely available: its absence is
              the answer to "can I knock yet?", and it never has to be greyed
              out to say no. */}
          {knockable ? (
            <button
              type="button"
              className="action-btn"
              aria-pressed={knockMode}
              onClick={onKnockToggle}
            >
              {knockMode ? t('cancel') : t('ginKnock')}
            </button>
          ) : null}
        </div>

        <BannerSlot />
      </div>

      {deciding ? (
        <HandResultOverlay outcome={handResult} scores={session.scores} onNext={dealNextHand} />
      ) : null}

      <GinRummyResultOverlay
        session={session}
        lastResult={lastResult}
        stats={stats}
        onRematch={() => startNewGame(session.difficulty)}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame(session.difficulty);
        }}
      />
    </div>
  );
}

/**
 * What to say about an action that was not ours. The player's own taps need no
 * narration, and the deal's upcard is on the table to be looked at — so both
 * answer null and the line keeps saying what to do next.
 */
function noticeFor(
  event: PublicEvent,
  name: (card: Card) => string,
): {
  key: 'ginCpuPassed' | 'ginCpuDrewStock' | 'ginCpuTookDiscard' | 'ginCpuDiscarded';
  vars?: { card: string };
} | null {
  switch (event.kind) {
    case 'upcard':
      return null;
    case 'pass':
      return event.seat === CPU ? { key: 'ginCpuPassed' } : null;
    case 'draw-stock':
      return event.seat === CPU ? { key: 'ginCpuDrewStock' } : null;
    case 'draw-discard':
      return event.seat === CPU
        ? { key: 'ginCpuTookDiscard', vars: { card: name(event.card) } }
        : null;
    case 'discard':
    case 'knock':
    case 'gin':
      return event.seat === CPU
        ? { key: 'ginCpuDiscarded', vars: { card: name(event.card) } }
        : null;
    default:
      return null;
  }
}
