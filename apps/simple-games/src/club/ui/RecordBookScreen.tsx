import { useEffect, useRef, useState } from 'react';
import type { ClubConnection } from '@/storage/schemas';
import { useSettings } from '@/state/SettingsContext';
import { ClubApiError } from '../api/errors';
import { createManagedClient, type OwnerSpace } from '../api/managed';
import { clearManagedOwnerAdRemoval } from '../storage/connections';
import {
  createRecordsClient,
  type OwnerRecords,
  type RecordDaily,
  type RecordTable,
} from '../api/ownerRecords';
import { gameTitle } from '../contract/challenge';
import { membershipConnection } from './ManagedScreen';
import { axisText, errorText, factText, rankingTitle, ScreenFrame, todayLocal } from './common';

interface Read {
  connection: ClubConnection;
  data: OwnerRecords;
}
/** Sorted object keys keep the same board together even when JSON property order differs. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function dailyComparisonKey(row: RecordDaily): string {
  return canonical([
    row.gameId,
    row.contractVersion,
    row.params,
    row.seed,
    row.boardDigest,
    row.daily,
  ]);
}

/** Only owned Clubs are read; same-game/mode tables and exactly matching daily boards stay separate. */
export function RecordBookScreen({
  connection,
  managed,
  onAlbums,
  onBack,
}: {
  connection?: ClubConnection;
  managed?: { origin: string; owner: OwnerSpace; token: string };
  onAlbums: (connection: ClubConnection) => void;
  onBack: () => void;
}) {
  const { t } = useSettings();
  const [reads, setReads] = useState<Read[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const date = useRef(todayLocal());
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      let connections: ClubConnection[] = connection ? [connection] : [];
      if (managed) {
        const api = createManagedClient(managed.origin, managed.token);
        // Basic has at most three Clubs. A future plan must retain this explicit batch bound.
        const ready = managed.owner.clubs.filter((club) => club.status === 'ready');
        connections = [];
        for (let i = 0; i < ready.length; i += 3) {
          const batch = await Promise.allSettled(
            ready
              .slice(i, i + 3)
              .map(async (club) => membershipConnection(await api.connect(club.id))),
          );
          for (const item of batch) {
            if (item.status === 'fulfilled') connections.push(item.value);
            else {
              // A refused owner key ends the owner's ad benefit here too, as on the owner
              // screen (managed-clubs.md §8): the cached benefit must not outlive the key.
              if (item.reason instanceof ClubApiError && item.reason.code === 'unauthorized') {
                await clearManagedOwnerAdRemoval({
                  origin: managed.origin,
                  ownerToken: managed.token,
                });
              }
              if (alive.current) setError(errorText(item.reason, t));
            }
          }
        }
      }
      const next: Read[] = [];
      for (let i = 0; i < connections.length; i += 3) {
        const settled = await Promise.allSettled(
          connections.slice(i, i + 3).map(async (c) => ({
            connection: c,
            data: await createRecordsClient(c.endpoint, c.memberToken).records({
              daily: date.current,
            }),
          })),
        );
        for (const item of settled) {
          if (item.status === 'fulfilled') next.push(item.value);
          else if (alive.current) setError(errorText(item.reason, t));
        }
      }
      if (alive.current) setReads(next);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const more = async (read: Read) => {
    setBusy(true);
    setError(null);
    try {
      const data = await createRecordsClient(
        read.connection.endpoint,
        read.connection.memberToken,
      ).records({
        daily: date.current,
        ...(read.data.nextAfter ? { after: read.data.nextAfter } : {}),
        ...(read.data.nextDailyAfter ? { dailyAfter: read.data.nextDailyAfter } : {}),
      });
      if (alive.current)
        setReads((rows) =>
          rows.map((row) =>
            row.connection.endpoint !== read.connection.endpoint
              ? row
              : {
                  ...row,
                  data: {
                    ...data,
                    tables: [
                      ...row.data.tables,
                      ...data.tables.filter(
                        (item) =>
                          !row.data.tables.some(
                            (old) => old.gameId === item.gameId && old.paramsKey === item.paramsKey,
                          ),
                      ),
                    ],
                    daily: [
                      ...row.data.daily,
                      ...data.daily.filter(
                        (item) =>
                          !row.data.daily.some((old) => old.challengeId === item.challengeId),
                      ),
                    ],
                    nextAfter: read.data.nextAfter ? data.nextAfter : null,
                    nextDailyAfter: read.data.nextDailyAfter ? data.nextDailyAfter : null,
                  },
                },
          ),
        );
    } catch (e) {
      if (alive.current) setError(errorText(e, t));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const tables = new Map<string, { read: Read; row: RecordTable }[]>();
  const dailies = new Map<string, { read: Read; row: RecordDaily }[]>();
  for (const read of reads) {
    for (const row of read.data.tables) {
      const key = `${row.gameId}:${row.paramsKey}`;
      tables.set(key, [...(tables.get(key) ?? []), { read, row }]);
    }
    for (const row of read.data.daily) {
      const key = dailyComparisonKey(row);
      dailies.set(key, [...(dailies.get(key) ?? []), { read, row }]);
    }
  }
  return (
    <ScreenFrame title={t('clubRecordBook')} onBack={onBack} t={t}>
      <p className="club-disclosure">{t('clubRecordBasis')}</p>
      <button className="club-text-btn" disabled={busy} onClick={() => void load()}>
        {t('clubReload')}
      </button>
      {busy ? (
        <p className="club-quiet" role="status">
          {t('clubLoading')}
        </p>
      ) : null}
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}
      {[...tables.entries()].map(([key, rows]) => (
        <section key={key} className="club-managed-card">
          <h2>{rankingTitle(rows[0]!.row.gameId, rows[0]!.row.paramsKey, t)}</h2>
          <div className="club-comparison-scroll">
            <table className="club-comparison">
              <thead>
                <tr>
                  <th>{t('clubName')}</th>
                  <th>{t('clubMembers')}</th>
                  <th>{t('clubResults')}</th>
                  <th>{t('clubYou')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ read, row }) => (
                  <tr key={read.connection.endpoint}>
                    <th>{read.data.club.name}</th>
                    <td>{t('clubRecordParticipants', { n: row.participantCount })}</td>
                    <td>
                      {row.leader ? (
                        <>
                          {axisText(row.gameId, row.leader.facts, t)}
                          <small>{row.leader.nickname}</small>
                        </>
                      ) : (
                        '—'
                      )}
                      {row.medianBestValue === null ? null : (
                        <small>
                          {t('clubRecordMedian', {
                            value:
                              row.axis.fact === 'elapsedSeconds'
                                ? (factText(row.axis.fact, row.medianBestValue, t) ?? '')
                                : String(row.medianBestValue),
                          })}
                        </small>
                      )}
                    </td>
                    <td>
                      {row.me ? (
                        <>
                          {t('clubRecordOwnRank', { rank: row.me.rank })}
                          <small>{axisText(row.gameId, row.me.entry.facts, t)}</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {[...dailies.entries()].map(([key, rows]) => (
        <section key={key} className="club-managed-card">
          <h2>
            {gameTitle(rows[0]!.row.gameId)} · {t('clubDaily')} · {rows[0]!.row.daily}
          </h2>
          <div className="club-comparison-scroll">
            <table className="club-comparison">
              <thead>
                <tr>
                  <th>{t('clubName')}</th>
                  <th>{t('clubMembers')}</th>
                  <th>{t('clubResults')}</th>
                  <th>{t('clubYou')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ read, row }) => (
                  <tr key={read.connection.endpoint}>
                    <th>{read.data.club.name}</th>
                    <td>{t('clubRecordParticipants', { n: row.participantCount })}</td>
                    <td>
                      {row.leader ? (
                        <>
                          {axisText(row.gameId, row.leader.facts, t)}
                          <small>{row.leader.nickname}</small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{row.me ? t('clubRecordOwnRank', { rank: row.me.rank }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!busy && reads.length > 0 && tables.size === 0 && dailies.size === 0 ? (
        <p className="club-quiet">{t('clubNothingYet')}</p>
      ) : null}
      {reads.map((read) => (
        <section key={read.connection.endpoint} className="club-managed-card">
          <h2>{read.data.club.name}</h2>
          <div className="club-actions">
            {read.data.nextAfter || read.data.nextDailyAfter ? (
              <button className="btn btn-ghost" disabled={busy} onClick={() => void more(read)}>
                {t('clubMoreRecords')}
              </button>
            ) : null}
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => onAlbums(read.connection)}
            >
              {t('clubAlbums')}
            </button>
          </div>
        </section>
      ))}
    </ScreenFrame>
  );
}
