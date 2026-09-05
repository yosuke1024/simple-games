/**
 * The collection home: the games, nothing else competing for attention. One
 * tap opens a game; the gear opens the shared settings. No badges, no events,
 * no urgency — the quiet front door the brand promises.
 *
 * The layout answers one question: how does this stay usable at twenty games?
 * A one-per-row list with a description under each title was right at one game
 * and would be several screens at twenty, with the last title always a scroll
 * away. So:
 *
 * - The full list is a two-column grid of title cards, cut into category
 *   sections (registry.ts GAME_CATEGORIES). One unbroken grid was fine at
 *   sixteen games; at twenty, finding a title meant reading it. A category
 *   heading lets a reader skip whole shelves — someone after Solitaire never
 *   scans the drills — and gives a new game an obvious place to appear.
 *   Titles are proper nouns, identical in every language (registry.ts), so
 *   they fit a grid cell in all fourteen locales in a way a sentence never
 *   could; the category names are ordinary nouns and come from the catalog.
 * - Each tile wears its own title's accent (packages/brand titleAccents) rather
 *   than one shared colour, so a game can be found by colour and position
 *   instead of by reading every label.
 * - Above it all, two short blocks that keep the games somebody actually plays
 *   at zero scroll however long the grid grows, so no category has to double
 *   as "favourites" to keep up: the games they pinned themselves
 *   (app/favoriteGames.ts), then the games opened most recently
 *   (app/recentGames.ts).
 *
 * Why both, and in that order (issue #109): the recent row is written by the
 * shell and answers "where was I", which is the wrong question for a game
 * somebody returns to every day and a poor one for a game they play twice a
 * week. Pinning answers "keep this here" and nothing else can. A pinned game
 * is dropped from the recent row rather than shown twice — the row's two
 * slots are for doors that are not already open, and the games most likely to
 * be pinned are exactly the ones most likely to be recent, so without this the
 * common case is the broken-looking one.
 *
 * What neither block is: they carry no timestamp, no progress, no "continue
 * where you left off", and each is absent entirely rather than showing an
 * empty state. They are doors that remember, not a status board.
 *
 * The long press on a tile opens `GameActionSheet` (issue #109), which on
 * Android also offers pinning that one game to the OS home screen
 * (issue #110) — a second, independent decision from favouriting, gated by
 * `homeShortcutsAvailable()` so the action is simply absent everywhere the
 * launcher cannot honour it.
 */
import { Capacitor } from '@capacitor/core';
import { SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getFavoriteGames, toggleFavoriteGame } from '../../app/favoriteGames';
import { getRecentGames } from '../../app/recentGames';
import { GAMES, GAME_CATEGORIES, type GameId, type GameDefinition } from '../../app/registry';
import {
  homeShortcutsAvailable,
  requestHomeShortcut,
} from '../../services/homeShortcut/homeShortcut';
import { useSettings } from '../../state/SettingsContext';
import { GameActionSheet } from '../components/GameActionSheet';
import { GameTile } from '../components/GameTile';
import { IconChevronRight, IconGear } from '../components/icons';
import { WebAdSlot } from '../components/WebAdSlot';
import { WebChromeSlot } from '../components/WebChromeSlot';

/**
 * How long a press has to last before it means "the menu" instead of "open
 * the game". The same 450ms Minesweeper's board uses for its own long press:
 * long enough not to fire while tapping, short enough not to feel stuck.
 */
export const GAME_MENU_PRESS_MS = 450;

interface GameButtonProps {
  game: GameDefinition;
  className: string;
  onOpen: (gameId: GameId) => void;
  onMenu: (game: GameDefinition, trigger: HTMLElement | null, midPress: boolean) => void;
  children: ReactNode;
}

/**
 * A tile. A tap opens the game; a long press, a right-click, or the keyboard's
 * context-menu key opens the sheet instead (issue #109).
 *
 * The click that ends a long press is not suppressed here. `GameActionSheet`
 * swallows it, and it is the only place that can: by the time that click is
 * dispatched the sheet's full-screen backdrop is over this button, so the
 * click lands on the backdrop — never on the tile — and a guard here would sit
 * unreachable while the one case that matters went unhandled.
 */
function GameButton({ game, className, onOpen, onMenu, children }: GameButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // A tile can be unmounted mid-press — pinning a game rebuilds the shelf
  // above it — and a timer that fired afterwards would open a sheet nobody
  // asked for.
  useEffect(() => clearTimer, [clearTimer]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={className}
      // Which game this door leads to, for the one caller that has to find a
      // door again after the one it was holding disappeared (`closeMenu`).
      data-game-id={game.id}
      onPointerDown={(event) => {
        // Only the primary button arms the press. A right-click has its own
        // doorway below, and arming here as well would open the sheet twice.
        if (event.button > 0) return;
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          onMenu(game, buttonRef.current, true);
        }, GAME_MENU_PRESS_MS);
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event) => {
        // A right-click, and the keyboard's own menu key (Shift+F10): the
        // browser raises this same event for both, so the mouse route and one
        // keyboard route cost three lines between them.
        event.preventDefault();
        clearTimer();
        onMenu(game, buttonRef.current, false);
      }}
      onClick={() => {
        clearTimer();
        onOpen(game.id);
      }}
    >
      {children}
    </button>
  );
}

export interface CollectionHomeScreenProps {
  onOpenGame: (gameId: GameId) => void;
  onOpenSettings: () => void;
  /**
   * The browser version's one-time app card, when the shell has decided this
   * is its moment (app/App.tsx, docs/WEB_VERSION.md「アプリへの送客」). The home
   * owns only where it goes; whether it exists at all is not its question.
   */
  appPrompt?: ReactNode;
}

export function CollectionHomeScreen({
  onOpenGame,
  onOpenSettings,
  appPrompt,
}: CollectionHomeScreenProps) {
  const { t } = useSettings();

  /**
   * The pinned shelf. State rather than a read per render, because unlike the
   * recent row this one changes while the screen is open: the sheet below
   * pins and unpins, and the shelf has to move under it.
   */
  const [favoriteIds, setFavoriteIds] = useState<readonly GameId[]>(getFavoriteGames);
  const [menuGame, setMenuGame] = useState<GameDefinition | null>(null);
  /** Where the sheet was opened from, so closing it hands focus back. */
  const menuTriggerRef = useRef<{ element: HTMLElement | null; gameId: GameId } | null>(null);

  const [menuMidPress, setMenuMidPress] = useState(false);

  const openMenu = useCallback(
    (game: GameDefinition, trigger: HTMLElement | null, midPress: boolean) => {
      menuTriggerRef.current = { element: trigger, gameId: game.id };
      setMenuMidPress(midPress);
      setMenuGame(game);
    },
    [],
  );

  const closeMenu = useCallback(() => setMenuGame(null), []);

  /**
   * Focus goes back where the sheet was opened from — after the commit that
   * closed it, not during. The tile that opened it may be gone by then:
   * unpinning removes the shelf tile the sheet was opened from, and a check
   * made before React has updated the DOM would say it is still there, focus
   * it, and watch the browser drop focus to `<body>` a moment later. That
   * leaves a keyboard user at the top of the document with no way back to
   * where they were, in the one flow this sheet exists to support.
   *
   * When the tile really is gone, the game still has its tile in its own
   * category — the same door, one section down — so focus lands there.
   */
  useEffect(() => {
    if (menuGame !== null) return;
    const from = menuTriggerRef.current;
    if (from === null) return;
    menuTriggerRef.current = null;
    const target = from.element?.isConnected
      ? from.element
      : document.querySelector<HTMLElement>(`[data-game-id="${from.gameId}"]`);
    target?.focus();
  }, [menuGame]);

  const byId = (id: GameId) => GAMES.find((game) => game.id === id);
  const isDefined = (game: GameDefinition | undefined): game is GameDefinition =>
    game !== undefined;

  const favorites = favoriteIds.map(byId).filter(isDefined);
  const pinned = new Set(favoriteIds);
  // Read once per mount, not live: the shell remounts this screen on the way
  // back from a game, so the row is current without the home ever watching
  // anything (and it never reorders under a finger that is mid-tap).
  const recent = getRecentGames()
    .filter((id) => !pinned.has(id))
    .map(byId)
    .filter(isDefined);

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
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app, which has no
          site to return to. */}
      <WebChromeSlot />

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

      {/* The shelf the player arranged, above the one the shell keeps. Same
          grid as the category sections, because it is the same kind of thing:
          a shelf of titles, in an order somebody chose. */}
      {favorites.length > 0 ? (
        <nav className="game-favorites" aria-labelledby="home-favorites-heading">
          <h2 className="home-section-label" id="home-favorites-heading">
            {t('favoritesHeading')}
          </h2>
          <div className="game-grid">
            {favorites.map((game) => (
              <GameButton
                key={game.id}
                game={game}
                className="game-cell"
                onOpen={onOpenGame}
                onMenu={openMenu}
              >
                <GameTile game={game} />
                <span className="game-cell-title">{game.title}</span>
              </GameButton>
            ))}
          </div>
        </nav>
      ) : null}

      {recent.length > 0 ? (
        <nav className="game-recent" aria-labelledby="home-recent-heading">
          <h2 className="home-section-label" id="home-recent-heading">
            {t('recentHeading')}
          </h2>
          {recent.map((game) => (
            <GameButton
              key={game.id}
              game={game}
              className="game-row"
              onOpen={onOpenGame}
              onMenu={openMenu}
            >
              <GameTile game={game} />
              <span className="game-row-title">{game.title}</span>
              <span className="game-row-chevron" aria-hidden="true">
                <IconChevronRight />
              </span>
            </GameButton>
          ))}
        </nav>
      ) : null}

      {/* Below the shortcuts and above the full list: past the row somebody
          came back for, before the twenty titles they scroll. It is one card
          in the flow, so the games under it move down by its height and by
          nothing else — no overlay, no reserved space when it is absent. */}
      {appPrompt}

      {/* One landmark for the whole list, headed sections inside: six category
          navs would drown the landmark list, while the headings still let a
          reader (or a screen-reader's heading jump) skip a shelf at a time.
          Sections come from GAME_CATEGORIES; a game is listed under the one
          category it names in the registry, in registry order. */}
      <nav className="game-sections" aria-label={t('gamesHeading')}>
        {GAME_CATEGORIES.map((category) => {
          const games = GAMES.filter((game) => game.category === category.id);
          if (games.length === 0) return null;
          return (
            <div key={category.id} className="game-category">
              <h2 className="home-section-label">{t(category.headingKey)}</h2>
              <div className="game-grid">
                {games.map((game) => (
                  <GameButton
                    key={game.id}
                    game={game}
                    className="game-cell"
                    onOpen={onOpenGame}
                    onMenu={openMenu}
                  >
                    <GameTile game={game} />
                    <span className="game-cell-title">{game.title}</span>
                  </GameButton>
                ))}
              </div>
            </div>
          );
        })}
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

      <GameActionSheet
        game={menuGame}
        isFavorite={menuGame !== null && pinned.has(menuGame.id)}
        openedMidPress={menuMidPress}
        onToggleFavorite={() => {
          if (menuGame) setFavoriteIds(toggleFavoriteGame(menuGame.id));
          closeMenu();
        }}
        // Android only, and only when the launcher already answered "yes" at
        // boot (`homeShortcutsAvailable`, a runtime guard read once) — every
        // other build passes no prop at all, so the sheet draws no action for
        // a door that would not open. The sheet closes immediately: the
        // launcher raises its own confirmation on top of the app, and there
        // is nothing to await, since `requestHomeShortcut` never reports
        // whether a shortcut was actually created (issue #110). Favouriting
        // is a separate state above and is left untouched either way.
        onAddToHomeScreen={
          homeShortcutsAvailable()
            ? () => {
                if (menuGame) void requestHomeShortcut(menuGame);
                closeMenu();
              }
            : undefined
        }
        onClose={closeMenu}
      />
    </div>
  );
}
