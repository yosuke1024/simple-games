/**
 * Home (docs/ECHO_PADS_RULES.md §2, §7, §13): the level to play, today's
 * daily, the level list and the statistics — nothing between the player and
 * either mode, and nothing that counts days in a row.
 *
 * - With a level run in progress, the main button resumes it, named by its
 *   level. The level button below starts the suggested level (the first open
 *   one not cleared) and, while a run is suspended, asks first: the slot holds
 *   one run (§9). When the suspended run is at the suggested level itself, that
 *   button is "New sequence" (with the level's tier and length), not the same
 *   level named twice.
 * - The daily button resumes today's daily when it is in progress (no
 *   question — it is a slot of its own) and otherwise starts a new attempt at
 *   today's (§7). A first clear today shows the shared "Completed today".
 *
 * The header is the shell's (`GameHomeHeader`), and so is the early-release
 * notice under the tagline (docs/WEB_VERSION.md「先行公開(ベータ)」).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart, IconCheck, IconGrid } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { isFinished, LEVEL_COUNT, levelSpec, localDateString } from '../../game';
import { suggestedLevel, useEchoPads } from '../../state/GameContext';
import { ReplaceRunDialog } from '../components/ReplaceRunDialog';
import { dailyDetail, levelDetail, runDetail, runName } from '../labels';

export function EchoPadsHomeScreen() {
  const {
    navigate,
    sessions,
    progress,
    dailyDoneToday,
    startLevel,
    startDaily,
    resumeGame,
    exitToCollection,
  } = useEchoPads();
  const { t } = useSettings();
  const [pending, setPending] = useState<number | null>(null);

  const current = sessions.level !== null && !isFinished(sessions.level) ? sessions.level : null;
  const today = localDateString(new Date());
  const dailyGame =
    sessions.daily !== null && !isFinished(sessions.daily) && sessions.daily.dailyDate === today
      ? sessions.daily
      : null;
  const suggested = suggestedLevel(progress);
  const suggestedSpec = levelSpec(suggested);
  // The suspended run is already at the suggested level: the button below
  // Resume is a new sequence there, not "Level n" a second time.
  const anotherSequence = current !== null && current.level === suggested;
  const clearedCount = progress.cleared.filter(Boolean).length;

  const choose = (level: number) => {
    if (current) setPending(level);
    else startLevel(level);
  };

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="echo-pads" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts. */}
        <div className="home-logo" aria-hidden="true">
          {'♫'}
        </div>
        <h1 className="home-title">{t('echoPadsName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="echo-pads" />
      </div>

      <div className="home-actions">
        {current !== null ? (
          <button
            type="button"
            className="btn btn-primary btn-big"
            onClick={() => resumeGame('level')}
          >
            {t('resume')}
            <span className="btn-note">
              {runName(t, current)} · {runDetail(t, current)}
            </span>
          </button>
        ) : null}

        <button
          type="button"
          className={`btn ${current === null ? 'btn-primary' : 'btn-secondary'} btn-big`}
          onClick={() => choose(suggested)}
        >
          {anotherSequence ? t('echoPadsNewSequence') : t('modeLevel', { n: suggested })}
          {suggestedSpec ? (
            <span className="btn-note">
              {levelDetail(t, suggestedSpec.padCount, suggestedSpec.target)}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-big"
          onClick={() => (dailyGame ? resumeGame('daily') : startDaily())}
        >
          {t('dailyChallenge')}
          {dailyGame ? (
            <span className="btn-note">{t('resume')}</span>
          ) : dailyDoneToday ? (
            <span className="btn-note">
              <IconCheck className="badge-icon" /> {t('dailyDoneBadge')}
            </span>
          ) : (
            <span className="btn-note">{dailyDetail(t)}</span>
          )}
        </button>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('levels')}>
            <IconGrid className="home-chip-icon" />
            <span>{t('levelsTitle')}</span>
            <span className="home-chip-count">
              {clearedCount}/{LEVEL_COUNT}
            </span>
          </button>
          <button type="button" className="home-chip" onClick={() => navigate('stats')}>
            <IconChart className="home-chip-icon" />
            <span>{t('statistics')}</span>
          </button>
        </nav>

        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
        </div>
      </div>

      <ReplaceRunDialog
        pendingLevel={pending}
        current={current}
        onCancel={() => setPending(null)}
        onConfirm={(level) => {
          setPending(null);
          startLevel(level);
        }}
      />
    </div>
  );
}
