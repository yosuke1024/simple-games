/**
 * The Club House screens (docs/architecture/club.md §9). One component owns
 * the small stack of screens — Discover / All Clubs / Join / Club / Challenge / Ranking
 * — and the hardware back button, so Core sees a single mounted thing that
 * calls `onBack` at the root. Nothing here polls; every request starts from
 * something the person did (club.md §10).
 *
 * A Club's step on the stack keeps the lists its screen last read, so coming
 * back from a table or a daily shows them as they were instead of asking the
 * server again (club.md §9, decision 46). A panel or a table's mode chip
 * changes the top step in place: Back always goes where the person came from.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection } from '@/storage/schemas';
import type { ClubInvite, ClubRootProps } from '@/ui/clubBridge';
import { IconChevronRight } from '@/ui/components/icons';
import { PRIVATE_CLUBS_ENABLED } from '@/ui/clubFeatures';
import {
  acceptAutoSend,
  addClubConnection,
  departClubConnection,
  loadClubConnections,
  summarize,
  updateClubName,
  updateNickname,
} from '../storage/connections';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { dropOutboxFor } from '../storage/outbox';
import { ChallengeScreen } from './ChallengeScreen';
import type { RankingSummary } from '../api/types';
import { ClubScreen, type ClubData, type ClubPanel } from './ClubScreen';
import { ScreenFrame } from './common';
import { JoinScreen } from './JoinScreen';
import { RankingScreen } from './RankingScreen';
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
  | { kind: 'join'; invite: ClubInvite | null; publicClub?: boolean }
  | ClubStep
  | { kind: 'challenge'; endpoint: string; challengeId: string }
  | {
      kind: 'ranking';
      endpoint: string;
      gameId: string;
      /** The mode on screen; null: the game's first. */
      paramsKey: string | null;
      /** The game's tables from the Club screen's list: its modes, known without a request. */
      tables: RankingSummary[];
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
  const [stack, setStack] = useState<Screen[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void loadClubConnections()
      .catch(() => [] as ClubConnection[])
      .then((loaded) => {
        if (!alive.current) return;
        setConnections(loaded);
        const root = rootFor(loaded);
        // An invite link is acted on only while Private Clubs are on (club.md §14, decision 44).
        if (entry === 'invite' && invite && PRIVATE_CLUBS_ENABLED) {
          setStack([{ kind: 'join', invite }]);
          return;
        }
        const target = focus ? loaded.find((c) => c.endpoint === focus.endpoint) : undefined;
        if (focus && target) {
          const base: Screen[] = loaded.length >= 2 ? [{ kind: 'all' }] : [];
          setStack([
            ...base,
            { kind: 'club', endpoint: target.endpoint, panel: 'none' },
            { kind: 'challenge', endpoint: target.endpoint, challengeId: focus.challengeId },
          ]);
          return;
        }
        setStack(root);
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

  /** The Club step under a table: its lists no longer hold (one of the viewer's rows was deleted). */
  const markStale = (endpoint: string) => {
    setStack((current) => {
      for (let i = current.length - 1; i >= 0; i--) {
        const step = current[i]!;
        if (step.kind !== 'club' || step.endpoint !== endpoint) continue;
        if (step.data === undefined || step.stale === true) return current;
        const next = [...current];
        next[i] = { ...step, stale: true };
        return next;
      }
      return current;
    });
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
    const next = await addClubConnection(connection);
    apply(next);
    const club: Screen = { kind: 'club', endpoint: connection.endpoint, panel: 'none' };
    setStack(next.length >= 2 ? [{ kind: 'all' }, club] : [club]);
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
        <ScreenFrame title={t('clubDiscoverTitle')} onBack={onBack} t={t}>
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
          {PRIVATE_CLUBS_ENABLED ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => push({ kind: 'join', invite: null })}
            >
              {t('clubJoinWithLink')}
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
          {PRIVATE_CLUBS_ENABLED ? (
            <button
              type="button"
              className="btn btn-ghost club-join-another"
              onClick={() => push({ kind: 'join', invite: null })}
            >
              {t('clubJoinAnother')}
            </button>
          ) : null}
        </ScreenFrame>
      );

    case 'join':
      return (
        <JoinScreen
          invite={top.invite}
          publicClub={top.publicClub === true}
          connectionCount={connections.length}
          t={t}
          onBack={stepBack}
          onJoined={joined}
        />
      );

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

    case 'challenge': {
      const connection = connectionOf(top.endpoint);
      if (!connection) return null;
      return (
        <ChallengeScreen
          key={`${connection.endpoint}:${top.challengeId}`}
          connection={connection}
          challengeId={top.challengeId}
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
          onMode={(paramsKey) =>
            replaceTop((screen) => (screen.kind === 'ranking' ? { ...screen, paramsKey } : screen))
          }
          onChanged={() => markStale(connection.endpoint)}
          onBack={stepBack}
        />
      );
    }
  }
}
