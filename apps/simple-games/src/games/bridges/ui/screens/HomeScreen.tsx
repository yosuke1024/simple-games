/**
 * Bridges's home (scaffolded by scripts/new-game.mjs): the shared header,
 * the hero, one demo action that opens the game screen, and the way into
 * Quick Rules. The hero and the mode buttons are this game's own to shape
 * (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」); the header is the shell's.
 */
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { useBridges } from '../../state/GameContext';

export function BridgesHomeScreen() {
  const { stats, navigate, startPlaceholderRound, exitToCollection } = useBridges();
  const { t } = useSettings();

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="bridges" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts. */}
        <div className="home-logo" aria-hidden="true">
          {'⊶'}
        </div>
        <h1 className="home-title">{t('bridgesName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {/* Scaffold placeholder — replace with the real game entry point(s). */}
        <button type="button" className="btn btn-primary btn-big" onClick={startPlaceholderRound}>
          {t('bridgesPlayPlaceholder')}
          {stats.played > 0 ? <span className="btn-note">{stats.played}</span> : null}
        </button>

        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
        </div>
      </div>
    </div>
  );
}
