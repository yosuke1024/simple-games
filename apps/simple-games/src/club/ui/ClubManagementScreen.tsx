import { useEffect, useRef, useState } from 'react';
import type { ClubConnection } from '@/storage/schemas';
import { useSettings } from '@/state/SettingsContext';
import { createClient } from '../api/client';
import type { ClubSettings, JoinApplication } from '../api/managementTypes';
import { updateClubGames, updateClubName } from '../storage/connections';
import { errorText, ScreenFrame } from './common';
import { shelfGames } from './standings';

export function ClubManagementScreen({
  connection,
  onChanged,
  onBack,
}: {
  connection: ClubConnection;
  onChanged: () => void;
  onBack: () => void;
}) {
  const { t } = useSettings();
  const [settings, setSettings] = useState<ClubSettings | null>(null);
  const [requests, setRequests] = useState<JoinApplication[]>([]);
  const [name, setName] = useState(connection.clubName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const alive = useRef(true);
  const api = () => createClient(connection.endpoint, connection.memberToken);
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setSaved(false);
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
      const [value, pending] = await Promise.all([api().settings(), api().joinRequests()]);
      if (alive.current) {
        setSettings(value);
        setRequests(pending);
      }
    });
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [connection.endpoint]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () =>
    run(async () => {
      if (!settings) return;
      const result = await api().updateSettings(settings);
      if (!alive.current) return;
      await updateClubGames(connection.endpoint, result.allowedGameIds);
      if (!alive.current) return;
      if (name.trim() !== connection.clubName) {
        const club = await api().renameClub(name.trim());
        if (!alive.current) return;
        await updateClubName(connection.endpoint, club.name);
      }
      if (alive.current) {
        setSettings(result);
        setSaved(true);
      }
      onChanged();
    });
  const decide = (id: string, decision: 'approve' | 'reject') =>
    run(async () => {
      await api().decideJoinRequest(id, decision);
      if (alive.current) setRequests((rows) => rows.filter((r) => r.id !== id));
      onChanged();
    });
  const games = [...shelfGames().values()].map(({ game }) => game);
  // Waiting requests come first: they are what the owner came for (2026-10-24).
  const requestsSection = (
    <>
      <h2 className="home-section-label club-section">{t('clubJoinRequests')}</h2>
      <button className="club-text-btn" disabled={busy} onClick={() => void load()}>
        {t('clubReload')}
      </button>
      {requests.length === 0 && !busy ? <p className="club-quiet">{t('clubNothingYet')}</p> : null}
      {requests.map((request) => (
        <section key={request.id} className="club-managed-card">
          <h3>{request.nickname}</h3>
          <div className="club-actions">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void decide(request.id, 'approve')}
            >
              {t('clubApprove')}
            </button>
            <button
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void decide(request.id, 'reject')}
            >
              {t('clubReject')}
            </button>
          </div>
        </section>
      ))}
    </>
  );

  return (
    <ScreenFrame title={t('clubSettings')} onBack={onBack} t={t}>
      {requests.length > 0 ? requestsSection : null}
      {settings ? (
        <form
          className="club-form"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label className="club-field">
            <span>{t('clubName')}</span>
            <input
              className="club-input"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset className="club-managed-fieldset">
            <legend>{t('clubVisibility')}</legend>
            <label className="club-choice">
              <input
                type="radio"
                name="visibility"
                checked={settings.visibility === 'public'}
                onChange={() => setSettings({ ...settings, visibility: 'public' })}
              />
              {t('clubVisibilityPublic')}
            </label>
            <label className="club-choice">
              <input
                type="radio"
                name="visibility"
                checked={settings.visibility === 'private'}
                onChange={() => setSettings({ ...settings, visibility: 'private' })}
              />
              {t('clubVisibilityPrivate')}
            </label>
            <p className="club-quiet">{t('clubVisibilityHelp')}</p>
          </fieldset>
          <label className="club-choice">
            {/* Said as what happens without the owner (2026-10-24): ticked, a request is a
                member at once; unticked, it waits for the owner. The stored setting is
                `approvalRequired`, the opposite of the box. */}
            <input
              type="checkbox"
              checked={!settings.approvalRequired}
              onChange={(e) => setSettings({ ...settings, approvalRequired: !e.target.checked })}
            />
            {t('clubAutoApprove')}
          </label>
          <fieldset className="club-managed-fieldset">
            <legend>{t('clubGames')}</legend>
            <label className="club-choice">
              <input
                type="radio"
                name="games"
                checked={settings.allowedGameIds === null}
                onChange={() => setSettings({ ...settings, allowedGameIds: null })}
              />
              {t('clubGamesAll')}
            </label>
            <label className="club-choice">
              <input
                type="radio"
                name="games"
                checked={settings.allowedGameIds !== null}
                onChange={() =>
                  setSettings({ ...settings, allowedGameIds: games.map((g) => g.id) })
                }
              />
              {t('clubGamesSelected')}
            </label>
            {settings.allowedGameIds !== null ? (
              <div className="club-game-options">
                {games.map((game) => (
                  <label key={game.id} className="club-choice">
                    <input
                      type="checkbox"
                      checked={settings.allowedGameIds!.includes(game.id)}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          allowedGameIds: e.target.checked
                            ? [...settings.allowedGameIds!, game.id]
                            : settings.allowedGameIds!.filter((id) => id !== game.id),
                        })
                      }
                    />
                    {game.title}
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>
            {t('clubSave')}
          </button>
          {saved ? (
            <p className="club-quiet" role="status">
              {t('clubSettingsSaved')}
            </p>
          ) : null}
        </form>
      ) : null}
      {requests.length > 0 ? null : requestsSection}
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
    </ScreenFrame>
  );
}
