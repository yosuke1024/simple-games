import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '../state/SettingsContext';
import { ConfirmDialog } from '../ui/components/ConfirmDialog';
import { IconBack, IconClose } from '../ui/components/icons';
import { NearbyController, type Setup } from './controller';
import {
  blockIdentity,
  clearHistory,
  deleteGathering,
  loadHistory,
  savedGameId,
  savedGameResult,
  type Gathering,
} from './history';
import { useNearbyText } from './i18n';
import { isChatText, isPlayerName } from './session';
import { GAME_NAME_KEYS, GAME_TITLES, loadNearbyGame, type NearbyGame } from './games';
import type { NearbyGameId } from './gameTypes';
import { NearbyBrowser } from './NearbyBrowser';
import { filteredNearbyText, isAllowedNearbyText } from './contentFilter';
import { ReportDialog } from './ReportDialog';
import { listingKey, type ReportTarget } from './report';
import './nearby.css';
import type { GroupSelection } from './GroupRoot';
const GroupRoot = lazy(() => import('./GroupRoot'));

type Screen = 'home' | 'setup' | 'active' | 'history' | 'detail';
type Question = 'leave' | 'delete' | 'clear' | 'block' | 'blockHistory' | null;

export interface NearbyRootProps {
  gameId: NearbyGameId | null;
  onGameSelected?: (gameId: NearbyGameId | null) => void;
  onOpenGame?: (gameId: NearbyGameId) => void;
  onExit: () => void;
  /** Kept mounted by the app while a connection is active on another screen. */
  visible?: boolean;
  onActiveChange?: (active: boolean) => void;
  onRegisterStop?: (stop: (() => Promise<void>) | null) => void;
}

export function NearbyRoot(props: NearbyRootProps) {
  const [groupJoined, setGroupJoined] = useState<GroupSelection | null>(null);
  const fromBrowser = useRef(props.gameId === null).current;
  const [joined, setJoined] = useState<{
    controller: NearbyController;
    gameId: NearbyGameId;
    game: NearbyGame;
  } | null>(null);
  const [, render] = useState(0);
  const handedOffController = useRef<NearbyController | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      void handedOffController.current?.stop();
    };
  }, []);
  const changed = useCallback(() => {
    if (live.current) render((value) => value + 1);
  }, []);
  const gameId = fromBrowser ? (groupJoined ? 'ludo' : (joined?.gameId ?? null)) : props.gameId;
  const Loaded = useMemo(
    () =>
      lazy(async () => {
        if (!gameId) throw new Error('Select a game before loading its board');
        const game = await loadNearbyGame(gameId);
        return { default: (inner: GameRootProps) => <NearbyGameRoot {...inner} game={game} /> };
      }),
    [gameId],
  );
  if (gameId === 'ludo')
    return (
      <Suspense fallback={<div className="screen" aria-busy="true" />}>
        <GroupRoot {...props} gameId="ludo" initial={groupJoined ?? undefined} />
      </Suspense>
    );
  if (!gameId)
    return (
      <NearbyBrowser
        visible={props.visible}
        onExit={props.onExit}
        onOpenGame={props.onOpenGame}
        onRegisterStop={props.onRegisterStop}
        onChanged={changed}
        onJoinGroup={(selection) => {
          setGroupJoined(selection);
          props.onGameSelected?.('ludo');
        }}
        onJoin={(controller, selectedId, game) => {
          handedOffController.current = controller;
          setJoined({ controller, gameId: selectedId, game });
          props.onGameSelected?.(selectedId);
        }}
      />
    );
  const innerProps: GameRootProps = {
    ...props,
    gameId,
    initialController: joined?.controller,
    onReturnToBrowser: fromBrowser
      ? () => {
          setJoined(null);
          props.onGameSelected?.(null);
        }
      : undefined,
  };
  // The browser already loaded the selected board before handing off. Avoid
  // suspending/unmounting the connection while its encrypted handshake runs.
  if (joined) return <NearbyGameRoot {...innerProps} game={joined.game} />;
  return (
    <Suspense fallback={<div className="screen" aria-busy="true" />}>
      <Loaded {...innerProps} />
    </Suspense>
  );
}

interface GameRootProps extends Omit<NearbyRootProps, 'gameId'> {
  gameId: NearbyGameId;
  initialController?: NearbyController;
  onReturnToBrowser?: () => void;
}

function NearbyGameRoot({
  gameId,
  game,
  onExit,
  visible = true,
  onActiveChange,
  onRegisterStop,
  initialController,
  onReturnToBrowser,
}: GameRootProps & { game: NearbyGame }) {
  const n = useNearbyText();
  const { locale, t } = useSettings();
  const gameTitle = t(GAME_NAME_KEYS[gameId]);
  const [boardSize, setBoardSize] = useState<3 | 4 | 5>(3);
  const [screen, setScreen] = useState<Screen>(initialController ? 'active' : 'home');
  const [setup, setSetup] = useState<Setup>(() =>
    initialController?.setup.gameId
      ? {
          ...initialController.setup,
          gameId: initialController.setup.gameId,
        }
      : {
          gameId,
          host: true,
          name: '',
          // A public, editable title, not a connection secret or identity.
          roomName: `${[...gameTitle].slice(0, 19).join('')} ${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
          transport: 'ble',
          chatEnabled: false,
        },
  );
  const nameEdited = useRef(!!initialController);
  const [accepted, setAccepted] = useState(false);
  const [controller, setController] = useState<NearbyController | null>(initialController ?? null);
  const controllerRef = useRef<NearbyController | null>(initialController ?? null);
  const [, render] = useState(0);
  const [panel, setPanel] = useState<'chat' | 'game'>('game');
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState('');
  const [readMessages, setReadMessages] = useState(0);
  const [foreground, setForeground] = useState(document.visibilityState !== 'hidden');
  const [question, setQuestion] = useState<Question>(null);
  const [history, setHistory] = useState<Gathering[]>([]);
  const [detail, setDetail] = useState<Gathering | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [hiddenListings, setHiddenListings] = useState<Set<string>>(new Set());
  const safeText = (text: string) => filteredNearbyText(text, n('contentHidden'));
  const live = useRef(true);
  const chatEnd = useRef<HTMLDivElement>(null);
  const backRef = useRef<() => void>(() => {});
  const activeChangeRef = useRef(onActiveChange);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatHeadingRef = useRef<HTMLHeadingElement>(null);
  const chatButtonRef = useRef<HTMLButtonElement>(null);
  const date = (at: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);

  useEffect(() => {
    if (screen !== 'setup' || nameEdited.current) return;
    let current = true;
    void loadHistory()
      .then((data) => {
        if (current && !nameEdited.current && data.displayName)
          setSetup((value) => ({ ...value, name: data.displayName! }));
      })
      .catch(() => {
        if (current) setStorageError(true);
      });
    return () => {
      current = false;
    };
  }, [screen]);

  const back = () => {
    if (!visible || busy) return;
    if (report) {
      setReport(null);
      return;
    }
    if (question) {
      setQuestion(null);
      return;
    }
    if (
      screen === 'active' &&
      controller?.session?.paired &&
      controller.session.chatEnabled &&
      panel === 'chat'
    ) {
      closeChat();
      return;
    }
    if (screen === 'active' && controller?.state !== 'ended') {
      onExit();
      return;
    }
    if (screen === 'active') {
      if (onReturnToBrowser) {
        onReturnToBrowser();
        return;
      }
      setScreen('home');
      return;
    }
    if (screen === 'detail') {
      setScreen('history');
      return;
    }
    if (screen === 'home') onExit();
    else setScreen('home');
  };
  backRef.current = back;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      activeChangeRef.current?.(false);
      void controllerRef.current?.stop();
    };
  }, []);
  useEffect(() => {
    onRegisterStop?.(async () => {
      await controllerRef.current?.stop();
    });
    return () => onRegisterStop?.(null);
  }, [onRegisterStop]);
  useEffect(() => {
    if (!visible) return;
    let listening = true;
    const handle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('backButton', () => {
          if (listening) backRef.current();
        })
      : null;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) backRef.current();
    };
    window.addEventListener('keydown', escape);
    return () => {
      listening = false;
      window.removeEventListener('keydown', escape);
      void handle?.then((h) => h.remove()).catch(() => undefined);
    };
  }, [visible]);
  useEffect(() => {
    if (!visible && containerRef.current?.contains(document.activeElement))
      (document.activeElement as HTMLElement).blur();
  }, [visible]);

  useEffect(() => {
    const updateForeground = () => setForeground(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', updateForeground);
    return () => document.removeEventListener('visibilitychange', updateForeground);
  }, []);

  const session = controller?.session;
  const gameStatus = !session?.match
    ? ''
    : session.suspended
      ? n('reconnecting')
      : session.pending
        ? n('pending')
        : session.matchComplete
          ? session.result!.winner === 'draw'
            ? n('draw')
            : n('won', { name: session.names[session.result!.winner as 0 | 1]! })
          : n('playerTurn', { name: session.names[session.adapter.turn(session.match.state)]! });
  const active = controller !== null && controller.state !== 'ended';
  const inRoom = screen === 'active' && active && !!session?.paired;
  const chatEnabled = session?.chatEnabled === true;
  const chatOpen = chatEnabled && panel === 'chat';
  const showingBoard = inRoom && !!session?.match && !chatOpen;
  const needsInitialProposal =
    inRoom && !session?.match && !session?.gameProposed && !session?.suspended && !session?.pending;
  useEffect(() => {
    if (needsInitialProposal) session?.proposeGame();
  }, [needsInitialProposal, session]);
  useEffect(() => {
    activeChangeRef.current = onActiveChange;
  }, [onActiveChange]);
  useEffect(() => {
    activeChangeRef.current?.(active);
  }, [active]);

  const messageCount = session?.messages.length ?? 0;
  const receivedMessages =
    session?.messages.filter((message) => message.sender === 'peer').length ?? 0;
  const unread = chatEnabled && !hidden && receivedMessages > readMessages;
  useEffect(() => {
    if (
      !visible ||
      !foreground ||
      !chatOpen ||
      !inRoom ||
      hidden ||
      question !== null ||
      report !== null
    )
      return;
    setReadMessages(receivedMessages);
    chatEnd.current?.scrollIntoView?.({ block: 'nearest' });
  }, [
    visible,
    foreground,
    chatOpen,
    inRoom,
    hidden,
    question,
    report,
    receivedMessages,
    messageCount,
  ]);
  useEffect(() => {
    if (visible && inRoom && chatOpen) chatHeadingRef.current?.focus({ preventScroll: true });
  }, [visible, inRoom, chatOpen]);
  const closeChat = () => {
    setPanel('game');
    chatButtonRef.current?.focus();
  };

  const begin = () => {
    if (
      !visible ||
      active ||
      !isPlayerName(setup.name.trim()) ||
      (setup.host && !isPlayerName(setup.roomName.trim())) ||
      !accepted ||
      busy
    )
      return;
    const adapter = game.makeAdapter ? game.makeAdapter(boardSize) : game.adapter;
    const next = new NearbyController(
      { ...setup, name: setup.name.trim(), roomName: setup.host ? setup.roomName.trim() : '' },
      () => {
        if (live.current) render((v) => v + 1);
      },
      undefined,
      adapter,
    );
    controllerRef.current = next;
    setController(next);
    setHidden(false);
    setDraft('');
    setHiddenListings(new Set());
    setReadMessages(0);
    setPanel('game');
    setScreen('active');
    void next.start();
  };
  const readHistory = async () => {
    setBusy(true);
    setStorageError(false);
    try {
      const data = await loadHistory();
      setHistory(data.gatherings);
      setBlocked(data.blocked);
    } catch {
      setStorageError(true);
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    const action = question;
    setQuestion(null);
    if (action === 'leave') {
      await controller?.stop();
      return;
    }
    if (action === 'block') {
      setBusy(true);
      try {
        await controller?.block();
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    setStorageError(false);
    try {
      if (action === 'blockHistory' && detail?.peerIdentity) {
        await blockIdentity(detail.peerIdentity);
        setBlocked((old) => [...old, detail.peerIdentity!]);
        return;
      }
      if (action === 'delete' && detail) await deleteGathering(detail.id);
      if (action === 'clear') {
        await clearHistory();
        nameEdited.current = false;
        setSetup((value) => ({ ...value, name: '' }));
      }
      setDetail(null);
      await readHistory();
      setScreen('history');
    } catch {
      setStorageError(true);
    } finally {
      setBusy(false);
    }
  };
  const questionTitle =
    question === 'delete'
      ? n('deleteTitle')
      : question === 'clear'
        ? n('clear')
        : question === 'blockHistory'
          ? n('blockPlayer')
          : question === 'block'
            ? n('block')
            : n('leaveTitle');
  const questionBody =
    question === 'delete'
      ? n('deleteBody')
      : question === 'clear'
        ? n('clearBody')
        : question === 'blockHistory'
          ? n('blockHistoryBody')
          : question === 'block'
            ? n('blockBody')
            : n('leaveBody');
  const questionAction =
    question === 'delete'
      ? n('delete')
      : question === 'clear'
        ? n('clear')
        : question === 'blockHistory'
          ? n('blockPlayer')
          : question === 'block'
            ? n('block')
            : n('leave');

  return (
    <div
      ref={containerRef}
      className={`screen nearby-screen accent-${gameId}`}
      hidden={!visible}
      inert={!visible}
      data-game={gameId}
    >
      <div
        className="nearby-content"
        inert={question !== null || report !== null || busy}
        aria-busy={busy}
      >
        <header className="screen-header">
          <button className="icon-btn" aria-label={n('back')} disabled={busy} onClick={back}>
            <IconBack />
          </button>
          <h1 className="nearby-title">{gameTitle}</h1>
          {inRoom && chatEnabled ? (
            <button
              ref={chatButtonRef}
              className="icon-btn nearby-chat-toggle"
              aria-label={panel === 'chat' ? n('closeChat') : n(unread ? 'unreadChat' : 'chat')}
              aria-expanded={panel === 'chat'}
              data-unread={unread}
              aria-controls="nearby-chat-panel"
              onClick={() => (panel === 'chat' ? closeChat() : setPanel('chat'))}
            >
              {panel === 'chat' ? <IconClose /> : <ConversationIcon />}
              {unread && panel !== 'chat' && <span className="nearby-unread" aria-hidden="true" />}
            </button>
          ) : (
            <span className="icon-btn-placeholder" />
          )}
        </header>
        {screen === 'home' && (
          <main className="nearby-stack">
            <h2>{n('playTogether')}</h2>
            <p className="nearby-note">{n('twoPeople')}</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSetup({ ...setup, host: true, chatEnabled: false });
                setScreen('setup');
              }}
            >
              {n('create')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSetup({ ...setup, host: false, chatEnabled: false });
                setScreen('setup');
              }}
            >
              {n('join')}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setScreen('history');
                void readHistory();
              }}
            >
              {n('history')}
            </button>
            <p className="nearby-note">{n('localNote')}</p>
          </main>
        )}
        {screen === 'setup' && (
          <form
            className="nearby-stack"
            onSubmit={(e) => {
              e.preventDefault();
              begin();
            }}
          >
            <h2>{n(setup.host ? 'create' : 'join')}</h2>
            {storageError && (
              <p className="nearby-warning" role="alert">
                {n('storageError')}
              </p>
            )}
            {setup.host && (
              <>
                <label className="nearby-field">
                  {n('roomName')}
                  <input
                    value={setup.roomName}
                    maxLength={48}
                    autoComplete="off"
                    aria-describedby="nearby-room-name-hint"
                    onChange={(e) => setSetup({ ...setup, roomName: e.target.value })}
                  />
                </label>
                <p id="nearby-room-name-hint" className="nearby-note">
                  {n('roomNameHint')}
                </p>
                {!isAllowedNearbyText(setup.roomName) && <p role="alert">{n('contentBlocked')}</p>}
              </>
            )}
            {setup.host && game.makeAdapter && (
              <label className="nearby-field">
                {t('dotsAndBoxesChooseBoard')}
                <select
                  value={boardSize}
                  onChange={(e) => setBoardSize(Number(e.target.value) as 3 | 4 | 5)}
                >
                  <option value={3}>3 × 3</option>
                  <option value={4}>4 × 4</option>
                  <option value={5}>5 × 5</option>
                </select>
              </label>
            )}
            <label className="nearby-field">
              {n('name')}
              <input
                value={setup.name}
                maxLength={48}
                autoComplete="off"
                aria-describedby="nearby-name-hint"
                onChange={(e) => {
                  nameEdited.current = true;
                  setSetup({ ...setup, name: e.target.value });
                }}
              />
            </label>
            <p id="nearby-name-hint" className="nearby-note">
              {n('nameHint')}
            </p>
            {!isAllowedNearbyText(setup.name) && <p role="alert">{n('contentBlocked')}</p>}
            {setup.host && (
              <>
                <label className="nearby-check">
                  <input
                    type="checkbox"
                    checked={setup.chatEnabled}
                    aria-describedby="nearby-chat-setting-hint"
                    onChange={(e) => setSetup({ ...setup, chatEnabled: e.target.checked })}
                  />
                  {n('useChat')}
                </label>
                <p id="nearby-chat-setting-hint" className="nearby-note">
                  {n('chatSettingHint')}
                </p>
              </>
            )}
            <fieldset className="nearby-choices">
              <legend>{n('connectionHint')}</legend>
              <label>
                <input
                  type="radio"
                  name="transport"
                  checked={setup.transport === 'ble'}
                  onChange={() => setSetup({ ...setup, transport: 'ble' })}
                />
                {n('bluetooth')}
              </label>
              <label>
                <input
                  type="radio"
                  name="transport"
                  checked={setup.transport === 'lan'}
                  onChange={() => setSetup({ ...setup, transport: 'lan' })}
                />
                {n('wifi')}
              </label>
            </fieldset>
            <p className="nearby-note">{n('conduct')}</p>
            <label className="nearby-check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              {n('accept')}
            </label>
            <button
              className="btn btn-primary"
              disabled={
                !isPlayerName(setup.name.trim()) ||
                (setup.host && !isPlayerName(setup.roomName.trim())) ||
                !accepted
              }
            >
              {n(setup.host ? 'start' : 'search')}
            </button>
          </form>
        )}
        {screen === 'active' && controller && (
          <main className={`nearby-stack ${showingBoard ? 'nearby-playing' : ''}`}>
            {(controller.storageFailed || storageError) && (
              <p className="nearby-warning" role="alert">
                {n('storageError')}
              </p>
            )}
            {controller.state !== 'ended' && session?.peerName && !showingBoard && (
              <p className="nearby-note">{n(chatEnabled ? 'chatOn' : 'chatOff')}</p>
            )}
            {controller.state === 'ended' ? (
              <>
                <h2>{n('ended')}</h2>
                {controller.reason !== 'ended' && <p role="status">{n(controller.reason)}</p>}
                {controller.gathering && <p className="nearby-note">{n('localNote')}</p>}
                <button
                  className="btn btn-primary"
                  onClick={() => (onReturnToBrowser ? onReturnToBrowser() : setScreen('home'))}
                >
                  {onReturnToBrowser ? n('search') : n('retry', { game: gameTitle })}
                </button>
              </>
            ) : session && (session.paired || controller.state === 'reconnecting') ? (
              <>
                {!showingBoard && (
                  <div className="nearby-room-heading">
                    <h2>{session.roomName}</h2>
                    <span>{session.names.join(' · ')}</span>
                  </div>
                )}
                {(controller.state === 'reconnecting' || session.suspended) && (
                  <p className="nearby-warning" role="status">
                    {n('reconnecting')}
                  </p>
                )}
                {!chatOpen && (session.gameProposed || !session.match || session.matchComplete) && (
                  <section className="nearby-card">
                    {session.gameProposed || !session.match ? (
                      <>
                        <h3>{n('proposed', { game: gameTitle })}</h3>
                        <button
                          className="btn btn-primary"
                          disabled={
                            !visible ||
                            !session.gameProposed ||
                            session.localReady ||
                            session.pending ||
                            session.suspended
                          }
                          onClick={() => {
                            session.ready();
                            setPanel('game');
                          }}
                        >
                          {n(session.localReady ? 'waitingReady' : 'ready')}
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-secondary"
                        disabled={!visible || session.pending || session.suspended}
                        onClick={() => session.proposeGame()}
                      >
                        {n('rematch')}
                      </button>
                    )}
                  </section>
                )}
                {!chatOpen && session.match && (
                  <section className="nearby-board" aria-label={gameTitle}>
                    <p className="nearby-game-status" role="status">
                      {gameStatus}
                    </p>
                    <game.Board
                      key={`${gameId}:${session.match.round}`}
                      match={session.match}
                      seat={session.host ? 0 : 1}
                      names={session.names}
                      statusLabel={gameStatus}
                      canAct={
                        visible &&
                        foreground &&
                        question === null &&
                        report === null &&
                        session.canAct
                      }
                      act={(action) => session.act(action)}
                    />
                    {session.result &&
                      !['chess', 'nim', 'yacht', 'gin-rummy', 'scopa'].includes(gameId) && (
                        <p className="nearby-game-score">
                          {session.names[0]} {session.result.scores[0]} · {session.names[1]}{' '}
                          {session.result.scores[1]}
                        </p>
                      )}
                  </section>
                )}
                {chatOpen && (
                  <section
                    id="nearby-chat-panel"
                    className="nearby-chat-panel"
                    aria-labelledby="nearby-chat-heading"
                  >
                    <h2 id="nearby-chat-heading" ref={chatHeadingRef} tabIndex={-1}>
                      {n('chat')}
                    </h2>
                    {session.gameProposed && (
                      <button className="btn btn-secondary" onClick={closeChat}>
                        {n('proposed', { game: gameTitle })} · {n('openGame')}
                      </button>
                    )}
                    <div
                      className="nearby-messages"
                      role="log"
                      aria-label={n('chat')}
                      aria-live="polite"
                      aria-relevant="additions"
                    >
                      {hidden && <p className="nearby-note">{n('chatHidden')}</p>}
                      {session.messages
                        .filter((m) => !hidden || m.sender === 'self')
                        .map((m) => (
                          <article
                            key={m.id}
                            className={`nearby-message nearby-message-${m.sender}`}
                          >
                            <strong>{m.sender === 'self' ? session.name : session.peerName}</strong>
                            <p>{safeText(m.text)}</p>
                            {m.sender === 'self' && <small>{n(m.status)}</small>}
                            {m.sender === 'peer' && (
                              <button
                                className="btn btn-ghost nearby-message-report"
                                onClick={() =>
                                  setReport({
                                    title: `${gameTitle} · ${session.peerName}`,
                                    content: m.text,
                                  })
                                }
                              >
                                {n('report')}
                              </button>
                            )}
                          </article>
                        ))}
                      <div ref={chatEnd} />
                    </div>
                    <form
                      className="nearby-compose"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (visible && chatEnabled && session.sendChat(draft.trim())) setDraft('');
                      }}
                    >
                      <label className="nearby-field">
                        {n('message')}
                        <input
                          value={draft}
                          disabled={session.suspended}
                          maxLength={320}
                          autoComplete="off"
                          enterKeyHint="send"
                          onChange={(e) => setDraft(e.target.value)}
                        />
                      </label>
                      <button
                        className="btn btn-primary"
                        disabled={
                          session.suspended ||
                          session.chatPending ||
                          session.pending ||
                          !isChatText(draft.trim())
                        }
                      >
                        {n('send')}
                      </button>
                    </form>
                    {!isAllowedNearbyText(draft) && <p role="alert">{n('contentBlocked')}</p>}
                    <p className="nearby-note">{n('chatHint')}</p>
                  </section>
                )}
                <details className="nearby-safety">
                  <summary>{n('room')}</summary>
                  <p>{session.roomName}</p>
                  <p>{session.names.join(' · ')}</p>
                  <p>{n('confirmation', { code: controller.code })}</p>
                  {chatEnabled && (
                    <button className="btn btn-ghost" onClick={() => setHidden(!hidden)}>
                      {n(hidden ? 'showChat' : 'hideChat')}
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => setQuestion('block')}>
                    {n('block')}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      setReport({
                        title: gameTitle,
                        content: `${session.roomName}\n${session.peerName}`,
                      })
                    }
                  >
                    {n('report')}
                  </button>
                  <p className="nearby-note">{n('reportHint')}</p>
                </details>
              </>
            ) : (
              <>
                <h2>
                  {session?.peerName
                    ? setup.host
                      ? n('request', { name: session.peerName })
                      : n('awaiting')
                    : n(
                        controller.state === 'discovering'
                          ? setup.host
                            ? 'hosting'
                            : 'searching'
                          : 'connecting',
                      )}
                </h2>
                {setup.host && (
                  <section className="nearby-card">
                    <h3>{setup.roomName}</h3>
                    <p>
                      {gameTitle} · {n('participants', { count: 1, capacity: 2 })}
                    </p>
                  </section>
                )}
                {!setup.host && session?.roomName && <p>{session.roomName}</p>}
                {session?.peerName && (
                  <section className="nearby-card">
                    <p>{session.peerName}</p>
                    <p className="nearby-code">{n('confirmation', { code: controller.code })}</p>
                    <p className="nearby-note">{n('compare')}</p>
                    <div className="nearby-actions">
                      <button
                        className="btn btn-ghost"
                        disabled={!session.peerIdentity}
                        onClick={() => setQuestion('block')}
                      >
                        {n('block')}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          setReport({
                            title: gameTitle,
                            content: `${session.roomName}\n${session.peerName}`,
                          })
                        }
                      >
                        {n('report')}
                      </button>
                    </div>
                    {setup.host && (
                      <div className="nearby-actions">
                        <button
                          className="btn btn-primary"
                          disabled={session.approvalPending}
                          onClick={() => session.approve()}
                        >
                          {n('approve')}
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={session.approvalPending}
                          onClick={() => session.reject()}
                        >
                          {n('reject')}
                        </button>
                      </div>
                    )}
                  </section>
                )}
                {!setup.host && controller.state === 'discovering' && (
                  <div className="nearby-stack">
                    {controller.peers.filter((peer) => !hiddenListings.has(listingKey(peer)))
                      .length === 0 && <p className="nearby-note">{n('noPeers')}</p>}
                    {controller.peers
                      .filter((peer) => !hiddenListings.has(listingKey(peer)))
                      .map((peer) => (
                        <article className="nearby-listing" key={peer.id}>
                          <button
                            className="nearby-peer"
                            onClick={() => {
                              void controller.connect(peer.id);
                            }}
                          >
                            <strong>{peer.roomName}</strong>
                            <span>{t(GAME_NAME_KEYS[peer.gameId])}</span>
                            <span>{n('participants', { count: 1, capacity: 2 })}</span>
                          </button>
                          <div className="nearby-actions nearby-listing-actions">
                            <button
                              className="btn btn-ghost"
                              onClick={() =>
                                setHiddenListings((old) => new Set([...old, listingKey(peer)]))
                              }
                            >
                              {n('hideListing')}
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() =>
                                setReport({
                                  title: GAME_TITLES[peer.gameId],
                                  content: peer.roomName ?? '',
                                })
                              }
                            >
                              {n('report')}
                            </button>
                          </div>
                        </article>
                      ))}
                    {hiddenListings.size > 0 && (
                      <p className="nearby-note" role="status">
                        {n('hideListingHint')}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            {controller.state !== 'ended' && (
              <button className="btn btn-ghost nearby-leave" onClick={() => setQuestion('leave')}>
                {n(setup.host ? 'dissolve' : 'leave')}
              </button>
            )}
          </main>
        )}
        {screen === 'history' && (
          <main className="nearby-stack">
            <h2>{n('history')}</h2>
            <p className="nearby-note">{n('historyReadOnly')}</p>
            {storageError && <p role="alert">{n('storageError')}</p>}
            {!busy && !storageError && history.length === 0 && <p>{n('historyEmpty')}</p>}
            {history.map((g) => (
              <button
                className="nearby-peer"
                key={g.id}
                onClick={() => {
                  setDetail(g);
                  setScreen('detail');
                }}
              >
                <strong>{safeText(g.roomName ?? g.names.join(' · '))}</strong>
                {g.roomName && <span>{safeText(g.names.join(' · '))}</span>}
                <span>{date(g.at)}</span>
              </button>
            ))}
            <button className="btn btn-ghost" disabled={busy} onClick={() => setQuestion('clear')}>
              {n('clear')}
            </button>
          </main>
        )}
        {screen === 'detail' && detail && (
          <main className="nearby-stack">
            <h2>{safeText(detail.roomName ?? detail.names.join(' · '))}</h2>
            {detail.roomName && <p>{safeText(detail.names.join(' · '))}</p>}
            <p>{date(detail.at)}</p>
            <p className="nearby-note">{n('historyReadOnly')}</p>
            {storageError && <p role="alert">{n('storageError')}</p>}
            {detail.games.map((game) => (
              <section className="nearby-card" key={game.round}>
                <h3>
                  {GAME_TITLES[savedGameId(game)]} · {game.round}
                </h3>
                <p>
                  {!game.finished
                    ? n('interrupted')
                    : savedGameResult(game).winner === 'draw'
                      ? n('draw')
                      : n('won', {
                          name: safeText(detail.names[savedGameResult(game).winner as 0 | 1]!),
                        })}
                </p>
                {!['chess', 'nim'].includes(savedGameId(game)) && (
                  <p>
                    {safeText(detail.names[0])} {game.scores[0]} · {safeText(detail.names[1])}{' '}
                    {game.scores[1]}
                  </p>
                )}
              </section>
            ))}
            {detail.messages.map((m) => (
              <article className={`nearby-message nearby-message-${m.sender}`} key={m.id}>
                <strong>
                  {safeText(detail.names[(m.sender === 'self') === detail.host ? 0 : 1])}
                </strong>
                <p>{safeText(m.text)}</p>
                <small>
                  {date(m.at)}
                  {m.sender === 'self'
                    ? ` · ${n(m.status === 'sending' ? 'failed' : m.status)}`
                    : ''}
                </small>
                {m.sender === 'peer' && (
                  <button
                    className="btn btn-ghost nearby-message-report"
                    onClick={() =>
                      setReport({
                        title: `${n('history')} · ${detail.names[detail.host ? 1 : 0]}`,
                        content: m.text,
                      })
                    }
                  >
                    {n('report')}
                  </button>
                )}
              </article>
            ))}
            <button
              className="btn btn-ghost"
              onClick={() =>
                setReport({
                  title: n('history'),
                  content: `${detail.roomName ?? ''}\n${detail.names[detail.host ? 1 : 0]}`,
                })
              }
            >
              {n('report')}
            </button>
            {detail.peerIdentity &&
              (blocked.includes(detail.peerIdentity) ? (
                <p role="status">{n('blocked')}</p>
              ) : (
                <button className="btn btn-ghost" onClick={() => setQuestion('blockHistory')}>
                  {n('blockPlayer')}
                </button>
              ))}
            <button className="btn btn-ghost" onClick={() => setQuestion('delete')}>
              {n('delete')}
            </button>
          </main>
        )}
      </div>
      {visible && report && <ReportDialog target={report} onClose={() => setReport(null)} />}
      <ConfirmDialog
        open={visible && question !== null}
        title={questionTitle}
        body={questionBody}
        confirmLabel={questionAction}
        cancelLabel={n('cancel')}
        danger
        onCancel={() => setQuestion(null)}
        onConfirm={() => {
          void confirm();
        }}
      />
    </div>
  );
}

function ConversationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 4H4a1 1 0 0 0-1 1v15l4-4h13a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z" />
      <path d="M7 8h10M7 12h6" />
    </svg>
  );
}
