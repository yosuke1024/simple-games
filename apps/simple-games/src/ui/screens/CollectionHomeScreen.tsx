/**
 * The collection home: the game list, nothing else competing for attention.
 * One tap opens a game; the gear opens the shared settings. No badges, no
 * events, no urgency — the quiet front door the brand promises.
 */
import { Capacitor } from '@capacitor/core';
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
  /**
   * The tagline promises "fully offline", which is the app's promise and not
   * the web build's: the browser has to download the assets on a first visit,
   * and docs/WEB_VERSION.md forbids wording that blurs that difference. So the
   * line is gated rather than reworded — a web-only tagline would be a new
   * string in fourteen locales, and the settings screen already answers this
   * the same way (SettingsScreen.tsx, docs/I18N_POLICY.md). It comes back here
   * unchanged the day the web build is offline on a first visit.
   */
  const taglineIsTrue = Capacitor.isNativePlatform();
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
        {/*
          The collection mark, drawn to match assets/icon.svg (the launcher
          icon), public/favicon.svg and the hero on the PixApps page — same
          geometry, same colours, so the app opens on the icon that was
          tapped. It carries its own ink rather than the theme accent for the
          same reason an app icon does not repaint per theme. Keep the four in
          step if the mark ever changes.

          It replaced a ▦ glyph, which registry.ts also hands to Nonogram: the
          collection and one of the games were wearing the same face.
        */}
        <svg className="home-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <rect width="64" height="64" rx="14" fill="#232a33" />
          <rect x="13" y="13" width="17" height="17" rx="4" fill="#fffdf8" />
          <rect x="34" y="13" width="17" height="17" rx="4" fill="#fffdf8" />
          <rect x="13" y="34" width="17" height="17" rx="4" fill="#fffdf8" />
          <rect x="34" y="34" width="17" height="17" rx="4" fill="#8b95a3" />
        </svg>
        <h1 className="home-title">{SERIES_NAME}</h1>
        {taglineIsTrue ? <p className="home-tagline">{t('collectionTagline')}</p> : null}
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
