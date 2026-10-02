/**
 * The one seam between Core and the Club House layer (docs/architecture/
 * club.md §3). Core declares every type here and imports nothing from
 * `src/club/`; `src/app/clubGate.ts` loads that directory on demand and
 * App.tsx hands what came back to the screens through the context below.
 *
 * `ClubResultAction` (ui/components) reads the context and nothing else, so a
 * result screen never learns whether the Club layer is even in the bundle: no
 * provider, or a provider with no connections, and it draws nothing.
 */
import { createContext, type ComponentType } from 'react';
import type { ChallengeStart, GameId } from '../app/registry';

/** A connection as the shell needs it for its two entries — never the token. */
export interface ClubConnectionSummary {
  endpoint: string;
  clubId: string;
  clubName: string;
  nickname: string;
  role: 'owner' | 'member';
}

/** The challenge whose board is on screen, kept by the shell while the game runs (club.md §6-2). */
export interface ActiveChallenge {
  endpoint: string;
  clubName: string;
  challengeId: string;
  gameId: GameId;
  boardDigest: string;
  /** This device already has a result here: a replay sends nothing (club.md §6-3「1 人 1 回」). */
  submitted: boolean;
}

export type ClubOutcome = 'completed' | 'played';

/** The result screen's figures, as the game's challenge contract names them (club.md §6-1). */
export type ClubFacts = Readonly<Record<string, unknown>>;

/** A finished ordinary game, offered as a new challenge (club.md §6-3). */
export interface ClubResultPayload {
  gameId: GameId;
  outcome: ClubOutcome;
  facts: ClubFacts;
  seed: string;
  params: unknown;
  boardDigest: string;
  /**
   * The daily date of the board, set ONLY by a game whose daily is the same
   * board for everyone (Sudoku; not Minesweeper, whose daily depends on the
   * first tap — club.md §6-0). The server keeps one challenge per board, so
   * everyone's daily meets in one challenge.
   */
  daily?: string | null;
}

/** A finished challenge game: the result the active challenge is owed. */
export interface ClubChallengeResult {
  outcome: ClubOutcome;
  facts: ClubFacts;
  boardDigest: string;
}

/** `sent` reached the server; `queued` waits in the outbox (club.md §10); `rejected` will never go. */
export type ClubSendOutcome = 'sent' | 'queued' | 'rejected';

export interface ClubBridge {
  connections: readonly ClubConnectionSummary[];
  activeChallenge: ActiveChallenge | null;
  /** `Send to Club`: this ordinary game becomes a challenge in that club, with this result as its first. */
  sendToClub(endpoint: string, payload: ClubResultPayload): Promise<ClubSendOutcome>;
  /** The active challenge's result, sent as the game ends; queued when the server is out of reach. */
  submitActive(result: ClubChallengeResult): Promise<ClubSendOutcome>;
}

export const ClubBridgeContext = createContext<ClubBridge | null>(null);

/** Which door opened the Club layer (club.md §9「入口」). */
export type ClubEntry = 'settings' | 'home' | 'discover' | 'invite';

export interface ClubInvite {
  endpoint: string;
  token: string;
}

/** What the Club screen hands the shell when a challenge is played. */
export interface ClubPlayRequest {
  gameId: GameId;
  challenge: ChallengeStart;
  active: ActiveChallenge;
}

export interface ClubRootProps {
  entry: ClubEntry;
  /** An invite link that was opened; the Join screen comes first (club.md §7-4). */
  invite?: ClubInvite | null;
  /** The challenge to show again — the one whose game just ended. */
  focus?: { endpoint: string; challengeId: string } | null;
  /** Back to the collection home. */
  onBack: () => void;
  onPlayChallenge: (request: ClubPlayRequest) => void;
  /** Connections changed (joined, disconnected): the shell's entries follow. */
  onConnectionsChanged: (connections: readonly ClubConnectionSummary[]) => void;
}

/** The shape `src/club/index.ts` exports and `src/app/clubGate.ts` loads. */
export interface ClubModule {
  ClubRoot: ComponentType<ClubRootProps>;
  /** The two bridge functions over the stored connections; `active` is read at call time. */
  createBridge(
    active: () => ActiveChallenge | null,
  ): Pick<ClubBridge, 'sendToClub' | 'submitActive'>;
  /** The stored connections, for the shell's entries (never the tokens). */
  loadConnections(): Promise<readonly ClubConnectionSummary[]>;
  /** Parses an invite URL (club.md §7-1); null for anything else. */
  inviteFromHref(href: string): ClubInvite | null;
}
