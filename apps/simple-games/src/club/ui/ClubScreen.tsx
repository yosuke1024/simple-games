/**
 * One Club (club.md §9「Club」): today's dailies, the rankings and the members, read
 * when the screen opens and again only on `Reload`. No timer, no polling, no
 * counts. The Owner's two extras (Invite, Remove) and the Settings panel
 * (change your name, Disconnect — §8-5, §9) live here too,
 * as panels over the same data. Invite is hidden while Private Clubs are off.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, type ClubClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import type { Challenge, Member, RankingSummary, ReportedMember } from '../api/types';
import { contractFor, gameTitle } from '../contract/challenge';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { flushOutbox } from '../storage/outbox';
import { shareGame } from '@/services/share/share';
import type { ClubConnection } from '@/storage/schemas';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconChevronRight } from '@/ui/components/icons';
import { useSettings } from '@/state/SettingsContext';
import { PRIVATE_CLUBS_ENABLED } from '@/ui/clubFeatures';
import {
  axisText,
  dateLabel,
  errorText,
  modeLabel,
  NICKNAME_MAX,
  ScreenFrame,
  todayLocal,
  type T,
} from './common';

interface ClubData {
  /** Challenges tagged with today's daily date (everyone's daily meets here). */
  today: Challenge[];
  /** The local date `today` was asked for, so the answer can be held to it. */
  todayDate: string;
  rankings: RankingSummary[];
  members: Member[];
  /** All members, of whom `members` is the newest page. */
  memberCount: number;
  /** Owner only: members others reported, most reported first. */
  reported: ReportedMember[];
  /** The club's name as the server has it now. */
  clubName: string;
}

export type ClubPanel = 'none' | 'invite' | 'settings';

/** `Sudoku · Hard`; a game with one table (`standard`) is its title alone. */
export function rankingTitle(gameId: string, paramsKey: string, t: T): string {
  const game = gameTitle(gameId) ?? gameId;
  const mode = modeLabel(gameId, paramsKey, t);
  return mode === null ? game : `${game} · ${mode}`;
}

export function challengeTitle(challenge: Challenge, t: T): string {
  const game = gameTitle(challenge.gameId) ?? challenge.gameId;
  const contract = contractFor(challenge.gameId);
  const params = contract?.validateParams(challenge.params);
  const key = params && contract ? contract.paramsKey(params) : null;
  const mode = key !== null ? modeLabel(challenge.gameId, key, t, challenge.daily !== null) : null;
  const title = mode !== null ? `${game} · ${mode}` : game;
  return challenge.daily !== null ? `${title} · ${t('clubDaily')}` : title;
}

export function ClubScreen({
  connection,
  panel,
  onPanel,
  onBack,
  onOpenChallenge,
  onOpenRanking,
  onDisconnect,
  onRenamed,
  onRenamedMe,
  onAcceptAutoSend,
}: {
  connection: ClubConnection;
  panel: ClubPanel;
  onPanel: (panel: ClubPanel) => void;
  onBack: () => void;
  onOpenChallenge: (challengeId: string) => void;
  onOpenRanking: (gameId: string, paramsKey: string) => void;
  onDisconnect: () => Promise<void>;
  /** The server's name for the club differs from the cached one. */
  onRenamed: (clubName: string) => void;
  /** The owner renamed this member: the server's nickname differs from the stored one. */
  onRenamedMe: (nickname: string) => void;
  /** The player accepted the automatic-send disclosure shown for a connection that never saw it. */
  onAcceptAutoSend: () => void;
}) {
  const { t, locale } = useSettings();
  const [data, setData] = useState<ClubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmReport, setConfirmReport] = useState<Member | null>(null);
  /** Members this device reported on this screen; local only. */
  const [reportedIds, setReportedIds] = useState<readonly string[]>([]);
  const [renaming, setRenaming] = useState<{ key: string; member: Member } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const clientRef = useRef<ClubClient | null>(null);
  const flushed = useRef(false);
  const alive = useRef(true);

  const clubName = data?.clubName ?? connection.clubName;
  const isOwner = connection.role === 'owner';

  const client = () => {
    clientRef.current ??= createClient(connection.endpoint, connection.memberToken);
    return clientRef.current;
  };

  const load = useCallback(async () => {
    const api = client();
    setLoading(true);
    setError(null);
    try {
      if (!flushed.current) {
        flushed.current = true;
        // Best effort, oldest first (club.md §10): a result that waited gets its turn now.
        try {
          await flushOutbox(connection.endpoint, api);
        } catch {
          /* the list below says whether the club is reachable */
        }
      }
      const todayDate = todayLocal();
      // Three requests, and a fourth for the owner alone (club.md §10).
      const [club, today, rankings, reported] = await Promise.all([
        api.club(),
        api.challenges({ daily: todayDate }),
        api.rankings(),
        isOwner
          ? // A server from before §17 has no such route: an empty list, not an error.
            // Anything else is a failure the owner must see (club.md §10).
            api.reportedMembers().catch((e: unknown) => {
              if (e instanceof ClubApiError && e.code === 'not_found')
                return [] as ReportedMember[];
              throw e;
            })
          : Promise.resolve([] as ReportedMember[]),
      ]);
      if (!alive.current) return;
      setData({
        clubName: club.club.name,
        members: club.members,
        memberCount: club.memberCount,
        reported,
        today,
        todayDate,
        rankings,
      });
      if (club.club.name !== connection.clubName) onRenamed(club.club.name);
      if (club.me.nickname !== connection.nickname) onRenamedMe(club.me.nickname);
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    } finally {
      if (alive.current) setLoading(false);
    }
    // `t` and `onRenamed` change identity without changing what is fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.endpoint, connection.memberToken, connection.clubName, connection.nickname]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
    // Once per open; `Reload` is the only other fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.endpoint]);

  // Held to the date asked for: a server that predates `?daily=` ignores the
  // parameter and answers with its ordinary list, which is not today's.
  const todays = (data?.today ?? []).filter(
    (c) => contractFor(c.gameId) !== null && c.daily === data?.todayDate,
  );
  const rankings = (data?.rankings ?? []).filter((r) => contractFor(r.gameId) !== null);

  const remove = async (member: Member, purge: boolean) => {
    setConfirmRemove(null);
    setActionError(null);
    try {
      await client().removeMember(member.id, { purge });
      if (purge) {
        // Their results and ranking rows are gone server-side (club.md §17-3): the
        // tables and the Today results on screen are stale, so read them again.
        await load();
        return;
      }
      setData((d) =>
        d
          ? {
              ...d,
              members: d.members.filter((m) => m.id !== member.id),
              reported: d.reported.filter((r) => r.member.id !== member.id),
              memberCount: Math.max(0, d.memberCount - 1),
            }
          : d,
      );
    } catch (e) {
      setActionError(errorText(e, t, clubName));
    }
  };

  const report = async (member: Member) => {
    setConfirmReport(null);
    setActionError(null);
    try {
      await client().reportMember(member.id);
      setReportedIds((ids) => [...ids, member.id]);
    } catch (e) {
      setActionError(errorText(e, t, clubName));
    }
  };

  const rename = async (member: Member, nickname: string) => {
    setActionError(null);
    try {
      const renamed = await client().renameMember(member.id, nickname);
      const apply = (m: Member): Member => (m.id === renamed.id ? { ...m, ...renamed } : m);
      setData((d) =>
        d
          ? {
              ...d,
              members: d.members.map(apply),
              reported: d.reported.map((r) => ({ ...r, member: apply(r.member) })),
            }
          : d,
      );
      setRenaming(null);
    } catch (e) {
      setActionError(errorText(e, t, clubName));
    }
  };

  /**
   * Your own name (club.md §5-3, §9): the server renames the member and the
   * name on their results; reports against them stay. Throws for the panel to show.
   */
  const changeName = async (nickname: string) => {
    const member = await client().renameSelf(nickname);
    onRenamedMe(member.nickname);
    // Your row in the lists carries the new name.
    void load();
  };

  /** One member line: the owner gets Rename / Remove, everyone else Report (never on oneself). */
  const memberLine = (section: string, m: Member, value: string) => {
    if (renaming?.key === `${section}:${m.id}`) {
      return (
        <RenamePanel
          key={`${section}:${m.id}`}
          member={m}
          t={t}
          onCancel={() => setRenaming(null)}
          onSave={(nickname) => rename(m, nickname)}
        />
      );
    }
    const other = m.id !== connection.memberId;
    return (
      <div className="settings-row settings-row-static club-line" key={`${section}:${m.id}`}>
        <span className="settings-row-label">{m.nickname}</span>
        <span className="settings-row-value">{value}</span>
        {other && isOwner ? (
          <>
            <button
              type="button"
              className="club-text-btn"
              onClick={() => setRenaming({ key: `${section}:${m.id}`, member: m })}
            >
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
        {other && !isOwner ? (
          reportedIds.includes(m.id) ? (
            <span className="club-quiet">{t('clubReported')}</span>
          ) : (
            <button
              type="button"
              className="club-text-btn club-quiet-btn"
              onClick={() => setConfirmReport(m)}
            >
              {t('clubReport')}
            </button>
          )
        ) : null}
      </div>
    );
  };

  // The owner's invite panel exists only while Private Clubs are on (club.md §14, decision 44).
  if (panel === 'invite' && PRIVATE_CLUBS_ENABLED) {
    return (
      <InvitePanel clubName={clubName} client={client()} t={t} onBack={() => onPanel('none')} />
    );
  }
  if (panel === 'settings') {
    return (
      <SettingsPanel
        clubName={clubName}
        isOwner={isOwner}
        isPublic={connection.endpoint === PUBLIC_CLUB_ENDPOINT}
        members={data?.members ?? null}
        selfId={connection.memberId}
        nickname={connection.nickname}
        t={t}
        onBack={() => onPanel('none')}
        onDisconnect={onDisconnect}
        onChangeName={changeName}
      />
    );
  }

  return (
    <ScreenFrame
      title={clubName}
      onBack={onBack}
      t={t}
      right={
        <span className="club-header-actions">
          {isOwner && PRIVATE_CLUBS_ENABLED ? (
            <button type="button" className="club-text-btn" onClick={() => onPanel('invite')}>
              {t('clubInvite')}
            </button>
          ) : null}
          <button type="button" className="club-text-btn" onClick={() => onPanel('settings')}>
            {t('clubSettings')}
          </button>
        </span>
      }
    >
      {connection.autoSend === true ? null : (
        // A connection from before results were sent by themselves never saw the
        // disclosure, so nothing is sent until its owner accepts it here (club.md §4-1).
        // Not pressing it changes nothing else: the Club stays fully usable.
        <div className="club-consent">
          <p className="club-disclosure">{t('clubAutoSendDisclosure')}</p>
          <button type="button" className="btn btn-primary" onClick={onAcceptAutoSend}>
            {t('clubAutoSendAccept')}
          </button>
        </div>
      )}
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

      {data ? (
        <>
          {todays.length > 0 ? (
            <>
              <h2 className="home-section-label club-section">{t('clubToday')}</h2>
              {todays.map((c) => (
                <ChallengeRow key={c.id} challenge={c} t={t} onOpen={onOpenChallenge} />
              ))}
            </>
          ) : null}
          <h2 className="home-section-label club-section">{t('clubRankings')}</h2>
          {rankings.length === 0 ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
          {rankings.map((r) => {
            const title = rankingTitle(r.gameId, r.paramsKey, t);
            const leader =
              `1. ${r.leader.nickname} ${axisText(r.gameId, r.leader.facts, t)}`.trim();
            const entries = t('clubEntries', { n: r.entryCount });
            return (
              <button
                type="button"
                className="settings-row club-line"
                key={`${r.gameId}:${r.paramsKey}`}
                aria-label={`${title} · ${leader} · ${entries}`}
                onClick={() => onOpenRanking(r.gameId, r.paramsKey)}
              >
                <span className="settings-row-label club-ranking-title">{title}</span>
                <span className="settings-row-value club-ranking-leader">{leader}</span>
                <span className="settings-row-value club-ranking-count">{entries}</span>
                <span className="settings-row-chevron" aria-hidden="true">
                  <IconChevronRight />
                </span>
              </button>
            );
          })}

          {isOwner && data.reported.length > 0 ? (
            <>
              <h2 className="home-section-label club-section">{t('clubReported')}</h2>
              {data.reported
                .filter((r) => r.member.id !== connection.memberId)
                .map((r) =>
                  memberLine('reported', r.member, t('clubReportCount', { n: r.reportCount })),
                )}
            </>
          ) : null}

          <h2 className="home-section-label club-section">
            {t('clubMembersCount', { n: data.memberCount })}
          </h2>
          {actionError ? (
            <p className="club-note club-note-error" role="alert">
              {actionError}
            </p>
          ) : null}
          {data.members.map((m) =>
            memberLine('members', m, t('clubJoinedOn', { date: dateLabel(m.joinedAt, locale) })),
          )}
        </>
      ) : null}

      {confirmRemove ? (
        <RemoveDialog
          member={confirmRemove}
          t={t}
          onCancel={() => setConfirmRemove(null)}
          onRemove={(purge) => void remove(confirmRemove, purge)}
        />
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

/**
 * Remove has two ends (club.md §17-3), so it is its own dialog on the shell's
 * dialog classes: keep their results, or erase them with them.
 */
function RemoveDialog({
  member,
  t,
  onCancel,
  onRemove,
}: {
  member: Member;
  t: T;
  onCancel: () => void;
  onRemove: (purge: boolean) => void;
}) {
  const title = t('clubRemoveTitle', { name: member.nickname });
  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{t('clubRemoveBody')}</p>
        <p className="dialog-body">{t('clubRemoveEraseBody')}</p>
        <div className="dialog-actions club-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} autoFocus>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => onRemove(false)}>
            {t('clubRemove')}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => onRemove(true)}>
            {t('clubRemoveErase')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Owner only: a new nickname for a member, saved in place (club.md §17-3). */
function RenamePanel({
  member,
  t,
  onCancel,
  onSave,
}: {
  member: Member;
  t: T;
  onCancel: () => void;
  onSave: (nickname: string) => Promise<void>;
}) {
  const [text, setText] = useState(member.nickname);
  const [busy, setBusy] = useState(false);
  const trimmed = text.trim();
  const save = async () => {
    setBusy(true);
    await onSave(trimmed);
    setBusy(false);
  };
  return (
    <div className="club-rename">
      <input
        className="club-input"
        type="text"
        maxLength={24}
        value={text}
        aria-label={t('clubRenameTitle')}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="club-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || trimmed === '' || trimmed === member.nickname}
          onClick={() => void save()}
        >
          {t('clubSave')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

function ChallengeRow({
  challenge,
  t,
  onOpen,
}: {
  challenge: Challenge;
  t: T;
  onOpen: (id: string) => void;
}) {
  const label = `${challengeTitle(challenge, t)} · ${t('clubBy', { name: challenge.createdBy.nickname })}`;
  return (
    <button
      type="button"
      className="settings-row club-line"
      aria-label={label}
      onClick={() => onOpen(challenge.id)}
    >
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-chevron" aria-hidden="true">
        <IconChevronRight />
      </span>
    </button>
  );
}

/** Owner only: the current invite link, to read or share; `New link` replaces it (club.md §7-2). */
function InvitePanel({
  clubName,
  client,
  t,
  onBack,
}: {
  clubName: string;
  client: ClubClient;
  t: T;
  onBack: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    client
      .invite()
      .then((invite) => {
        if (alive.current) setUrl(invite.url);
      })
      .catch((e: unknown) => {
        if (alive.current) setError(errorText(e, t, clubName));
      });
    return () => {
      alive.current = false;
    };
    // The link is read once when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const rotate = async () => {
    setConfirm(false);
    setError(null);
    setCopied(false);
    try {
      const invite = await client.rotateInvite();
      if (alive.current) setUrl(invite.url);
    } catch (e) {
      if (alive.current) setError(errorText(e, t, clubName));
    }
  };

  const share = async () => {
    if (url === null) return;
    const result = await shareGame({ text: t('clubShareText', { club: clubName }), url });
    if (result === 'copied' && alive.current) setCopied(true);
  };

  return (
    <ScreenFrame title={t('clubInvite')} onBack={onBack} t={t}>
      <p className="club-quiet">{t('clubInviteBody', { club: clubName })}</p>
      {url === null && error === null ? <p className="club-quiet">{t('clubLoading')}</p> : null}
      {url !== null ? (
        <>
          <input
            className="club-input"
            type="text"
            readOnly
            value={url}
            aria-label={t('clubInviteLink')}
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="club-actions">
            <button type="button" className="btn btn-primary" onClick={() => void share()}>
              {t('clubShare')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)}>
              {t('clubNewLink')}
            </button>
          </div>
          {copied ? <p className="club-quiet">{t('clubCopied')}</p> : null}
        </>
      ) : null}
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title={t('clubNewLinkTitle')}
        body={t('clubNewLinkBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubNewLink')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void rotate()}
      />
    </ScreenFrame>
  );
}

/**
 * Settings (club.md §9): change your name, Disconnect. Leaving and deleting
 * one's records are independent (decision 42): Disconnect keeps your records
 * on the server. Disconnect is this device only; the server and
 * the others carry on. How to stop paying for the server is said only to an owner
 * of a Club someone hosts themselves — a Public member has no server to delete.
 */
function SettingsPanel({
  clubName,
  isOwner,
  isPublic,
  members,
  selfId,
  nickname,
  t,
  onBack,
  onDisconnect,
  onChangeName,
}: {
  clubName: string;
  isOwner: boolean;
  isPublic: boolean;
  members: Member[] | null;
  selfId: string;
  /** This member's name as the device has it. */
  nickname: string;
  t: T;
  onBack: () => void;
  onDisconnect: () => Promise<void>;
  onChangeName: (nickname: string) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [text, setText] = useState(nickname);
  // An owner rename learned after load: follow it while the field is still the name it showed.
  const shown = useRef(nickname);
  useEffect(() => {
    setText((typed) => (typed === shown.current ? nickname : typed));
    shown.current = nickname;
  }, [nickname]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // Known from the list this screen already read; no extra request.
  const onlyOwner =
    isOwner && members !== null && !members.some((m) => m.role === 'owner' && m.id !== selfId);

  const trimmed = text.trim();
  const nameOk = trimmed.length >= 1 && trimmed.length <= NICKNAME_MAX && trimmed !== nickname;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await work();
      if (alive.current) setNote({ kind: 'saved', text: t('clubNameSaved') });
    } catch (e) {
      if (alive.current) setNote({ kind: 'error', text: errorText(e, t, clubName) });
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <ScreenFrame title={t('clubSettings')} onBack={onBack} t={t}>
      <h2 className="home-section-label club-section">{t('clubChangeName')}</h2>
      <form
        className="club-rename"
        onSubmit={(event) => {
          event.preventDefault();
          if (nameOk && !busy) void run(() => onChangeName(trimmed));
        }}
      >
        <input
          className="club-input"
          type="text"
          maxLength={NICKNAME_MAX}
          autoComplete="off"
          value={text}
          aria-label={t('clubChangeName')}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="club-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !nameOk}>
            {t('clubSave')}
          </button>
        </div>
      </form>
      {note ? (
        <p
          className={note.kind === 'error' ? 'club-note club-note-error' : 'club-quiet'}
          role={note.kind === 'error' ? 'alert' : 'status'}
        >
          {note.text}
        </p>
      ) : null}
      <button
        type="button"
        className="settings-row settings-row-danger"
        onClick={() => setConfirm(true)}
      >
        <span className="settings-row-label">{t('clubDisconnect')}</span>
        <span className="settings-row-chevron" aria-hidden="true">
          <IconChevronRight />
        </span>
      </button>
      <ConfirmDialog
        open={confirm}
        title={t('clubDisconnect')}
        body={[
          t('clubDisconnectBody', { club: clubName }),
          isOwner && !isPublic ? t('clubDisconnectHostingNote') : null,
          onlyOwner ? t('clubDisconnectLastOwner') : null,
        ]
          .filter((part): part is string => part !== null)
          .join(' ')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubDisconnectConfirm')}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void onDisconnect();
        }}
      />
    </ScreenFrame>
  );
}
