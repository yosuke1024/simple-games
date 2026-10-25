import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SUPPORT_EMAIL } from '@simple-games/brand';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../state/SettingsContext';
import { ConfirmDialog } from '../ui/components/ConfirmDialog';
import { IconBack } from '../ui/components/icons';
import { NearbyController, type Setup } from './controller';
import { clearHistory, deleteGathering, loadHistory, type Gathering } from './history';
import { useNearbyText } from './i18n';
import { isChatText, isPlayerName, type Session } from './session';
import { CATEGORIES, finished, scoreFor, totals, turn } from './yacht';
import './nearby.css';

type Screen = 'home' | 'setup' | 'active' | 'history' | 'detail';
type Question = 'leave' | 'delete' | 'clear' | 'block' | null;
type Text = ReturnType<typeof useNearbyText>;
const categoryKeys = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'fullHouse',
  'fourKind',
  'littleStraight',
  'bigStraight',
  'choice',
  'yacht',
] as const;

export function NearbyRoot({ onExit }: { onExit: () => void }) {
  const n = useNearbyText();
  const { locale } = useSettings();
  const [screen, setScreen] = useState<Screen>('home');
  const [setup, setSetup] = useState<Setup>({
    host: true,
    name: '',
    public: false,
    transport: 'ble',
  });
  const [accepted, setAccepted] = useState(false);
  const [controller, setController] = useState<NearbyController | null>(null);
  const controllerRef = useRef<NearbyController | null>(null);
  const [, render] = useState(0);
  const [panel, setPanel] = useState<'chat' | 'game'>('chat');
  const [hidden, setHidden] = useState(false);
  const [draft, setDraft] = useState('');
  const [question, setQuestion] = useState<Question>(null);
  const [history, setHistory] = useState<Gathering[]>([]);
  const [detail, setDetail] = useState<Gathering | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const chatEnd = useRef<HTMLDivElement>(null);
  const backRef = useRef<() => void>(() => {});
  const date = (at: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);

  const back = () => {
    if (question) {
      setQuestion(null);
      return;
    }
    if (screen === 'active' && controller?.state !== 'ended') {
      setQuestion('leave');
      return;
    }
    if (screen === 'active') {
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
    const handle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('backButton', () => backRef.current())
      : null;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) backRef.current();
    };
    window.addEventListener('keydown', escape);
    return () => {
      live.current = false;
      window.removeEventListener('keydown', escape);
      void handle?.then((h) => h.remove()).catch(() => undefined);
      void controllerRef.current?.stop();
    };
  }, []);

  const session = controller?.session;
  const messageCount = session?.messages.length ?? 0;
  useEffect(() => {
    chatEnd.current?.scrollIntoView?.({ block: 'nearest' });
  }, [messageCount, panel]);

  const begin = () => {
    if (!isPlayerName(setup.name.trim()) || !accepted || busy) return;
    const next = new NearbyController({ ...setup, name: setup.name.trim() }, () => {
      if (live.current) render((v) => v + 1);
    });
    controllerRef.current = next;
    setController(next);
    setHidden(false);
    setDraft('');
    setPanel('chat');
    setScreen('active');
    void next.start();
  };
  const readHistory = async () => {
    setBusy(true);
    setStorageError(false);
    try {
      setHistory((await loadHistory()).gatherings);
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
      await controller?.block();
      return;
    }
    setBusy(true);
    setStorageError(false);
    try {
      if (action === 'delete' && detail) await deleteGathering(detail.id);
      if (action === 'clear') await clearHistory();
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
        : question === 'block'
          ? n('block')
          : n('leaveTitle');
  const questionBody =
    question === 'delete'
      ? n('deleteBody')
      : question === 'clear'
        ? n('clearBody')
        : question === 'block'
          ? n('blockBody')
          : n('leaveBody');
  const questionAction =
    question === 'delete'
      ? n('delete')
      : question === 'clear'
        ? n('clear')
        : question === 'block'
          ? n('block')
          : n('leave');

  return (
    <div className="screen nearby-screen">
      <div className="nearby-content" inert={question !== null}>
        <header className="screen-header">
          <button className="icon-btn" aria-label={n('back')} onClick={back}>
            <IconBack />
          </button>
          <h1 className="nearby-title">Nearby Play</h1>
          <span className="icon-btn-placeholder" />
        </header>
        {screen === 'home' && (
          <main className="nearby-stack">
            <div className="nearby-hero">
              <span aria-hidden="true">◉ ◉</span>
              <h2>{n('tagline')}</h2>
              <p>{n('twoPeople')}</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSetup({ ...setup, host: true });
                setScreen('setup');
              }}
            >
              {n('create')}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSetup({ ...setup, host: false });
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
            <label className="nearby-field">
              {n('name')}
              <input
                value={setup.name}
                maxLength={48}
                autoComplete="off"
                aria-describedby="nearby-name-hint"
                onChange={(e) => setSetup({ ...setup, name: e.target.value })}
              />
            </label>
            <p id="nearby-name-hint" className="nearby-note">
              {n('nameHint')}
            </p>
            {setup.host && (
              <>
                <fieldset className="nearby-choices">
                  <legend>{n('create')}</legend>
                  <label>
                    <input
                      type="radio"
                      name="audience"
                      checked={!setup.public}
                      onChange={() => setSetup({ ...setup, public: false })}
                    />
                    {n('friends')}
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="audience"
                      checked={setup.public}
                      onChange={() => setSetup({ ...setup, public: true })}
                    />
                    {n('public')}
                  </label>
                </fieldset>
                <p className="nearby-note">{n('audienceHint')}</p>
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
              disabled={!isPlayerName(setup.name.trim()) || !accepted}
            >
              {n(setup.host ? 'start' : 'search')}
            </button>
          </form>
        )}
        {screen === 'active' && controller && (
          <main className="nearby-stack">
            {(controller.storageFailed || storageError) && (
              <p className="nearby-warning" role="alert">
                {n('storageError')}
              </p>
            )}
            {controller.state === 'ended' ? (
              <>
                <h2>{n('ended')}</h2>
                {controller.reason !== 'ended' && <p role="status">{n(controller.reason)}</p>}
                {controller.gathering && <p className="nearby-note">{n('localNote')}</p>}
                <button className="btn btn-primary" onClick={() => setScreen('home')}>
                  {n('retry')}
                </button>
              </>
            ) : session?.paired ? (
              <>
                <div className="nearby-room-heading">
                  <h2>{session.names.join(' · ')}</h2>
                  <span>{controller.label}</span>
                </div>
                <p className="nearby-note">{n('roomHint')}</p>
                <div className="nearby-tabs" role="group" aria-label={n('room')}>
                  <button
                    className="btn btn-ghost"
                    aria-pressed={panel === 'chat'}
                    onClick={() => setPanel('chat')}
                  >
                    {n('chat')}
                  </button>
                  {session.match && (
                    <button
                      className="btn btn-ghost"
                      aria-pressed={panel === 'game'}
                      onClick={() => setPanel('game')}
                    >
                      {n('game')}
                    </button>
                  )}
                </div>
                {(session.gameProposed || !session.match || session.matchComplete) && (
                  <section className="nearby-card">
                    {session.gameProposed ? (
                      <>
                        <h3>{n('proposed')}</h3>
                        <button
                          className="btn btn-primary"
                          disabled={session.localReady || session.pending}
                          onClick={() => {
                            session.ready();
                            setPanel('game');
                          }}
                        >
                          {n(session.localReady ? 'waitingReady' : 'ready')}
                        </button>
                      </>
                    ) : setup.host ? (
                      <button
                        className="btn btn-secondary"
                        disabled={session.pending}
                        onClick={() => session.proposeGame()}
                      >
                        {n(session.match ? 'rematch' : 'propose')}
                      </button>
                    ) : (
                      <p>{n('hostSelects')}</p>
                    )}
                  </section>
                )}
                {panel === 'game' && session.match ? (
                  <YachtBoard session={session} n={n} onRoom={() => setPanel('chat')} />
                ) : (
                  <>
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
                            <p>{m.text}</p>
                            {m.sender === 'self' && <small>{n(m.status)}</small>}
                          </article>
                        ))}
                      <div ref={chatEnd} />
                    </div>
                    <form
                      className="nearby-compose"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (session.sendChat(draft.trim())) setDraft('');
                      }}
                    >
                      <label className="nearby-field">
                        {n('message')}
                        <input
                          value={draft}
                          maxLength={320}
                          autoComplete="off"
                          enterKeyHint="send"
                          onChange={(e) => setDraft(e.target.value)}
                        />
                      </label>
                      <button
                        className="btn btn-primary"
                        disabled={
                          session.chatPending || session.pending || !isChatText(draft.trim())
                        }
                      >
                        {n('send')}
                      </button>
                    </form>
                    <p className="nearby-note">{n('chatHint')}</p>
                  </>
                )}
                <details className="nearby-safety">
                  <summary>{n('room')}</summary>
                  <p>{n('confirmation', { code: controller.code })}</p>
                  <button className="btn btn-ghost" onClick={() => setHidden(!hidden)}>
                    {n(hidden ? 'showChat' : 'hideChat')}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setQuestion('block')}>
                    {n('block')}
                  </button>
                  <a href={`mailto:${SUPPORT_EMAIL}?subject=Nearby%20Play`}>{n('report')}</a>
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
                  <p>
                    {n('label')} <strong className="nearby-code">{controller.label}</strong>
                  </p>
                )}
                {session?.peerName && (
                  <section className="nearby-card">
                    <p>{session.peerName}</p>
                    <p className="nearby-code">{n('confirmation', { code: controller.code })}</p>
                    <p className="nearby-note">{n('compare')}</p>
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
                    {controller.peers.length === 0 && <p className="nearby-note">{n('noPeers')}</p>}
                    {controller.peers.map((peer) => (
                      <button
                        key={peer.id}
                        className="nearby-peer"
                        onClick={() => {
                          void controller.connect(peer.id);
                        }}
                      >
                        <strong>{peer.name}</strong>
                        <span>{n(peer.name.startsWith('F-') ? 'friends' : 'public')}</span>
                      </button>
                    ))}
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
                <strong>{g.names.join(' · ')}</strong>
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
            <h2>{detail.names.join(' · ')}</h2>
            <p>{date(detail.at)}</p>
            <p className="nearby-note">{n('historyReadOnly')}</p>
            {storageError && <p role="alert">{n('storageError')}</p>}
            {detail.games.map((game) => (
              <section className="nearby-card" key={game.round}>
                <h3>Yacht · {game.round}</h3>
                <p>{n(game.finished ? 'completed' : 'interrupted')}</p>
                <p>
                  {detail.names[0]} {game.scores[0]} · {detail.names[1]} {game.scores[1]}
                </p>
              </section>
            ))}
            {detail.messages.map((m) => (
              <article className={`nearby-message nearby-message-${m.sender}`} key={m.id}>
                <strong>{detail.names[(m.sender === 'self') === detail.host ? 0 : 1]}</strong>
                <p>{m.text}</p>
                <small>
                  {date(m.at)}
                  {m.sender === 'self'
                    ? ` · ${n(m.status === 'sending' ? 'failed' : m.status)}`
                    : ''}
                </small>
              </article>
            ))}
            <button className="btn btn-ghost" onClick={() => setQuestion('delete')}>
              {n('delete')}
            </button>
          </main>
        )}
      </div>
      <ConfirmDialog
        open={question !== null}
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

function YachtBoard({ session: s, n, onRoom }: { session: Session; n: Text; onRoom: () => void }) {
  const m = s.match!;
  const points = totals(m);
  const seat = s.host ? 0 : 1;
  return (
    <section className="nearby-board">
      <h3>Yacht</h3>
      <p role="status">
        {s.pending
          ? n('pending')
          : s.matchComplete
            ? points[0] === points[1]
              ? n('draw')
              : n('won', { name: s.names[points[0]! > points[1]! ? 0 : 1]! })
            : n('turn', { name: s.names[turn(m)]!, rolls: m.rolls })}
      </p>
      {!finished(m) && (
        <>
          <div className="nearby-dice">
            {m.dice.map((face, index) => (
              <button
                key={index}
                aria-label={`${n('die', { number: index + 1, face: m.rolls ? face : '—' })}${m.held[index] ? ` · ${n('held')}` : ''}`}
                aria-pressed={m.held[index]}
                disabled={!s.canAct || m.rolls === 0 || m.rolls === 3}
                onClick={() => s.act({ kind: 'hold', index })}
              >
                {m.rolls ? face : '—'}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            disabled={!s.canAct || m.rolls >= 3 || m.held.every(Boolean)}
            onClick={() => s.act({ kind: 'roll' })}
          >
            {n('roll')}
          </button>
        </>
      )}
      <table className="nearby-scores">
        <thead>
          <tr>
            <th>Yacht</th>
            {s.names.map((name, i) => (
              <th key={i} scope="col">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((category, index) => (
            <tr key={category}>
              <th scope="row">{n(categoryKeys[index]!)}</th>
              {[0, 1].map((player) => (
                <td key={player}>
                  {m.scores[player]![index] ??
                    (player === seat && s.canAct && m.rolls > 0 ? (
                      <button
                        onClick={() => s.act({ kind: 'score', category })}
                        aria-label={`${n(categoryKeys[index]!)}: ${scoreFor(category, m.dice)}`}
                      >
                        {scoreFor(category, m.dice)}
                      </button>
                    ) : (
                      '—'
                    ))}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">{n('total')}</th>
            <td>{points[0]}</td>
            <td>{points[1]}</td>
          </tr>
        </tbody>
      </table>
      <button className="btn btn-ghost" onClick={onRoom}>
        {n('returnRoom')}
      </button>
    </section>
  );
}
