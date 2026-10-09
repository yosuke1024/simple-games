/**
 * One Club (club.md §9「Club」): your rankings, today's dailies, the rankings as
 * shelves of games and the members, read when the screen opens and again only
 * on `Reload`. No timer, no polling. Coming back from a table or a daily shows
 * what the screen already had (`cached`, kept by ClubRoot) instead of reading
 * it all again. The Owner's two extras (Invite, Remove) and the Settings panel
 * (change your name, Disconnect — §8-5, §9) live here too, as panels over the
 * same data. Invite is hidden while Private Clubs are off.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, REQUEST_TIMEOUT_MS, type ClubClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import type { Challenge, Member, RankingMine, RankingSummary, ReportedMember } from '../api/types';
import { contractFor, gameTitle } from '../contract/challenge';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { flushOutbox, type FlushReport } from '../storage/outbox';
import { availableGames } from '@/app/gameChannel';
import { GAME_CATEGORIES, type GameDefinition } from '@/app/registry';
import { shareGame } from '@/services/share/share';
import type { ClubConnection } from '@/storage/schemas';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { GameTile } from '@/ui/components/GameTile';
import { IconChevronRight } from '@/ui/components/icons';
import { useSettings } from '@/state/SettingsContext';
import { PRIVATE_CLUBS_ENABLED } from '@/ui/clubFeatures';
import {
  axisGap,
  axisText,
  compareModes,
  dateLabel,
  errorText,
  modeLabel,
  NICKNAME_MAX,
  RankMark,
  ScreenFrame,
  sortModes,
  todayLocal,
  type T,
} from './common';
import { NameSheet } from './NameSheet';

export interface ClubData {
  /** Challenges tagged with today's daily date (everyone's daily meets here). */
  today: Challenge[];
  /** The local date `today` was asked for, so the answer can be held to it. */
  todayDate: string;
  rankings: RankingSummary[];
  /** The tables the viewer is in (`GET /rankings/mine`); empty from a server without the route. */
  mine: RankingMine[];
  members: Member[];
  /** All members, of whom `members` is the newest page. */
  memberCount: number;
  /** Owner only: members others reported, most reported first. */
  reported: ReportedMember[];
  /** The club's name as the server has it now. */
  clubName: string;
}

/**
 * How long a Club screen waits for its own flush before reading the lists: one
 * request's timeout and a beat, so a flush that could not reach the Club reports
 * it first (and the screen says so without asking again).
 */
const FLUSH_WAIT_MS = REQUEST_TIMEOUT_MS + 1_000;

export type ClubPanel = 'none' | 'invite' | 'settings';

/** `Sudoku · Hard`; a game with one table (`standard`) is its title alone, a daily table says Daily. */
export function rankingTitle(gameId: string, paramsKey: string, t: T): string {
  const game = gameTitle(gameId) ?? gameId;
  if (paramsKey === 'daily') return `${game} · ${t('clubDaily')}`;
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

/**
 * The games this device can open that have a table contract, in registry
 * order (app/gameChannel.ts: a web-beta title is not on the app's shelves, so
 * it is not on the Club's either).
 */
function shelfGames(): Map<string, { game: GameDefinition; index: number }> {
  return new Map(
    availableGames()
      .filter((game) => game.challenge !== undefined)
      .map((game, index) => [game.id as string, { game, index }]),
  );
}

export function ClubScreen({
  connection,
  panel,
  cached,
  refresh = false,
  onData,
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
  /** What this screen showed before a table or a daily was opened over it; undefined on a fresh open. */
  cached?: ClubData;
  /** Something the person did on the screen above changed the lists: read them again (not a resend). */
  refresh?: boolean;
  /** Every list this screen now holds, for ClubRoot to keep across a round trip. */
  onData: (data: ClubData) => void;
  onPanel: (panel: ClubPanel) => void;
  onBack: () => void;
  onOpenChallenge: (challengeId: string) => void;
  /** A game's tables: `paramsKey` is the mode to show first (null: the table screen's first). */
  onOpenRanking: (gameId: string, paramsKey: string | null, tables: RankingSummary[]) => void;
  onDisconnect: () => Promise<void>;
  /** The server's name for the club differs from the cached one. */
  onRenamed: (clubName: string) => void;
  /** The owner renamed this member: the server's nickname differs from the stored one. */
  onRenamedMe: (nickname: string) => void;
  /** The player accepted the automatic-send disclosure shown for a connection that never saw it. */
  onAcceptAutoSend: () => void;
}) {
  const { t, locale } = useSettings();
  const [data, setData] = useState<ClubData | null>(cached ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(cached === undefined || refresh);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  /** Another member's name, pressed: the sheet with the one Report button (club.md §17-3). */
  const [sheet, setSheet] = useState<Member | null>(null);
  /** A report went through on this screen: one quiet line, no mark on the row. */
  const [reportedNote, setReportedNote] = useState(false);
  const [renaming, setRenaming] = useState<{ key: string; member: Member } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const clientRef = useRef<ClubClient | null>(null);
  const alive = useRef(true);

  const clubName = data?.clubName ?? connection.clubName;
  const isOwner = connection.role === 'owner';

  const client = () => {
    clientRef.current ??= createClient(connection.endpoint, connection.memberToken);
    return clientRef.current;
  };

  /** `resend`: the person opened the screen or pressed Reload (the only times it resends). */
  const load = useCallback(
    async (resend = false) => {
      const api = client();
      setLoading(true);
      setError(null);
      try {
        if (resend) {
          // Best effort, oldest first (club.md §10): results that waited get their
          // turn when the screen opens and when the person presses Reload, both their
          // own actions (判断 38) — not when the screen reads the lists again after one
          // of its own actions (a rename, removing a member). The flush queues behind
          // one a result screen may still be running for this Club (outbox.ts
          // `flushing`), so the screen waits for it at most one request's time and a
          // beat — long enough for a flush whose request times out to say so — and
          // then the flush carries on by itself.
          let wait: ReturnType<typeof setTimeout> | undefined;
          let flush: FlushReport | undefined;
          try {
            flush = await Promise.race([
              flushOutbox(connection.endpoint, api),
              new Promise<undefined>((resolve) => {
                wait = setTimeout(() => resolve(undefined), FLUSH_WAIT_MS);
              }),
            ]);
          } catch {
            /* the lists below say whether the club is reachable */
          } finally {
            clearTimeout(wait);
          }
          if (!alive.current) return;
          // The flush has just failed to reach the Club: asking for the lists would only
          // wait out the same timeout again before saying the same thing.
          if (flush?.unreachable) throw new ClubApiError('unreachable', null, 'Club not reachable');
        }
        const todayDate = todayLocal();
        // A server from before a route has no such route: an empty list, not an error.
        // Anything else is a failure the person must see (club.md §10).
        const orEmpty = <V,>(e: unknown): V[] => {
          if (e instanceof ClubApiError && e.code === 'not_found') return [];
          throw e;
        };
        // Four requests, and a fifth for the owner alone (club.md §10).
        const [club, today, rankings, mine, reported] = await Promise.all([
          api.club(),
          api.challenges({ daily: todayDate }),
          api.rankings(),
          api.rankingsMine().catch((e: unknown) => orEmpty<RankingMine>(e)),
          isOwner
            ? api.reportedMembers().catch((e: unknown) => orEmpty<ReportedMember>(e))
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
          mine,
        });
        if (club.club.name !== connection.clubName) onRenamed(club.club.name);
        if (club.me.nickname !== connection.nickname) onRenamedMe(club.me.nickname);
      } catch (e) {
        if (alive.current) setError(errorText(e, t, connection.clubName));
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    // `t` and `onRenamed` change identity without changing what is fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connection.endpoint, connection.memberToken, connection.clubName, connection.nickname],
  );

  useEffect(() => {
    alive.current = true;
    // A fresh open reads (and resends); a return from a table shows what it had,
    // reading again only when something was changed up there.
    if (cached === undefined) void load(true);
    else if (refresh) void load();
    return () => {
      alive.current = false;
    };
    // Once per open; `Reload` is the only other fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.endpoint]);

  // ClubRoot keeps the latest lists, so the way back from a table needs no request.
  useEffect(() => {
    if (data !== null) onData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Held to the date asked for: a server that predates `?daily=` ignores the
  // parameter and answers with its ordinary list, which is not today's.
  const todays = (data?.today ?? []).filter(
    (c) => contractFor(c.gameId) !== null && c.daily === data?.todayDate,
  );

  const games = shelfGames();
  const rankings = (data?.rankings ?? []).filter((r) => games.has(r.gameId));
  const tablesOf = (gameId: string) => rankings.filter((r) => r.gameId === gameId);
  const categoryOf = (gameId: string) => {
    const game = games.get(gameId)?.game;
    return game ? GAME_CATEGORIES.findIndex((c) => c.id === game.category) : -1;
  };
  // The shelves' order, fixed (club.md §9): never by rank, never by recency.
  const mine = (data?.mine ?? [])
    .filter((m) => games.has(m.gameId))
    .sort(
      (a, b) =>
        categoryOf(a.gameId) - categoryOf(b.gameId) ||
        games.get(a.gameId)!.index - games.get(b.gameId)!.index ||
        compareModes(a.gameId, a.paramsKey, b.paramsKey),
    );
  const shelves = GAME_CATEGORIES.map((category) => ({
    category,
    games: [...games.values()]
      .map(({ game }) => game)
      .filter(
        (game) => game.category === category.id && rankings.some((r) => r.gameId === game.id),
      ),
  })).filter((shelf) => shelf.games.length > 0);

  /** A shelf's tile: the mode the viewer has a row in first, else the game's first mode. */
  const openGame = (gameId: string) => {
    const tables = tablesOf(gameId);
    const modes = sortModes(
      gameId,
      tables.map((r) => r.paramsKey),
    );
    const own = new Set(mine.filter((m) => m.gameId === gameId).map((m) => m.paramsKey));
    onOpenRanking(gameId, modes.find((key) => own.has(key)) ?? modes[0] ?? null, tables);
  };

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

  /** Reporting twice is harmless (the server answers 204 and changes nothing). */
  const report = async (member: Member) => {
    setActionError(null);
    setReportedNote(false);
    try {
      await client().reportMember(member.id);
      if (alive.current) setReportedNote(true);
    } catch (e) {
      if (alive.current) setActionError(errorText(e, t, clubName));
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

  /**
   * One member line. The owner gets Rename / Remove on everyone else; a member
   * gets nothing on the row — another member's name opens the sheet with Report
   * (club.md §17-3). One's own name is plain text everywhere.
   */
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
        <span className="settings-row-label">
          {other && !isOwner ? (
            <button type="button" className="club-name-btn" onClick={() => setSheet(m)}>
              {m.nickname}
            </button>
          ) : (
            m.nickname
          )}
        </span>
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
          onClick={() => void load(true)}
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
          {mine.length > 0 ? (
            <>
              <h2 className="home-section-label club-section">{t('clubMyRankings')}</h2>
              {mine.map((row) => (
                <MyRankingRow
                  key={`${row.gameId}:${row.paramsKey}`}
                  row={row}
                  game={games.get(row.gameId)!.game}
                  t={t}
                  onOpen={() => onOpenRanking(row.gameId, row.paramsKey, tablesOf(row.gameId))}
                />
              ))}
            </>
          ) : null}

          {todays.length > 0 ? (
            <>
              <h2 className="home-section-label club-section">{t('clubToday')}</h2>
              {todays.map((c) => (
                <ChallengeRow key={c.id} challenge={c} t={t} onOpen={onOpenChallenge} />
              ))}
            </>
          ) : null}

          <h2 className="home-section-label club-section">{t('clubRankings')}</h2>
          {shelves.length === 0 ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
          {shelves.map(({ category, games: shelf }) => (
            // The home's shelves (CollectionHomeScreen): the same category headings,
            // the same tiles, the same order; only the games with a table are on them.
            <div key={category.id} className="club-shelf">
              <h3 className="home-section-label club-shelf-label">{t(category.headingKey)}</h3>
              <div className="game-grid">
                {shelf.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    className="game-cell"
                    aria-label={game.title}
                    onClick={() => openGame(game.id)}
                  >
                    <GameTile game={game} />
                    <span className="game-cell-title">{game.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

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
          {reportedNote ? (
            <p className="club-quiet" role="status">
              {t('clubReported')}
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
      {sheet ? (
        <NameSheet
          nickname={sheet.nickname}
          detail={t('clubJoinedOn', { date: dateLabel(sheet.joinedAt, locale) })}
          t={t}
          onClose={() => setSheet(null)}
          onReport={() => report(sheet)}
        />
      ) : null}
    </ScreenFrame>
  );
}

/**
 * One table the viewer is in (club.md §9「Your rankings」): the game's tile, the
 * table's title, then on a second line that wraps on a narrow phone — the rank
 * (none below the server's counting ceiling), the table's size, the viewer's
 * best value and, unless they are first, how far the next rank is.
 */
function MyRankingRow({
  row,
  game,
  t,
  onOpen,
}: {
  row: RankingMine;
  game: GameDefinition;
  t: T;
  onOpen: () => void;
}) {
  const title = rankingTitle(row.gameId, row.paramsKey, t);
  const rank = row.best.rank;
  const entries = t('clubEntries', { n: row.entryCount });
  const value = axisText(row.gameId, row.best.entry.facts, t);
  const gap = axisGap(row.gameId, row.best.entry.facts, row.best.nextValue, t);
  const toNext = gap === '' ? '' : t('clubToNext', { gap });
  const label = [title, rank === null ? '' : t('clubRank', { n: rank }), entries, value, toNext]
    .filter((part) => part !== '')
    .join(' · ');
  return (
    <button
      type="button"
      className="settings-row club-line club-mine"
      aria-label={label}
      onClick={onOpen}
    >
      <GameTile game={game} />
      <span className="club-mine-text">
        <span className="settings-row-label">{title}</span>
        <span className="club-mine-facts">
          <span className="club-mine-place">
            {/* The first three wear the table's disc; below them the rank is words like the rest. */}
            {rank !== null && rank <= 3 ? <RankMark rank={rank} t={t} /> : null}
            {rank !== null && rank > 3 ? `${t('clubRank', { n: rank })} · ${entries}` : entries}
          </span>
          {value ? <span className="club-mine-value">{value}</span> : null}
          {toNext ? <span>{toNext}</span> : null}
        </span>
      </span>
      <span className="settings-row-chevron" aria-hidden="true">
        <IconChevronRight />
      </span>
    </button>
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
