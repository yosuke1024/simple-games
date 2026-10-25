import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../state/SettingsContext';
import { IconBack } from '../ui/components/icons';
import { NearbyController } from './controller';
import { GAME_TITLES, loadNearbyGame, type NearbyGame } from './games';
import type { NearbyGameId } from './gameTypes';
import { useNearbyText } from './i18n';
import type { Transport } from './native';
import { isPlayerName } from './session';
import { loadHistory } from './history';

interface Selection {
  id: string;
  name: string;
  roomName: string;
  gameId: NearbyGameId;
}

/** Browse all games without loading a board or starting a game handshake. */
export function NearbyBrowser({
  onExit,
  onChanged,
  onJoin,
  onRegisterStop,
  visible = true,
}: {
  visible?: boolean;
  onExit: () => void;
  onChanged: () => void;
  onJoin: (controller: NearbyController, gameId: NearbyGameId, game: NearbyGame) => void;
  onRegisterStop?: (stop: (() => Promise<void>) | null) => void;
}) {
  const { t } = useSettings();
  const n = useNearbyText();
  const [transport, setTransport] = useState<Transport>('ble');
  const [controller, setController] = useState<NearbyController | null>(null);
  const controllerRef = useRef<NearbyController | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [name, setName] = useState('');
  const nameEdited = useRef(false);
  const [storageError, setStorageError] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const live = useRef(true);
  const handedOff = useRef(false);
  const shown = useRef(visible);
  shown.current = visible;
  const attempt = useRef(0);
  const backRef = useRef<() => void>(() => {});
  const titleRef = useRef<HTMLHeadingElement>(null);
  const active = !!controller && controller.state !== 'ended';
  const available =
    controller?.state === 'discovering' &&
    controller.peers.some(
      (p) =>
        p.id === selection?.id &&
        p.name === selection.name &&
        p.gameId === selection.gameId &&
        p.roomName === selection.roomName,
    );

  const back = () => {
    if (!visible) return;
    if (selection && !busy) {
      setSelection(null);
      return;
    }
    void controllerRef.current?.stop();
    onExit();
  };
  backRef.current = back;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      attempt.current += 1;
      // A selected game takes ownership of this exact connection. No stop/start
      // here: native peer identifiers belong to the current discovery run.
      if (!handedOff.current) void controllerRef.current?.stop();
    };
  }, []);
  useEffect(() => {
    if (visible) return;
    attempt.current += 1;
    setBusy(false);
    setSelection(null);
    if (!handedOff.current) void controllerRef.current?.stop();
  }, [visible]);
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
    if (visible) titleRef.current?.focus({ preventScroll: true });
  }, [selection, visible]);
  useEffect(() => {
    if (!selection || nameEdited.current) return;
    let current = true;
    void loadHistory()
      .then((data) => {
        if (current && !nameEdited.current && data.displayName) setName(data.displayName);
      })
      .catch(() => {
        if (current) setStorageError(true);
      });
    return () => {
      current = false;
    };
  }, [selection]);

  const search = async () => {
    if (busy || active || !visible) return;
    const request = ++attempt.current;
    setBusy(true);
    await controllerRef.current?.stop();
    if (!live.current || !shown.current || request !== attempt.current) return;
    setFailed(false);
    setSelection(null);
    const next = new NearbyController(
      { host: false, gameId: null, name: '', roomName: '', chatEnabled: false, transport },
      onChanged,
    );
    controllerRef.current = next;
    setController(next);
    setBusy(false);
    await next.start();
  };
  const join = async () => {
    if (!controller || !selection || !available || busy || !accepted || !isPlayerName(name.trim()))
      return;
    const request = ++attempt.current;
    const current = () => live.current && shown.current && request === attempt.current;
    setBusy(true);
    setFailed(false);
    try {
      const game = await loadNearbyGame(selection.gameId);
      if (!current()) return;
      if (
        !controller.peers.some(
          (p) =>
            p.id === selection.id &&
            p.name === selection.name &&
            p.gameId === selection.gameId &&
            p.roomName === selection.roomName,
        )
      )
        return;
      const connected = await controller.connectToGame(selection.id, name.trim(), game.adapter);
      if (!current()) return;
      if (!connected) {
        setFailed(true);
        return;
      }
      handedOff.current = true;
      onJoin(controller, selection.gameId, game);
    } catch {
      if (current()) setFailed(true);
    } finally {
      if (current()) setBusy(false);
    }
  };

  return (
    <div className="screen nearby-screen">
      <header className="screen-header">
        <button className="icon-btn" type="button" aria-label={n('back')} onClick={back}>
          <IconBack />
        </button>
        <h1 className="nearby-title" tabIndex={-1} ref={titleRef}>
          {t('findNearbyOpponents')}
        </h1>
        <span className="icon-btn-placeholder" />
      </header>
      <main className="nearby-stack">
        {selection ? (
          <form
            className="nearby-join-form"
            onSubmit={(event) => {
              event.preventDefault();
              void join();
            }}
          >
            <section className="nearby-card">
              <h2>{selection.roomName}</h2>
              <p>{GAME_TITLES[selection.gameId]}</p>
              <p className="nearby-note">{n(transport === 'ble' ? 'bluetooth' : 'wifi')}</p>
            </section>
            {!available && <p role="status">{n('listingUnavailable')}</p>}
            <label className="nearby-field">
              {n('name')}
              <input
                value={name}
                maxLength={48}
                autoComplete="off"
                aria-describedby="nearby-join-name-hint"
                onChange={(event) => {
                  nameEdited.current = true;
                  setName(event.target.value);
                }}
              />
            </label>
            <p id="nearby-join-name-hint" className="nearby-note">
              {n('nameHint')}
            </p>
            <p className="nearby-note">{n('conduct')}</p>
            <label className="nearby-check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              {n('accept')}
            </label>
            <button
              className="btn btn-primary"
              disabled={busy || !available || !accepted || !isPlayerName(name.trim())}
            >
              {n(busy ? 'connecting' : 'join')}
            </button>
          </form>
        ) : (
          <>
            <p className="nearby-note">{n('browseHint')}</p>
            <fieldset className="nearby-choices" disabled={active || busy}>
              <legend>{n('chooseConnection')}</legend>
              {(['ble', 'lan'] as const).map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="discovery-transport"
                    checked={transport === option}
                    onChange={() => setTransport(option)}
                  />
                  {n(option === 'ble' ? 'bluetooth' : 'wifi')}
                </label>
              ))}
            </fieldset>
            {active ? (
              <>
                <p role="status">{n('searching')}</p>
                <div className="nearby-stack nearby-listings">
                  {controller?.peers.length === 0 && <p className="nearby-note">{n('noPeers')}</p>}
                  {controller?.peers.map(
                    (peer) =>
                      peer.roomName && (
                        <button
                          key={peer.id}
                          type="button"
                          className="nearby-peer"
                          aria-label={`${peer.roomName} ${GAME_TITLES[peer.gameId]} ${n('participants', { count: 1, capacity: 2 })}`}
                          onClick={() => setSelection(peer)}
                        >
                          <strong>{peer.roomName}</strong>
                          <span>{GAME_TITLES[peer.gameId]}</span>
                          <span>{n('participants', { count: 1, capacity: 2 })}</span>
                        </button>
                      ),
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    void controller?.stop();
                  }}
                >
                  {n('stopSearch')}
                </button>
              </>
            ) : (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => {
                  void search();
                }}
              >
                {n('search')}
              </button>
            )}
          </>
        )}
        {controller?.state === 'ended' && controller.reason !== 'ended' && (
          <p className="nearby-warning" role="status">
            {n(controller.reason)}
          </p>
        )}
        {failed && (
          <p className="nearby-warning" role="alert">
            {n('connectionError')}
          </p>
        )}
        {(storageError || controller?.storageFailed) && (
          <p className="nearby-warning" role="alert">
            {n('storageError')}
          </p>
        )}
      </main>
    </div>
  );
}
