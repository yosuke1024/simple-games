import { useEffect, useRef, useState } from 'react';
import type { ClubConnection } from '@/storage/schemas';
import { useSettings } from '@/state/SettingsContext';
import {
  createManagedClient,
  operationId,
  type ManagedMembership,
  type OwnerSpace,
} from '../api/managed';
import { ClubApiError } from '../api/errors';
import { loadManagedOwner, saveManagedOwner } from '../storage/connections';
import { errorText, NICKNAME_MAX, ScreenFrame } from './common';

export function membershipConnection(joined: ManagedMembership): ClubConnection {
  return {
    endpoint: joined.endpoint,
    clubId: joined.club.id,
    clubName: joined.club.name,
    memberId: joined.member.id,
    memberToken: joined.memberToken,
    nickname: joined.member.nickname,
    role: joined.member.role,
    joinedAt: joined.member.joinedAt,
  };
}

/** The key is verified before persistence. Creating a Club does not consent to automatic result sending. */
export function ManagedScreen({
  origin,
  onOpen,
  onRecords,
  onBack,
}: {
  origin: string;
  onOpen: (c: ClubConnection) => Promise<void>;
  onRecords: (owner: OwnerSpace, ownerToken: string) => void;
  onBack: () => void;
}) {
  const { t, locale } = useSettings();
  const [key, setKey] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [space, setSpace] = useState<OwnerSpace | null>(null);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const createId = useRef<string | null>(null);
  const alive = useRef(true);
  const showError = (e: unknown) =>
    e instanceof ClubApiError && e.code === 'unauthorized'
      ? t('clubOwnerKeyInvalid')
      : errorText(e, t);
  useEffect(() => {
    alive.current = true;
    void loadManagedOwner()
      .then(async (saved) => {
        if (!alive.current || saved?.origin !== origin) return;
        const data = await createManagedClient(origin, saved.ownerToken).owner();
        if (alive.current) {
          setToken(saved.ownerToken);
          setSpace(data);
        }
      })
      .catch((e: unknown) => {
        if (alive.current) setError(showError(e));
      })
      .finally(() => {
        if (alive.current) setBusy(false);
      });
    return () => {
      alive.current = false;
    };
    // The owner asked to open this space; no background refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      if (alive.current) setError(showError(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const connectOwner = () =>
    run(async () => {
      const value = key.trim();
      const data = await createManagedClient(origin, value).owner();
      if (!alive.current) return;
      await saveManagedOwner({ origin, ownerToken: value });
      if (alive.current) {
        setToken(value);
        setSpace(data);
        setKey('');
      }
    });
  const create = () =>
    run(async () => {
      if (!token) return;
      createId.current ??= operationId();
      const api = createManagedClient(origin, token);
      const joined = await api.create(name.trim(), nickname.trim(), createId.current);
      if (!alive.current) return;
      createId.current = null;
      if (alive.current) {
        setName('');
        setNickname('');
      }
      const data = await api.owner();
      if (!alive.current) return;
      setSpace(data);
      await onOpen(membershipConnection(joined));
    });
  const open = (id: string) =>
    run(async () => {
      if (!token) return;
      const joined = await createManagedClient(origin, token).connect(id);
      if (alive.current) await onOpen(membershipConnection(joined));
    });
  const date = space ? new Date(space.owner.validUntil).toLocaleDateString(locale) : '';
  const canCreate = space?.owner.status === 'active' && space.clubs.length < space.limits.maxClubs;
  return (
    <ScreenFrame title={t('clubOwnerSpace')} onBack={onBack} t={t}>
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
      {!space ? (
        <form
          className="club-form"
          onSubmit={(e) => {
            e.preventDefault();
            void connectOwner();
          }}
        >
          <label className="club-field">
            <span>{t('clubOwnerKey')}</span>
            <input
              className="club-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              value={key}
              maxLength={128}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <p className="club-quiet">{t('clubOwnerKeyHelp')}</p>
          <button className="btn btn-primary" disabled={busy || key.trim().length < 16}>
            {t('clubOwnerConnect')}
          </button>
        </form>
      ) : (
        <>
          <section className="club-managed-card">
            <h2>Basic</h2>
            <p>
              {t('clubOwnerUsage', {
                used: space.clubs.length,
                max: space.limits.maxClubs,
                members: space.limits.maxMembersPerClub,
              })}
            </p>
            <p className="club-quiet">{t('clubOwnerExpires', { date })}</p>
            {space.owner.status === 'expired' ? (
              <p className="club-note">{t('clubSubscriptionExpired')}</p>
            ) : null}
          </section>
          {space.clubs.map((club) => (
            <button
              key={club.id}
              type="button"
              className="settings-row club-line"
              disabled={busy}
              onClick={() => void open(club.id)}
            >
              <span className="settings-row-label">{club.name}</span>
              <span className="settings-row-value">
                {t('clubMembersCount', { n: club.memberCount })}
              </span>
            </button>
          ))}
          {space.clubs.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                if (token) onRecords(space, token);
              }}
            >
              {t('clubRecordBook')}
            </button>
          ) : null}
          {canCreate ? (
            <form
              className="club-form club-managed-card"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <h2>{t('clubCreate')}</h2>
              <label className="club-field">
                <span>{t('clubName')}</span>
                <input
                  className="club-input"
                  value={name}
                  maxLength={40}
                  onChange={(e) => {
                    setName(e.target.value);
                    createId.current = null;
                  }}
                />
              </label>
              <label className="club-field">
                <span>{t('clubNickname')}</span>
                <input
                  className="club-input"
                  value={nickname}
                  maxLength={NICKNAME_MAX}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    createId.current = null;
                  }}
                />
              </label>
              <button
                className="btn btn-primary"
                disabled={busy || !name.trim() || !nickname.trim()}
              >
                {t('clubCreate')}
              </button>
            </form>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await saveManagedOwner(null);
                if (alive.current) {
                  setSpace(null);
                  setToken(null);
                }
              })
            }
          >
            {t('clubOwnerForget')}
          </button>
        </>
      )}
    </ScreenFrame>
  );
}
