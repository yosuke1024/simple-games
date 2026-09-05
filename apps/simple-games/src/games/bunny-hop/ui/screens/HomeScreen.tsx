import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { IconChart } from '@/ui/components/icons';
import { useBunnyHop } from '../../state/GameContext';

/**
 * Home (docs/BUNNY_HOP_RULES.md §13): one button. There are no levels, no
 * daily and no run to come back to — the track is endless and the record is
 * the score — so nothing here stands between a player and the next run.
 */
export function BunnyHomeScreen() {
  const { navigate, stats, startRun, exitToCollection } = useBunnyHop();
  const { t } = useSettings();

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="bunny-hop" onBack={exitToCollection} />

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ⌃
        </div>
        <h1 className="home-title">{t('bunnyName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button type="button" className="btn btn-primary btn-big" onClick={startRun}>
          {t('bunnyStartRun')}
          {stats.bestScore > 0 ? (
            <span className="btn-note">
              {t('bunnyBestScore')} {stats.bestScore}
            </span>
          ) : null}
        </button>

        <nav className="home-chips">
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
