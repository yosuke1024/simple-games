/**
 * ShapeRegions's home (scaffolded by scripts/new-game.mjs): the shared header,
 * a title, a "How to Play" placeholder, and one demo action that exercises
 * the result overlay. Replace the demo action with the real game entry
 * point once there is a game to start.
 */
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { useShapeRegions } from '../../state/GameContext';
import { ShapeRegionsResultOverlay } from '../components/ResultOverlay';

export function ShapeRegionsHomeScreen() {
  const { stats, lastResult, playPlaceholderRound, dismissResult, exitToCollection } =
    useShapeRegions();
  const { t } = useSettings();

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="shape-regions" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts. */}
        <div className="home-logo" aria-hidden="true">
          {'▙'}
        </div>
        <h1 className="home-title">{t('shapeRegionsName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {/* Scaffold placeholder — replace with the real game entry point. */}
        <button type="button" className="btn btn-primary btn-big" onClick={playPlaceholderRound}>
          {t('shapeRegionsPlayPlaceholder')}
          {stats.played > 0 ? <span className="btn-note">{stats.played}</span> : null}
        </button>

        <section className="home-links">
          <h2>{t('howToPlay')}</h2>
          <p className="tutorial-body">{t('shapeRegionsHowToPlayPlaceholder')}</p>
        </section>
      </div>

      <ShapeRegionsResultOverlay result={lastResult} onDismiss={dismissResult} />
    </div>
  );
}
