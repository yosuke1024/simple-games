import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection, PendingClubJoin } from '@/storage/schemas';
import { createManagedClient, type DirectoryPage, type ManagedClub } from '../api/managed';
import { gameTitle } from '../contract/challenge';
import { errorText, ScreenFrame } from './common';

export function DirectoryScreen({
  origin,
  onJoin,
  onBack,
  connections,
  pending,
}: {
  origin: string;
  onJoin: (club: ManagedClub) => void;
  onBack: () => void;
  connections: ClubConnection[];
  pending: PendingClubJoin[];
}) {
  const { t } = useSettings();
  const [page, setPage] = useState<DirectoryPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const load = async (after?: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await createManagedClient(origin).directory(after);
      if (alive.current)
        setPage((current) => ({
          ...next,
          clubs:
            after && current
              ? [
                  ...current.clubs,
                  ...next.clubs.filter((c) => !current.clubs.some((old) => old.id === c.id)),
                ]
              : next.clubs,
        }));
    } catch (e) {
      if (alive.current) setError(errorText(e, t));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [origin]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ScreenFrame title={t('clubFindClubs')} onBack={onBack} t={t}>
      <div className="club-toolbar">
        <button className="club-text-btn" disabled={busy} onClick={() => void load()}>
          {t('clubReload')}
        </button>
      </div>
      {page?.clubs.map((club) => (
        <section key={club.id} className="club-managed-card">
          <h2>{club.name}</h2>
          <p>{t('clubMembersCount', { n: club.memberCount })}</p>
          <p className="club-quiet">
            {club.allowedGameIds === null
              ? t('clubGamesAll')
              : club.allowedGameIds.map((id) => gameTitle(id) ?? id).join(' · ') ||
                t('clubNoGames')}
          </p>
          <button className="btn btn-primary" disabled={busy} onClick={() => onJoin(club)}>
            {t(
              connections.some((c) => c.endpoint === club.endpoint)
                ? 'clubPlay'
                : pending.some((request) => request.endpoint === club.endpoint)
                  ? 'clubCheckRequest'
                  : club.approvalRequired
                    ? 'clubRequestJoin'
                    : 'clubJoinClub',
            )}
          </button>
        </section>
      ))}
      {page?.clubs.length === 0 ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
      {page?.nextCursor ? (
        <button
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => void load(page.nextCursor!)}
        >
          {t('clubMoreRecords')}
        </button>
      ) : null}
      {busy ? <p className="club-quiet">{t('clubLoading')}</p> : null}
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}
    </ScreenFrame>
  );
}
