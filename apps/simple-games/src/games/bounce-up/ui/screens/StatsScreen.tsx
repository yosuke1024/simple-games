/**
 * Statistics (docs/BOUNCE_UP_RULES.md §5): the best score and the total score
 * per width — apart, because the same height at Wide and at Normal is not
 * the same climb — then the runs played and the time spent running. No
 * streak, and nothing to compare against but the player's own numbers.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconBack } from '@/ui/components/icons';
import { formatDuration } from '@/ui/format';
import { useBounceUp } from '../../state/GameContext';
import { WIDTHS } from '../../storage/schemas';

const WIDTH_KEYS = {
  normal: 'bounceUpWidth_normal',
  wide: 'bounceUpWidth_wide',
} as const;

export function BounceUpStatsScreen() {
  const { goHome, stats } = useBounceUp();
  const { t } = useSettings();

  return (
    <div className="screen stats-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
          <IconBack />
        </button>
        <h1>{t('statistics')}</h1>
        <span className="icon-btn-placeholder" />
      </header>

      <div className="stats-body">
        {WIDTHS.map((width) => (
          <section key={width} className="stats-section">
            <h2 className="stats-title">{t(WIDTH_KEYS[width])}</h2>
            <dl className="stats-grid">
              <div className="stats-row">
                <dt>{t('bounceUpBest')}</dt>
                <dd>{stats.best[width]}</dd>
              </div>
              <div className="stats-row">
                <dt>{t('bounceUpTotal')}</dt>
                <dd>{stats.total[width]}</dd>
              </div>
            </dl>
          </section>
        ))}
        <section className="stats-section">
          <dl className="stats-grid">
            <div className="stats-row">
              <dt>{t('played')}</dt>
              <dd>{stats.played}</dd>
            </div>
            <div className="stats-row">
              <dt>{t('totalTime')}</dt>
              <dd>{formatDuration(stats.totalPlaySeconds)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
