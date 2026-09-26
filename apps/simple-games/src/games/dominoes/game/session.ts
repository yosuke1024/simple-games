/**
 * DominoesSession — a pure, immutable snapshot of one game in progress: the
 * line, both hands, the boneyard, whose turn it is. The React layer only
 * dispatches into these functions; all rules live here, in engine.ts and in
 * cpu.ts (docs/DOMINOES_RULES.md).
 *
 * A turn is one or more ACTIONS (§3): play a tile, or — only with nothing
 * that fits — draw one, or — only with nothing that fits and nothing left to
 * draw — pass. Drawing keeps the turn; playing and passing hand it over. Every
 * action counts one move, which is what gives each of the CPU's actions its
 * own tie-break stream (§5).
 *
 * There is no Undo and no hint (§7): a drawn tile is information, and taking
 * the draw back would be a look at the boneyard.
 *
 * There is no clock on screen (§11); elapsed seconds are carried here for the
 * statistics only.
 */
import { buildCpuView, chooseCpuMove, type CpuAction, type CpuView } from './cpu';
import {
  dealFromSeed,
  findOpening,
  hasLegalPlay,
  legalEnds,
  pipTotal,
  placeTile,
  withoutTile,
} from './engine';
import { createRng } from './rng';
import {
  CPU,
  opponentOf,
  PLAYER,
  type End,
  type Ending,
  type GameStatus,
  type Line,
  type Opening,
  type Side,
  type Tile,
} from './types';

/** Two passes in a row with the boneyard empty block the game (§4). */
export const PASSES_TO_BLOCK = 2;

export interface DominoesSession {
  readonly seed: string;
  readonly line: Line;
  readonly playerHand: readonly Tile[];
  readonly cpuHand: readonly Tile[];
  /** Face down, drawn from the front (§3). */
  readonly boneyard: readonly Tile[];
  /** Whose action it is. Meaningless once the status is terminal. */
  readonly toMove: Side;
  /** Passes in a row; any play resets it, two block the game (§4). */
  readonly passes: number;
  /** Actions taken this game, the opening included. The CPU tie-break's second half (§5). */
  readonly moveCount: number;
  /** Who put the first tile down, for the screen's first line (§2, §11). */
  readonly opening: Opening;
  /** From the player's side of the table: 'won' means the player did (§4). */
  readonly status: GameStatus;
  /** How it ended, for the result card — null while playing. */
  readonly ending: Ending | null;
  /** The winner's points (§4): 0 while playing and on a draw. */
  readonly score: number;
  readonly playerPips: number;
  readonly cpuPips: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one game's seed its own. There are no levels and no
 * dates to seed from, so every new game gets a new deal — while the seed still
 * pins the deal and the CPU's tie-breaks down completely.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const gameSeed = (token: string): string => `dominoes-${token}`;

/** The tiles `side` holds. */
export const handOf = (session: DominoesSession, side: Side): readonly Tile[] =>
  side === PLAYER ? session.playerHand : session.cpuHand;

/** Whether `side` has a tile that fits either end (§3). */
export const canPlay = (session: DominoesSession, side: Side): boolean =>
  hasLegalPlay(session.line, handOf(session, side));

/** Whether `side` may draw now: nothing fits and the boneyard has a tile (§3). */
export const canDraw = (session: DominoesSession, side: Side): boolean =>
  session.status === 'playing' &&
  session.toMove === side &&
  session.boneyard.length > 0 &&
  !canPlay(session, side);

/** Whether `side` may pass now: nothing fits and nothing is left to draw (§3). */
export const canPass = (session: DominoesSession, side: Side): boolean =>
  session.status === 'playing' &&
  session.toMove === side &&
  session.boneyard.length === 0 &&
  !canPlay(session, side);

/**
 * Status, ending, score and the two pip totals for a position (§4). A side
 * with no tiles has gone out and won the other's pips; two passes in a row
 * block the game and the lower total wins the difference.
 */
function outcomeOf(
  playerHand: readonly Tile[],
  cpuHand: readonly Tile[],
  passes: number,
): Pick<DominoesSession, 'status' | 'ending' | 'score' | 'playerPips' | 'cpuPips'> {
  const playerPips = pipTotal(playerHand);
  const cpuPips = pipTotal(cpuHand);
  if (playerHand.length === 0) {
    return { status: 'won', ending: 'out', score: cpuPips, playerPips, cpuPips };
  }
  if (cpuHand.length === 0) {
    return { status: 'lost', ending: 'out', score: playerPips, playerPips, cpuPips };
  }
  if (passes >= PASSES_TO_BLOCK) {
    const status: GameStatus =
      playerPips < cpuPips ? 'won' : playerPips > cpuPips ? 'lost' : 'draw';
    return {
      status,
      ending: 'blocked',
      score: Math.abs(playerPips - cpuPips),
      playerPips,
      cpuPips,
    };
  }
  return { status: 'playing', ending: null, score: 0, playerPips, cpuPips };
}

/**
 * A fresh game (§1, §2): the seed's deal, and the opening tile already on the
 * line — the highest double, or with none dealt the heaviest tile, from
 * whichever hand holds it. The other side moves first.
 */
export function createSession(seed: string = gameSeed(newSeedToken())): DominoesSession {
  const deal = dealFromSeed(seed);
  const opening = findOpening(deal.playerHand, deal.cpuHand);
  const playerHand =
    opening.by === PLAYER ? withoutTile(deal.playerHand, opening.tile)! : deal.playerHand;
  const cpuHand = opening.by === CPU ? withoutTile(deal.cpuHand, opening.tile)! : deal.cpuHand;
  return {
    seed,
    line: placeTile([], opening.tile, 'right')!,
    playerHand,
    cpuHand,
    boneyard: deal.boneyard,
    toMove: opponentOf(opening.by),
    passes: 0,
    moveCount: 1,
    opening,
    ...outcomeOf(playerHand, cpuHand, 0),
    elapsedSeconds: 0,
  };
}

const withHand = (
  session: DominoesSession,
  side: Side,
  hand: readonly Tile[],
): Pick<DominoesSession, 'playerHand' | 'cpuHand'> =>
  side === PLAYER
    ? { playerHand: hand, cpuHand: session.cpuHand }
    : { playerHand: session.playerHand, cpuHand: hand };

/**
 * `side` plays `tile` on `end` (§3). Null when it is not that side's action,
 * the side does not hold the tile, or the tile does not fit there. Playing
 * the last tile ends the game (§4); otherwise the turn passes over.
 */
export function play(
  session: DominoesSession,
  side: Side,
  tile: Tile,
  end: End,
): DominoesSession | null {
  if (session.status !== 'playing' || session.toMove !== side) return null;
  const hand = withoutTile(handOf(session, side), tile);
  if (hand === null) return null;
  if (!legalEnds(session.line, tile).includes(end)) return null;
  const line = placeTile(session.line, tile, end);
  if (line === null) return null;

  const hands = withHand(session, side, hand);
  return {
    ...session,
    ...hands,
    line,
    toMove: opponentOf(side),
    passes: 0,
    moveCount: session.moveCount + 1,
    ...outcomeOf(hands.playerHand, hands.cpuHand, 0),
  };
}

/**
 * `side` draws the boneyard's front tile (§3). Null when the side has a tile
 * that fits — the rules require it to play — or the boneyard is empty. The
 * turn stays with the side: it draws again or plays what it drew.
 */
export function draw(session: DominoesSession, side: Side): DominoesSession | null {
  if (!canDraw(session, side)) return null;
  const [drawn, ...boneyard] = session.boneyard;
  const hands = withHand(session, side, [...handOf(session, side), drawn!]);
  return {
    ...session,
    ...hands,
    boneyard,
    moveCount: session.moveCount + 1,
    ...outcomeOf(hands.playerHand, hands.cpuHand, session.passes),
  };
}

/**
 * `side` passes (§3). Null unless nothing fits and the boneyard is empty.
 * The second pass in a row blocks the game (§4).
 */
export function pass(session: DominoesSession, side: Side): DominoesSession | null {
  if (!canPass(session, side)) return null;
  const passes = session.passes + 1;
  return {
    ...session,
    toMove: opponentOf(side),
    passes,
    moveCount: session.moveCount + 1,
    ...outcomeOf(session.playerHand, session.cpuHand, passes),
  };
}

/**
 * What the CPU sees of a session (§6): its own tiles, the line, and two
 * counts. Nothing else of the session is reachable from here.
 */
export const cpuViewOf = (session: DominoesSession): CpuView =>
  buildCpuView(session.cpuHand, session.line, session.boneyard.length, session.playerHand.length);

/** The coin the CPU's ties are settled with, one stream per action (§5). */
export const cpuTieBreak = (session: DominoesSession): (() => number) =>
  createRng(`${session.seed}:cpu:${session.moveCount}`);

export interface CpuOutcome {
  readonly session: DominoesSession;
  readonly action: CpuAction;
}

/**
 * One action of the CPU's turn (§5): play, draw or pass. Null when it is not
 * the CPU's action — the caller schedules this off the session state, and a
 * stale schedule must land as nothing.
 */
export function applyCpuAction(session: DominoesSession): CpuOutcome | null {
  if (session.status !== 'playing' || session.toMove !== CPU) return null;
  const action = chooseCpuMove(cpuViewOf(session), cpuTieBreak(session));
  const next =
    action.kind === 'play'
      ? play(session, CPU, action.tile, action.end)
      : action.kind === 'draw'
        ? draw(session, CPU)
        : pass(session, CPU);
  return next === null ? null : { session: next, action };
}

export type RestoredFields = Pick<
  DominoesSession,
  | 'seed'
  | 'line'
  | 'playerHand'
  | 'cpuHand'
  | 'boneyard'
  | 'toMove'
  | 'passes'
  | 'moveCount'
  | 'elapsedSeconds'
>;

/**
 * Rebuilds a session from its saved position (§9). The status is derived,
 * never stored, so a finished position comes back finished and the loader can
 * discard it. The opening is re-derived from the seed's deal — the loader has
 * already checked the line still holds that tile.
 */
export function restoreSession(data: RestoredFields): DominoesSession {
  const deal = dealFromSeed(data.seed);
  return {
    ...data,
    opening: findOpening(deal.playerHand, deal.cpuHand),
    ...outcomeOf(data.playerHand, data.cpuHand, data.passes),
  };
}
