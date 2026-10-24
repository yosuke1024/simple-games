/**
 * Join a Club (club.md §7-3, §7-4): an invite link, a nickname, one request.
 * Whatever the way in, the screen first says that every game finished from now on
 * is sent to this Club by itself (`clubAutoSendDisclosure`) — the consent the
 * automatic send rests on (club.md §2-2). A Club this device left earlier is
 * joined by coming back as the same member (`joinOrRestore`, decision 43); the
 * typed nickname wins, and the field is never prefilled (a cached name can be stale).
 */
import { useEffect, useRef, useState } from 'react';
import { inviteFromHref } from '../invite';
import { joinOrRestore } from '../join';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { findDeparted, loadPendingJoins } from '../storage/connections';
import { createClient } from '../api/client';
import type { Admission } from '../api/managementTypes';
import { MANAGED_CLUB_ORIGIN, PRIVATE_CLUBS_ENABLED } from '@/ui/clubFeatures';
import { CLUB_CONNECTIONS_MAX, type ClubConnection, type PendingClubJoin } from '@/storage/schemas';
import type { ClubInvite } from '@/ui/clubBridge';
import { errorText, NICKNAME_MAX, ScreenFrame, type T } from './common';

export function JoinScreen({
  invite,
  publicClub = false,
  endpoint,
  clubName,
  connectionCount,
  t,
  onBack,
  onJoined,
  onPending,
}: {
  /** Opened from an invite link: the paste field stays hidden. */
  invite: ClubInvite | null;
  /** The Public Club House: no link, a nickname alone — and the disclosure comes first (PRODUCT_PRINCIPLES「公開されることを、参加の前に言う」). */
  publicClub?: boolean;
  /** A listed managed Club: joining still requires the disclosure and possibly approval. */
  endpoint?: string;
  clubName?: string;
  connectionCount: number;
  t: T;
  onBack: () => void;
  onJoined: (connection: ClubConnection) => Promise<void>;
  onPending?: (request: PendingClubJoin) => Promise<void>;
}) {
  const [link, setLink] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasHere, setWasHere] = useState(false);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [admissionBusy, setAdmissionBusy] = useState(false);
  // Kept apart from `error`: a member coming back does not need the invite to be current.
  const [admissionError, setAdmissionError] = useState<string | null>(null);
  // Bumped by the Retry button: the invite's fragment is already gone from the address.
  const [admissionAttempt, setAdmissionAttempt] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const parsed = invite ?? (link.trim() === '' ? null : inviteFromHref(link));
  const linkProblem =
    !publicClub &&
    !endpoint &&
    invite === null &&
    link.trim() !== '' &&
    (parsed === null ||
      (!PRIVATE_CLUBS_ENABLED &&
        !(MANAGED_CLUB_ORIGIN && parsed.endpoint.startsWith(`${MANAGED_CLUB_ORIGIN}/clubs/`))));
  const name = nickname.trim();
  const nicknameOk = name.length >= 1 && name.length <= NICKNAME_MAX;
  const target = endpoint ?? (publicClub ? PUBLIC_CLUB_ENDPOINT : (parsed?.endpoint ?? null));
  const managed = target !== null && /\/clubs\/[A-Za-z0-9_-]+$/.test(target);

  useEffect(() => {
    let alive = true;
    setAdmission(null);
    setAdmissionError(null);
    if (!managed || !target) return;
    setAdmissionBusy(true);
    setError(null);
    void createClient(target)
      .admission(parsed?.token)
      .then((value) => {
        if (alive) setAdmission(value);
      })
      .catch((e: unknown) => {
        if (alive) setAdmissionError(errorText(e, t));
      })
      .finally(() => {
        if (alive) setAdmissionBusy(false);
      });
    return () => {
      alive = false;
    };
    // Reading admission is caused only by opening/pasting this Club or Retry, never a timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, parsed?.token, managed, admissionAttempt]);

  // A Club this device left: say so. The old name is not offered — an owner may have renamed since.
  useEffect(() => {
    let alive = true;
    setWasHere(false);
    if (target !== null) {
      void findDeparted(target)
        .then((departed) => {
          if (!alive || departed === null) return;
          setWasHere(true);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [target]);

  const ready =
    target !== null &&
    !linkProblem &&
    nicknameOk &&
    !busy &&
    // A departed member is restored with their own saved credential (club.md §7-4), which
    // does not depend on the invite: an owner may have made a new link since.
    (!managed || admission !== null || wasHere) &&
    !admissionBusy;

  const submit = async () => {
    if (!ready || target === null) return;
    // A pending request holds a secret receipt like a connection does, so it counts toward
    // the same ten: the store keeps no more, and would otherwise drop the oldest receipt.
    const waiting = managed
      ? (await loadPendingJoins()).filter((p) => p.endpoint !== target).length
      : 0;
    if (!alive.current) return;
    if (connectionCount + waiting >= CLUB_CONNECTIONS_MAX) {
      setError(t('clubErr_too_many_connections'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // The disclosure above was on this screen, whichever way in: that is the
      // consent (the connection is stored with `autoSend`).
      const outcome = await joinOrRestore({
        endpoint: target,
        inviteToken: parsed?.token ?? null,
        nickname: name,
        allowPending: true,
      });
      // Closing this screen withdraws the local join action. In particular,
      // a later network reply must not repopulate credentials after Reset.
      if (!alive.current) return;
      if ('pending' in outcome) {
        await onPending?.(outcome.pending);
      } else {
        await onJoined({
          ...outcome.connection,
          ...(admission ? { allowedGameIds: admission.allowedGameIds } : {}),
        });
      }
    } catch (e) {
      if (alive.current) {
        setError(errorText(e, t));
        setBusy(false);
      }
    }
  };

  return (
    <ScreenFrame
      title={
        admission?.club.name ?? clubName ?? (publicClub ? t('clubPublicTitle') : t('clubJoinClub'))
      }
      onBack={onBack}
      t={t}
    >
      <form
        className="club-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {publicClub ? <p className="club-disclosure">{t('clubPublicDisclosure')}</p> : null}
        {/* Every way in says it, before the button: results are sent by themselves from here on. */}
        <p className="club-disclosure">
          {t(managed ? 'clubManagedJoinDisclosure' : 'clubAutoSendDisclosure')}
        </p>
        {admission?.approvalRequired ? (
          <p className="club-quiet">{t('clubApprovalRequired')}</p>
        ) : null}
        {wasHere ? <p className="club-quiet">{t('clubRejoinNote')}</p> : null}
        {invite === null && !publicClub && !endpoint ? (
          <label className="club-field">
            <span className="club-field-label">{t('clubInviteLink')}</span>
            <input
              className="club-input"
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('clubInvitePaste')}
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
          </label>
        ) : null}
        {linkProblem ? (
          <p className="club-note club-note-error" role="alert">
            {t('clubErr_not_invite')}
          </p>
        ) : null}
        <label className="club-field">
          <span className="club-field-label">{t('clubNickname')}</span>
          <input
            className="club-input"
            type="text"
            maxLength={NICKNAME_MAX}
            autoComplete="off"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!ready}>
          {busy || admissionBusy
            ? t('clubJoining')
            : t(admission?.approvalRequired ? 'clubRequestJoin' : 'clubJoinAndPlay')}
        </button>
        {error ? (
          <p className="club-note club-note-error" role="alert">
            {error}
          </p>
        ) : null}
        {!error && admissionError && !wasHere ? (
          <>
            <p className="club-note club-note-error" role="alert">
              {admissionError}
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={admissionBusy}
              onClick={() => setAdmissionAttempt((n) => n + 1)}
            >
              {t('clubReload')}
            </button>
          </>
        ) : null}
      </form>
    </ScreenFrame>
  );
}
