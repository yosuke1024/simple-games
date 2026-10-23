/**
 * Overtake's home (docs/OVERTAKE_RULES.md §7, §11「ホーム」): Play at the
 * frontier, the Levels chip with how far up the hundred, Statistics, the
 * Drag / Buttons choice, and Quick Rules. The header is the shell's; the
 * early-release notice under the tagline is the shell's too
 * (docs/WEB_VERSION.md「先行公開(ベータ)」).
 *
 * There is no saved race to guard (§9), so every entry point is safe to tap.
 * The controls need no choosing before a first race — Drag is the default —
 * and a choice is kept in `ot.prefs` from the next `ready` on; it lives here
 * only, so it never changes under a running race.
 */
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart, IconGrid } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { CONTROLS } from '../../game/progress';
import { LEVEL_COUNT } from '../../game/levels';
import { useOvertake } from '../../state/GameContext';
import { clearedLevels, homeLevel } from '../../state/statsLogic';

const CONTROL_KEYS = {
  drag: 'overtakeControlsDrag',
  buttons: 'overtakeControlsButtons',
} as const;

export function OvertakeHomeScreen() {
  const { progress, controls, setControls, navigate, startLevel, exitToCollection } = useOvertake();
  const { t } = useSettings();
  const level = homeLevel(progress);

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="overtake" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="overtake" />
        </span>
        <h1 className="home-title">{t('overtakeName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="overtake" />
      </div>

      <div className="home-actions">
        <button type="button" className="btn btn-primary btn-big" onClick={() => startLevel(level)}>
          {t('modeLevel', { n: level })}
        </button>

        <div className="ot-controls">
          <span className="ot-controls-label" id="ot-controls-label">
            {t('overtakeControls')}
          </span>
          <div className="segmented" role="group" aria-labelledby="ot-controls-label">
            {CONTROLS.map((option) => (
              <button
                key={option}
                type="button"
                className={`segment ${option === controls ? 'segment-active' : ''}`}
                aria-pressed={option === controls}
                onClick={() => setControls(option)}
              >
                {t(CONTROL_KEYS[option])}
              </button>
            ))}
          </div>
        </div>

        <nav className="home-chips">
          <button type="button" className="home-chip" onClick={() => navigate('levels')}>
            <IconGrid className="home-chip-icon" />
            <span>{t('levelsTitle')}</span>
            <span className="home-chip-count">
              {clearedLevels(progress)}/{LEVEL_COUNT}
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
    </div>
  );
}
