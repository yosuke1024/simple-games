/**
 * The Hearts game screen (docs/HEARTS_RULES.md §2, §7, §11).
 *
 * Owns the two-tap machine: the first tap lifts a card, the second commits it
 * — put down onto the trick, or picked out for the pass (Gomoku's precedent,
 * and the answer to a fan where the rows overlap). A card already on the pass
 * tray comes back with one tap: the second tap is what commits, and taking a
 * card back out of the tray is the undoing of that rather than another one.
 *
 * HELP HERE IS THE RULE, NOT THE MOVE. The cards the rules allow are the ones
 * you can tap; everything else sinks — following suit, the opening trick's ban
 * on points, and hearts not being led before they are broken all become
 * something you can see instead of something you have to know
 * (state/GameContext.tsx `playable`). None of it says which card to play.
 * There is no hint, and there is **no Undo**: this game has hidden
 * information, and taking a card back after watching three replies would hand
 * back a card you now know was safe (game/session.ts).
 *
 * The chain of beats belongs to the context, not here. This screen reads
 * `lastEvent` and turns it into a sound, a fold, and a line of text — one
 * effect run per beat, with the beat's own serial number as its identity, so a
 * re-render never replays a sound.
 *
 * The clock is not on screen. Neither is anything that counts down.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import {
  passDirectionOf,
  PASS_SIZE,
  penaltiesTakenIn,
  seatToPlay,
  trickWinnerOf,
  YOU,
  type Card,
  type TrickOutcome,
} from '../../game';
import { useHearts } from '../../state/GameContext';
import { HandResultOverlay } from '../components/HandResultOverlay';
import { HeartsHand } from '../components/HeartsHand';
import { HeartsResultOverlay } from '../components/HeartsResultOverlay';
import { HeartsTable } from '../components/HeartsTable';

/**
 * How long the finished trick keeps folding towards whoever took it. Shorter
 * than one beat (state/GameContext.tsx `CPU_DELAY_MS` = 450) so the fold is
 * always finished before the next card lands, and stopped outright under
 * Reduced Motion by the shell's global rule.
 */
const FOLD_MS = 380;

/** How long "who took that" stays on the line — read at a glance, then gone. */
const NOTICE_MS = 1600;

export function HeartsGameScreen() {
  const {
    session,
    stats,
    lastEvent,
    handResult,
    canDealNextHand,
    lastResult,
    playable,
    selectPassCard,
    unselectPassCard,
    canConfirmPass,
    confirmPass,
    playCard,
    dealNextHand,
    goHome,
    startNewGame,
  } = useHearts();
  const { t } = useSettings();
  const foldTimeout = useTransientTimeout();
  const noticeTimeout = useTransientTimeout();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  /** The card lifted by the first tap, waiting for the second. */
  const [lifted, setLifted] = useState<Card | null>(null);
  /** The trick on its way to whoever took it, for as long as that takes. */
  const [folding, setFolding] = useState<TrickOutcome | null>(null);
  /** Who took the trick that just went, in words, for a beat. */
  const [notice, setNotice] = useState<string | null>(null);

  const acted = useCallback(() => {
    sounds.select();
    void haptics.tap();
  }, []);

  const hand = session?.hand ?? null;
  const passing = hand !== null && hand.phase === 'passing';
  // Memoised because the two-tap machine below closes over it: the hand's own
  // array is stable between beats, and an empty literal per render would arm a
  // fresh callback every time nothing had changed.
  const chosen = useMemo<readonly Card[]>(() => hand?.selected[YOU] ?? [], [hand]);
  const committed = hand !== null && hand.confirmed[YOU];
  const fanCards =
    hand === null
      ? []
      : passing
        ? hand.hands[YOU].filter((card) => !chosen.includes(card))
        : hand.hands[YOU];
  /** A lift only survives while the card it lifted is still in the fan. */
  const heldUp = lifted !== null && fanCards.includes(lifted) ? lifted : null;

  /**
   * The two-tap confirm. The first tap lifts; the second commits. A tap the
   * rules refuse cannot get here — the fan sinks those cards — and a tap on a
   * different card simply moves the lift, without a sound of complaint
   * (docs/HEARTS_RULES.md §2.2).
   */
  const onCardTap = useCallback(
    (card: Card) => {
      if (passing && chosen.includes(card)) {
        if (unselectPassCard(card)) {
          setLifted(null);
          acted();
        }
        return;
      }
      if (heldUp !== card) {
        setLifted(card);
        acted();
        return;
      }
      if (passing ? selectPassCard(card) : playCard(card)) {
        setLifted(null);
        acted();
      }
    },
    [acted, chosen, heldUp, passing, playCard, selectPassCard, unselectPassCard],
  );

  const onConfirmPass = useCallback(() => {
    if (confirmPass()) {
      setLifted(null);
      acted();
    }
  }, [acted, confirmPass]);

  // The table's own beats arrive outside any tap of ours, so their sound, the
  // fold and the line are played off the event record. One effect run per
  // beat: the beat's serial number is the identity, and a re-render is not one.
  useEffect(() => {
    if (!lastEvent) return;
    const { event } = lastEvent;
    if (event.kind === 'play' && event.seat !== YOU) sounds.select();
    if (event.kind !== 'collect') return;
    sounds.select();
    setFolding(event.trick);
    foldTimeout(() => setFolding(null), FOLD_MS);
    setNotice(
      event.trick.winner === YOU
        ? t('heartsTrickYou')
        : t('heartsTrickCpu', { n: event.trick.winner }),
    );
    noticeTimeout(() => setNotice(null), NOTICE_MS);
  }, [lastEvent, foldTimeout, noticeTimeout, t]);

  // A hand settling is its own small event, distinct from the match ending.
  useEffect(() => {
    if (handResult && canDealNextHand) sounds.match();
  }, [handResult, canDealNextHand]);

  const status = session?.status;
  useEffect(() => {
    if (status === 'won') {
      sounds.clear();
      void haptics.clear();
    } else if (status === 'lost' || status === 'draw') {
      sounds.gameOver();
      void haptics.invalid();
    }
  }, [status]);

  if (!session || !hand) return null;

  const matchOver = session.status !== 'playing';
  const deciding = canDealNextHand && handResult !== null;
  const toPlay = seatToPlay(hand);
  const yourTurn = !matchOver && toPlay === YOU;
  const taken = penaltiesTakenIn(hand);
  const tricks = hand.tricks;
  const lastTrickWinner = tricks.length === 0 ? null : trickWinnerOf(tricks[tricks.length - 1]!);

  /**
   * What a tap may do something with. During the pass that is the whole hand
   * until three are picked out, and then only the three themselves — so the
   * way to change your mind is to put one back, which is also what the sunk
   * fan says. During the tricks it is the rules' own list, and nothing else.
   */
  const takeable: readonly Card[] = passing
    ? committed
      ? []
      : chosen.length < PASS_SIZE
        ? [...fanCards, ...chosen]
        : chosen
    : playable;

  const line = passing
    ? committed
      ? t('heartsPassWaiting')
      : t('heartsPassPrompt')
    : (notice ??
      (matchOver || hand.phase === 'over'
        ? ''
        : yourTurn
          ? t('heartsPlayPrompt')
          : toPlay === null
            ? ''
            : t('heartsCpuTurn', { n: toPlay })));

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={matchOver || deciding || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          {/* Your own standing: the match total, and what this hand has cost
              so far. The position, never a target being counted down, and
              never a clock. */}
          <div
            className={`ht-status ${lastTrickWinner === YOU ? 'ht-status-took' : ''}`}
            role="group"
            aria-label={t('heartsYouLabel', { hand: taken[YOU], total: session.scores[YOU] })}
          >
            <span className="ht-status-name" aria-hidden="true">
              {t('heartsYou')}
            </span>
            <span className="ht-status-total" aria-hidden="true">
              {session.scores[YOU]}
            </span>
            <span className="ht-status-taken" aria-hidden="true">
              +{taken[YOU]}
            </span>
            {/* The same mark the three CPU seats get, so being on lead reads
                the same wherever the seat is drawn. */}
            {lastTrickWinner === YOU ? (
              <span className="ht-status-mark" role="img" aria-label={t('heartsTookLastTrick')} />
            ) : null}
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

        <div className="ht-body">
          <HeartsTable
            hand={hand}
            scores={session.scores}
            folding={folding}
            lastTrickWinner={lastTrickWinner}
          />

          <HeartsHand
            cards={fanCards}
            chosen={chosen}
            passing={passing}
            takeable={takeable}
            active={passing ? !committed : yourTurn}
            lifted={heldUp}
            direction={passDirectionOf(hand.passOffset)}
            onCardTap={onCardTap}
          />

          {/* One line, always present, so the table never jumps: what to do
              now, or — for a beat — who took the trick that just went. */}
          <p className="ht-line" role="status">
            {line}
          </p>
        </div>

        {/* The only button the table ever offers, and it belongs to the pass
            alone — so the bar is absent for the whole of the play, where the
            height is worth more to the table than an empty strip is. Unlike
            Gin Rummy's Knock, whose absence is itself the answer to "may I?",
            this one is the pass's own progress: it is there for the whole
            choice and turns live on the third card, so the player can see what
            they are working towards rather than wait for a button to appear. */}
        {passing ? (
          <div className="action-bar ht-actions">
            <button
              type="button"
              className="action-btn"
              disabled={!canConfirmPass}
              onClick={onConfirmPass}
            >
              {t('heartsPassConfirm')}
            </button>
          </div>
        ) : null}

        <BannerSlot />
      </div>

      {deciding ? (
        <HandResultOverlay outcome={handResult} scores={session.scores} onNext={dealNextHand} />
      ) : null}

      <HeartsResultOverlay
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
