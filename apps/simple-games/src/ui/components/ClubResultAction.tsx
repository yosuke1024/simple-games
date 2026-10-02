/**
 * The Club House's one operation on a result screen (docs/architecture/
 * club.md §2-2) — placed by the games that can be a challenge, next to
 * ShareAction, and drawn only on a device that has joined a Club. Everywhere
 * else it renders nothing, and the result screen's other elements keep their
 * place either way.
 *
 * Two shapes, decided by the board on screen:
 *
 * - An ordinary game (level, daily, free): `Send to Club`. The game becomes a
 *   challenge in the chosen Club — "I did this; you?" — with this result as
 *   its first (club.md §6-3). One tap, one request, nothing on failure but
 *   the button again.
 * - The active challenge's own board (the digests agree): no button, one
 *   status line. The result is sent as the screen appears, because the
 *   Challenge screen said so before the player pressed Play (「開示が先、
 *   送信が後」); a tap here would be a step, not consent. A replay of a
 *   challenge this device already answered draws nothing — one result per
 *   member (club.md §6-3). The line says what happened (club.md §10): sent,
 *   waiting in the outbox for the next time the Club is opened, or refused
 *   for good.
 *
 * The figures travel exactly as the result screen shows them: `facts` is
 * built from the same session fields as `details` (the share's strings), and
 * nothing is computed here. The server stores `facts` as given and reads it
 * only to derive club records (club.md §5-4).
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { GameId } from '../../app/registry';
import type { ShareDetail } from '../../services/share/message';
import { useSettings } from '../../state/SettingsContext';
import {
  ClubBridgeContext,
  type ClubConnectionSummary,
  type ClubFacts,
  type ClubOutcome,
  type ClubSendOutcome,
} from '../clubBridge';

export interface ClubResultActionProps {
  gameId: GameId;
  outcome: ClubOutcome;
  /** The result screen's strings — the proof that `facts` repeats the screen (src/test/clubResultWiring.test.ts). */
  details: readonly ShareDetail[];
  /** The same figures, structured as the game's challenge contract names them (club.md §6-1). */
  facts: ClubFacts;
  /** The board's identity (club.md §6-4), or null for a game without one (a ranking needs none, §16). */
  seed: string;
  params: unknown;
  boardDigest: string | null;
  /** The daily date, for a game whose daily is one board for everyone (see ClubResultPayload.daily). */
  daily?: string | null;
}

type State =
  | { kind: 'idle' }
  | { kind: 'choose' }
  | { kind: 'sending' }
  | { kind: 'done'; outcome: ClubSendOutcome; clubName: string };

export function ClubResultAction({
  gameId,
  outcome,
  facts,
  seed,
  params,
  boardDigest,
  daily,
}: ClubResultActionProps) {
  const { t } = useSettings();
  const bridge = useContext(ClubBridgeContext);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const active = bridge?.activeChallenge ?? null;
  const isChallengeBoard =
    active !== null &&
    active.gameId === gameId &&
    boardDigest !== null &&
    active.boardDigest === boardDigest;

  // The active challenge's result goes out once, as the screen appears.
  // StrictMode mounts twice in development; the ref keeps it to one request.
  const submitted = useRef(false);
  useEffect(() => {
    if (!isChallengeBoard || active.submitted || submitted.current || bridge === null) return;
    submitted.current = true;
    void bridge.submitActive({ outcome, facts, boardDigest: boardDigest! }).then((result) => {
      if (mounted.current) setState({ kind: 'done', outcome: result, clubName: active.clubName });
    });
  }, [isChallengeBoard, active, bridge, outcome, facts, boardDigest]);

  const send = useCallback(
    (club: ClubConnectionSummary) => {
      if (bridge === null) return;
      setState({ kind: 'sending' });
      void bridge
        .sendToClub(club.endpoint, {
          gameId,
          outcome,
          facts,
          seed,
          params,
          boardDigest,
          daily: daily ?? null,
        })
        .then((result) => {
          if (!mounted.current) return;
          // A new challenge is not queued (club.md §4-2 queues results only):
          // what did not go simply offers the button again.
          setState(
            result === 'sent'
              ? { kind: 'done', outcome: result, clubName: club.clubName }
              : { kind: 'idle' },
          );
        });
    },
    [bridge, gameId, outcome, facts, seed, params, boardDigest, daily],
  );

  if (bridge === null || bridge.connections.length === 0) return null;

  if (isChallengeBoard) {
    if (active.submitted) return null;
    return (
      <div className="result-share">
        <span className="result-share-note" role="status">
          {state.kind !== 'done'
            ? ''
            : state.outcome === 'sent'
              ? t('clubResultSent', { club: state.clubName })
              : state.outcome === 'queued'
                ? t('clubResultPending')
                : t('clubResultNotSent', { club: state.clubName })}
        </span>
      </div>
    );
  }

  if (state.kind === 'done') {
    return (
      <div className="result-share">
        <span className="result-share-note" role="status">
          {t('clubResultSent', { club: state.clubName })}
        </span>
      </div>
    );
  }

  if (state.kind === 'choose') {
    return (
      <div className="result-share result-club-choose">
        {bridge.connections.map((club) => (
          <button
            type="button"
            key={club.endpoint}
            className="result-share-btn"
            onClick={() => send(club)}
          >
            {club.clubName}
          </button>
        ))}
      </div>
    );
  }

  const connections = bridge.connections;
  return (
    <div className="result-share">
      <button
        type="button"
        className="result-share-btn"
        disabled={state.kind === 'sending'}
        onClick={() => {
          if (connections.length === 1) send(connections[0]!);
          else setState({ kind: 'choose' });
        }}
      >
        {t('clubSendResult')}
      </button>
      <span className="result-share-note" role="status" />
    </div>
  );
}
