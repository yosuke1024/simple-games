import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSettings } from '../state/SettingsContext';
import { ConfirmDialog } from '../ui/components/ConfirmDialog';
import { IconBack } from '../ui/components/icons';
import { GroupController, type GroupSetup } from './groupController';
import type { Control } from './groupSession';
import { useNearbyText } from './i18n';
import { isPlayerName, isRoomName } from './session';
import { isAllowedNearbyText, filteredNearbyText } from './contentFilter';
import { clearHistory, deleteGroup, loadHistory, type SavedGroup } from './history';
import LudoView from './games/ludoView';
import { isLudoState, ludoResult } from './games/ludo';
import type { NearbyRootProps } from './NearbyRoot';
import type { Transport } from './native';
import { ReportDialog } from './ReportDialog';
import { listingKey, type ReportTarget } from './report';

export interface GroupSelection {
  name: string;
  roomName: string;
  label: string;
  transport: Transport;
}
export default function GroupRoot({
  onExit,
  visible = true,
  onActiveChange,
  onRegisterStop,
  initial,
}: NearbyRootProps & { initial?: GroupSelection }) {
  const n = useNearbyText();
  const { locale } = useSettings();
  const [setup, setSetup] = useState<GroupSetup>(() => ({
    host: !initial,
    name: initial?.name ?? '',
    roomName:
      initial?.roomName ?? `Ludo ${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
    transport: initial?.transport ?? 'ble',
  }));
  const [controller, setController] = useState<GroupController | null>(null);
  const current = useRef<GroupController | null>(null);
  const live = useRef(true);
  const starting = useRef(false);
  const startAttempt = useRef(0);
  const shown = useRef(visible);
  shown.current = visible;
  const historyRequest = useRef(0);
  const nameEdited = useRef(!!initial);
  const [, render] = useState(0);
  const [accepted, setAccepted] = useState(!!initial);
  const [question, setQuestion] = useState<
    | { type: 'leave' }
    | { type: 'clear' }
    | { type: 'delete'; id: string }
    | { type: 'block'; peer: string }
    | null
  >(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [hiddenListings, setHiddenListings] = useState(new Set<string>());
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<SavedGroup[] | null>(null);
  const [error, setError] = useState(false);
  const active = !!controller && controller.status !== 'ended';
  const snapshot = controller?.snapshot;
  const host = controller?.hostSession;
  const state = snapshot?.state;
  const result = isLudoState(state) ? ludoResult(state) : null;
  const safeName = (name: string) => filteredNearbyText(name, n('contentHidden'));
  const names =
    snapshot?.seats.map((seat, i) =>
      seat.control === 'cpu' ? n('groupCpuName', { seat: i + 1 }) : safeName(seat.name),
    ) ?? [];
  const showHistory = async () => {
    const request = ++historyRequest.current;
    try {
      const data = await loadHistory();
      if (live.current && request === historyRequest.current) setHistory(data.groups ?? []);
    } catch {
      if (live.current && request === historyRequest.current) setError(true);
    }
  };
  const begin = async (label?: string) => {
    if (starting.current || !live.current || (!setup.host && !shown.current)) return;
    const attempt = ++startAttempt.current;
    starting.current = true;
    setBusy(true);
    historyRequest.current++;
    try {
      await current.current?.stop();
      if (!live.current || attempt !== startAttempt.current || (!setup.host && !shown.current))
        return;
      setHistory(null);
      setHiddenListings(new Set());
      setError(false);
      const next = new GroupController(
        { ...setup, name: setup.name.trim(), roomName: setup.roomName.trim() },
        () => {
          if (live.current) render((v) => v + 1);
        },
      );
      current.current = next;
      setController(next);
      await next.start(label);
    } catch {
      if (live.current) setError(true);
    } finally {
      starting.current = false;
      if (live.current) setBusy(false);
    }
  };
  const exitHistory = () => {
    historyRequest.current++;
    setHistory(null);
  };
  const reportPerson = (name: string) =>
    setReport({ title: 'Ludo', content: `${snapshot?.title ?? setup.roomName}\n${name}` });
  const personActions = (peer: string, name: string) => (
    <div className="nearby-actions">
      <button className="btn btn-ghost" disabled={busy} onClick={() => reportPerson(name)}>
        {n('report')}
      </button>
      <button
        className="btn btn-ghost"
        disabled={busy || !controller?.participants.get(peer)?.identity}
        onClick={() => setQuestion({ type: 'block', peer })}
      >
        {n('blockPlayer')}
      </button>
    </div>
  );
  const guestHostDetails = !host && controller && (
    <>
      {active &&
        [...controller.participants].map(([peer, person]) => (
          <section className="nearby-card" key={peer}>
            <p>{safeName(person.name)}</p>
            {personActions(peer, person.name)}
          </section>
        ))}
      {[...controller.codes.values()].map((code) => (
        <p key={code}>{n('confirmation', { code })}</p>
      ))}
    </>
  );
  const confirm = async () => {
    const action = question;
    if (!action || busy) return;
    const historyGeneration = historyRequest.current;
    setQuestion(null);
    setBusy(true);
    setError(false);
    try {
      if (action.type === 'leave') await controller?.stop();
      else if (action.type === 'block') await controller?.block(action.peer);
      else {
        if (action.type === 'clear') {
          await clearHistory();
          if (live.current && historyGeneration === historyRequest.current) {
            nameEdited.current = false;
            setSetup((s) => ({ ...s, name: '' }));
          }
        } else await deleteGroup(action.id);
        if (live.current && historyGeneration === historyRequest.current) await showHistory();
      }
    } catch {
      if (live.current && historyGeneration === historyRequest.current) setError(true);
    } finally {
      if (live.current) setBusy(false);
    }
  };
  useEffect(() => {
    live.current = true;
    if (initial) void begin(initial.label);
    else
      void loadHistory()
        .then((data) => {
          if (live.current && !nameEdited.current && data.displayName)
            setSetup((s) => ({ ...s, name: data.displayName! }));
        })
        .catch(() => {
          if (live.current) setError(true);
        });
    return () => {
      live.current = false;
      void current.current?.stop();
    };
    // A selected room starts once; later prop updates do not recreate its connections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const retainedRoom = active && (!!controller?.setup.host || snapshot != null);
  useEffect(() => {
    onActiveChange?.(retainedRoom);
  }, [retainedRoom, onActiveChange]);
  const leaveView = useCallback(async () => {
    const generation = ++historyRequest.current;
    startAttempt.current++;
    const room = current.current;
    if (room && !room.setup.host && room.snapshot === null && room.status !== 'ended')
      await room.stop();
    if (live.current && shown.current && generation === historyRequest.current) onExit();
  }, [onExit]);
  useEffect(() => {
    if (visible) return;
    historyRequest.current++;
    startAttempt.current++;
    const room = current.current;
    if (room && !room.setup.host && room.snapshot === null && room.status !== 'ended')
      void room.stop();
  }, [visible, controller]);
  useEffect(() => {
    onRegisterStop?.(async () => {
      await current.current?.stop();
    });
    return () => onRegisterStop?.(null);
  }, [onRegisterStop]);
  useEffect(() => {
    let mounted = true;
    const visibility = () => current.current?.setForeground(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', visibility);
    const listener = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          if (mounted) current.current?.setForeground(isActive);
        })
      : null;
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', visibility);
      void listener?.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    if (!visible) return;
    const back = () => {
      if (report) setReport(null);
      else if (question) setQuestion(null);
      else if (history) exitHistory();
      else void leaveView();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) back();
    };
    window.addEventListener('keydown', escape);
    let mounted = true;
    const listener = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('backButton', () => {
          if (mounted) back();
        })
      : null;
    return () => {
      mounted = false;
      window.removeEventListener('keydown', escape);
      void listener?.then((h) => h.remove()).catch(() => undefined);
    };
  }, [visible, leaveView, history, question, report]);

  return (
    <div className="screen nearby-screen" hidden={!visible}>
      <header className="screen-header" inert={question !== null || report !== null}>
        <button
          type="button"
          className="icon-btn"
          aria-label={n('back')}
          onClick={() => {
            if (history) exitHistory();
            else void leaveView();
          }}
        >
          <IconBack />
        </button>
        <h1 className="nearby-title">{snapshot ? safeName(snapshot.title) : 'Ludo'}</h1>
      </header>
      <div className="nearby-stack" inert={question !== null || report !== null}>
        {(error || controller?.storageFailed) && <p role="alert">{n('storageError')}</p>}
        {history ? (
          <>
            <h2>{n('history')}</h2>
            {history.length === 0 && <p>{n('historyEmpty')}</p>}
            {history.map((entry) => (
              <article className="nearby-card" key={entry.id}>
                <h3>{safeName(entry.roomName)}</h3>
                <p>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(entry.at)}
                </p>
                {entry.rounds.map((round) => (
                  <div key={round.round}>
                    <p>{round.names.map(safeName).join(' / ')}</p>
                    <p>
                      {round.finished
                        ? round.winner === null
                          ? n('groupFinished')
                          : n('groupWinner', { name: safeName(round.names[round.winner]!) })
                        : n('ended')}
                    </p>
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    setReport({
                      title: 'Ludo',
                      content: [
                        entry.roomName,
                        ...entry.rounds.flatMap((round) => round.names),
                      ].join('\n'),
                    })
                  }
                >
                  {n('report')}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setQuestion({ type: 'delete', id: entry.id })}
                >
                  {n('delete')}
                </button>
              </article>
            ))}
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setQuestion({ type: 'clear' })}
            >
              {n('clear')}
            </button>
          </>
        ) : !controller ? (
          <form
            className="nearby-stack"
            onSubmit={(event) => {
              event.preventDefault();
              void begin();
            }}
          >
            <p>{n('groupConnection')}</p>
            <p className="nearby-note">{n('groupHostStops')}</p>
            <fieldset className="nearby-choices">
              <legend>{n('playTogether')}</legend>
              {[true, false].map((isHost) => (
                <label key={String(isHost)}>
                  <input
                    type="radio"
                    name="group-role"
                    checked={setup.host === isHost}
                    onChange={() => setSetup((s) => ({ ...s, host: isHost }))}
                  />
                  {n(isHost ? 'create' : 'join')}
                </label>
              ))}
            </fieldset>
            <label className="nearby-field">
              {n('name')}
              <input
                value={setup.name}
                maxLength={48}
                onChange={(e) => {
                  nameEdited.current = true;
                  setSetup((s) => ({ ...s, name: e.target.value }));
                }}
              />
            </label>
            <p className="nearby-note">{n('nameHint')}</p>
            {setup.host && (
              <>
                <label className="nearby-field">
                  {n('roomName')}
                  <input
                    value={setup.roomName}
                    maxLength={48}
                    onChange={(e) => setSetup((s) => ({ ...s, roomName: e.target.value }))}
                  />
                </label>
                <p className="nearby-note">{n('roomNameHint')}</p>
              </>
            )}
            <fieldset className="nearby-choices">
              <legend>{n('chooseConnection')}</legend>
              {(['ble', 'lan'] as const).map((transport) => (
                <label key={transport}>
                  <input
                    type="radio"
                    name="group-transport"
                    checked={setup.transport === transport}
                    onChange={() => setSetup((s) => ({ ...s, transport }))}
                  />
                  {n(transport === 'ble' ? 'bluetooth' : 'wifi')}
                </label>
              ))}
            </fieldset>
            <p className="nearby-note">{n('groupNoChat')}</p>
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
                busy ||
                !accepted ||
                !isPlayerName(setup.name.trim()) ||
                !isAllowedNearbyText(setup.name) ||
                (setup.host &&
                  (!isRoomName(setup.roomName.trim()) || !isAllowedNearbyText(setup.roomName)))
              }
            >
              {n(setup.host ? 'create' : 'search')}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void showHistory()}
            >
              {n('history')}
            </button>
          </form>
        ) : (
          <>
            {controller.status === 'searching' && (
              <>
                <p role="status">{n('searching')}</p>
                {controller.peers
                  .filter((peer) => !hiddenListings.has(listingKey(peer)))
                  .map((peer) => (
                    <article className="nearby-listing" key={peer.id}>
                      <button
                        className="nearby-peer"
                        disabled={busy}
                        onClick={() => void controller.join(peer.id)}
                      >
                        <strong>{safeName(peer.roomName)}</strong>
                        <span>{n('groupFourSeats')}</span>
                      </button>
                      <div className="nearby-actions nearby-listing-actions">
                        <button
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() =>
                            setHiddenListings((old) => new Set([...old, listingKey(peer)]))
                          }
                        >
                          {n('hideListing')}
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => setReport({ title: 'Ludo', content: peer.roomName })}
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
                {controller.peers.length === 0 && <p>{n('noPeers')}</p>}
              </>
            )}
            {controller.status === 'connecting' && (
              <p role="status">{n(controller.codes.size ? 'awaiting' : 'connecting')}</p>
            )}
            {state == null && guestHostDetails}
            {host &&
              [...host.pending].map(([peer, name]) => (
                <section className="nearby-card" key={peer}>
                  <h2>{n('request', { name: safeName(name) })}</h2>
                  <p>{n('confirmation', { code: controller.codes.get(peer) ?? '' })}</p>
                  <p className="nearby-note">{n('compare')}</p>
                  <div className="nearby-actions">
                    {host.seats.map(
                      (seat, i) =>
                        i > 0 &&
                        (seat.control !== 'human' || !seat.connected) && (
                          <button
                            key={i}
                            className="btn btn-primary"
                            onClick={() => controller.approve(peer, i)}
                          >
                            {n('groupJoinSeat', { seat: i + 1 })}
                          </button>
                        ),
                    )}
                    <button className="btn btn-ghost" onClick={() => controller.decline(peer)}>
                      {n('reject')}
                    </button>
                  </div>
                  {personActions(peer, name)}
                </section>
              ))}
            {snapshot && (
              <>
                <details
                  className="group-seat-controls"
                  key={state ? `round-${snapshot.round}` : 'lobby'}
                  open={!state}
                >
                  <summary>{n('groupSeats')}</summary>
                  {!state && <p className="nearby-note">{n('groupHostStops')}</p>}
                  {state != null && guestHostDetails}
                  <div className="group-seats">
                    {snapshot.seats.map((seat, i) => (
                      <div className="nearby-card" key={i}>
                        <strong>{n('groupSeat', { seat: i + 1 })}</strong>
                        <span>{names[i] || n('groupOpen')}</span>
                        {seat.control === 'cpu' && seat.connected && (
                          <span>{safeName(seat.name)}</span>
                        )}
                        {seat.control === 'human' && !seat.connected && (
                          <span role="status">{n('groupDisconnected')}</span>
                        )}
                        {host && i > 0 && active && (
                          <label className="nearby-field">
                            {n('groupSwitch', { seat: i + 1 })}
                            <select
                              value={seat.control}
                              onChange={(e) => controller.control(i, e.target.value as Control)}
                            >
                              <option value="cpu">{n('groupCpu')}</option>
                              {seat.connected && <option value="human">{n('groupHuman')}</option>}
                              {!state && <option value="open">{n('groupOpen')}</option>}
                              {state != null && seat.control === 'human' && !seat.connected && (
                                <option value="human" disabled>
                                  {n('groupDisconnected')}
                                </option>
                              )}
                            </select>
                          </label>
                        )}
                        {host &&
                          active &&
                          [...host.members]
                            .filter(([, slot]) => slot === i)
                            .map(([peer]) => (
                              <div key={peer}>{personActions(peer, seat.name)}</div>
                            ))}
                      </div>
                    ))}
                  </div>
                </details>
                {active && (!state || result) && (
                  <div className="nearby-actions">
                    <button
                      className="btn btn-primary"
                      disabled={
                        snapshot.seats[snapshot.you]?.ready ||
                        snapshot.seats[snapshot.you]?.control !== 'human'
                      }
                      onClick={() => controller.ready()}
                    >
                      {n('ready')}
                    </button>
                    {host && (
                      <button
                        className="btn btn-primary"
                        disabled={!host.canStart}
                        onClick={() => controller.startRound()}
                      >
                        {n('groupStart')}
                      </button>
                    )}
                  </div>
                )}
                {active &&
                  (!state || snapshot.seats.some((s) => s.control === 'human' && !s.connected)) && (
                    <p role="status">{n('groupWaiting')}</p>
                  )}
                {isLudoState(state) && (
                  <LudoView
                    state={state}
                    seat={snapshot.you}
                    names={names}
                    canAct={controller.canAct && !question && !report && !busy}
                    act={(action) => controller.act(action)}
                    visible={visible}
                  />
                )}
                {result && (
                  <p role="status">
                    {result.winner === null
                      ? n('groupFinished')
                      : n('groupWinner', { name: names[result.winner]! })}
                  </p>
                )}
              </>
            )}
            {controller.status === 'ended' ? (
              <>
                <p role="status">
                  {n(
                    controller.reason === 'hostLeft'
                      ? 'groupHostLeft'
                      : controller.reason === 'blocked'
                        ? 'blocked'
                        : controller.reason === 'declined'
                          ? 'declined'
                          : controller.reason === 'timeout'
                            ? 'timeout'
                            : controller.reason === 'connection'
                              ? 'connectionError'
                              : 'ended',
                  )}
                </p>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => {
                    setController(null);
                    current.current = null;
                    setQuestion(null);
                    setReport(null);
                    setHiddenListings(new Set());
                  }}
                >
                  {n('groupBackToSetup')}
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => setQuestion({ type: 'leave' })}
              >
                {n('leave')}
              </button>
            )}
          </>
        )}
      </div>
      {report && visible && <ReportDialog target={report} onClose={() => setReport(null)} />}
      {question && visible && (
        <ConfirmDialog
          open
          cancelLabel={n('cancel')}
          title={n(
            question.type === 'leave'
              ? 'leave'
              : question.type === 'clear'
                ? 'clear'
                : question.type === 'block'
                  ? 'blockPlayer'
                  : 'delete',
          )}
          body={n(
            question.type === 'leave'
              ? 'groupHostStops'
              : question.type === 'clear'
                ? 'clearBody'
                : question.type === 'block'
                  ? 'blockHistoryBody'
                  : 'deleteBody',
          )}
          confirmLabel={n(
            question.type === 'leave'
              ? 'leave'
              : question.type === 'clear'
                ? 'clear'
                : question.type === 'block'
                  ? 'blockPlayer'
                  : 'delete',
          )}
          onCancel={() => setQuestion(null)}
          onConfirm={() => void confirm()}
        />
      )}
    </div>
  );
}
