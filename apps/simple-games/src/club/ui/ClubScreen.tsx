/**
 * One Club (club.md §9「Club」): its challenges, records and members, read
 * when the screen opens and again only on `Reload`. No timer, no polling, no
 * counts. The Owner's two extras (Invite, Remove) and the Settings panel
 * (Disconnect, §8-5) live here too, as panels over the same data.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, type ClubClient } from '../api/client';
import type { Challenge, ClubRecord, Member } from '../api/types';
import { contractFor, gameTitle } from '../contract/challenge';
import { flushOutbox } from '../storage/outbox';
import { shareGame } from '@/services/share/share';
import type { ClubConnection } from '@/storage/schemas';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconChevronRight } from '@/ui/components/icons';
import { useSettings } from '@/state/SettingsContext';
import {
  axisText,
  dateLabel,
  errorText,
  ScreenFrame,
  tierLabel,
  todayLocal,
  type T,
} from './common';

interface ClubData {
  challenges: Challenge[];
  /** Challenges tagged with today's daily date (everyone's daily meets here). */
  today: Challenge[];
  /** The local date `today` was asked for, so the answer can be held to it. */
  todayDate: string;
  records: ClubRecord[];
  members: Member[];
  /** The club's name as the server has it now. */
  clubName: string;
}

export type ClubPanel = 'none' | 'invite' | 'settings';

export function challengeTitle(challenge: Challenge, t: T): string {
  const game = gameTitle(challenge.gameId) ?? challenge.gameId;
  const contract = contractFor(challenge.gameId);
  const params = contract?.validateParams(challenge.params);
  const title = params && contract ? `${game} · ${tierLabel(contract.paramsKey(params), t)}` : game;
  return challenge.daily !== null ? `${title} · ${t('clubDaily')}` : title;
}

export function ClubScreen({
  connection,
  panel,
  onPanel,
  onBack,
  onOpenChallenge,
  onDisconnect,
  onRenamed,
}: {
  connection: ClubConnection;
  panel: ClubPanel;
  onPanel: (panel: ClubPanel) => void;
  onBack: () => void;
  onOpenChallenge: (challengeId: string) => void;
  onDisconnect: () => Promise<void>;
  /** The server's name for the club differs from the cached one. */
  onRenamed: (clubName: string) => void;
}) {
  const { t, locale } = useSettings();
  const [data, setData] = useState<ClubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const clientRef = useRef<ClubClient | null>(null);
  const flushed = useRef(false);
  const alive = useRef(true);

  const clubName = data?.clubName ?? connection.clubName;
  const isOwner = connection.role === 'owner';

  const client = () => {
    clientRef.current ??= createClient(connection.endpoint, connection.memberToken);
    return clientRef.current;
  };

  const load = useCallback(async () => {
    const api = client();
    setLoading(true);
    setError(null);
    try {
      if (!flushed.current) {
        flushed.current = true;
        // Best effort, oldest first (club.md §10): a result that waited gets its turn now.
        try {
          await flushOutbox(connection.endpoint, api);
        } catch {
          /* the list below says whether the club is reachable */
        }
      }
      const todayDate = todayLocal();
      const [club, challenges, today, records] = await Promise.all([
        api.club(),
        api.challenges(),
        api.challenges({ daily: todayDate }),
        api.records(),
      ]);
      if (!alive.current) return;
      setData({
        clubName: club.club.name,
        members: club.members,
        challenges,
        today,
        todayDate,
        records,
      });
      if (club.club.name !== connection.clubName) onRenamed(club.club.name);
    } catch (e) {
      if (alive.current) setError(errorText(e, t, connection.clubName));
    } finally {
      if (alive.current) setLoading(false);
    }
    // `t` and `onRenamed` change identity without changing what is fetched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.endpoint, connection.memberToken, connection.clubName]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
    // Once per open; `Reload` is the only other fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.endpoint]);

  const known = (data?.challenges ?? []).filter((c) => contractFor(c.gameId) !== null);
  // Held to the date asked for: a server that predates `?daily=` ignores the
  // parameter and answers with its ordinary list, which is not today's.
  const todays = (data?.today ?? []).filter(
    (c) => contractFor(c.gameId) !== null && c.daily === data?.todayDate,
  );
  const todayIds = new Set(todays.map((c) => c.id));
  const rest = known.filter((c) => !todayIds.has(c.id));
  const open = rest.filter((c) => !c.mine);
  const played = rest.filter((c) => c.mine);
  const records = (data?.records ?? []).filter((r) => contractFor(r.gameId) !== null);

  const remove = async (member: Member) => {
    setConfirmRemove(null);
    setActionError(null);
    try {
      await client().removeMember(member.id);
      setData((d) => (d ? { ...d, members: d.members.filter((m) => m.id !== member.id) } : d));
    } catch (e) {
      setActionError(errorText(e, t, clubName));
    }
  };

  if (panel === 'invite') {
    return (
      <InvitePanel clubName={clubName} client={client()} t={t} onBack={() => onPanel('none')} />
    );
  }
  if (panel === 'settings') {
    return (
      <SettingsPanel
        clubName={clubName}
        isOwner={isOwner}
        members={data?.members ?? null}
        selfId={connection.memberId}
        t={t}
        onBack={() => onPanel('none')}
        onDisconnect={onDisconnect}
      />
    );
  }

  return (
    <ScreenFrame
      title={clubName}
      onBack={onBack}
      t={t}
      right={
        <span className="club-header-actions">
          {isOwner ? (
            <button type="button" className="club-text-btn" onClick={() => onPanel('invite')}>
              {t('clubInvite')}
            </button>
          ) : null}
          <button type="button" className="club-text-btn" onClick={() => onPanel('settings')}>
            {t('clubSettings')}
          </button>
        </span>
      }
    >
      <div className="club-toolbar">
        <button
          type="button"
          className="club-text-btn"
          disabled={loading}
          onClick={() => void load()}
        >
          {t('clubReload')}
        </button>
        {loading ? <span className="club-quiet">{t('clubLoading')}</span> : null}
      </div>
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          {todays.length > 0 ? (
            <>
              <h2 className="home-section-label club-section">{t('clubToday')}</h2>
              {todays.map((c) => (
                <ChallengeRow key={c.id} challenge={c} t={t} onOpen={onOpenChallenge} />
              ))}
            </>
          ) : null}
          <h2 className="home-section-label club-section">{t('clubChallenges')}</h2>
          {open.length === 0 ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
          {open.map((c) => (
            <ChallengeRow key={c.id} challenge={c} t={t} onOpen={onOpenChallenge} />
          ))}

          {played.length > 0 ? (
            <>
              <h2 className="home-section-label club-section">{t('clubPlayed')}</h2>
              {played.map((c) => (
                <ChallengeRow key={c.id} challenge={c} t={t} onOpen={onOpenChallenge} />
              ))}
            </>
          ) : null}

          {records.length > 0 ? (
            <>
              <h2 className="home-section-label club-section">{t('clubRecords')}</h2>
              {records.map((r) => (
                <div
                  className="settings-row settings-row-static club-line"
                  key={`${r.gameId}:${r.paramsKey}`}
                >
                  <span className="settings-row-label">
                    {`${gameTitle(r.gameId) ?? r.gameId} · ${tierLabel(r.paramsKey, t)}`}
                  </span>
                  <span className="settings-row-value">
                    {`${axisText(r.gameId, r.facts, t)}  ${r.nickname}`.trim()}
                  </span>
                </div>
              ))}
            </>
          ) : null}

          <h2 className="home-section-label club-section">{t('clubMembers')}</h2>
          {actionError ? (
            <p className="club-note club-note-error" role="alert">
              {actionError}
            </p>
          ) : null}
          {data.members.map((m) => (
            <div className="settings-row settings-row-static club-line" key={m.id}>
              <span className="settings-row-label">{m.nickname}</span>
              <span className="settings-row-value">
                {t('clubJoinedOn', { date: dateLabel(m.joinedAt, locale) })}
              </span>
              {isOwner && m.id !== connection.memberId ? (
                <button
                  type="button"
                  className="club-text-btn club-danger"
                  onClick={() => setConfirmRemove(m)}
                >
                  {t('clubRemove')}
                </button>
              ) : null}
            </div>
          ))}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmRemove !== null}
        title={t('clubRemoveTitle', { name: confirmRemove?.nickname ?? '' })}
        body={t('clubRemoveBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubRemove')}
        danger
        onCancel={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) void remove(confirmRemove);
        }}
      />
    </ScreenFrame>
  );
}

function ChallengeRow({
  challenge,
  t,
  onOpen,
}: {
  challenge: Challenge;
  t: T;
  onOpen: (id: string) => void;
}) {
  const label = `${challengeTitle(challenge, t)} · ${t('clubBy', { name: challenge.createdBy.nickname })}`;
  return (
    <button
      type="button"
      className="settings-row club-line"
      aria-label={label}
      onClick={() => onOpen(challenge.id)}
    >
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-chevron" aria-hidden="true">
        <IconChevronRight />
      </span>
    </button>
  );
}

/** Owner only: the current invite link, to read or share; `New link` replaces it (club.md §7-2). */
function InvitePanel({
  clubName,
  client,
  t,
  onBack,
}: {
  clubName: string;
  client: ClubClient;
  t: T;
  onBack: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    client
      .invite()
      .then((invite) => {
        if (alive.current) setUrl(invite.url);
      })
      .catch((e: unknown) => {
        if (alive.current) setError(errorText(e, t, clubName));
      });
    return () => {
      alive.current = false;
    };
    // The link is read once when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const rotate = async () => {
    setConfirm(false);
    setError(null);
    setCopied(false);
    try {
      const invite = await client.rotateInvite();
      if (alive.current) setUrl(invite.url);
    } catch (e) {
      if (alive.current) setError(errorText(e, t, clubName));
    }
  };

  const share = async () => {
    if (url === null) return;
    const result = await shareGame({ text: t('clubShareText', { club: clubName }), url });
    if (result === 'copied' && alive.current) setCopied(true);
  };

  return (
    <ScreenFrame title={t('clubInvite')} onBack={onBack} t={t}>
      <p className="club-quiet">{t('clubInviteBody', { club: clubName })}</p>
      {url === null && error === null ? <p className="club-quiet">{t('clubLoading')}</p> : null}
      {url !== null ? (
        <>
          <input
            className="club-input"
            type="text"
            readOnly
            value={url}
            aria-label={t('clubInviteLink')}
            onFocus={(event) => event.currentTarget.select()}
          />
          <div className="club-actions">
            <button type="button" className="btn btn-primary" onClick={() => void share()}>
              {t('clubShare')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)}>
              {t('clubNewLink')}
            </button>
          </div>
          {copied ? <p className="club-quiet">{t('clubCopied')}</p> : null}
        </>
      ) : null}
      {error ? (
        <p className="club-note club-note-error" role="alert">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title={t('clubNewLinkTitle')}
        body={t('clubNewLinkBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('clubNewLink')}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void rotate()}
      />
    </ScreenFrame>
  );
}

/** Disconnect this device (club.md §8-5): this device only; the server and the others carry on. */
function SettingsPanel({
  clubName,
  isOwner,
  members,
  selfId,
  t,
  onBack,
  onDisconnect,
}: {
  clubName: string;
  isOwner: boolean;
  members: Member[] | null;
  selfId: string;
  t: T;
  onBack: () => void;
  onDisconnect: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  // Known from the list this screen already read; no extra request.
  const onlyOwner =
    isOwner && members !== null && !members.some((m) => m.role === 'owner' && m.id !== selfId);
  return (
    <ScreenFrame title={t('clubSettings')} onBack={onBack} t={t}>
      <button
        type="button"
        className="settings-row settings-row-danger"
        onClick={() => setConfirm(true)}
      >
        <span className="settings-row-label">{t('clubDisconnect')}</span>
        <span className="settings-row-chevron" aria-hidden="true">
          <IconChevronRight />
        </span>
      </button>
      <ConfirmDialog
        open={confirm}
        title={t('clubDisconnect')}
        body={
          onlyOwner
            ? `${t('clubDisconnectBody', { club: clubName })} ${t('clubDisconnectLastOwner')}`
            : t('clubDisconnectBody', { club: clubName })
        }
        cancelLabel={t('cancel')}
        confirmLabel={t('clubDisconnectConfirm')}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void onDisconnect();
        }}
      />
    </ScreenFrame>
  );
}
