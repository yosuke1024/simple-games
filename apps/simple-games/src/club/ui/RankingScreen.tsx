/**
 * One game × mode table (club.md §16-2): the server's order is the rank, so
 * nothing is sorted here. The viewer's row says `You`; when it is below the
 * rows the server sent, it follows after a separator with its own rank.
 */
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { createClient } from '../api/client';
import type { RankingEntry, RankingTable } from '../api/types';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection } from '@/storage/schemas';
import { errorText, factsLine, ScreenFrame } from './common';
import { rankingTitle } from './ClubScreen';

const TOP = 50;

export function RankingScreen({
  connection,
  gameId,
  paramsKey,
  onBack,
}: {
  connection: ClubConnection;
  gameId: string;
  paramsKey: string;
  onBack: () => void;
}) {
  const { t } = useSettings();
  const [table, setTable] = useState<RankingTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const [confirmReport, setConfirmReport] = useState<RankingEntry | null>(null);
  const [reportedIds, setReportedIds] = useState<readonly string[]>([]);

  const load = async () => {
    const client = createClient(connection.endpoint, connection.memberToken);
    setLoading(true);
    setError(null);
    try {
      const next = await client.ranking(gameId, paramsKey, TOP);
      if (alive.current) setTable(next);
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
  }, [gameId, paramsKey, connection.endpoint]);

  const report = async (entry: RankingEntry) => {
    setConfirmReport(null);
    setError(null);
    try {
      await createClient(connection.endpoint, connection.memberToken).reportMember(entry.memberId);
      setReportedIds((ids) => [...ids, entry.memberId]);
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    }
  };

  const row = (entry: RankingEntry, rank: number | null) => {
    const own = entry.memberId === connection.memberId;
    return (
      <div
        className={`settings-row settings-row-static club-line${own ? ' club-own' : ''}`}
        key={`${rank}:${entry.memberId}`}
      >
        <span className="settings-row-label">
          {/* No number when the server stopped counting below its ceiling (club.md §16-1). */}
          <span className="club-rank">{rank === null ? '' : t('clubRank', { n: rank })}</span>
          {own ? t('clubYou') : entry.nickname}
        </span>
        <span className="settings-row-value">{factsLine(gameId, entry.facts, t)}</span>
        {own ? null : reportedIds.includes(entry.memberId) ? (
          <span className="club-quiet">{t('clubReported')}</span>
        ) : (
          <button
            type="button"
            className="club-text-btn club-quiet-btn"
            aria-label={`${t('clubReport')} ${entry.nickname}`}
            onClick={() => setConfirmReport(entry)}
          >
            {t('clubReport')}
          </button>
        )}
      </div>
    );
  };

  const meBelow =
    table?.me != null && !table.entries.some((e) => e.memberId === table.me?.entry.memberId)
      ? table.me
      : null;

  return (
    <ScreenFrame title={rankingTitle(gameId, paramsKey, t)} onBack={onBack} t={t}>
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
      {table ? (
        <>
          {table.entries.length === 0 ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
          {table.entries.map((entry, i) => row(entry, i + 1))}
          {meBelow ? (
            <>
              <div className="club-separator" aria-hidden="true">
                …
              </div>
              {row(meBelow.entry, meBelow.rank)}
            </>
          ) : null}
          <p className="club-quiet club-footer">{t('clubEntries', { n: table.entryCount })}</p>
        </>
      ) : null}
      <ConfirmDialog
        open={confirmReport !== null}
        title={t('clubReportTitle')}
        body={t('clubReportBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubReport')}
        onCancel={() => setConfirmReport(null)}
        onConfirm={() => {
          if (confirmReport) void report(confirmReport);
        }}
      />
    </ScreenFrame>
  );
}
