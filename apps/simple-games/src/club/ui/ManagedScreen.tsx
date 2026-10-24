import { useEffect, useRef, useState } from 'react';
import type { ClubConnection } from '@/storage/schemas';
import { useSettings } from '@/state/SettingsContext';
import {
  createManagedClient,
  newOwnerKey,
  operationId,
  type ManagedMembership,
  type OwnerSpace,
} from '../api/managed';
import { ClubApiError } from '../api/errors';
import {
  clearManagedOwnerAdRemoval,
  loadManagedOwner,
  saveManagedOwner,
  saveVerifiedManagedOwner,
} from '../storage/connections';
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

/** New Trial keys persist before signup so a lost reply can be retried with the same credential. */
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
  const [pendingTrial, setPendingTrial] = useState(false);
  const [space, setSpace] = useState<OwnerSpace | null>(null);
  // The saved key was refused (reissued by the operator, say): offer the key form again.
  const [rejected, setRejected] = useState(false);
  const [expiryPassed, setExpiryPassed] = useState(false);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const createId = useRef<string | null>(null);
  const running = useRef(false);
  const alive = useRef(true);
  const showError = (e: unknown) =>
    e instanceof ClubApiError && e.code === 'unauthorized'
      ? t('clubOwnerKeyInvalid')
      : errorText(e, t);
  const acceptOwner = async (value: string, data: OwnerSpace) => {
    if (!alive.current) return false;
    const saved = await saveVerifiedManagedOwner(
      { origin, ownerToken: value },
      data.benefits.adRemoval,
    );
    // A Reset, a forgotten key or a different owner must win over a delayed reply.
    if (!alive.current) return false;
    if (!saved) throw new Error('owner_state_not_saved');
    setToken(value);
    setPendingTrial(false);
    setRejected(false);
    setSpace(data);
    return true;
  };
  async function ownerRequest<T>(value: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (e) {
      if (alive.current && e instanceof ClubApiError && e.code === 'unauthorized') {
        await clearManagedOwnerAdRemoval({ origin, ownerToken: value });
        if (alive.current) {
          setSpace(null);
          setRejected(true);
        }
      }
      throw e;
    }
  }
  const readOwner = (value: string) =>
    ownerRequest(value, async () => {
      const data = await createManagedClient(origin, value).owner();
      return acceptOwner(value, data);
    });
  useEffect(() => {
    alive.current = true;
    void loadManagedOwner()
      .then(async (saved) => {
        if (!alive.current || saved?.origin !== origin) return;
        setToken(saved.ownerToken);
        setPendingTrial(saved.pendingTrial === true);
        // Resume an unfinished signup only when its owner presses Continue.
        if (!saved.pendingTrial) await readOwner(saved.ownerToken);
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
  const validUntil = space?.owner.validUntil ?? null;
  useEffect(() => {
    if (validUntil === null) {
      setExpiryPassed(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = Date.parse(validUntil) - Date.now();
      setExpiryPassed(remaining <= 0);
      if (remaining > 0) timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
    };
    checkExpiry();
    return () => clearTimeout(timer);
  }, [validUntil]);
  const run = async (work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      if (alive.current) setError(showError(e));
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const connectOwner = () =>
    run(async () => {
      const value = key.trim();
      const data = await createManagedClient(origin, value).owner();
      if (!alive.current) return;
      await saveManagedOwner({ origin, ownerToken: value });
      if (!alive.current) return;
      setToken(value);
      if (await acceptOwner(value, data)) setKey('');
    });
  const startTrial = () =>
    run(async () => {
      const value = pendingTrial && token ? token : newOwnerKey();
      if (!alive.current) return;
      if (!pendingTrial) {
        await saveManagedOwner({ origin, ownerToken: value, pendingTrial: true });
        if (!alive.current) return;
        setToken(value);
        setPendingTrial(true);
      }
      await ownerRequest(value, async () => {
        const data = await createManagedClient(origin, value).startTrial();
        await acceptOwner(value, data);
      });
    });
  const create = () =>
    run(async () => {
      if (!token) return;
      createId.current ??= operationId();
      const api = createManagedClient(origin, token);
      const clientId = createId.current;
      const joined = await ownerRequest(token, () =>
        api.create(name.trim(), nickname.trim(), clientId),
      );
      if (!alive.current) return;
      createId.current = null;
      if (alive.current) {
        setName('');
        setNickname('');
      }
      if (await readOwner(token)) await onOpen(membershipConnection(joined));
    });
  const open = (id: string) =>
    run(async () => {
      if (!token) return;
      const joined = await ownerRequest(token, () =>
        createManagedClient(origin, token).connect(id),
      );
      if (alive.current) await onOpen(membershipConnection(joined));
    });
  const date = validUntil ? new Date(validUntil).toLocaleDateString(locale) : '';
  const expired = expiryPassed || (validUntil !== null && Date.parse(validUntil) <= Date.now());
  const canCreate =
    space?.owner.status === 'active' && !expired && space.clubs.length < space.limits.maxClubs;
  const benefit = space?.benefits.adRemoval;
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
      {!space && (!token || pendingTrial) ? (
        <section className="club-managed-card">
          <h2>{t('clubTrialPlan')}</h2>
          <p>{t('clubTrialHelp')}</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void startTrial()}
          >
            {t(pendingTrial ? 'clubTrialRetry' : 'clubTrialStart')}
          </button>
        </section>
      ) : null}
      {!space && token && !pendingTrial && !rejected ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await readOwner(token);
            })
          }
        >
          {t('clubReload')}
        </button>
      ) : null}
      {!space && (!token || rejected) ? (
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
      ) : space ? (
        <>
          <section className="club-managed-card">
            <h2>{space.owner.plan === 'trial' ? t('clubTrialPlan') : 'Basic'}</h2>
            <p>
              {t('clubOwnerUsage', {
                used: space.clubs.length,
                max: space.limits.maxClubs,
                members: space.limits.maxMembersPerClub,
              })}
            </p>
            <p className="club-quiet">
              {validUntil === null ? t('clubTrialNoExpiry') : t('clubOwnerExpires', { date })}
            </p>
            {space.owner.status === 'expired' || expired ? (
              <p className="club-note">{t('clubSubscriptionExpired')}</p>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (token) await readOwner(token);
                })
              }
            >
              {t('clubReload')}
            </button>
          </section>
          {benefit ? (
            <section className="club-managed-card">
              <h2>{t('clubOwnerAdRemovalTitle')}</h2>
              <p>
                {t('clubOwnerMemberProgress', {
                  n: benefit.memberCount,
                  required: benefit.requiredMembers,
                })}
              </p>
              <progress
                className="club-owner-progress"
                aria-label={t('clubOwnerAdRemovalTitle')}
                aria-valuetext={t('clubOwnerMemberProgress', {
                  n: benefit.memberCount,
                  required: benefit.requiredMembers,
                })}
                value={Math.min(benefit.memberCount, benefit.requiredMembers)}
                max={benefit.requiredMembers}
              />
              <p role="status">
                {t(
                  benefit.active && !expired
                    ? 'clubOwnerAdRemovalActive'
                    : 'clubOwnerAdRemovalInactive',
                )}
              </p>
              <p className="club-quiet">
                {t('clubOwnerAdRemovalHelp', { required: benefit.requiredMembers })}
              </p>
              <p className="club-quiet">{t('clubOwnerMemberCountHelp')}</p>
            </section>
          ) : null}
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
        </>
      ) : null}
    </ScreenFrame>
  );
}
