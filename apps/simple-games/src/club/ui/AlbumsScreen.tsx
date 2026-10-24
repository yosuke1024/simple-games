import { useEffect, useRef, useState } from 'react';
import type { ClubConnection } from '@/storage/schemas';
import { useSettings } from '@/state/SettingsContext';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import {
  createRecordsClient,
  type AlbumSummary,
  type OwnerRecords,
  type RecordAlbum,
} from '../api/ownerRecords';
import { operationId } from '../api/managed';
import { gameTitle } from '../contract/challenge';
import { axisText, dateLabel, errorText, rankingTitle, ScreenFrame, todayLocal } from './common';

export function AlbumsScreen({
  connection,
  onBack,
}: {
  connection: ClubConnection;
  onBack: () => void;
}) {
  const { t, locale } = useSettings();
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [current, setCurrent] = useState<RecordAlbum | null>(null);
  const [records, setRecords] = useState<OwnerRecords | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const alive = useRef(true);
  const clientId = useRef<string | null>(null);
  const recordsDate = useRef(todayLocal());
  const api = () => createRecordsClient(connection.endpoint, connection.memberToken);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      if (alive.current) setError(errorText(e, t));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const load = () =>
    run(async () => {
      const list = await api().albums();
      if (alive.current) setAlbums(list);
    });
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [connection.endpoint]); // eslint-disable-line react-hooks/exhaustive-deps
  const select = (key: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else if (next.size < 50) next.add(key);
      return next;
    });
    clientId.current = null;
  };
  const publish = () =>
    run(async () => {
      if (!records || selected.size === 0) return;
      clientId.current ??= operationId();
      const album = await api().publish(
        title.trim(),
        records.tables
          .filter((r) => selected.has(`t:${r.gameId}:${r.paramsKey}`))
          .map(({ gameId, paramsKey }) => ({ gameId, paramsKey })),
        records.daily.filter((r) => selected.has(`d:${r.challengeId}`)).map((r) => r.challengeId),
        clientId.current,
      );
      clientId.current = null;
      if (alive.current) {
        setCurrent(album);
        setRecords(null);
        setTitle('');
        setSelected(new Set());
        setAlbums(await api().albums());
      }
    });
  const more = () =>
    run(async () => {
      if (!records) return;
      const next = await api().records({
        daily: recordsDate.current,
        ...(records.nextAfter ? { after: records.nextAfter } : {}),
        ...(records.nextDailyAfter ? { dailyAfter: records.nextDailyAfter } : {}),
      });
      if (alive.current)
        setRecords({
          ...next,
          tables: [
            ...records.tables,
            ...next.tables.filter(
              (r) =>
                !records.tables.some(
                  (old) => old.gameId === r.gameId && old.paramsKey === r.paramsKey,
                ),
            ),
          ],
          daily: [
            ...records.daily,
            ...next.daily.filter(
              (r) => !records.daily.some((old) => old.challengeId === r.challengeId),
            ),
          ],
          nextAfter: records.nextAfter ? next.nextAfter : null,
          nextDailyAfter: records.nextDailyAfter ? next.nextDailyAfter : null,
        });
    });
  return (
    <ScreenFrame
      title={current?.title ?? t('clubAlbums')}
      onBack={() => {
        if (current) setCurrent(null);
        else if (records) setRecords(null);
        else onBack();
      }}
      t={t}
    >
      <p className="club-disclosure">{t('clubAlbumDisclosure')}</p>
      {busy ? (
        <p className="club-quiet" role="status">
          {t('clubLoading')}
        </p>
      ) : null}
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}
      {current ? (
        <>
          <p className="club-quiet">{dateLabel(current.createdAt, locale)}</p>
          {current.tables.map((row) => (
            <section className="club-managed-card" key={`${row.gameId}:${row.paramsKey}`}>
              <h2>{rankingTitle(row.gameId, row.paramsKey, t)}</h2>
              <p>
                {axisText(row.gameId, row.entry.facts, t)} · {row.entry.nickname}
              </p>
            </section>
          ))}
          {current.daily.map((row) => (
            <section className="club-managed-card" key={row.challengeId}>
              <h2>
                {gameTitle(row.gameId)} · {t('clubDaily')} · {row.daily}
              </h2>
              <p>
                {axisText(row.gameId, row.entry.facts, t)} · {row.entry.nickname}
              </p>
            </section>
          ))}
          {current.unavailableCount > 0 ? (
            <p className="club-quiet">
              {t('clubAlbumUnavailable', { n: current.unavailableCount })}
            </p>
          ) : null}
          {connection.role === 'owner' ? (
            <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(true)}>
              {t('clubDeleteAlbum')}
            </button>
          ) : null}
        </>
      ) : records ? (
        <form
          className="club-form"
          onSubmit={(e) => {
            e.preventDefault();
            void publish();
          }}
        >
          <label className="club-field">
            <span>{t('clubAlbumTitle')}</span>
            <input
              className="club-input"
              maxLength={60}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clientId.current = null;
              }}
            />
          </label>
          {records.tables
            .filter((r) => r.leader !== null)
            .map((row) => {
              const key = `t:${row.gameId}:${row.paramsKey}`;
              return (
                <label key={key} className="club-choice">
                  <input type="checkbox" checked={selected.has(key)} onChange={() => select(key)} />
                  {rankingTitle(row.gameId, row.paramsKey, t)}
                </label>
              );
            })}
          {records.daily
            .filter((r) => r.leader !== null)
            .map((row) => {
              const key = `d:${row.challengeId}`;
              return (
                <label key={key} className="club-choice">
                  <input type="checkbox" checked={selected.has(key)} onChange={() => select(key)} />
                  {gameTitle(row.gameId)} · {t('clubDaily')} · {row.daily}
                </label>
              );
            })}
          {records.nextAfter || records.nextDailyAfter ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void more()}
            >
              {t('clubMoreRecords')}
            </button>
          ) : null}
          <button
            className="btn btn-primary"
            disabled={busy || !title.trim() || selected.size === 0}
          >
            {t('clubPublishAlbum')}
          </button>
        </form>
      ) : (
        <>
          <button className="club-text-btn" disabled={busy} onClick={() => void load()}>
            {t('clubReload')}
          </button>
          {albums.map((album) => (
            <button
              className="settings-row club-line"
              key={album.id}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const value = await api().album(album.id);
                  if (alive.current) setCurrent(value);
                })
              }
            >
              <span className="settings-row-label">{album.title}</span>
              <span className="settings-row-value">{dateLabel(album.createdAt, locale)}</span>
            </button>
          ))}
          {!busy && albums.length === 0 ? (
            <p className="club-quiet">{t('clubNothingYet')}</p>
          ) : null}
          {connection.role === 'owner' ? (
            <button
              className="btn btn-primary"
              disabled={busy || albums.length >= 24}
              onClick={() =>
                void run(async () => {
                  recordsDate.current = todayLocal();
                  const value = await api().records({ daily: recordsDate.current });
                  if (alive.current) {
                    setRecords(value);
                    setSelected(new Set());
                  }
                })
              }
            >
              {t('clubPublishAlbum')}
            </button>
          ) : null}
        </>
      )}
      <ConfirmDialog
        open={confirm}
        title={t('clubDeleteAlbum')}
        body={t('clubDeleteAlbumBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubDeleteConfirm')}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          if (current)
            void run(async () => {
              await api().deleteAlbum(current.id);
              if (alive.current) {
                setCurrent(null);
                setAlbums(await api().albums());
              }
            });
        }}
      />
    </ScreenFrame>
  );
}
