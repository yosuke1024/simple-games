/**
 * The Scopa game screen (docs/SCOPA_RULES.md §2.5, §7, §11).
 *
 * Owns the lift-and-take machine. The first tap on a hand card lifts it and
 * marks the table cards it can take. With one way to take, a second tap on the
 * card — or a tap on a marked table card — takes it. With several, the table
 * card chooses: one same-value card is taken at once, and a sum is built card
 * by card until it reaches the value (ui/selection.ts). A card that cannot
 * take goes down only through the table's "place here" slot: placing cannot be
 * taken back and may hand the CPU a scopa, so a second tap on the same card
 * lowers it instead of placing it. Escape lowers it too.
 *
 * HELP HERE IS THE RULES' ARITHMETIC, NOT THE MOVE (§7). The hand cards that
 * can take are marked, the table cards the lifted card can take are marked,
 * and the primiera tally is always on. None of it says which card to play, and
 * there is no hint and **no Undo** (§6): the CPU's hand and the stock are
 * hidden, and a card taken back after the reply would keep what it learned.
 *
 * The beats belong to the context. This screen reads `lastEvent` and turns it
 * into a sound, a fold and a line — one effect run per beat, by its serial
 * (a ref remembers the last one handled, so a re-render for another reason —
 * Reduced Motion switched, the language changed — never plays a beat twice).
 * The clock is not on screen. Neither is anything that counts down.
 *
 * Keyboard focus follows the play: a card played from the board takes its
 * button with it, so when the turn comes back the first playable hand card
 * gets focus — but only when focus was on the board and has not gone
 * elsewhere since (§2.5).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import {
  captureOptions,
  isPlayersTurn,
  phaseOf,
  valueOf,
  YOU,
  type Card,
  type Seat,
} from '../../game';
import { useScopa, type LastEvent } from '../../state/GameContext';
import { CaptureBand } from '../components/CaptureBand';
import { MiniCard, ScopaMark } from '../components/CardFace';
import { cardLabel, cardListLabel, type Translate } from '../components/cardText';
import { DealResultOverlay } from '../components/DealResultOverlay';
import { ScopaResultOverlay } from '../components/ScopaResultOverlay';
import { Hand, PrimieraStrip, TableArea, type Fold, type FoldPart } from '../components/ScopaTable';
import { liftOf, pickedSum, tapTable, tappableCards } from '../selection';

/**
 * How long a capture folds towards whoever took it. Shorter than one beat
 * (state/GameContext.tsx `CPU_DELAY_MS` = 450), so the fold is always done
 * before the next card moves, and not drawn at all under Reduced Motion.
 */
const FOLD_MS = 380;

/**
 * How long the CPU's card, a scopa, or where the last cards went stays on the
 * line — unless the player lifts a card first: their own guidance outranks it.
 */
const NOTICE_MS = 2400;

/** What the line says about a beat that was not the player's own doing. */
interface Notice {
  /** The words on screen; cards follow them as drawn chips. */
  readonly text: string;
  readonly cards: readonly Card[];
  readonly taken: readonly Card[];
  readonly scopa: boolean;
  /** The whole sentence, every card named, for the live region (§11.2). */
  readonly spoken: string;
  readonly seat: Seat;
}

/** What the card itself did, before the end of the deal is considered. */
function playNotice(last: LastEvent, t: Translate): Notice | null {
  const { event } = last;
  if (event.kind !== 'play') return null;
  const scopaLine = event.seat === YOU ? t('scopaLineScopaYou') : t('scopaLineScopaCpu');
  if (event.seat === YOU) {
    // The player's own card needs no narration, unless it emptied the table.
    return event.scopa
      ? { text: scopaLine, cards: [], taken: [], scopa: true, spoken: scopaLine, seat: YOU }
      : null;
  }
  const card = cardLabel(t, event.card);
  if (event.captured.length === 0) {
    return {
      text: t('scopaLineCpuPlaced'),
      cards: [event.card],
      taken: [],
      scopa: false,
      spoken: t('scopaSayCpuPlaced', { card }),
      seat: event.seat,
    };
  }
  const took = t('scopaSayCpuTook', { card, cards: cardListLabel(t, event.captured) });
  return {
    text: event.scopa ? scopaLine : t('scopaLineCpuTook'),
    cards: [event.card],
    taken: event.captured,
    scopa: event.scopa,
    spoken: event.scopa ? t('scopaSayThen', { first: took, then: scopaLine }) : took,
    seat: event.seat,
  };
}

/**
 * The line for one beat. On the thirty-sixth card the table empties to whoever
 * took last, in the same move (§2.2): the line says so, with those cards, for
 * the beat before the settlement or the result card covers the table (§11.2).
 * What is read aloud keeps the card's own sentence first.
 */
function noticeFor(last: LastEvent, t: Translate): Notice | null {
  const played = playNotice(last, t);
  const sweep = last.dealResult?.sweep ?? null;
  if (sweep === null || sweep.cards.length === 0) return played;
  const cards = cardListLabel(t, sweep.cards);
  const said =
    sweep.seat === YOU ? t('scopaSaySweepYou', { cards }) : t('scopaSaySweepCpu', { cards });
  return {
    text: sweep.seat === YOU ? t('scopaLineSweepYou') : t('scopaLineSweepCpu'),
    cards: sweep.cards,
    taken: [],
    scopa: false,
    spoken: played ? t('scopaSayThen', { first: played.spoken, then: said }) : said,
    seat: sweep.seat,
  };
}

/** Where a beat's cards fold to: the capture, then what the last taker swept up. */
function foldPartsOf(last: LastEvent): FoldPart[] {
  const { event } = last;
  if (event.kind !== 'play') return [];
  const parts: FoldPart[] = [];
  if (event.captured.length > 0) {
    parts.push({ cards: [event.card, ...event.captured], toward: event.seat });
  }
  const sweep = last.dealResult?.sweep ?? null;
  if (sweep !== null && sweep.cards.length > 0) {
    const same = parts.findIndex((part) => part.toward === sweep.seat);
    if (same >= 0) {
      parts[same] = { cards: [...parts[same]!.cards, ...sweep.cards], toward: sweep.seat };
    } else {
      parts.push({ cards: sweep.cards, toward: sweep.seat });
    }
  }
  return parts;
}

export function ScopaGameScreen() {
  const { session, lastEvent, dealResult, lastResult, play, dealNextDeal, goHome, startNewGame } =
    useScopa();
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const foldTimeout = useTransientTimeout();
  const noticeTimeout = useTransientTimeout();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  /** The hand card lifted by the first tap. */
  const [lifted, setLifted] = useState<Card | null>(null);
  /** The table cards picked so far into a sum. */
  const [picked, setPicked] = useState<readonly Card[]>([]);
  const [folding, setFolding] = useState<Fold | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** The serial of the last beat played off, so a beat is never played twice. */
  const handledRef = useRef(0);
  /** The board: hand, table and line, for the focus handover after a play. */
  const boardRef = useRef<HTMLDivElement>(null);
  /** Set when a play left from the board, until the turn comes back to the player. */
  const refocusRef = useRef(false);

  const deal = session?.deal ?? null;
  const status = session?.status;

  // A new position — anyone's card, a refill, a fresh deal — lowers whatever
  // was lifted: a lift is not a move, and it does not outlive the table it
  // was made against.
  useEffect(() => {
    setLifted(null);
    setPicked([]);
  }, [deal]);

  const yourTurn = session !== null && isPlayersTurn(session);
  const heldUp =
    yourTurn && deal !== null && lifted !== null && deal.hands[YOU].includes(lifted)
      ? lifted
      : null;
  const lift = useMemo(
    () => (heldUp !== null && deal !== null ? liftOf(deal.table, heldUp) : null),
    [deal, heldUp],
  );
  const tappable = useMemo(() => tappableCards(lift, picked), [lift, picked]);
  const canTake = useMemo(() => {
    const out = new Set<Card>();
    if (deal === null) return out;
    for (const card of deal.hands[YOU]) {
      if (captureOptions(deal.table, card).length > 0) out.add(card);
    }
    return out;
  }, [deal]);

  const lower = useCallback(() => {
    setLifted(null);
    setPicked([]);
  }, []);

  const commit = useCallback(
    (move: { card: Card; captured: readonly Card[] }) => {
      const active = document.activeElement;
      const fromBoard = active instanceof Node && boardRef.current?.contains(active) === true;
      if (play(move)) {
        void haptics.tap();
        lower();
        refocusRef.current = fromBoard;
      }
    },
    [lower, play],
  );

  // The turn is back: hand focus to the first playable card, if the last play
  // left from the board and focus has not been put somewhere else since.
  useEffect(() => {
    if (!yourTurn || !refocusRef.current) return;
    refocusRef.current = false;
    const board = boardRef.current;
    const active = document.activeElement;
    if (!board || (active && active !== document.body && !board.contains(active))) return;
    board.querySelector<HTMLButtonElement>('.sc-hand-card:not(:disabled)')?.focus();
  }, [yourTurn, deal]);

  const onHandTap = useCallback(
    (card: Card) => {
      if (!deal) return;
      // The player's own guidance outranks what the CPU just did (§11.2).
      setNotice(null);
      if (heldUp !== card) {
        // Lifting is not a move: another card simply moves the lift.
        setLifted(card);
        setPicked([]);
        void haptics.tap();
        return;
      }
      const options = captureOptions(deal.table, card);
      // One way to take: the second tap takes it. A card that can only be
      // placed, or that has several ways to take, comes back down — the slot
      // and the table cards are where those are decided (§2.5).
      if (options.length === 1) commit({ card, captured: options[0]! });
      else lower();
    },
    [commit, deal, heldUp, lower],
  );

  const onTableTap = useCallback(
    (card: Card) => {
      const tap = tapTable(lift, picked, card);
      setNotice(null);
      if (tap.kind === 'take') commit(tap.move);
      else if (tap.kind === 'group') {
        setPicked(tap.picked);
        void haptics.tap();
      }
    },
    [commit, lift, picked],
  );

  const onPlace = useCallback(() => {
    if (lift && lift.kind === 'place') commit({ card: lift.card, captured: [] });
  }, [commit, lift]);

  // The table's beats, and the player's own cards, arrive as events: their
  // sound, the fold and the line are played off the record, once per beat.
  // A deal settling is its own small event, distinct from the match ending —
  // and the deal that decides the match has no settlement, so no sound (§11.2).
  // Both are live transitions only: a table that arrives (a resume, a fresh
  // deal) carries no event and plays nothing.
  useEffect(() => {
    if (!lastEvent || lastEvent.serial === handledRef.current) return;
    handledRef.current = lastEvent.serial;
    const { event } = lastEvent;
    if (event.kind !== 'play') return;
    if (event.scopa) sounds.match();
    else sounds.select();
    if (lastEvent.dealResult && status === 'playing') sounds.match();
    const parts = foldPartsOf(lastEvent);
    if (parts.length > 0 && !reducedMotion) {
      setFolding({ parts, serial: lastEvent.serial });
      foldTimeout(() => setFolding(null), FOLD_MS);
    }
    const said = noticeFor(lastEvent, t);
    setNotice(said);
    if (said) noticeTimeout(() => setNotice(null), NOTICE_MS);
  }, [lastEvent, status, reducedMotion, foldTimeout, noticeTimeout, t]);

  useEffect(() => {
    if (status === 'won') {
      sounds.clear();
      void haptics.clear();
    } else if (status === 'lost') {
      sounds.gameOver();
      void haptics.invalid();
    }
  }, [status]);

  const matchOver = session !== null && session.status !== 'playing';
  const deciding = dealResult !== null;

  // Escape lowers the lifted card and the half-built group. A dialog takes
  // Escape first (ui/useDialogDismiss.ts), and the listener is off while one
  // is open or the table is covered.
  const onKey = (event: KeyboardEvent): boolean => {
    if (event.key !== 'Escape' || heldUp === null) return false;
    lower();
    return true;
  };
  useGameKeys(onKey, !confirmNewGame && !matchOver && !deciding);

  if (!session || !deal) return null;

  const refilling = phaseOf(deal) === 'refill';
  let line: string;
  if (notice) line = notice.text;
  else if (refilling) line = t('scopaLineDealing');
  else if (!yourTurn) line = matchOver || deciding ? '' : t('scopaLineCpuTurn');
  else if (lift === null) line = t('scopaLineYourTurn');
  else if (lift.kind === 'place') line = t('scopaLinePlace');
  else if (lift.options.length === 1) line = t('scopaLineTakeOne');
  else if (lift.kind === 'same') line = t('scopaLineChooseSame');
  else line = t('scopaLineBuildSum', { n: valueOf(lift.card), sum: pickedSum(picked) });
  const spoken = notice ? notice.spoken : line;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={matchOver || deciding || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('scopaName')}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <CaptureBand
          deal={deal}
          scores={session.scores}
          flash={notice?.scopa ? notice.seat : null}
        />

        <div className="sc-body" ref={boardRef}>
          <TableArea
            deal={deal}
            tappable={tappable}
            picked={picked}
            canPlace={lift !== null && lift.kind === 'place'}
            folding={folding}
            onTableTap={onTableTap}
            onPlace={onPlace}
          />

          {/* One line, always present, so the table never jumps. What is on
              screen names cards by their printed faces; what is read aloud
              names every card in words (§11.2). */}
          <p className="sc-line" aria-hidden="true">
            {notice?.scopa ? <ScopaMark /> : null}
            <span className="sc-line-text">{line}</span>
            {notice?.cards.map((card) => (
              <MiniCard key={card} card={card} />
            ))}
            {notice && notice.taken.length > 0 ? <span className="sc-line-arrow">→</span> : null}
            {notice?.taken.map((card) => (
              <MiniCard key={card} card={card} />
            ))}
          </p>
          <p className="visually-hidden" role="status">
            {spoken}
          </p>

          <Hand
            hand={deal.hands[YOU]}
            active={yourTurn}
            canTake={canTake}
            lifted={heldUp}
            onHandTap={onHandTap}
          />
          <PrimieraStrip taken={deal.captured[YOU]} />
        </div>

        <BannerSlot />
      </div>

      {deciding && dealResult ? (
        <DealResultOverlay
          outcome={dealResult}
          dealNumber={session.dealNumber}
          scores={session.scores}
          onNext={dealNextDeal}
        />
      ) : null}

      <ScopaResultOverlay
        session={session}
        lastResult={lastResult}
        onRematch={startNewGame}
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
          startNewGame();
        }}
      />
    </div>
  );
}
