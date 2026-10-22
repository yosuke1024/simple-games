/**
 * One challenge (club.md §9「Challenge」): the disclosure comes before `Play`
 * (§2-2「開示が先、送信が後」), the ranked results come after. Results are
 * ordered by the game's contract on this device; the server only stores them.
 * The first three wear the tables' marks (§16-2, decision 48). Only the
 * viewer's own result carries a delete button (club.md §9, decision 42);
 * another member's name opens that member's view (§9「Member」) — on every
 * device, the owner's too. What it last read is handed up (`onRead`) and back
 * (`cached`), with where it was scrolled to, so closing that view shows the
 * challenge where it was left.
 */
import { useEffect, useRef, useState } from 'react';
import { createClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import { dropOutboxMatching } from '../storage/outbox';
import type { Challenge, Result } from '../api/types';
import { contractFor, gameTitle, rankResults } from '../contract/challenge';
import { findAvailableGame } from '@/app/gameChannel';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import type { ClubConnection } from '@/storage/schemas';
import type { ClubPlayRequest } from '@/ui/clubBridge';
import {
  dateLabel,
  errorText,
  factsLine,
  RankMark,
  ScreenFrame,
  useRestoredScroll,
} from './common';
import { challengeTitle } from './ClubScreen';

/**
 * Challenges this session withdrew from (endpoint + challenge id). The server
 * reports a withdrawn challenge as `mine` (it refuses any further result with
 * `already_submitted`, club.md §5-4), so after a reload it reads as "already
 * in" — no send promise, `Play again` — like a challenge with a result of one's
 * own (§6-3). This set covers the moment between the DELETE and that reload,
 * and a server from before withdrawals were reported.
 */
const withdrawn = new Set<string>();

/** Forgets every withdrawal; the session's memory only, kept apart for tests. */
export function clearWithdrawnChallenges(): void {
  withdrawn.clear();
}

/** The challenge and its results as last read; ClubRoot keeps them on the step while a member's view is open. */
export interface ChallengeRead {
  challenge: Challenge;
  results: Result[];
}

export function ChallengeScreen({
  connection,
  challengeId,
  cached,
  refresh = false,
  scrollTop,
  onRead,
  onOpenMember,
  onBack,
  onPlay,
}: {
  connection: ClubConnection;
  challengeId: string;
  /** What this screen read before a member's view was opened over it; undefined on a fresh open. */
  cached?: ChallengeRead;
  /** Something done on the screen above changed what the results hold: read them again (club.md §9). */
  refresh?: boolean;
  /** Where the body was scrolled to when a member's view was opened over it. */
  scrollTop?: number;
  /** The challenge was read anew (not the cached one handed back): ClubRoot keeps it for the way back. */
  onRead: (read: ChallengeRead) => void;
  /** Another member's name was pressed: ClubRoot pushes that member's view; `scrollTop` is where the body is. */
  onOpenMember: (memberId: string, nickname: string, scrollTop: number) => void;
  onBack: () => void;
  onPlay: (request: ClubPlayRequest) => void;
}) {
  const { t, locale } = useSettings();
  // What the step kept is shown at once, with no request (a Back from a member's view),
  // unless something up there changed what it holds.
  const [challenge, setChallenge] = useState<Challenge | null>(cached?.challenge ?? null);
  const [results, setResults] = useState<Result[] | null>(cached?.results ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(cached === undefined || refresh);
  const bodyRef = useRef<HTMLDivElement>(null);
  useRestoredScroll(bodyRef, scrollTop);
  const alive = useRef(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const client = createClient(connection.endpoint, connection.memberToken);
    setLoading(true);
    setError(null);
    try {
      const [c, r] = await Promise.all([
        client.challenge(challengeId),
        client.results(challengeId),
      ]);
      if (!alive.current) return;
      setChallenge(c);
      setResults(r);
      onRead({ challenge: c, results: r });
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  useEffect(() => {
    alive.current = true;
    // A challenge handed back is not asked for again, unless something changed it meanwhile.
    if (cached === undefined || refresh) void load();
    return () => {
      alive.current = false;
    };
    // Once per open; `Reload` is the only other fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId, connection.endpoint]);

  const joined =
    challenge !== null &&
    (challenge.mine || withdrawn.has(`${connection.endpoint}|${challenge.id}`));

  const ranked = challenge && results ? rankResults(contractFor(challenge.gameId), results) : [];

  // Only a title this build offers (app/gameChannel.ts): on the app a web-beta id resolves to
  // nothing, so Play can never open a game the app keeps off its doors.
  const gameId = challenge ? (findAvailableGame(challenge.gameId)?.id ?? null) : null;

  const play = () => {
    if (!challenge || gameId === null) return;
    // The game opens onto its own daily and its result goes out like any other;
    // what the shell keeps is only the way back to this challenge.
    onPlay({ gameId, focus: { endpoint: connection.endpoint, challengeId: challenge.id } });
  };

  /**
   * Deletes the viewer's own result and withdraws them from this challenge. What
   * this device has queued for it goes first, or a queued result would be sent
   * (and refused) right after. A 404 means the result is already gone — the
   * challenge is simply read again.
   */
  const deleteMine = async () => {
    if (!challenge) return;
    setConfirmDelete(false);
    setDeleting(true);
    setError(null);
    try {
      await dropOutboxMatching(connection.endpoint, {
        kind: 'daily',
        challengeId: challenge.id,
        gameId: challenge.gameId,
        seed: challenge.seed,
        boardDigest: challenge.boardDigest,
      });
      try {
        await createClient(connection.endpoint, connection.memberToken).deleteMyResult(
          challenge.id,
        );
      } catch (e) {
        if (!(e instanceof ClubApiError && e.code === 'not_found')) throw e;
      }
      withdrawn.add(`${connection.endpoint}|${challenge.id}`);
      if (alive.current) await load();
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  return (
    <ScreenFrame
      title={challenge ? challengeTitle(challenge, t) : connection.clubName}
      onBack={onBack}
      bodyRef={bodyRef}
      t={t}
    >
      <div className="club-toolbar">
        <button
          type="button"
          className="club-text-btn"
          disabled={loading}
          onClick={() => void load()}
        >
          {t('clubReload')}
        </button>
        {loading ? <span className="club-quiet">{t('clubLoading')}</span> : null}
      </div>
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}

      {challenge ? (
        <>
          <p className="club-quiet">
            {t('clubByDate', {
              name: challenge.createdBy.nickname,
              date: dateLabel(challenge.createdAt, locale),
            })}
          </p>
          {gameId !== null && contractFor(challenge.gameId) !== null ? (
            <>
              {/* A replay sends nothing (club.md §6-3), and neither does a connection that has not
                  accepted automatic sending (§4-1): neither promises anything. */}
              {!joined && connection.autoSend === true && (
                <p className="club-disclosure">
                  {t('clubDailyDisclosure', {
                    game: gameTitle(challenge.gameId) ?? challenge.gameId,
                    club: connection.clubName,
                  })}
                </p>
              )}
              <button type="button" className="btn btn-primary" onClick={play}>
                {joined ? t('clubPlayAgain') : t('clubPlay')}
              </button>
            </>
          ) : (
            <p className="club-note">{t('clubDifferentVersion')}</p>
          )}

          <h2 className="home-section-label club-section">{t('clubResults')}</h2>
          {ranked.map(({ result, rank }) => {
            const facts =
              result.outcome === 'played'
                ? t('clubPlayedOutcome')
                : factsLine(challenge.gameId, result.facts, t);
            const own = result.memberId === connection.memberId;
            return (
              <div
                className={`settings-row settings-row-static club-line${own ? ' club-own' : ''}`}
                key={result.memberId}
              >
                <span className="settings-row-label">
                  {rank !== null ? <RankMark rank={rank} t={t} /> : null}
                  {own ? (
                    result.nickname
                  ) : (
                    <button
                      type="button"
                      className="club-name-btn"
                      onClick={() =>
                        onOpenMember(
                          result.memberId,
                          result.nickname,
                          bodyRef.current?.scrollTop ?? 0,
                        )
                      }
                    >
                      {result.nickname}
                    </button>
                  )}
                  {own ? <span className="club-you">{t('clubYou')}</span> : null}
                </span>
                <span className="settings-row-value">{facts}</span>
                {own ? (
                  // The same quiet word as a ranking row's delete (§16-2): the confirmation is the danger.
                  <button
                    type="button"
                    className="club-text-btn club-quiet-btn"
                    aria-label={t('clubDeleteRecord')}
                    disabled={deleting}
                    onClick={() => setConfirmDelete(true)}
                  >
                    {t('clubDeleteConfirm')}
                  </button>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}
      <ConfirmDialog
        open={confirmDelete}
        title={t('clubDeleteResultTitle')}
        body={t('clubDeleteResultBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubDeleteConfirm')}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void deleteMine()}
      />
    </ScreenFrame>
  );
}
