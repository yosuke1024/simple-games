/**
 * The one seam between Core and the Club House layer (docs/architecture/
 * club.md §3). Core declares every type here and imports nothing from
 * `src/club/`; `src/app/clubGate.ts` loads that directory on demand and
 * App.tsx hands what came back to the screens through the context below.
 *
 * `ClubResultAction` (ui/components) reads the context and nothing else, so a
 * result screen never learns whether the Club layer is even in the bundle: no
 * provider, or a provider with no connections, and it draws nothing. With
 * connections it sends the finished result to every Club this device has
 * joined, by itself (club.md §2-2), and says what happened in one line.
 */
import { createContext, type ComponentType } from 'react';
import type { GameId } from '../app/registry';

/** A connection as the shell needs it for its two entries — never the token. */
export interface ClubConnectionSummary {
  endpoint: string;
  clubId: string;
  clubName: string;
  nickname: string;
  role: 'owner' | 'member';
}

/**
 * Which challenge to show again when a game opened from the Club's Today list
 * is left (club.md §6-2). Only a way back: the result of that game goes out
 * like any other, to every Club, not to this challenge in particular.
 */
export interface ClubFocus {
  endpoint: string;
  challengeId: string;
}

export type ClubOutcome = 'completed' | 'played';

/** The result screen's figures, as the game's challenge contract names them (club.md §6-1). */
export type ClubFacts = Readonly<Record<string, unknown>>;

/**
 * A finished game, sent to every Club this device has joined (club.md §2-2): a
 * daily everyone plays on the same board goes to its day's challenge (§6-3),
 * anything else to the game × mode ranking (§16).
 */
export interface ClubResultPayload {
  gameId: GameId;
  outcome: ClubOutcome;
  facts: ClubFacts;
  seed: string;
  params: unknown;
  /** The board's identity (club.md §6-4), or null for a game that has none — a ranking needs none. */
  boardDigest: string | null;
  /**
   * The daily date of the board, set ONLY by a game whose daily is the same
   * board for everyone (not Minesweeper, whose daily depends on the first tap,
   * nor Number Recall, whose retries deal a new layout — club.md §6-0). The
   * server keeps one challenge per board, so everyone's daily meets in one
   * challenge.
   */
  daily?: string | null;
  /**
   * This play, as distinct from another play of the same game that happens to end
   * with the same figures (an arcade title sends no seed, and a small score
   * repeats): a random token the result screen makes once per mount. The bridge
   * keys its "already sent" memo on it, so two plays are two rows (club.md §16-1)
   * while one play, re-rendered or sent late, is still sent once. Absent only in
   * tests that stand in for the result screen.
   */
  playId?: string;
}

/**
 * What became of the result for one Club (club.md §10). `sent` reached the
 * server; `queued` waits in the outbox for the next time the player opens a
 * Club or finishes another game; `rejected` will never go; `already` means the
 * server had this member's result for that daily (the first one counts) — as
 * delivered as it will ever be, and not worth a word on screen.
 */
export type ClubSendOutcome = 'sent' | 'queued' | 'rejected' | 'already';

export interface ClubSendReport {
  endpoint: string;
  clubName: string;
  outcome: ClubSendOutcome;
}

export interface ClubBridge {
  connections: readonly ClubConnectionSummary[];
  /**
   * Sends one finished result to every connection that accepted automatic
   * sending, in parallel, and says what became of it for each (in connection
   * order). A connection that never did — one made before results were sent by
   * themselves — gets nothing and is not reported (club.md §4-1). Never throws.
   * Connections are read at call time, so nothing played before joining or
   * accepting is ever sent. A `played` result (a loss, a dead end) is sent
   * nowhere: it would lock a daily and rankings ignore it.
   */
  sendResult(payload: ClubResultPayload): Promise<readonly ClubSendReport[]>;
}

export const ClubBridgeContext = createContext<ClubBridge | null>(null);

/** Which door opened the Club layer (club.md §9「入口」). */
export type ClubEntry = 'settings' | 'home' | 'discover' | 'invite';

export interface ClubInvite {
  endpoint: string;
  token: string;
}

/** What the Club screen hands the shell when a Today challenge is played: the game opens onto its own daily (club.md §9, §16-3). */
export interface ClubPlayRequest {
  gameId: GameId;
  /** Where leaving the game returns to. */
  focus: ClubFocus;
}

export interface ClubRootProps {
  entry: ClubEntry;
  /** An invite link that was opened; the Join screen comes first (club.md §7-4). */
  invite?: ClubInvite | null;
  /** The challenge to show again — the one whose game just ended. */
  focus?: ClubFocus | null;
  /** Back to the collection home. */
  onBack: () => void;
  onPlayChallenge: (request: ClubPlayRequest) => void;
  /** Connections changed (joined, disconnected): the shell's entries follow. */
  onConnectionsChanged: (connections: readonly ClubConnectionSummary[]) => void;
}

/** The shape `src/club/index.ts` exports and `src/app/clubGate.ts` loads. */
export interface ClubModule {
  ClubRoot: ComponentType<ClubRootProps>;
  /** The bridge function over the stored connections. */
  createBridge(): Pick<ClubBridge, 'sendResult'>;
  /** The stored connections, for the shell's entries (never the tokens). */
  loadConnections(): Promise<readonly ClubConnectionSummary[]>;
  /** Parses an invite URL (club.md §7-1); null for anything else. */
  inviteFromHref(href: string): ClubInvite | null;
}
