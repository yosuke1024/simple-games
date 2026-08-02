/**
 * The collection home: the games, nothing else competing for attention. One
 * tap opens a game; the gear opens the shared settings. No badges, no events,
 * no urgency — the quiet front door the brand promises.
 *
 * The layout answers one question: how does this stay usable at sixteen games?
 * A one-per-row list with a description under each title was right at one game
 * and would be two and a half screens at sixteen, with the last title always a
 * scroll away. So:
 *
 * - The full list is a two-column grid of title cards. Titles are proper nouns,
 *   identical in every language (registry.ts), so they fit a grid cell in all
 *   fourteen locales in a way a sentence never could.
 * - Each tile wears its own title's accent (packages/brand titleAccents) rather
 *   than one shared colour, so a game can be found by colour and position
 *   instead of by reading every label.
 * - Above it, the games opened most recently (app/recentGames.ts) — so the
 *   games somebody actually plays stay at zero scroll however long the grid
 *   grows, and the order of the grid itself never has to move to keep up.
 *
 * What the shortcut row is not: it carries no timestamp, no progress, no
 * "continue where you left off", and it is absent entirely on a fresh install
 * rather than showing an empty state. It is a door that remembers, not a
 * status board.
 */
import { Capacitor } from '@capacitor/core';
import { SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
import { getRecentGames } from '../../app/recentGames';
import { GAMES, type GameId, type GameModule } from '../../app/registry';
import { useSettings } from '../../state/SettingsContext';
import { IconChevronRight, IconGear } from '../components/icons';
import { WebAdSlot } from '../components/WebAdSlot';

/**
 * The tile carries the title's accent by class, which `ui/styles.css` maps to
 * the same tokens `:root[data-game='…']` sets while that game is mounted —
 * one set of accent values, used in both places. Number Match needs no class:
 * its accent is the series default, which is what the home is already painted
 * with (docs/ARCHITECTURE.md「タイトルごとのアクセント色」).
 */
function GameTile({ game }: { game: GameModule }) {
  return (
    <span className={`game-tile accent-${game.id}`} aria-hidden="true">
      {game.glyph}
    </span>
  );
}

export interface CollectionHomeScreenProps {
  onOpenGame: (gameId: GameId) => void;
  onOpenSettings: () => void;
}

export function CollectionHomeScreen({ onOpenGame, onOpenSettings }: CollectionHomeScreenProps) {
  const { t } = useSettings();
  // Read once per mount, not live: the shell remounts this screen on the way
  // back from a game, so the row is current without the home ever watching
  // anything (and it never reorders under a finger that is mid-tap).
  const recent = getRecentGames()
    .map((id) => GAMES.find((game) => game.id === id))
    .filter((game): game is GameModule => game !== undefined);
  /**
   * The tagline promises offline play, which is the app's promise and not the
   * web build's: the browser has to download the assets on a first visit, and
   * docs/WEB_VERSION.md forbids wording that blurs that difference. So the line
   * is gated rather than reworded — a web-only tagline would be a new string in
   * fourteen locales, and the settings screen already answers this the same way
   * (SettingsScreen.tsx, docs/I18N_POLICY.md). It comes back here unchanged the
   * day the web build is offline on a first visit.
   *
   * This is the same `tagline` the game home screens show. The collection
   * carried its own line until it was found claiming the app cost nothing at
   * all, which docs/BRAND.md forbids while the remove-ads purchase exists.
   * Sharing the key leaves one wording to keep honest rather than two, and
   * spends no new high-risk strings (docs/I18N_POLICY.md) to say it.
   */
  const taglineIsTrue = Capacitor.isNativePlatform();
  return (
    <div className="screen home-screen collection-screen">
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
        {taglineIsTrue ? <p className="home-tagline">{t('tagline')}</p> : null}
      </div>

      {recent.length > 0 ? (
        <nav className="game-recent" aria-labelledby="home-recent-heading">
          <h2 className="home-section-label" id="home-recent-heading">
            {t('recentHeading')}
          </h2>
          {recent.map((game) => (
            <button
              key={game.id}
              type="button"
              className="game-row"
              onClick={() => onOpenGame(game.id)}
            >
              <GameTile game={game} />
              <span className="game-row-title">{game.title}</span>
              <span className="game-row-chevron" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
          ))}
        </nav>
      ) : null}

      <nav className="game-grid" aria-labelledby="home-games-heading">
        <h2 className="home-section-label" id="home-games-heading">
          {t('gamesHeading')}
        </h2>
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            className="game-cell"
            onClick={() => onOpenGame(game.id)}
          >
            <GameTile game={game} />
            <span className="game-cell-title">{game.title}</span>
          </button>
        ))}
      </nav>

      {/* Web build only — the home display unit (docs/ADS_POLICY.md「Web 版」).
          Renders nothing on the native app, whose only ad surface stays the
          anchored banner inside each game (BannerSlot). Kept outside the game
          list and far from anything tappable toward a game. */}
      <WebAdSlot />

      <footer className="brand-footer">
        <span className="brand-name">{SERIES_NAME}</span>
        <span className="brand-by">{SERIES_BY_LINE}</span>
      </footer>
    </div>
  );
}
