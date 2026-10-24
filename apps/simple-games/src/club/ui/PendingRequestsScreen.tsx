import { useEffect, useRef, useState } from 'react';
import type { ClubConnection, PendingClubJoin } from '@/storage/schemas';
import { useSettings } from '@/state/SettingsContext';
import { createClient } from '../api/client';
import { ClubApiError } from '../api/errors';
import { forgetPendingJoin } from '../storage/connections';
import { errorText, ScreenFrame } from './common';

/** Requests are read only on an explicit check. They never become sending memberships by a timer. */
export function PendingRequestsScreen({
  requests,
  onChanged,
  onJoined,
  onBack,
}: {
  requests: PendingClubJoin[];
  onChanged: () => Promise<void>;
  onJoined: (connection: ClubConnection) => Promise<void>;
  onBack: () => void;
}) {
  const { t } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const requestError = async (error: unknown, pending: PendingClubJoin) => {
    if (!alive.current) return;
    // A bounded server ledger can forget a rejected/expired application.
    // Keep transport failures retryable, but let an expired receipt leave
    // this device so the person can submit a fresh request.
    if (
      error instanceof ClubApiError &&
      (error.code === 'unauthorized' || error.code === 'not_found')
    ) {
      await forgetPendingJoin(pending.endpoint);
      await onChanged();
      setNote(t('clubRequestExpired'));
    } else {
      setNote(
        error instanceof ClubApiError && error.code === 'request_decided'
          ? t('clubCheckRequest')
          : errorText(error, t),
      );
    }
  };
  const check = async (pending: PendingClubJoin) => {
    setBusy(pending.endpoint);
    setNote(null);
    try {
      const status = await createClient(pending.endpoint).joinRequestStatus(pending.requestToken);
      if (!alive.current) return;
      if (status.status === 'approved' && status.member && status.memberToken) {
        await onJoined({
          endpoint: pending.endpoint,
          clubId: status.club.id,
          clubName: status.club.name,
          memberId: status.member.id,
          memberToken: status.memberToken,
          nickname: status.member.nickname,
          role: status.member.role,
          joinedAt: status.member.joinedAt,
          autoSend: true,
        });
        await forgetPendingJoin(pending.endpoint);
        await onChanged();
      } else if (status.status === 'pending') {
        setNote(t('clubPendingTitle'));
      } else {
        await forgetPendingJoin(pending.endpoint);
        await onChanged();
        setNote(t(status.status === 'rejected' ? 'clubRequestRejected' : 'clubRequestExpired'));
      }
    } catch (error) {
      await requestError(error, pending);
    } finally {
      if (alive.current) setBusy(null);
    }
  };
  const cancel = async (pending: PendingClubJoin) => {
    setBusy(pending.endpoint);
    setNote(null);
    try {
      await createClient(pending.endpoint).cancelJoinRequest(pending.requestToken);
      if (!alive.current) return;
      await forgetPendingJoin(pending.endpoint);
      await onChanged();
    } catch (error) {
      await requestError(error, pending);
    } finally {
      if (alive.current) setBusy(null);
    }
  };
  return (
    <ScreenFrame title={t('clubJoinRequests')} onBack={onBack} t={t}>
      <p className="club-disclosure">{t('clubPendingHelp')}</p>
      {requests.length === 0 ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
      {requests.map((request) => (
        <section key={request.endpoint} className="club-managed-card">
          <h2>{request.clubName}</h2>
          <p>{request.nickname}</p>
          <div className="club-actions">
            <button
              className="btn btn-primary"
              disabled={busy !== null}
              onClick={() => void check(request)}
            >
              {t('clubCheckRequest')}
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy !== null}
              onClick={() => void cancel(request)}
            >
              {t('clubCancelRequest')}
            </button>
          </div>
        </section>
      ))}
      {note ? (
        <p className="club-note" role="status">
          {note}
        </p>
      ) : null}
    </ScreenFrame>
  );
}
