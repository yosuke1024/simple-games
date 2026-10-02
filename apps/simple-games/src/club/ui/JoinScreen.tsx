/**
 * Join a Club (club.md §7-3, §7-4): an invite link, a nickname, one request.
 * Whatever the way in, the screen first says that every game finished from now on
 * is sent to this Club by itself (`clubAutoSendDisclosure`) — the consent the
 * automatic send rests on (club.md §2-2). A Club this device left earlier is
 * joined by coming back as the same member (`joinOrRestore`, decision 43); the
 * typed nickname wins, and the field is never prefilled (a cached name can be stale).
 */
import { useEffect, useState } from 'react';
import { inviteFromHref } from '../invite';
import { joinOrRestore } from '../join';
import { PUBLIC_CLUB_ENDPOINT } from '../public';
import { findDeparted } from '../storage/connections';
import { CLUB_CONNECTIONS_MAX, type ClubConnection } from '@/storage/schemas';
import type { ClubInvite } from '@/ui/clubBridge';
import { errorText, NICKNAME_MAX, ScreenFrame, type T } from './common';

export function JoinScreen({
  invite,
  publicClub = false,
  connectionCount,
  t,
  onBack,
  onJoined,
}: {
  /** Opened from an invite link: the paste field stays hidden. */
  invite: ClubInvite | null;
  /** The Public Club House: no link, a nickname alone — and the disclosure comes first (PRODUCT_PRINCIPLES「公開されることを、参加の前に言う」). */
  publicClub?: boolean;
  connectionCount: number;
  t: T;
  onBack: () => void;
  onJoined: (connection: ClubConnection) => Promise<void>;
}) {
  const [link, setLink] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasHere, setWasHere] = useState(false);

  const parsed = invite ?? (link.trim() === '' ? null : inviteFromHref(link));
  const linkProblem = !publicClub && invite === null && link.trim() !== '' && parsed === null;
  const name = nickname.trim();
  const nicknameOk = name.length >= 1 && name.length <= NICKNAME_MAX;
  const target = publicClub ? PUBLIC_CLUB_ENDPOINT : (parsed?.endpoint ?? null);

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

  const ready = (publicClub || parsed !== null) && nicknameOk && !busy;

  const submit = async () => {
    if ((!publicClub && parsed === null) || !nicknameOk) return;
    if (connectionCount >= CLUB_CONNECTIONS_MAX) {
      setError(t('clubErr_too_many_connections'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const endpoint = publicClub ? PUBLIC_CLUB_ENDPOINT : parsed!.endpoint;
      // The disclosure above was on this screen, whichever way in: that is the
      // consent (the connection is stored with `autoSend`).
      const { connection } = await joinOrRestore({
        endpoint,
        inviteToken: publicClub ? null : parsed!.token,
        nickname: name,
      });
      await onJoined(connection);
    } catch (e) {
      setError(errorText(e, t));
      setBusy(false);
    }
  };

  return (
    <ScreenFrame
      title={publicClub ? t('clubPublicTitle') : t('clubJoinClub')}
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
        <p className="club-disclosure">{t('clubAutoSendDisclosure')}</p>
        {wasHere ? <p className="club-quiet">{t('clubRejoinNote')}</p> : null}
        {invite === null && !publicClub ? (
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
          {busy ? t('clubJoining') : t('clubJoinAndPlay')}
        </button>
        {error ? (
          <p className="club-note club-note-error" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </ScreenFrame>
  );
}
