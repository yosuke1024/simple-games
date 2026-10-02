/**
 * The Club House's one operation on a result screen (docs/architecture/
 * club.md §2-2) — placed by the games that can be ranked, next to
 * ShareAction, and active only on a device that has joined a Club. Everywhere
 * else it renders nothing, and the result screen's other elements keep their
 * place either way.
 *
 * There is no button. Joining a Club said, before the player agreed, that
 * every game finished while they are in it sends its result there
 * (docs/PRODUCT_PRINCIPLES.md, Club House); a tap here
 * would be a step, not consent, and a good score would be lost the moment the
 * player moved on without pressing it. So the result is sent as the screen
 * appears — once, to every Club joined — and one status line says what
 * happened (club.md §10): sent, waiting in the outbox for the next time a Club
 * is opened or a game is finished, or refused for good. A result the server
 * already held (a daily answered once) draws nothing: the first one counts.
 *
 * Leaving the screen does not cancel the send; the outbox holds what has not
 * gone. A loss or a dead end (`outcome: 'played'`) is sent nowhere, so a game
 * that cannot be ranked never locks a daily by being lost.
 *
 * The figures travel exactly as the result screen shows them: `facts` is
 * built from the same session fields as `details` (the share's strings), and
 * nothing is computed here. The server stores `facts` as given and reads it
 * only to derive club records (club.md §5-4).
 */
import { useContext, useEffect, useRef, useState } from 'react';
import type { GameId } from '../../app/registry';
import type { ShareDetail } from '../../services/share/message';
import { useSettings } from '../../state/SettingsContext';
import {
  ClubBridgeContext,
  type ClubFacts,
  type ClubOutcome,
  type ClubSendReport,
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
  const [reports, setReports] = useState<readonly ClubSendReport[] | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The result goes out once, as the screen appears. StrictMode mounts twice in
  // development and the facts object is new on most renders; the ref keeps it
  // to one request, and is set only when the request is actually made — so a
  // result screen that is open when the Club chunk finishes loading (the
  // bridge arrives late) still sends. Nothing cancels the request on unmount.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || bridge === null || bridge.connections.length === 0) return;
    sent.current = true;
    if (outcome !== 'completed') return;
    void bridge
      .sendResult({ gameId, outcome, facts, seed, params, boardDigest, daily: daily ?? null })
      .then((result) => {
        if (mounted.current) setReports(result);
      });
  }, [bridge, gameId, outcome, facts, seed, params, boardDigest, daily]);

  if (bridge === null || bridge.connections.length === 0) return null;

  // What counts is every Club the server did not already have this result for.
  const counted = (reports ?? []).filter((r) => r.outcome !== 'already');
  const rejected = counted.filter((r) => r.outcome === 'rejected');
  const delivered = counted.filter((r) => r.outcome === 'sent').length;
  let text = '';
  if (counted.length > 0) {
    if (rejected.length > 0) {
      text = t('clubResultNotSent', { club: rejected.map((r) => r.clubName).join(', ') });
    } else if (counted.length === 1) {
      text =
        delivered === 1
          ? t('clubResultSent', { club: counted[0]!.clubName })
          : t('clubResultPending');
    } else if (delivered === counted.length) {
      text = t('clubResultSentMany', { count: delivered });
    } else if (delivered === 0) {
      text = t('clubResultPending');
    } else {
      text = t('clubResultPartial', { sent: delivered, count: counted.length });
    }
  }

  return (
    <div className="result-share">
      <span className="result-share-note" role="status">
        {text}
      </span>
    </div>
  );
}
