/**
 * One game's tables (club.md §16-2): the game's tile and title, its modes as
 * chips (only the modes the Club has a table for, easiest first), then the
 * chosen table. Every finished game is a row of its own (decision 45), so the
 * viewer may be on it many times: each of their rows says `You` and carries
 * its own quiet delete. The server's order is the rank, so nothing is sorted
 * here. When the viewer's best row is below the rows the server sent, it
 * follows after a separator with its own rank. Another member's name opens that
 * member's view (§9「Member」) — on every device, the owner's too. The table it
 * last read is handed up (`onRead`) and back (`cached`), with where it was
 * scrolled to, so closing that view shows the table where it was left.
 */
import { useEffect, useRef, useState } from 'react';
import { GAMES } from '@/app/registry';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection } from '@/storage/schemas';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameTile } from '@/ui/components/GameTile';
import { createClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import type { RankingEntry, RankingSummary, RankingTable } from '../api/types';
import { gameTitle } from '../contract/challenge';
import {
  axisGap,
  axisText,
  errorText,
  factsLine,
  modeLabel,
  RankMark,
  rankingTitle,
  ScreenFrame,
  sortModes,
  useRestoredScroll,
  type T,
} from './common';

const TOP = 50;

/** The table a mode last answered with; ClubRoot keeps it on the step while a member's view is open. */
export interface RankingRead {
  /** The mode (`paramsKey`) the table is for. */
  key: string;
  table: RankingTable;
}

/** A chip's word: the mode as a title would name it; a daily table says Daily. */
function chipLabel(gameId: string, key: string, t: T): string {
  if (key === 'daily') return t('clubDaily');
  return modeLabel(gameId, key, t) ?? gameTitle(gameId) ?? key;
}

export function RankingScreen({
  connection,
  gameId,
  paramsKey,
  tables,
  cached,
  refresh = false,
  scrollTop,
  onRead,
  onMode,
  onChanged,
  onOpenMember,
  onBack,
}: {
  connection: ClubConnection;
  gameId: string;
  /** The mode on screen; null: the first of the game's modes. */
  paramsKey: string | null;
  /** The game's tables as the Club screen listed them: the chips, without a request. */
  tables: readonly RankingSummary[];
  /** What this screen read before a member's view was opened over it; undefined on a fresh open. */
  cached?: RankingRead;
  /** Something done on the screen above changed what the tables hold: read it again (club.md §9). */
  refresh?: boolean;
  /** Where the body was scrolled to when a member's view was opened over it. */
  scrollTop?: number;
  /** A table was read anew (not the cached one handed back): ClubRoot keeps it for the way back. */
  onRead: (read: RankingRead) => void;
  /** A chip was pressed: the mode to show instead (ClubRoot replaces this screen, never stacks one). */
  onMode: (paramsKey: string) => void;
  /** One of the viewer's rows was deleted: the Club screen's lists are out of date. */
  onChanged: () => void;
  /** Another member's name was pressed: ClubRoot pushes that member's view; `scrollTop` is where the body is. */
  onOpenMember: (memberId: string, nickname: string, scrollTop: number) => void;
  onBack: () => void;
}) {
  const { t } = useSettings();
  // The mode on screen is always among the chips, even if the list it came from lacked it.
  const modes = sortModes(gameId, [
    ...tables.filter((r) => r.gameId === gameId).map((r) => r.paramsKey),
    ...(paramsKey === null ? [] : [paramsKey]),
  ]);
  const key = paramsKey ?? modes[0] ?? 'standard';
  // A game with one table and no modes (`standard`) needs no chip to say which it is.
  const chips = modes.length > 1 || (modes.length === 1 && modes[0] !== 'standard');
  const game = GAMES.find((g) => g.id === gameId);

  // The table the step kept, when it is the mode on screen: shown at once, with no request
  // (a Back from a member's view), unless something up there changed what it holds.
  const kept = cached !== undefined && cached.key === key ? cached.table : null;
  const [table, setTable] = useState<RankingTable | null>(kept);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(kept === null || refresh);
  const [confirmDelete, setConfirmDelete] = useState<RankingEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  useRestoredScroll(bodyRef, scrollTop);
  const alive = useRef(true);
  /** The newest read: an answer for a mode the person has already left is dropped. */
  const latest = useRef(0);

  const client = () => createClient(connection.endpoint, connection.memberToken);

  const load = async (mode: string) => {
    const ticket = ++latest.current;
    const current = () => alive.current && ticket === latest.current;
    setLoading(true);
    setError(null);
    try {
      const next = await client().ranking(gameId, mode, TOP);
      if (current()) {
        setTable(next);
        onRead({ key: mode, table: next });
      }
    } catch (e) {
      if (current()) setError(errorText(e, t, connection.clubName));
    } finally {
      if (current()) setLoading(false);
    }
  };

  useEffect(() => {
    alive.current = true;
    const held = cached !== undefined && cached.key === key;
    // A mode of its own: nothing of the last table stays on screen under the new chip.
    if (!held) setTable(null);
    // A table handed back is not asked for again, unless something changed it meanwhile.
    if (!held || refresh) void load(key);
    return () => {
      alive.current = false;
    };
    // Once per open and once per chip pressed; `Reload` is the only other fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, key, connection.endpoint]);

  /**
   * Deletes one of the viewer's rows, by its id (club.md §5-4, decision 51).
   * Nothing queued on this device is dropped: a queued result is another
   * game's, and becomes another row. A 404 means the row is already gone —
   * the table is simply read again. A row without an id comes from a server
   * from before rows had one (one row per member there), so it goes through
   * the compatibility route, which deletes that one row.
   */
  const deleteEntry = async (entry: RankingEntry) => {
    setConfirmDelete(null);
    setDeleting(true);
    setError(null);
    try {
      try {
        if (entry.id === null) await client().deleteMyRanking(gameId, key);
        else await client().deleteMyEntry(gameId, key, entry.id);
      } catch (e) {
        if (!(e instanceof ClubApiError && e.code === 'not_found')) throw e;
      }
      onChanged();
      if (alive.current) await load(key);
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    } finally {
      if (alive.current) setDeleting(false);
    }
  };

  const row = (entry: RankingEntry, rank: number | null, rowKey: string) => {
    const own = entry.memberId === connection.memberId;
    return (
      <div
        className={`settings-row settings-row-static club-line${own ? ' club-own' : ''}`}
        key={rowKey}
      >
        <span className="settings-row-label">
          <RankMark rank={rank} t={t} />
          {own ? (
            t('clubYou')
          ) : (
            <button
              type="button"
              className="club-name-btn"
              onClick={() =>
                onOpenMember(entry.memberId, entry.nickname, bodyRef.current?.scrollTop ?? 0)
              }
            >
              {entry.nickname}
            </button>
          )}
        </span>
        <span className="settings-row-value">{factsLine(gameId, entry.facts, t)}</span>
        {own ? (
          <button
            type="button"
            className="club-text-btn club-quiet-btn"
            aria-label={t('clubDeleteRecord')}
            disabled={deleting}
            onClick={() => setConfirmDelete(entry)}
          >
            {t('clubDeleteConfirm')}
          </button>
        ) : null}
      </div>
    );
  };

  const me = table?.me ?? null;
  // The viewer's best row, when it is not among the rows sent: by its id, or by
  // whose it is on a server without ids (one row each there).
  const meBelow =
    me !== null &&
    !table!.entries.some((e) =>
      me.entry.id !== null ? e.id === me.entry.id : e.memberId === me.entry.memberId,
    )
      ? me
      : null;
  const gap = me === null ? '' : axisGap(gameId, me.entry.facts, me.nextValue, t);
  const standing =
    me === null || table === null
      ? ''
      : [
          me.rank === null ? '' : t('clubRank', { n: me.rank }),
          t('clubEntries', { n: table.entryCount }),
          axisText(gameId, me.entry.facts, t),
          gap === '' ? '' : t('clubToNext', { gap }),
        ]
          .filter((part) => part !== '')
          .join(' · ');
  const title = chips ? (gameTitle(gameId) ?? gameId) : rankingTitle(gameId, key, t);

  return (
    <ScreenFrame
      title={title}
      lead={game ? <GameTile game={game} /> : undefined}
      onBack={onBack}
      bodyRef={bodyRef}
      t={t}
    >
      {chips ? (
        // The game's accent on its own chips, as its home wears it.
        <div className={`club-chips accent-${gameId}`} role="tablist" aria-label={title}>
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              id={`club-tab-${mode}`}
              aria-selected={mode === key}
              aria-controls="club-ranking-panel"
              className="club-chip"
              onClick={() => {
                if (mode !== key) onMode(mode);
              }}
            >
              {chipLabel(gameId, mode, t)}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="club-panel"
        {...(chips
          ? { role: 'tabpanel', id: 'club-ranking-panel', 'aria-labelledby': `club-tab-${key}` }
          : {})}
      >
        <div className="club-toolbar">
          <button
            type="button"
            className="club-text-btn"
            disabled={loading}
            onClick={() => void load(key)}
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
            {standing ? <p className="club-standing">{standing}</p> : null}
            {table.entries.length === 0 ? (
              <p className="club-quiet">{t('clubNothingYet')}</p>
            ) : null}
            {table.entries.map((entry, i) => row(entry, i + 1, entry.id ?? `row-${i}`))}
            {meBelow ? (
              <>
                <div className="club-separator" aria-hidden="true">
                  …
                </div>
                {row(meBelow.entry, meBelow.rank, 'below')}
              </>
            ) : null}
            <p className="club-quiet club-footer">
              <span>{t('clubEntries', { n: table.entryCount })}</span>
              {' · '}
              <span>{t('clubRowsNote')}</span>
            </p>
          </>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('clubDeleteEntryTitle')}
        body={t('clubDeleteEntryBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubDeleteConfirm')}
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) void deleteEntry(confirmDelete);
        }}
      />
    </ScreenFrame>
  );
}
