/**
 * The collection home: the game list, nothing else competing for attention.
 * One tap opens a game; the gear opens the shared settings. No badges, no
 * events, no urgency — the quiet front door the brand promises.
 */
import { SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
import { GAMES, type GameId } from '../../app/registry';
import { useSettings } from '../../state/SettingsContext';
import { IconChevronRight, IconGear } from '../components/icons';

export interface CollectionHomeScreenProps {
  onOpenGame: (gameId: GameId) => void;
  onOpenSettings: () => void;
}

export function CollectionHomeScreen({ onOpenGame, onOpenSettings }: CollectionHomeScreenProps) {
  const { t } = useSettings();
  return (
    <div className="screen home-screen">
      <header className="screen-header">
        <span className="icon-btn-placeholder" />
        <button
          type="button"
          className="icon-btn"
          aria-label={t('settings')}
          onClick={onOpenSettings}
        >
          <IconGear />
        </button>
      </header>

      <div className="home-hero">
        <div className="home-logo" aria-hidden="true">
          ▦
        </div>
        <h1 className="home-title">{SERIES_NAME}</h1>
        <p className="home-tagline">{t('collectionTagline')}</p>
      </div>

      <nav className="game-list" aria-label={t('gamesHeading')}>
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            className="game-card"
            onClick={() => onOpenGame(game.id)}
          >
            <span className="game-card-tile" aria-hidden="true">
              {game.glyph}
            </span>
            <span className="game-card-text">
              <span className="game-card-title">{game.title}</span>
              <span className="game-card-blurb">{t(game.blurbKey)}</span>
            </span>
            <span className="game-card-chevron" aria-hidden="true">
              <IconChevronRight />
            </span>
          </button>
        ))}
      </nav>

      <footer className="brand-footer">
        <span className="brand-name">{SERIES_NAME}</span>
        <span className="brand-by">{SERIES_BY_LINE}</span>
      </footer>
    </div>
  );
}
