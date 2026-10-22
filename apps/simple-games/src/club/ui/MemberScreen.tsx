/**
 * One member (club.md §9「Member」): what another member's name opens, from the
 * Members list, a table's row or a daily's result. The name, when they joined,
 * and the tables they are in as the same rows "Your rankings" draws (club.md
 * §16-2) — what the tables already show, gathered under one name, and nothing
 * else (no totals, no recent results, no last-played time: §14, decision 54).
 * One request when the screen opens (`GET /members/:id`); coming back to it
 * from a table reads it again, and there is no `Reload`.
 *
 * Under the rows, a member's one action is `Report` behind a confirmation
 * (§17-3); the Owner's are `Rename` and `Remove`, which reach a member the
 * list does not show too. A server that has no such route (404) leaves the
 * name the person pressed as the title and a line saying so, and the actions
 * stay. Nothing is offered on one's own view — the screens never open it.
 */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection } from '@/storage/schemas';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { createClient, type ClubClient } from '../api/client';
import type { Member, MemberView, RankingSummary } from '../api/types';
import { dateLabel, errorText, ScreenFrame } from './common';
import { RemoveDialog, RenamePanel } from './memberActions';
import { shelfGames, sortByShelf, StandingRow } from './standings';

export function MemberScreen({
  connection,
  memberId,
  nickname,
  tables,
  onOpenRanking,
  onRenamed,
  onRemoved,
  onBack,
}: {
  connection: ClubConnection;
  memberId: string;
  /** The name that was pressed: the title until the server's own arrives. */
  nickname: string;
  /** The Club screen's tables: the chips of a table opened from here, without a request. */
  tables: readonly RankingSummary[];
  /** A game's table: `paramsKey` is the mode to show first. */
  onOpenRanking: (gameId: string, paramsKey: string | null, tables: RankingSummary[]) => void;
  /** The Owner renamed this member: the server's answer. */
  onRenamed: (member: Member) => void;
  /** The Owner removed this member (`purge`: and erased their results); the screen goes. */
  onRemoved: (memberId: string, purge: boolean) => void;
  onBack: () => void;
}) {
  const { t, locale } = useSettings();
  const [view, setView] = useState<MemberView | null>(null);
  const [name, setName] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmReport, setConfirmReport] = useState(false);
  /** A report went through: one quiet line, and the button stays (reporting twice is harmless). */
  const [reportedNote, setReportedNote] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const clientRef = useRef<ClubClient | null>(null);
  const alive = useRef(true);

  const isOwner = connection.role === 'owner';
  const own = memberId === connection.memberId;
  const client = () => {
    clientRef.current ??= createClient(connection.endpoint, connection.memberToken);
    return clientRef.current;
  };

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    setError(null);
    client()
      .member(memberId)
      .then((loaded) => {
        if (!alive.current) return;
        setView(loaded);
        setName(loaded.member.nickname);
      })
      .catch((e: unknown) => {
        if (alive.current) setError(errorText(e, t, connection.clubName));
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
    };
    // One request per open; there is no Reload (club.md §9).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, connection.endpoint]);

  /** Reporting twice is harmless (the server answers 204 and changes nothing). */
  const report = async () => {
    setActionError(null);
    setReportedNote(false);
    try {
      await client().reportMember(memberId);
      if (alive.current) setReportedNote(true);
    } catch (e) {
      if (alive.current) setActionError(errorText(e, t, connection.clubName));
    }
  };

  const rename = async (next: string) => {
    setActionError(null);
    try {
      const renamed = await client().renameMember(memberId, next);
      // The Club's lists are ClubRoot's, so they follow even if this screen was left meanwhile.
      onRenamed(renamed);
      if (!alive.current) return;
      setName(renamed.nickname);
      setView((current) =>
        current ? { ...current, member: { ...current.member, ...renamed } } : current,
      );
      setRenaming(false);
    } catch (e) {
      if (alive.current) setActionError(errorText(e, t, connection.clubName));
    }
  };

  const remove = async (purge: boolean) => {
    setConfirmRemove(false);
    setActionError(null);
    try {
      await client().removeMember(memberId, { purge });
      // ClubRoot drops them from the lists and takes this screen away.
      onRemoved(memberId, purge);
    } catch (e) {
      if (alive.current) setActionError(errorText(e, t, connection.clubName));
    }
  };

  const games = shelfGames();
  const rows = view ? sortByShelf(view.rankings, games) : [];

  return (
    <ScreenFrame title={name} onBack={onBack} t={t}>
      {loading ? <p className="club-quiet">{t('clubLoading')}</p> : null}
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}

      {view ? (
        <>
          <p className="club-quiet">
            {t('clubJoinedOn', { date: dateLabel(view.member.joinedAt, locale) })}
          </p>
          <h2 className="home-section-label club-section">{t('clubRankings')}</h2>
          {rows.length === 0 ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
          {rows.map((row) => (
            <StandingRow
              key={`${row.gameId}:${row.paramsKey}`}
              row={row}
              game={games.get(row.gameId)!.game}
              t={t}
              onOpen={() =>
                onOpenRanking(
                  row.gameId,
                  row.paramsKey,
                  tables.filter((table) => table.gameId === row.gameId),
                )
              }
            />
          ))}
        </>
      ) : null}

      {actionError ? (
        <p className="club-note club-note-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {reportedNote ? (
        <p className="club-quiet" role="status">
          {t('clubReported')}
        </p>
      ) : null}

      {own ? null : isOwner ? (
        // The Owner deals with a member rather than reporting them (club.md §17-3).
        renaming ? (
          <RenamePanel
            member={{ nickname: name }}
            t={t}
            onCancel={() => setRenaming(false)}
            onSave={rename}
          />
        ) : (
          <div className="club-member-actions">
            <button type="button" className="club-text-btn" onClick={() => setRenaming(true)}>
              {t('clubRename')}
            </button>
            <button
              type="button"
              className="club-text-btn club-danger"
              onClick={() => setConfirmRemove(true)}
            >
              {t('clubRemove')}
            </button>
          </div>
        )
      ) : (
        <div className="club-member-actions">
          <button
            type="button"
            className="club-text-btn club-quiet-btn"
            onClick={() => setConfirmReport(true)}
          >
            {t('clubReport')}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmReport}
        title={t('clubReportTitle')}
        body={t('clubReportBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubReport')}
        onCancel={() => setConfirmReport(false)}
        onConfirm={() => {
          // The dialog goes first; the screen says "Reported" once the server answers.
          setConfirmReport(false);
          void report();
        }}
      />
      {confirmRemove ? (
        <RemoveDialog
          member={{ nickname: name }}
          t={t}
          onCancel={() => setConfirmRemove(false)}
          onRemove={(purge) => void remove(purge)}
        />
      ) : null}
    </ScreenFrame>
  );
}
