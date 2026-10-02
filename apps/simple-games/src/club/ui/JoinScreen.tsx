/** Join a Club (club.md §7-3, §7-4): an invite link, a nickname, one request. */
import { useState } from 'react';
import { createClient } from '../api/client';
import { inviteFromHref } from '../invite';
import { CLUB_CONNECTIONS_MAX, type ClubConnection } from '@/storage/schemas';
import type { ClubInvite } from '@/ui/clubBridge';
import { errorText, ScreenFrame, type T } from './common';

export const NICKNAME_MAX = 24;

export function JoinScreen({
  invite,
  connectionCount,
  t,
  onBack,
  onJoined,
}: {
  /** Opened from an invite link: the paste field stays hidden. */
  invite: ClubInvite | null;
  connectionCount: number;
  t: T;
  onBack: () => void;
  onJoined: (connection: ClubConnection) => Promise<void>;
}) {
  const [link, setLink] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = invite ?? (link.trim() === '' ? null : inviteFromHref(link));
  const linkProblem = invite === null && link.trim() !== '' && parsed === null;
  const name = nickname.trim();
  const nicknameOk = name.length >= 1 && name.length <= NICKNAME_MAX;
  const ready = parsed !== null && nicknameOk && !busy;

  const submit = async () => {
    if (parsed === null || !nicknameOk) return;
    if (connectionCount >= CLUB_CONNECTIONS_MAX) {
      setError(t('clubErr_too_many_connections'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const joined = await createClient(parsed.endpoint).join(parsed.token, name);
      await onJoined({
        endpoint: parsed.endpoint,
        clubId: joined.club.id,
        clubName: joined.club.name,
        memberId: joined.member.id,
        memberToken: joined.memberToken,
        nickname: joined.member.nickname,
        role: joined.member.role,
        joinedAt: joined.member.joinedAt,
      });
    } catch (e) {
      setError(errorText(e, t));
      setBusy(false);
    }
  };

  return (
    <ScreenFrame title={t('clubJoinClub')} onBack={onBack} t={t}>
      <form
        className="club-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {invite === null ? (
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
