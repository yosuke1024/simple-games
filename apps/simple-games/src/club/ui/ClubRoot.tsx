/**
 * The Club House screens (docs/architecture/club.md §9). One component owns
 * the small stack of screens — Discover / All Clubs / Join / Club / Challenge / Ranking
 * — and the hardware back button, so Core sees a single mounted thing that
 * calls `onBack` at the root. Nothing here polls; every request starts from
 * something the person did (club.md §10).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSettings } from '@/state/SettingsContext';
import type { ClubConnection } from '@/storage/schemas';
import type { ClubInvite, ClubRootProps } from '@/ui/clubBridge';
import { IconChevronRight } from '@/ui/components/icons';
import {
  addClubConnection,
  loadClubConnections,
  removeClubConnection,
  summarize,
  updateClubName,
  updateNickname,
} from '../storage/connections';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { dropOutboxFor } from '../storage/outbox';
import { ChallengeScreen } from './ChallengeScreen';
import { ClubScreen, type ClubPanel } from './ClubScreen';
import { ScreenFrame } from './common';
import { JoinScreen } from './JoinScreen';
import { RankingScreen } from './RankingScreen';
import './club.css';

type Screen =
  | { kind: 'discover' }
  | { kind: 'all' }
  | { kind: 'join'; invite: ClubInvite | null; publicClub?: boolean }
  | { kind: 'club'; endpoint: string; panel: ClubPanel }
  | { kind: 'challenge'; endpoint: string; challengeId: string }
  | { kind: 'ranking'; endpoint: string; gameId: string; paramsKey: string };

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
        if (entry === 'invite' && invite) {
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

  // A club's own panel (Invite / Settings) is a step back too, even at the root.
  const stepBack = useCallback(() => {
    if (top?.kind === 'club' && top.panel !== 'none') {
      setStack((current) => [...current.slice(0, -1), { ...top, panel: 'none' as const }]);
    } else if (stack.length <= 1) {
      onBack();
    } else {
      setStack((current) => current.slice(0, -1));
    }
  }, [top, stack.length, onBack]);

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
    const next = await removeClubConnection(endpoint);
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
          <p className="club-quiet">{t('clubDiscoverBody')}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => push({ kind: 'join', invite: null, publicClub: true })}
          >
            {t('clubJoinPublic')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => push({ kind: 'join', invite: null })}
          >
            {t('clubJoinWithLink')}
          </button>
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
          <button
            type="button"
            className="btn btn-ghost club-join-another"
            onClick={() => push({ kind: 'join', invite: null })}
          >
            {t('clubJoinAnother')}
          </button>
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
          onPanel={(panel) => setStack((current) => [...current.slice(0, -1), { ...top, panel }])}
          onBack={stepBack}
          onOpenChallenge={(challengeId) =>
            push({ kind: 'challenge', endpoint: connection.endpoint, challengeId })
          }
          onOpenRanking={(gameId, paramsKey) =>
            push({ kind: 'ranking', endpoint: connection.endpoint, gameId, paramsKey })
          }
          onDisconnect={() => disconnect(connection.endpoint)}
          onRenamedMe={(nickname) => {
            void updateNickname(connection.endpoint, nickname)
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
        <RankingScreen
          key={`${connection.endpoint}:${top.gameId}:${top.paramsKey}`}
          connection={connection}
          gameId={top.gameId}
          paramsKey={top.paramsKey}
          onBack={stepBack}
        />
      );
    }
  }
}
