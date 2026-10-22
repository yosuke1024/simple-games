/**
 * The people of one Club (club.md §9「Members」, §17-2): a screen of its own, so
 * the Club screen stays about play and a long list never pushes the rankings
 * out of reach. It asks for nothing when it opens — the newest page, the total
 * and (for the Owner) the Reported list are the lists the Club screen already
 * read, handed down by ClubRoot. `Show older members` is the one request here,
 * one page per press (never a scroll that loads by itself). It stops offering it
 * when a page adds nobody or the server is from before the route (404); that is
 * kept with the lists (`ClubData.olderExhausted`), not here, because this screen
 * is rebuilt each time a member's view is closed. The page size is the server's
 * (an operator may set it), so no count of ours says which page is the last.
 *
 * A name opens that member's view (`MemberScreen`); one's own name is plain
 * text. The Owner has Rename / Remove on every other row, and above the list
 * the members others reported (§17-3). What the Owner does is sent here and
 * then handed to ClubRoot, which keeps the lists the Club screen will show when
 * it is back.
 */
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection } from '@/storage/schemas';
import { createClient, type ClubClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import type { Member, MembersPage, ReportedMember } from '../api/types';
import { dateLabel, errorText, ScreenFrame, useRestoredScroll } from './common';
import { RemoveDialog, RenamePanel } from './memberActions';

export function MembersScreen({
  connection,
  members,
  memberCount,
  reported,
  exhausted,
  scrollTop,
  onMore,
  onNoOlder,
  onOpenMember,
  onRenamed,
  onRemoved,
  onBack,
}: {
  connection: ClubConnection;
  /** The newest page, and the older pages read since: the Club screen's list. */
  members: readonly Member[];
  /** All members of the Club. */
  memberCount: number;
  /** Owner only: members others reported, most reported first. */
  reported: readonly ReportedMember[];
  /** There is no older page to ask for (ClubRoot keeps this with the lists). */
  exhausted: boolean;
  /** Where the list was scrolled to when a member's view was opened over it. */
  scrollTop?: number;
  /** An older page was read: ClubRoot appends it to the Club screen's list. */
  onMore: (page: MembersPage) => void;
  /** The server has no older page to give (a 404): ClubRoot stops offering the button. */
  onNoOlder: () => void;
  /** A name was pressed; `scrollTop` is where the list is now, for the way back. */
  onOpenMember: (memberId: string, nickname: string, scrollTop: number) => void;
  /** The Owner renamed a member: the server's answer. */
  onRenamed: (member: Member) => void;
  /** The Owner removed a member; `purge` also erased their results. */
  onRemoved: (memberId: string, purge: boolean) => void;
  onBack: () => void;
}) {
  const { t, locale } = useSettings();
  const [paging, setPaging] = useState(false);
  const [pagingError, setPagingError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const clientRef = useRef<ClubClient | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useRestoredScroll(bodyRef, scrollTop);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const isOwner = connection.role === 'owner';
  const client = () => {
    clientRef.current ??= createClient(connection.endpoint, connection.memberToken);
    return clientRef.current;
  };

  const last = members[members.length - 1];
  const more = !exhausted && last !== undefined && members.length < memberCount;

  /** The members who joined before the last one shown, one server page of them (club.md §5-3). */
  const showOlder = async () => {
    if (last === undefined) return;
    setPaging(true);
    setPagingError(null);
    try {
      const page = await client().membersBefore(last.id);
      if (!alive.current) return;
      // ClubRoot appends it, and stops offering the button when it added nobody.
      onMore(page);
    } catch (e) {
      if (!alive.current) return;
      // A server from before the route has nothing older to offer; say nothing (club.md §17-2).
      if (e instanceof ClubApiError && e.code === 'not_found') onNoOlder();
      else setPagingError(errorText(e, t, connection.clubName));
    } finally {
      if (alive.current) setPaging(false);
    }
  };

  const rename = async (member: Member, nickname: string) => {
    setActionError(null);
    try {
      const renamed = await client().renameMember(member.id, nickname);
      // The lists are ClubRoot's, so they follow even if this screen was left meanwhile.
      onRenamed(renamed);
      if (alive.current) setRenaming(null);
    } catch (e) {
      if (alive.current) setActionError(errorText(e, t, connection.clubName));
    }
  };

  const remove = async (member: Member, purge: boolean) => {
    setConfirmRemove(null);
    setActionError(null);
    try {
      await client().removeMember(member.id, { purge });
      onRemoved(member.id, purge);
    } catch (e) {
      if (alive.current) setActionError(errorText(e, t, connection.clubName));
    }
  };

  /**
   * One member line. A name opens that member's view for anyone but oneself;
   * the Owner also gets Rename / Remove on everyone else (club.md §17-3).
   */
  const memberLine = (section: string, m: Member, value: string) => {
    const key = `${section}:${m.id}`;
    if (renaming === key) {
      return (
        <RenamePanel
          key={key}
          member={m}
          t={t}
          onCancel={() => setRenaming(null)}
          onSave={(nickname) => rename(m, nickname)}
        />
      );
    }
    const other = m.id !== connection.memberId;
    return (
      <div className="settings-row settings-row-static club-line" key={key}>
        <span className="settings-row-label">
          {other ? (
            <button
              type="button"
              className="club-name-btn"
              onClick={() => onOpenMember(m.id, m.nickname, bodyRef.current?.scrollTop ?? 0)}
            >
              {m.nickname}
            </button>
          ) : (
            m.nickname
          )}
        </span>
        <span className="settings-row-value">{value}</span>
        {other && isOwner ? (
          <>
            <button type="button" className="club-text-btn" onClick={() => setRenaming(key)}>
              {t('clubRename')}
            </button>
            <button
              type="button"
              className="club-text-btn club-danger"
              onClick={() => setConfirmRemove(m)}
            >
              {t('clubRemove')}
            </button>
          </>
        ) : null}
      </div>
    );
  };

  const reportedOthers = isOwner ? reported.filter((r) => r.member.id !== connection.memberId) : [];

  return (
    <ScreenFrame title={t('clubMembers')} onBack={onBack} bodyRef={bodyRef} t={t}>
      {actionError ? (
        <p className="club-note club-note-error" role="alert">
          {actionError}
        </p>
      ) : null}

      {reportedOthers.length > 0 ? (
        <>
          <h2 className="home-section-label club-section">{t('clubReported')}</h2>
          {reportedOthers.map((r) =>
            memberLine('reported', r.member, t('clubReportCount', { n: r.reportCount })),
          )}
        </>
      ) : null}

      <h2 className="home-section-label club-section">
        {t('clubMembersCount', { n: memberCount })}
      </h2>
      {members.map((m) =>
        memberLine('members', m, t('clubJoinedOn', { date: dateLabel(m.joinedAt, locale) })),
      )}

      {more ? (
        <button
          type="button"
          className="btn btn-ghost club-older"
          disabled={paging}
          onClick={() => void showOlder()}
        >
          {t('clubOlderMembers')}
        </button>
      ) : null}
      {pagingError ? (
        <p className="club-note club-note-error" role="alert">
          {pagingError}
        </p>
      ) : null}

      {confirmRemove ? (
        <RemoveDialog
          member={confirmRemove}
          t={t}
          onCancel={() => setConfirmRemove(null)}
          onRemove={(purge) => void remove(confirmRemove, purge)}
        />
      ) : null}
    </ScreenFrame>
  );
}
