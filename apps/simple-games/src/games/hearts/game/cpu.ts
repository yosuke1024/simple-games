/**
 * The three opponents — and, more importantly, **what they can see**.
 *
 * Closed-source card apps have been suspected of peeking at the player's hand
 * for as long as they have existed, and the suspicion cannot be argued away.
 * So it is settled in the type system instead: everything this file reads
 * arrives as a `CpuView`, and a `CpuView` has nowhere to put another seat's
 * cards or the three somebody is about to pass. `buildCpuView` is the only
 * bridge from the full `HandState`, it copies out one seat's cards and the
 * public record, and its test re-deals every hidden card to prove the view
 * does not move.
 *
 * What the view *does* carry is what a person in that chair would have: their
 * own thirteen cards, which way the pass is going and which of their own cards
 * they have picked out, every trick that has been played and who took it, the
 * cards on the table right now, the running score and the points taken this
 * hand, and whether hearts are broken. An expert remembers all of that; these
 * seats may too, and no more. What they do *not* keep is a memory of the pass
 * once it has resolved — a real player would remember handing the queen to the
 * left, and these do not, which errs in the player's favour.
 *
 * The deal's seed never reaches here (the plan: cpu.ts は配札シードを受け取ら
 * ない). Ties need a coin, so one float comes in as a second argument from a
 * stream of its own — a number, not a key to the deck.
 *
 * There is no search. Every decision below is arithmetic over thirteen cards
 * and the tricks already played, far inside the CPU's own 450ms pause
 * (docs/GAME_LIFECYCLE.md「CPU 探索」). It is also, deliberately, not very
 * strong: hard counts the cards it has seen and blocks a moon, and that is
 * where it stops. A CPU that beat everybody would make a worse game than one
 * that plays a decent hand (issue #26 非目標).
 */
import {
  CARD_COUNT,
  countSuit,
  isHeart,
  penaltyPointsOf,
  QUEEN_OF_SPADES,
  RANK_QUEEN,
  rankOf,
  SPADES,
  sortedCards,
  suitOf,
  type Card,
  type Suit,
} from './cards';
import {
  bySeat,
  legalPlaysIn,
  PASS_SIZE,
  penaltiesTakenIn,
  seatAt,
  SEATS,
  seatToPlay,
  suitLengthsOf,
  trickWinnerOf,
  type BySeat,
  type Difficulty,
  type HandState,
  type PassOffset,
  type Phase,
  type Seat,
} from './types';

/** A finished trick as everybody at the table saw it. */
export interface PublicTrick {
  readonly leader: Seat;
  readonly cards: readonly Card[];
  readonly winner: Seat;
}

/**
 * Everything a CPU seat is allowed to know. There is deliberately no field for
 * anyone else's cards and none for what anyone else has picked out to pass:
 * add one and the peeking is visible in the diff, which is the whole point of
 * the type existing.
 */
export interface CpuView {
  /** Which chair this is. Every seat number below is read against it. */
  readonly seat: Seat;
  readonly difficulty: Difficulty;
  readonly phase: Phase;
  /** Whose turn it is to play, or null during the pass and between tricks. */
  readonly turn: Seat | null;
  /** This seat's own cards, ascending. */
  readonly hand: readonly Card[];
  /** How far round the pass goes this hand. Zero on the hand nobody passes. */
  readonly passOffset: PassOffset;
  /** The cards **this seat** has picked out to pass, ascending. Never another's. */
  readonly passSelection: readonly Card[];
  /** Finished tricks, oldest first, with who took each. */
  readonly tricks: readonly PublicTrick[];
  /** Who led the trick on the table. */
  readonly trickLeader: Seat;
  /** What has been played onto it so far, in order from the leader. */
  readonly trickCards: readonly Card[];
  readonly heartsBroken: boolean;
  /** Match totals, indexed by seat. */
  readonly scores: BySeat<number>;
  /** Penalty points taken so far this hand, indexed by seat. */
  readonly taken: BySeat<number>;
}

/**
 * The one bridge from the full state to the view. Copies rather than
 * references, so a view can never be walked back to the hand it came from.
 */
export function buildCpuView(
  hand: HandState,
  seat: Seat,
  difficulty: Difficulty,
  scores: BySeat<number>,
): CpuView {
  return {
    seat,
    difficulty,
    phase: hand.phase,
    turn: seatToPlay(hand),
    hand: [...hand.hands[seat]],
    passOffset: hand.passOffset,
    passSelection: [...hand.selected[seat]],
    tricks: hand.tricks.map((trick) => ({
      leader: trick.leader,
      cards: [...trick.cards],
      winner: trickWinnerOf(trick),
    })),
    trickLeader: hand.leader,
    trickCards: [...hand.played],
    heartsBroken: hand.heartsBroken,
    scores: bySeat<number>((at) => scores[at]),
    taken: penaltiesTakenIn(hand),
  };
}

/** A CPU beat, as a value the session can apply. Nothing else is expressible. */
export type CpuAction =
  | { readonly kind: 'pass'; readonly cards: readonly Card[] }
  | { readonly kind: 'play'; readonly card: Card };

// ---------------------------------------------------------------------------
// Reading the table
// ---------------------------------------------------------------------------

/** What the public record adds up to. Hard is the only strength that uses it. */
export interface Knowledge {
  /** Every card played this hand. Nobody is holding any of these. */
  readonly played: ReadonlySet<Card>;
  /** Neither played nor in this seat's hand: what the other three still have. */
  readonly unseen: ReadonlySet<Card>;
  /** Seats known to hold none of a suit, because they failed to follow it. */
  readonly voids: BySeat<ReadonlySet<Suit>>;
  readonly queenGone: boolean;
}

export function knowledgeOf(view: CpuView): Knowledge {
  const played = new Set<Card>();
  const voids = bySeat<Set<Suit>>(() => new Set<Suit>());

  const note = (leader: Seat, cards: readonly Card[]): void => {
    const lead = cards.length === 0 ? null : suitOf(cards[0]!);
    cards.forEach((card, index) => {
      played.add(card);
      // Failing to follow the suit led is a public statement of being out of
      // it, and it is the one deduction everybody at the table makes.
      if (lead !== null && index > 0 && suitOf(card) !== lead) {
        voids[seatAt(leader, index)].add(lead);
      }
    });
  };
  for (const trick of view.tricks) note(trick.leader, trick.cards);
  note(view.trickLeader, view.trickCards);

  const mine = new Set(view.hand);
  const unseen = new Set<Card>();
  for (let card = 0; card < CARD_COUNT; card++) {
    if (!played.has(card) && !mine.has(card)) unseen.add(card);
  }
  return { played, unseen, voids, queenGone: played.has(QUEEN_OF_SPADES) };
}

/** The card currently taking the trick on the table, or null on a fresh lead. */
export function winningCardOf(view: CpuView): Card | null {
  if (view.trickCards.length === 0) return null;
  const lead = suitOf(view.trickCards[0]!);
  let best = view.trickCards[0]!;
  for (const card of view.trickCards) {
    if (suitOf(card) === lead && card > best) best = card;
  }
  return best;
}

/** Who is currently taking the trick on the table, or null on a fresh lead. */
export function winningSeatOf(view: CpuView): Seat | null {
  const best = winningCardOf(view);
  if (best === null) return null;
  return seatAt(view.trickLeader, view.trickCards.indexOf(best));
}

/**
 * A seat is showing every sign of shooting the moon when it has taken all the
 * points there are and enough of them to matter. Below this, one unlucky trick
 * looks the same as a plan.
 */
const MOON_ALERT = 12;

/**
 * The seat about to take all twenty-six, or null. Never this seat: the CPU
 * does not shoot for the moon itself (the plan: 自分のムーン狙いはしない —
 * it only ever tries to stop one).
 */
export function moonThreatOf(view: CpuView): Seat | null {
  let shooter: Seat | null = null;
  for (const seat of SEATS) {
    if (view.taken[seat] === 0) continue;
    if (shooter !== null) return null;
    shooter = seat;
  }
  if (shooter === null || shooter === view.seat) return null;
  return view.taken[shooter] >= MOON_ALERT ? shooter : null;
}

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

/** Enough small spades under the queen to be safe holding the big ones. */
const SPADE_COVER = 4;
/** What a card is worth getting rid of, over and above its rank. */
const QUEEN_URGENCY = 100;
const HIGH_SPADE_URGENCY = 60;
const HIGH_HEART_URGENCY = 20;
/** A card that would empty a suit is worth more than its rank says. */
const VOID_BONUS = 8;

/**
 * How badly this seat wants a card gone (the plan: easy はランダム寄り、
 * normal 以上は Q♠/A♠/K♠ と短スート処理).
 *
 * Easy prices a card at its rank and nothing else: it throws its big cards
 * away and keeps the rest, which is what somebody who has just learnt the
 * rules does. Normal knows the queen of spades is the game — she goes, and the
 * ace and king that would capture her go with her, unless there are small
 * spades enough to hide behind. Hard adds the short suit: three cards out of a
 * doubleton is a void, and a void is somewhere to throw the queen later.
 */
export function passUrgencyOf(card: Card, view: CpuView, lengths: readonly number[]): number {
  const rank = rankOf(card);
  if (view.difficulty === 'easy') return rank;

  if (card === QUEEN_OF_SPADES) return QUEEN_URGENCY;
  const suit = suitOf(card);
  if (suit === SPADES && rank > RANK_QUEEN) {
    return lengths[SPADES]! > SPADE_COVER ? rank : HIGH_SPADE_URGENCY + rank;
  }
  if (isHeart(card)) return rank >= RANK_QUEEN ? HIGH_HEART_URGENCY + rank : rank;

  const length = lengths[suit]!;
  if (view.difficulty === 'hard' && length <= PASS_SIZE) {
    return rank + VOID_BONUS * (PASS_SIZE + 1 - length);
  }
  return rank;
}

/**
 * The three cards to pass, ascending. Deterministic: the same hand always
 * gives the same three, and the tie-break float only separates cards this seat
 * has no reason to choose between.
 */
export function chooseCpuPass(view: CpuView, tieBreak: number): Card[] {
  const lengths = suitLengthsOf(view.hand);
  const urgency = new Map<Card, number>();
  for (const card of view.hand) urgency.set(card, passUrgencyOf(card, view, lengths));
  const ranked = [...view.hand].sort((a, b) => urgency.get(b)! - urgency.get(a)! || a - b);
  if (ranked.length <= PASS_SIZE) return sortedCards(ranked);

  // Everything above the third card's urgency is settled. The third place may
  // be a tie, and that is the only thing the coin decides.
  const boundary = urgency.get(ranked[PASS_SIZE - 1]!)!;
  const locked = ranked.filter((card) => urgency.get(card)! > boundary);
  const tied = sortedCards(ranked.filter((card) => urgency.get(card)! === boundary));
  const room = PASS_SIZE - locked.length;
  const windows = tied.length - room + 1;
  const start = Math.min(Math.max(Math.floor(tieBreak * windows), 0), windows - 1);
  return sortedCards([...locked, ...tied.slice(start, start + room)]);
}

// ---------------------------------------------------------------------------
// The play
// ---------------------------------------------------------------------------

/** Picks from equally-good candidates with the tie-break float. */
function pick<T>(options: readonly T[], tieBreak: number): T {
  const index = Math.floor(tieBreak * options.length);
  return options[Math.min(Math.max(index, 0), options.length - 1)]!;
}

/** The cheapest option; ties are broken in card order by the coin. */
function cheapest(
  options: readonly Card[],
  costOf: (card: Card) => number,
  tieBreak: number,
): Card {
  const best = Math.min(...options.map(costOf));
  return pick(sortedCards(options.filter((card) => costOf(card) === best)), tieBreak);
}

/** What this seat may legally play, ascending. */
export function legalPlaysFor(view: CpuView): Card[] {
  if (view.turn !== view.seat) return [];
  return legalPlaysIn({
    cards: view.hand,
    leadCard: view.trickCards.length === 0 ? null : view.trickCards[0]!,
    firstTrick: view.tricks.length === 0,
    heartsBroken: view.heartsBroken,
  });
}

/**
 * Whether something bigger in the suit is still out there, so a lead of this
 * card goes to somebody else. Hard only — and it is nothing more than
 * remembering which cards have been played, which any attentive person does.
 */
function ducksUnder(card: Card, knowledge: Knowledge): boolean {
  const suit = suitOf(card);
  for (const unseen of knowledge.unseen) {
    if (suitOf(unseen) === suit && unseen > card) return true;
  }
  return false;
}

/** Costs, in the arbitrary units the comparisons below are made in. */
const LEAD_BIG_SPADE = 40;
const LEAD_QUEEN = 10;
const LEAD_HEART = 6;
const LEAD_SAFE_BONUS = 20;
const LEAD_INTO_VOID = 12;
/** Nothing beats putting the queen under a bigger spade. */
const DUMP_THE_QUEEN = -1000;
/** …and nothing is worse than handing a point to a seat that is shooting. */
const FEEDS_A_SHOOTER = 2000;

/** How dangerous it is to lead this card. Lower is better. */
function leadCostOf(card: Card, view: CpuView, knowledge: Knowledge): number {
  const rank = rankOf(card);
  if (view.difficulty === 'easy') return -rank; // easy leads its biggest card
  let cost = rank;
  // The ace and king of spades collect the queen from anybody who is void.
  if (suitOf(card) === SPADES && rank > RANK_QUEEN && !knowledge.queenGone) cost += LEAD_BIG_SPADE;
  if (card === QUEEN_OF_SPADES) cost += LEAD_QUEEN;
  if (isHeart(card)) cost += LEAD_HEART;
  if (view.difficulty === 'hard') {
    if (ducksUnder(card, knowledge)) cost -= LEAD_SAFE_BONUS;
    else if (SEATS.some((at) => at !== view.seat && knowledge.voids[at].has(suitOf(card)))) {
      // Winning a trick in a suit somebody else is out of is how the queen
      // arrives.
      cost += LEAD_INTO_VOID;
    }
  }
  return cost;
}

/**
 * How much it costs to follow with this card, when this seat holds the suit
 * led. The shape of the decision: get under the card that is winning if you
 * can, and if you cannot, win as cheaply as possible and hope somebody behind
 * you is bigger.
 *
 * The one card that breaks the pattern is the queen of spades. Under a bigger
 * spade she is the best card in the hand — thirteen points, handed to whoever
 * is on top — which is why she is priced below every other duck.
 */
function followCostOf(card: Card, view: CpuView, winning: Card, mustWin: boolean): number {
  const rank = rankOf(card);
  if (view.difficulty === 'easy') return -rank;
  if (mustWin) {
    // Whatever goes down takes the trick, so the only questions are what it
    // takes with it and whether a smaller card leaves room for somebody behind
    // to take it off us.
    return penaltyPointsOf(card) * 10 + rank;
  }
  if (card === QUEEN_OF_SPADES && card < winning) return DUMP_THE_QUEEN;
  return -rank; // duck as high as is safe
}

/**
 * What it costs to throw this card when void in the suit led. This is the only
 * free choice in the game, so the dangerous cards go first: the queen, then the
 * two spades that would capture her, then the high hearts, then whatever
 * empties a suit.
 */
function discardCostOf(card: Card, view: CpuView, knowledge: Knowledge): number {
  const rank = rankOf(card);
  if (view.difficulty === 'easy') return -rank;

  if (card === QUEEN_OF_SPADES) return -1000;
  if (suitOf(card) === SPADES && rank > RANK_QUEEN && !knowledge.queenGone) return -(500 + rank);
  if (isHeart(card)) return -(100 + rank);
  let cost = -rank;
  if (view.difficulty === 'hard') {
    const length = countSuit(view.hand, suitOf(card));
    if (length <= 2) cost -= VOID_BONUS * (3 - length);
  }
  return cost;
}

/**
 * Blocking a moon (hard only, the plan: ムーン検知…妨害に切り替え). When one
 * seat has taken every point so far, letting them take one more is worse than
 * taking points oneself: twenty-six lands on the other three. So if the
 * shooter is on top of this trick and it can be taken off them, it is — as
 * cheaply as the hand allows, and never with the queen if anything else will
 * do it.
 */
function blocksMoon(view: CpuView, legal: readonly Card[], shooter: Seat): Card | null {
  if (view.difficulty !== 'hard') return null;
  if (winningSeatOf(view) !== shooter) return null;
  const winning = winningCardOf(view);
  if (winning === null) return null;
  const lead = suitOf(view.trickCards[0]!);
  const beats = legal.filter((card) => suitOf(card) === lead && card > winning);
  if (beats.length === 0) return null;
  const withoutQueen = beats.filter((card) => card !== QUEEN_OF_SPADES);
  const usable = withoutQueen.length > 0 ? withoutQueen : beats;
  return usable.reduce((best, card) => (card < best ? card : best), usable[0]!);
}

/**
 * The card to play, or null when this seat has no turn. Deterministic: the
 * same view and the same tie-break float always give the same card, at every
 * strength. That is what makes a saved match resume into the game it was
 * suspended from.
 */
export function chooseCpuPlay(view: CpuView, tieBreak: number): Card | null {
  const legal = legalPlaysFor(view);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0]!;

  const knowledge = knowledgeOf(view);
  const shooter = moonThreatOf(view);
  if (shooter !== null) {
    const block = blocksMoon(view, legal, shooter);
    if (block !== null) return block;
  }
  // Any point thrown onto a trick the shooter is taking is a point towards
  // their twenty-six — the queen most of all.
  const feeding = shooter !== null && winningSeatOf(view) === shooter;
  const shooterAdjusted = (cost: number, card: Card): number =>
    feeding && penaltyPointsOf(card) > 0 ? cost + FEEDS_A_SHOOTER : cost;

  if (view.trickCards.length === 0) {
    return cheapest(legal, (card) => leadCostOf(card, view, knowledge), tieBreak);
  }

  const lead = suitOf(view.trickCards[0]!);
  const following = legal.filter((card) => suitOf(card) === lead);
  if (following.length > 0) {
    const winning = winningCardOf(view)!;
    const under = following.filter((card) => card < winning);
    const mustWin = under.length === 0;
    const options = mustWin ? following : under;
    return cheapest(
      options,
      (card) => shooterAdjusted(followCostOf(card, view, winning, mustWin), card),
      tieBreak,
    );
  }
  return cheapest(
    legal,
    (card) => shooterAdjusted(discardCostOf(card, view, knowledge), card),
    tieBreak,
  );
}

/**
 * The seat's beat, as an action the session can apply. Null only when there is
 * nothing for this seat to do — a seat whose turn it is always has a card.
 */
export function chooseCpuAction(view: CpuView, tieBreak: number): CpuAction | null {
  if (view.phase === 'passing') {
    if (view.passOffset === 0) return null;
    const cards = chooseCpuPass(view, tieBreak);
    return cards.length === PASS_SIZE ? { kind: 'pass', cards } : null;
  }
  const card = chooseCpuPlay(view, tieBreak);
  return card === null ? null : { kind: 'play', card };
}
