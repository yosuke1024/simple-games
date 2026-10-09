/**
 * One challenge (club.md §9「Challenge」): the disclosure comes before `Play`
 * (§2-2「開示が先、送信が後」), the ranked results come after. Results are
 * ordered by the game's contract on this device; the server only stores them.
 * The first three wear the tables' marks (§16-2, decision 48). Only the
 * viewer's own result carries a delete button (club.md §9, decision 42);
 * another member's name opens the sheet with Report (§17-3) — never on the
 * owner's device.
 */
import { useEffect, useRef, useState } from 'react';
import { createClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import { dropOutboxMatching } from '../storage/outbox';
import type { Challenge, Result } from '../api/types';
import { contractFor, gameTitle, rankResults } from '../contract/challenge';
import { GAMES } from '@/app/registry';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import type { ClubConnection } from '@/storage/schemas';
import type { ClubPlayRequest } from '@/ui/clubBridge';
import { dateLabel, errorText, factsLine, RankMark, ScreenFrame } from './common';
import { challengeTitle } from './ClubScreen';
import { NameSheet } from './NameSheet';

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

export function ChallengeScreen({
  connection,
  challengeId,
  onBack,
  onPlay,
}: {
  connection: ClubConnection;
  challengeId: string;
  onBack: () => void;
  onPlay: (request: ClubPlayRequest) => void;
}) {
  const { t, locale } = useSettings();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** Another member's result, its name pressed: the sheet with Report. */
  const [sheet, setSheet] = useState<{ result: Result; detail: string } | null>(null);
  const [reportedNote, setReportedNote] = useState(false);
  const isOwner = connection.role === 'owner';

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
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    } finally {
      if (alive.current) setLoading(false);
    }
  };

  useEffect(() => {
    alive.current = true;
    void load();
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

  const gameId = challenge ? (GAMES.find((g) => g.id === challenge.gameId)?.id ?? null) : null;

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

  /** Reporting twice is harmless (the server answers 204 and changes nothing). */
  const report = async (result: Result) => {
    setError(null);
    setReportedNote(false);
    try {
      await createClient(connection.endpoint, connection.memberToken).reportMember(result.memberId);
      if (alive.current) setReportedNote(true);
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    }
  };

  return (
    <ScreenFrame
      title={challenge ? challengeTitle(challenge, t) : connection.clubName}
      onBack={onBack}
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
      {reportedNote ? (
        <p className="club-quiet" role="status">
          {t('clubReported')}
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
                  {own || isOwner ? (
                    result.nickname
                  ) : (
                    <button
                      type="button"
                      className="club-name-btn"
                      onClick={() => setSheet({ result, detail: facts })}
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
      {sheet ? (
        <NameSheet
          nickname={sheet.result.nickname}
          detail={sheet.detail}
          t={t}
          onClose={() => setSheet(null)}
          onReport={() => report(sheet.result)}
        />
      ) : null}
    </ScreenFrame>
  );
}
