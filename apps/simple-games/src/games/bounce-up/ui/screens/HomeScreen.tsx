/**
 * Bounce Up's home (docs/BOUNCE_UP_RULES.md §4「幅」, §5): one way into a
 * run, the Normal / Wide choice, Statistics and Quick Rules. The header is
 * the shell's; the early-release notice under the tagline is the shell's too
 * (docs/WEB_VERSION.md「先行公開(ベータ)」).
 *
 * There is no saved run to guard (§5), so the entry is safe to tap. The width
 * needs no choosing before a first run — Normal is the default — and a choice
 * is kept in `bo.prefs` for the next run on; it lives here only, so it never
 * changes under a running run (§4「幅」). The record at this width is stated
 * once, quietly, on the button — never a target.
 */
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { GameArtwork } from '@/ui/components/GameArtwork';
import { IconChart } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useBounceUp } from '../../state/GameContext';
import { WIDTHS } from '../../storage/schemas';

const WIDTH_KEYS = {
  normal: 'bounceUpWidth_normal',
  wide: 'bounceUpWidth_wide',
} as const;

export function BounceUpHomeScreen() {
  const { stats, width, setWidth, navigate, startRun, exitToCollection } = useBounceUp();
  const { t } = useSettings();
  const best = stats.best[width];

  return (
    <div className="screen home-screen illustrated-game-home">
      <GameHomeHeader gameId="bounce-up" onBack={exitToCollection} />

      <div className="home-hero">
        <span className="game-home-artwork" aria-hidden="true">
          <GameArtwork id="bounce-up" />
        </span>
        <h1 className="home-title">{t('bounceUpName')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
        <WebBetaNotice gameId="bounce-up" />
      </div>

      <div className="home-actions">
        <button type="button" className="btn btn-primary btn-big" onClick={startRun}>
          {t('bounceUpPlay')}
          {best > 0 ? (
            <span className="btn-note">{t('bounceUpBestNote', { score: best })}</span>
          ) : null}
        </button>

        <div className="bo-width">
          <span className="bo-width-label" id="bo-width-label">
            {t('bounceUpWidth')}
          </span>
          <div className="segmented" role="group" aria-labelledby="bo-width-label">
            {WIDTHS.map((option) => (
              <button
                key={option}
                type="button"
                className={`segment ${option === width ? 'segment-active' : ''}`}
                aria-pressed={option === width}
                onClick={() => setWidth(option)}
              >
                {t(WIDTH_KEYS[option])}
              </button>
            ))}
          </div>
        </div>

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
