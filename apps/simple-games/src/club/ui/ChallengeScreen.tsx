/**
 * One challenge (club.md §9「Challenge」): the disclosure comes before `Play`
 * (§2-2「開示が先、送信が後」), the ranked results come after. Results are
 * ordered by the game's contract on this device; the server only stores them.
 */
import { useEffect, useRef, useState } from 'react';
import { createClient } from '../api/client';
import type { Challenge, Result } from '../api/types';
import { contractFor, gameTitle, rankResults } from '../contract/challenge';
import { GAMES } from '@/app/registry';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection } from '@/storage/schemas';
import type { ClubPlayRequest } from '@/ui/clubBridge';
import { dateLabel, errorText, factsLine, ScreenFrame } from './common';
import { challengeTitle } from './ClubScreen';

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

  const ranked = challenge && results ? rankResults(contractFor(challenge.gameId), results) : [];

  const gameId = challenge ? (GAMES.find((g) => g.id === challenge.gameId)?.id ?? null) : null;

  const play = () => {
    if (!challenge || gameId === null) return;
    // The game opens onto its own daily and its result goes out like any other;
    // what the shell keeps is only the way back to this challenge.
    onPlay({ gameId, focus: { endpoint: connection.endpoint, challengeId: challenge.id } });
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
              {/* A replay sends nothing (club.md §6-3), so it promises nothing. */}
              {!challenge.mine && (
                <p className="club-disclosure">
                  {t('clubDailyDisclosure', {
                    game: gameTitle(challenge.gameId) ?? challenge.gameId,
                    club: connection.clubName,
                  })}
                </p>
              )}
              <button type="button" className="btn btn-primary" onClick={play}>
                {challenge.mine ? t('clubPlayAgain') : t('clubPlay')}
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
                  {rank !== null ? (
                    <span className="club-rank">{t('clubRank', { n: rank })}</span>
                  ) : null}
                  {result.nickname}
                  {own ? <span className="club-you">{t('clubYou')}</span> : null}
                </span>
                <span className="settings-row-value">{facts}</span>
              </div>
            );
          })}
        </>
      ) : null}
    </ScreenFrame>
  );
}
