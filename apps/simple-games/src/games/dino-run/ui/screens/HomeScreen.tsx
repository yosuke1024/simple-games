import { useSettings } from '@/state/SettingsContext';
import { IconBack, IconChart } from '@/ui/components/icons';
import { WebChromeSlot } from '@/ui/components/WebChromeSlot';
import { useDinoRun } from '../../state/GameContext';

/**
 * Home (docs/DINO_RUN_RULES.md §13): one button. There are no levels, no
 * daily and no run to come back to — the track is endless and the record is
 * the score — so nothing here stands between a player and the next run.
 */
export function DinoHomeScreen() {
  const { navigate, stats, startRun, exitToCollection } = useDinoRun();
  const { t } = useSettings();

  return (
    <div className="screen home-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app. This game's
          board and result screens deliberately have none. */}
      <WebChromeSlot />

      <header className="screen-header">
        <button
          type="button"
          className="icon-btn"
          aria-label={t('backToGames')}
          onClick={exitToCollection}
        >
          <IconBack />
        </button>
        <span className="icon-btn-placeholder" />
      </header>

      <div className="home-hero">
        {/* The same glyph the collection home puts on this title's tile
            (app/registry.ts): arriving here should look like the tile that
            was tapped, not like a second mark for the same game. */}
        <div className="home-logo" aria-hidden="true">
          ⌁
        </div>
        <h1 className="home-title">{t('dinoName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        <button type="button" className="btn btn-primary btn-big" onClick={startRun}>
          {t('dinoStartRun')}
          {stats.bestScore > 0 ? (
            <span className="btn-note">
              {t('dinoBestScore')} {stats.bestScore}
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
