/**
 * The Club House screens (docs/architecture/club.md §9). One component owns
 * the small stack of screens — Discover / All Clubs / Join / Club / Members /
 * Member / Challenge / Ranking — and the hardware back button, so Core sees a
 * single mounted thing that calls `onBack` at the root. Nothing here polls;
 * every request starts from something the person did (club.md §10).
 *
 * A step on the stack keeps what its screen last read — a Club its lists, a
 * table or a daily its rows — and where the body was scrolled to when a member's
 * view was opened over it, so coming back shows it as it was instead of asking
 * the server again (club.md §9, decision 46). What a screen above changed on the
 * server (a deleted row, an erased or renamed member) marks those reads `stale`:
 * they are shown and read again. A panel or a table's mode chip changes the top
 * step in place: Back always goes where the person came from.
 *
 * The Members screen reads the lists the Club step holds and asks for nothing
 * itself (§9「Members」); what the person does there — a page of older members,
 * a rename, a removal — is written back into that step's lists
 * (`patchClubData`), so the Club screen shows it as it comes back.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection, PendingClubJoin } from '@/storage/schemas';
import type { ClubInvite, ClubRootProps } from '@/ui/clubBridge';
import { IconChevronRight } from '@/ui/components/icons';
import { PRIVATE_CLUBS_ENABLED, MANAGED_CLUB_ORIGIN } from '@/ui/clubFeatures';
import {
  acceptAutoSend,
  addClubConnection,
  admitPendingJoin,
  departClubConnection,
  forgetPendingJoin,
  loadClubConnections,
  summarize,
  updateClubName,
  updateNickname,
  loadPendingJoins,
  savePendingJoin,
} from '../storage/connections';
import type { OwnerSpace } from '../api/managed';
import { DirectoryScreen } from './DirectoryScreen';
import { ManagedScreen } from './ManagedScreen';
import { PendingRequestsScreen } from './PendingRequestsScreen';
import { ClubManagementScreen } from './ClubManagementScreen';
import { RecordBookScreen } from './RecordBookScreen';
import { AlbumsScreen } from './AlbumsScreen';
import { checkPendingJoin } from '../join';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { dropOutboxFor } from '../storage/outbox';
import { ChallengeScreen, type ChallengeRead } from './ChallengeScreen';
import type { Member, MembersPage, RankingSummary } from '../api/types';
import { ClubScreen, type ClubData, type ClubPanel } from './ClubScreen';
import { ScreenFrame } from './common';
import { JoinScreen } from './JoinScreen';
import { MemberScreen } from './MemberScreen';
import { MembersScreen } from './MembersScreen';
import { RankingScreen, type RankingRead } from './RankingScreen';
import './club.css';

interface ClubStep {
  kind: 'club';
  endpoint: string;
  panel: ClubPanel;
  /** What the Club screen last read; absent until it has, and on a fresh open. */
  data?: ClubData;
  /** A screen above changed what the lists hold (a deleted row): read them again on return. */
  stale?: boolean;
}

type Screen =
  | { kind: 'discover' }
  | { kind: 'all' }
  | {
      kind: 'join';
      invite: ClubInvite | null;
      publicClub?: boolean;
      endpoint?: string;
      clubName?: string;
    }
  | { kind: 'directory' }
  | { kind: 'managed' }
  | { kind: 'pending' }
  | { kind: 'manage'; endpoint: string }
  | { kind: 'albums'; connection: ClubConnection }
  | {
      kind: 'records';
      connection?: ClubConnection;
      managed?: { origin: string; owner: OwnerSpace; token: string };
    }
  | ClubStep
  /** The Club's people: the lists come from the Club step below, not from a request. */
  | {
      kind: 'members';
      endpoint: string;
      /** Where the list was scrolled to when a member's view was opened over it. */
      scrollTop?: number;
    }
  /** One member (`GET /members/:id`); `nickname` is the name that was pressed. */
  | { kind: 'member'; endpoint: string; memberId: string; nickname: string }
  | {
      kind: 'challenge';
      endpoint: string;
      challengeId: string;
      /** What the screen last read; absent until it has. */
      read?: ChallengeRead;
      /** Something changed what `read` holds: show it, and read it again. */
      stale?: boolean;
      scrollTop?: number;
    }
  | {
      kind: 'ranking';
      endpoint: string;
      gameId: string;
      /** The mode on screen; null: the game's first. */
      paramsKey: string | null;
      /** The game's tables from the Club screen's list: its modes, known without a request. */
      tables: RankingSummary[];
      /** The table the screen last read, for the mode it was read for; absent until it has. */
      read?: RankingRead;
      /** Something changed what `read` holds: show it, and read it again. */
      stale?: boolean;
      scrollTop?: number;
    };

/** What the first screen is, given who this device has joined (club.md §9「入口」). */
function rootFor(connections: readonly ClubConnection[]): Screen[] {
  if (connections.length === 0) return [{ kind: 'discover' }];
  if (connections.length === 1) {
    return [{ kind: 'club', endpoint: connections[0]!.endpoint, panel: 'none' }];
  }
  return [{ kind: 'all' }];
}

export function ClubRoot({
  entry,
  invite,
  focus,
  onBack,
  onPlayChallenge,
  onConnectionsChanged,
}: ClubRootProps) {
  const { t } = useSettings();
  const [connections, setConnections] = useState<ClubConnection[] | null>(null);
  const [pending, setPending] = useState<PendingClubJoin[]>([]);
  const [stack, setStack] = useState<Screen[]>([]);
  const alive = useRef(true);

  /** The door that opened the Club decides the first screen (club.md §9「入口」). */
  const firstScreens = (loaded: ClubConnection[], requests: PendingClubJoin[]): Screen[] => {
    const root = rootFor(loaded);
    // Only a configured Managed service may resume its explicit owner screen.
    if (entry === 'managed' && MANAGED_CLUB_ORIGIN) return [...root, { kind: 'managed' }];
    // The home's "Join a new Club House": the ways in, over the Clubs already joined.
    if (entry === 'join' && loaded.length > 0) return [...root, { kind: 'discover' }];
    // An invite link is acted on only while Private Clubs are on (club.md §14, decision 44).
    if (
      entry === 'invite' &&
      invite &&
      (PRIVATE_CLUBS_ENABLED ||
        (MANAGED_CLUB_ORIGIN && invite.endpoint.startsWith(`${MANAGED_CLUB_ORIGIN}/clubs/`)))
    ) {
      if (loaded.some((c) => c.endpoint === invite.endpoint)) {
        return [{ kind: 'club', endpoint: invite.endpoint, panel: 'none' }];
      }
      if (requests.some((request) => request.endpoint === invite.endpoint)) {
        return [...root, { kind: 'pending' }];
      }
      return [{ kind: 'join', invite }];
    }
    const target = focus ? loaded.find((c) => c.endpoint === focus.endpoint) : undefined;
    if (focus && target) {
      const base: Screen[] = loaded.length >= 2 ? [{ kind: 'all' }] : [];
      return [
        ...base,
        { kind: 'club', endpoint: target.endpoint, panel: 'none' },
        { kind: 'challenge', endpoint: target.endpoint, challengeId: focus.challengeId },
      ];
    }
    return root;
  };

  /**
   * Each stored request, asked about once as the Club House opens. An approved one is
   * stored as the membership; a decided or forgotten one leaves the device; one that
   * cannot be reached stays for the next open. If the person is still on the first
   * screen, the Club they were let into opens — otherwise where they went is left alone.
   */
  const settlePending = async (requests: PendingClubJoin[], first: Screen[]) => {
    let admitted: { connection: ClubConnection; count: number } | null = null;
    let changed = false;
    for (const request of requests) {
      let outcome;
      try {
        outcome = await checkPendingJoin(request);
      } catch {
        continue;
      }
      if (!alive.current) return;
      if (outcome.kind === 'approved') {
        const next = await admitPendingJoin(outcome.connection).catch(() => null);
        if (!alive.current) return;
        if (next === null) continue;
        apply(next);
        admitted = { connection: outcome.connection, count: next.length };
        changed = true;
      } else if (outcome.kind === 'closed') {
        await forgetPendingJoin(request.endpoint);
        changed = true;
      }
    }
    if (!alive.current) return;
    if (changed) setPending(await loadPendingJoins());
    if (!alive.current || admitted === null) return;
    const { connection, count } = admitted;
    const club: Screen = { kind: 'club', endpoint: connection.endpoint, panel: 'none' };
    setStack((current) =>
      current === first ? (count >= 2 ? [{ kind: 'all' }, club] : [club]) : current,
    );
  };

  useEffect(() => {
    alive.current = true;
    void Promise.all([loadClubConnections(), loadPendingJoins()])
      .catch(() => [[], []] as [ClubConnection[], PendingClubJoin[]])
      .then(([loaded, requests]) => {
        if (!alive.current) return;
        setConnections(loaded);
        setPending(requests);
        const first = firstScreens(loaded, requests);
        setStack(first);
        // Opening the Club House is the person's own action, so it is also when a
        // request they sent is asked about (once — never on a timer): an approved one
        // becomes the membership without a second press of Check request.
        if (requests.length > 0) void settlePending(requests, first);
      });
    return () => {
      alive.current = false;
    };
    // The door that opened the Club decides the first screen, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = stack[stack.length - 1];

  /** The stack with its top step changed in place (a panel, a chip, the lists read): never a new step. */
  const replaceTop = useCallback((change: (screen: Screen) => Screen) => {
    setStack((current) => {
      const last = current[current.length - 1];
      if (last === undefined) return current;
      const next = change(last);
      return next === last ? current : [...current.slice(0, -1), next];
    });
  }, []);

  /**
   * What a screen above changed on the server (one of the viewer's rows deleted, a
   * member erased or renamed): what the steps of this endpoint kept no longer holds.
   * They stay as they are on the stack and are shown and read again when the person
   * comes back to them. `club: false` leaves the Club's lists alone — a rename is
   * written into them already, and only the names in a table or a daily are old.
   */
  const markStale = (endpoint: string, { club = true }: { club?: boolean } = {}) => {
    setStack((current) => {
      let changed = false;
      const next = current.map((step): Screen => {
        switch (step.kind) {
          case 'club':
            if (club && step.endpoint === endpoint && step.data !== undefined && !step.stale) {
              changed = true;
              return { ...step, stale: true };
            }
            return step;
          case 'ranking':
          case 'challenge':
            if (step.endpoint === endpoint && step.read !== undefined && !step.stale) {
              changed = true;
              return { ...step, stale: true };
            }
            return step;
          default:
            return step;
        }
      });
      return changed ? next : current;
    });
  };

  /**
   * The lists the Club step for this endpoint holds, changed by a screen above it
   * (the Members screen: a page of older members, a rename, a removal). The step
   * nearest the top is the one the person came through; a Club that never read
   * its lists has nothing to change.
   */
  const patchClubData = (endpoint: string, change: (data: ClubData) => ClubData) => {
    setStack((current) => {
      for (let i = current.length - 1; i >= 0; i--) {
        const step = current[i]!;
        if (step.kind !== 'club' || step.endpoint !== endpoint) continue;
        if (step.data === undefined) return current;
        const data = change(step.data);
        if (data === step.data) return current;
        const next = [...current];
        next[i] = { ...step, data };
        return next;
      }
      return current;
    });
  };

  /**
   * A page of older members, read on the Members screen, joins the Club's list (no member
   * twice). A page that adds nobody is the end of the list, whatever the total says — the
   * total drifts as people join and leave, and the page size is the server's to set.
   */
  const onMembersPage = (endpoint: string, page: MembersPage) =>
    patchClubData(endpoint, (data) => {
      const known = new Set(data.members.map((m) => m.id));
      const added = page.members.filter((m) => !known.has(m.id));
      return {
        ...data,
        members: [...data.members, ...added],
        memberCount: page.memberCount,
        ...(added.length === 0 ? { olderExhausted: true } : {}),
      };
    });

  /** The server has no older page to give (a 404): the Members screen stops offering one, for good. */
  const onNoOlderMembers = (endpoint: string) =>
    patchClubData(endpoint, (data) =>
      data.olderExhausted ? data : { ...data, olderExhausted: true },
    );

  /**
   * A name was pressed on the Members screen, a table or a daily: that member's view opens
   * over it. Where the screen below was scrolled to is kept on its step, so the way back
   * lands on the row it left.
   */
  const openMember = (endpoint: string, memberId: string, nickname: string, scrollTop: number) =>
    setStack((current) => {
      const last = current[current.length - 1];
      if (last === undefined) return current;
      const below: Screen =
        last.kind === 'members' || last.kind === 'ranking' || last.kind === 'challenge'
          ? { ...last, scrollTop }
          : last;
      return [...current.slice(0, -1), below, { kind: 'member', endpoint, memberId, nickname }];
    });

  /**
   * The Owner renamed a member: every list, and every view of them on the stack, carries
   * the new name; the tables and dailies that were read with the old one are read again.
   */
  const onMemberRenamed = (endpoint: string, renamed: Member) => {
    const apply = (m: Member): Member => (m.id === renamed.id ? { ...m, ...renamed } : m);
    patchClubData(endpoint, (data) => ({
      ...data,
      members: data.members.map(apply),
      reported: data.reported.map((r) => ({ ...r, member: apply(r.member) })),
    }));
    setStack((current) =>
      current.map((step) =>
        step.kind === 'member' &&
        step.endpoint === endpoint &&
        step.memberId === renamed.id &&
        step.nickname !== renamed.nickname
          ? { ...step, nickname: renamed.nickname }
          : step,
      ),
    );
    markStale(endpoint, { club: false });
  };

  /**
   * The Owner removed a member. They leave both lists and the total. `purge` also
   * erased their results and ranking rows server-side (club.md §17-3): the tables
   * and the Today results the Club screen holds, and the tables and dailies kept on
   * the stack, are stale, so they are read again.
   */
  const onMemberRemoved = (endpoint: string, memberId: string, purge: boolean) => {
    patchClubData(endpoint, (data) => ({
      ...data,
      members: data.members.filter((m) => m.id !== memberId),
      reported: data.reported.filter((r) => r.member.id !== memberId),
      memberCount: Math.max(0, data.memberCount - 1),
    }));
    if (purge) markStale(endpoint);
  };

  /**
   * The Member screen of a member who was just removed goes, if it is still the
   * screen on top: the person may have pressed Back while the request ran, and
   * then the step to leave is not this one.
   */
  const leaveMember = (endpoint: string, memberId: string) => {
    setStack((current) => {
      const last = current[current.length - 1];
      return last?.kind === 'member' && last.endpoint === endpoint && last.memberId === memberId
        ? current.slice(0, -1)
        : current;
    });
  };

  /** What the Club step for this endpoint last read; the screens above it show those lists. */
  const clubDataOf = (endpoint: string): ClubData | undefined => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const step = stack[i]!;
      if (step.kind === 'club' && step.endpoint === endpoint) return step.data;
    }
    return undefined;
  };

  // A club's own panel (Invite / Settings) is a step back too, even at the root.
  const stepBack = useCallback(() => {
    if (top?.kind === 'club' && top.panel !== 'none') {
      replaceTop((screen) =>
        screen.kind === 'club' ? { ...screen, panel: 'none' as const } : screen,
      );
    } else if (stack.length <= 1) {
      onBack();
    } else {
      setStack((current) => current.slice(0, -1));
    }
  }, [top, stack.length, onBack, replaceTop]);

  // ONE listener while mounted; it always reaches the latest stepBack.
  const backRef = useRef(stepBack);
  backRef.current = stepBack;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('backButton', () => backRef.current());
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);

  const apply = (next: ClubConnection[]) => {
    setConnections(next);
    onConnectionsChanged(next.map(summarize));
  };

  const joined = async (connection: ClubConnection) => {
    if (!alive.current) return;
    const next = await addClubConnection(connection);
    if (!alive.current) return;
    apply(next);
    const club: Screen = { kind: 'club', endpoint: connection.endpoint, panel: 'none' };
    setStack(next.length >= 2 ? [{ kind: 'all' }, club] : [club]);
  };

  const refreshPending = async () => {
    setPending(await loadPendingJoins());
  };
  const requested = async (request: PendingClubJoin) => {
    if (!alive.current) return;
    await savePendingJoin(request);
    if (!alive.current) return;
    await refreshPending();
    setStack([{ kind: 'all' }, { kind: 'pending' }]);
  };

  const openManagedClub = async (connection: ClubConnection) => {
    // Reopening the same owner membership preserves its explicit sending consent.
    const previous = connections?.find(
      (c) => c.endpoint === connection.endpoint && c.memberId === connection.memberId,
    );
    await joined(previous ? { ...previous, ...connection } : connection);
  };

  const disconnect = async (endpoint: string) => {
    // The credentials stay as a departed entry: joining again returns the same member (§4-1).
    const next = await departClubConnection(endpoint);
    // Nothing could send them any more (club.md §4-2).
    await dropOutboxFor(endpoint);
    apply(next);
    setStack(rootFor(next));
  };

  const connectionOf = (endpoint: string) => connections?.find((c) => c.endpoint === endpoint);

  const push = (screen: Screen) => setStack((current) => [...current, screen]);

  if (connections === null || top === undefined) {
    return (
      <ScreenFrame title="" onBack={onBack} t={t}>
        <p className="club-quiet">{t('clubLoading')}</p>
      </ScreenFrame>
    );
  }

  switch (top.kind) {
    case 'discover':
      return (
        // Over a joined Club (the home's "Join a new Club House"), Back returns to it.
        <ScreenFrame
          title={t('clubDiscoverTitle')}
          onBack={stack.length > 1 ? stepBack : onBack}
          t={t}
        >
          <p className="club-quiet">
            {t(PRIVATE_CLUBS_ENABLED ? 'clubDiscoverBody' : 'clubDiscoverBodyPublic')}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => push({ kind: 'join', invite: null, publicClub: true })}
          >
            {t('clubJoinPublic')}
          </button>
          {PRIVATE_CLUBS_ENABLED || MANAGED_CLUB_ORIGIN ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => push({ kind: 'join', invite: null })}
            >
              {t('clubJoinWithLink')}
            </button>
          ) : null}
          {MANAGED_CLUB_ORIGIN ? (
            <>
              <button className="btn btn-ghost" onClick={() => push({ kind: 'directory' })}>
                {t('clubFindClubs')}
              </button>
              <button className="btn btn-ghost" onClick={() => push({ kind: 'managed' })}>
                {t('clubOwnerSpace')}
              </button>
            </>
          ) : null}
          {pending.length > 0 ? (
            <button className="btn btn-ghost" onClick={() => push({ kind: 'pending' })}>
              {t('clubJoinRequests')}
            </button>
          ) : null}
        </ScreenFrame>
      );

    case 'all':
      return (
        <ScreenFrame title={t('clubAllClubs')} onBack={stepBack} t={t}>
          {connections.map((c) => (
            <button
              key={c.endpoint}
              type="button"
              className="settings-row club-line"
              onClick={() => push({ kind: 'club', endpoint: c.endpoint, panel: 'none' })}
            >
              <span className="settings-row-label">{c.clubName}</span>
              <span className="settings-row-chevron" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
          ))}
          {connections.some((c) => c.endpoint === PUBLIC_CLUB_ENDPOINT) ? null : (
            <button
              type="button"
              className="btn btn-ghost club-join-another"
              onClick={() => push({ kind: 'join', invite: null, publicClub: true })}
            >
              {t('clubJoinPublic')}
            </button>
          )}
          {PRIVATE_CLUBS_ENABLED || MANAGED_CLUB_ORIGIN ? (
            <button
              type="button"
              className="btn btn-ghost club-join-another"
              onClick={() => push({ kind: 'join', invite: null })}
            >
              {t('clubJoinAnother')}
            </button>
          ) : null}
          {MANAGED_CLUB_ORIGIN ? (
            <>
              <button className="btn btn-ghost" onClick={() => push({ kind: 'directory' })}>
                {t('clubFindClubs')}
              </button>
              <button className="btn btn-ghost" onClick={() => push({ kind: 'managed' })}>
                {t('clubOwnerSpace')}
              </button>
            </>
          ) : null}
          {pending.length > 0 ? (
            <button className="btn btn-ghost" onClick={() => push({ kind: 'pending' })}>
              {t('clubJoinRequests')}
            </button>
          ) : null}
        </ScreenFrame>
      );

    case 'join':
      return (
        <JoinScreen
          invite={top.invite}
          publicClub={top.publicClub === true}
          endpoint={top.endpoint}
          clubName={top.clubName}
          connectionCount={connections.length}
          t={t}
          onBack={stepBack}
          onJoined={joined}
          onPending={requested}
        />
      );

    case 'directory':
      return MANAGED_CLUB_ORIGIN ? (
        <DirectoryScreen
          origin={MANAGED_CLUB_ORIGIN}
          onBack={stepBack}
          connections={connections}
          pending={pending}
          onJoin={(club) => {
            if (connections.some((c) => c.endpoint === club.endpoint))
              push({ kind: 'club', endpoint: club.endpoint, panel: 'none' });
            else if (pending.some((request) => request.endpoint === club.endpoint))
              push({ kind: 'pending' });
            else push({ kind: 'join', invite: null, endpoint: club.endpoint, clubName: club.name });
          }}
        />
      ) : null;
    case 'managed':
      return MANAGED_CLUB_ORIGIN ? (
        <ManagedScreen
          origin={MANAGED_CLUB_ORIGIN}
          onBack={stepBack}
          onOpen={openManagedClub}
          onRecords={(owner, token) =>
            push({ kind: 'records', managed: { origin: MANAGED_CLUB_ORIGIN!, owner, token } })
          }
        />
      ) : null;
    case 'pending':
      return (
        <PendingRequestsScreen
          requests={pending}
          onChanged={refreshPending}
          onJoined={joined}
          onBack={stepBack}
        />
      );
    case 'manage': {
      const connection = connectionOf(top.endpoint);
      return connection ? (
        <ClubManagementScreen
          connection={connection}
          onBack={stepBack}
          onChanged={() => {
            markStale(connection.endpoint);
            void loadClubConnections().then((next) => {
              if (alive.current) apply(next);
            });
          }}
        />
      ) : null;
    }
    case 'records':
      return (
        <RecordBookScreen
          connection={top.connection}
          managed={top.managed}
          onBack={stepBack}
          onAlbums={(connection) => push({ kind: 'albums', connection })}
        />
      );
    case 'albums':
      return <AlbumsScreen connection={top.connection} onBack={stepBack} />;

    case 'club': {
      const connection = connectionOf(top.endpoint);
      if (!connection) return null;
      return (
        <ClubScreen
          key={connection.endpoint}
          connection={connection}
          panel={top.panel}
          cached={top.data}
          refresh={top.stale === true}
          onData={(data) =>
            // Only lists read anew clear `stale`: the cached ones handed back on a return do not.
            replaceTop((screen) =>
              screen.kind === 'club' &&
              screen.endpoint === connection.endpoint &&
              screen.data !== data
                ? { ...screen, data, stale: false }
                : screen,
            )
          }
          onPanel={(panel) =>
            replaceTop((screen) => (screen.kind === 'club' ? { ...screen, panel } : screen))
          }
          onBack={stepBack}
          onOpenChallenge={(challengeId) =>
            push({ kind: 'challenge', endpoint: connection.endpoint, challengeId })
          }
          onOpenRanking={(gameId, paramsKey, tables) =>
            push({ kind: 'ranking', endpoint: connection.endpoint, gameId, paramsKey, tables })
          }
          onOpenMembers={() => push({ kind: 'members', endpoint: connection.endpoint })}
          onManage={() => push({ kind: 'manage', endpoint: connection.endpoint })}
          onRecords={() => push({ kind: 'records', connection })}
          onAlbums={() => push({ kind: 'albums', connection })}
          onAllClubs={() => push({ kind: 'all' })}
          onDisconnect={() => disconnect(connection.endpoint)}
          onRenamedMe={(nickname) => {
            void updateNickname(connection.endpoint, nickname)
              .then((next) => {
                if (alive.current) apply(next);
              })
              .catch(() => undefined);
          }}
          onAcceptAutoSend={() => {
            void acceptAutoSend(connection.endpoint)
              .then((next) => {
                if (alive.current) apply(next);
              })
              .catch(() => undefined);
          }}
          onRenamed={(clubName) => {
            void updateClubName(connection.endpoint, clubName)
              .then((next) => {
                if (alive.current) apply(next);
              })
              .catch(() => undefined);
          }}
        />
      );
    }

    case 'members': {
      const connection = connectionOf(top.endpoint);
      if (!connection) return null;
      const data = clubDataOf(connection.endpoint);
      return (
        <MembersScreen
          key={connection.endpoint}
          connection={connection}
          members={data?.members ?? []}
          memberCount={data?.memberCount ?? 0}
          reported={data?.reported ?? []}
          exhausted={data?.olderExhausted === true}
          scrollTop={top.scrollTop}
          onMore={(page) => onMembersPage(connection.endpoint, page)}
          onNoOlder={() => onNoOlderMembers(connection.endpoint)}
          onOpenMember={(memberId, nickname, scrollTop) =>
            openMember(connection.endpoint, memberId, nickname, scrollTop)
          }
          onRenamed={(member) => onMemberRenamed(connection.endpoint, member)}
          onRemoved={(memberId, purge) => onMemberRemoved(connection.endpoint, memberId, purge)}
          onBack={stepBack}
        />
      );
    }

    case 'member': {
      const connection = connectionOf(top.endpoint);
      if (!connection) return null;
      return (
        <MemberScreen
          key={`${connection.endpoint}:${top.memberId}`}
          connection={connection}
          memberId={top.memberId}
          nickname={top.nickname}
          tables={clubDataOf(connection.endpoint)?.rankings ?? []}
          onOpenRanking={(gameId, paramsKey, tables) =>
            push({ kind: 'ranking', endpoint: connection.endpoint, gameId, paramsKey, tables })
          }
          onRenamed={(member) => onMemberRenamed(connection.endpoint, member)}
          onRemoved={(memberId, purge) => {
            onMemberRemoved(connection.endpoint, memberId, purge);
            // The member is gone: back to wherever the person came from.
            leaveMember(connection.endpoint, memberId);
          }}
          onBack={stepBack}
        />
      );
    }

    case 'challenge': {
      const connection = connectionOf(top.endpoint);
      if (!connection) return null;
      return (
        <ChallengeScreen
          key={`${connection.endpoint}:${top.challengeId}`}
          connection={connection}
          challengeId={top.challengeId}
          cached={top.read}
          refresh={top.stale === true}
          scrollTop={top.scrollTop}
          onRead={(read) =>
            // Only a read made anew clears `stale`; the cached one handed back never comes here.
            replaceTop((screen) =>
              screen.kind === 'challenge' &&
              screen.endpoint === connection.endpoint &&
              screen.challengeId === top.challengeId
                ? { ...screen, read, stale: false }
                : screen,
            )
          }
          onOpenMember={(memberId, nickname, scrollTop) =>
            openMember(connection.endpoint, memberId, nickname, scrollTop)
          }
          onBack={stepBack}
          onPlay={onPlayChallenge}
        />
      );
    }

    case 'ranking': {
      const connection = connectionOf(top.endpoint);
      if (!connection) return null;
      return (
        // Keyed by the game, not the mode: a chip changes the table, and focus stays on the chip.
        <RankingScreen
          key={`${connection.endpoint}:${top.gameId}`}
          connection={connection}
          gameId={top.gameId}
          paramsKey={top.paramsKey}
          tables={top.tables}
          cached={top.read}
          refresh={top.stale === true}
          scrollTop={top.scrollTop}
          onRead={(read) =>
            // Only a read made anew clears `stale`; the cached one handed back never comes here.
            replaceTop((screen) =>
              screen.kind === 'ranking' &&
              screen.endpoint === connection.endpoint &&
              screen.gameId === top.gameId
                ? { ...screen, read, stale: false }
                : screen,
            )
          }
          onMode={(paramsKey) =>
            replaceTop((screen) => (screen.kind === 'ranking' ? { ...screen, paramsKey } : screen))
          }
          onChanged={() => markStale(connection.endpoint)}
          onOpenMember={(memberId, nickname, scrollTop) =>
            openMember(connection.endpoint, memberId, nickname, scrollTop)
          }
          onBack={stepBack}
        />
      );
    }
  }
}
