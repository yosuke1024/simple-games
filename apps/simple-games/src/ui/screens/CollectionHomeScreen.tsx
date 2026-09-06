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
 *
 * Searching by name is the third answer to the same growth problem, for the
 * case the other two cannot reach: a title somebody knows by name but has not
 * pinned and did not play recently (issue #122). It is a mode, not a box —
 * a small action in the header, and only once it is pressed does the header
 * become a field and the sections collapse to one flat list of what matches
 * (app/gameSearch.ts owns what "matches" means). A permanent search box at
 * the top of a screen whose whole content is thirty labelled doors would be
 * the loudest thing on it, for a question most arrivals are not asking.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SERIES_BY_LINE, SERIES_NAME } from '@simple-games/brand';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getFavoriteGames, toggleFavoriteGame } from '../../app/favoriteGames';
import { searchGames } from '../../app/gameSearch';
import { getRecentGames } from '../../app/recentGames';
import { GAMES, GAME_CATEGORIES, type GameId, type GameDefinition } from '../../app/registry';
import {
  homeShortcutsAvailable,
  requestHomeShortcut,
} from '../../services/homeShortcut/homeShortcut';
import { useSettings } from '../../state/SettingsContext';
import { GameActionSheet } from '../components/GameActionSheet';
import { GameTile } from '../components/GameTile';
import { IconBack, IconChevronRight, IconGear, IconSearch } from '../components/icons';
import { WebAdSlot } from '../components/WebAdSlot';
import { WebChromeSlot } from '../components/WebChromeSlot';

/**
 * How long a press has to last before it means "the menu" instead of "open
 * the game". The same 450ms Minesweeper's board uses for its own long press:
 * long enough not to fire while tapping, short enough not to feel stuck.
 */
export const GAME_MENU_PRESS_MS = 450;

/**
 * How far the finger may travel in that time and still mean "hold". A thumb
 * resting on a tile drifts a few pixels; a finger on its way to scrolling the
 * grid is far past this inside the first frames, long before the threshold.
 *
 * The distance has to be measured here because the browser's own answer is
 * too tight to use. The collection is the one long-press surface that lives
 * inside a page that scrolls (Minesweeper's board, the other one, does not),
 * and iOS WebKit hands a touch to its scroller — firing `pointercancel` — as
 * soon as it has travelled about ten pixels, whether or not the page then
 * scrolls at all. Ten pixels is less than a thumb drifts while holding still,
 * so a press that obeys that event dies for a reason the player cannot see:
 * measured in the iOS simulator, a hold drifting twelve pixels was cancelled
 * at 381ms, and the same hold drifting a little slower reached 450ms and
 * opened the sheet. That race is the "some tiles open the menu, some do
 * nothing" this screen was reported for — it is per press, not per game.
 */
export const GAME_MENU_MOVE_PX = 24;

/**
 * And how far the page may move under the finger in that time. The budget
 * above has to be generous enough to outlast iOS giving up on the pointer,
 * and generous enough leaves room for a genuine, very slow drag — measured on
 * an Android emulator, an inch-by-inch scroll of fifty-odd pixels over a
 * second and a bit was still inside it. The list moving is the thing that
 * says "this was a scroll" outright, so it ends the press on its own, with
 * only enough slack to absorb the first pixels a scroller takes for itself
 * when it decides the touch is its own.
 */
export const GAME_MENU_SCROLL_PX = 8;

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
 * What ends a press before the threshold is the finger *moving*: this is a
 * page that scrolls, so travel past `GAME_MENU_MOVE_PX`, or the list itself
 * sliding past `GAME_MENU_SCROLL_PX`, is somebody scrolling it — the second
 * because the first has to be loose enough to catch a slow drag that scrolls
 * without ever leaving the tile. A touch `pointercancel` is not that, whatever
 * it looks like — on iOS it arrives while the finger is still down and still
 * on the tile — so it is recorded rather than obeyed, and the touch stream
 * that keeps flowing past it
 * (`touchmove` right through to `touchend`, both watched below) is what
 * decides. A mouse or a pen has no such stream behind its cancel, so for those
 * a cancel still ends the press, as it always has (issue #120).
 *
 * What a cancel does mean, on any pointer, is that no click follows it — so a
 * sheet opened after one is told it did not open mid-press, and the guard in
 * `GameActionSheet` stays down instead of waiting to swallow a click that is
 * never coming.
 *
 * The press is armed from `touchstart` as well as `pointerdown`; for a finger
 * the first of the two to arrive wins. On iOS a tile past the first screen
 * can get its touch events without any `pointerdown` at all (the window
 * listener in `CollectionHomeScreen` is what normally prevents that, and
 * says why) — the touch stream is the one iOS always delivers, so it can
 * arm the press on its own. The mouse and the pen still have only
 * `pointerdown`.
 *
 * The click that ends an uncancelled long press is not suppressed here.
 * `GameActionSheet` swallows it, and it is the only place that can: by the
 * time that click is dispatched the sheet's full-screen backdrop is over this
 * button, so the click lands on the backdrop — never on the tile — and a guard
 * here would sit unreachable while the one case that matters went unhandled.
 */
function GameButton({ game, className, onOpen, onMenu, children }: GameButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  /** Where the press landed — the point every later position is measured from. */
  const originRef = useRef<{ x: number; y: number } | null>(null);
  /** Whether the browser has disowned this press, and with it the click. */
  const cancelledRef = useRef(false);
  /** The scroll watch belonging to the press in flight, while there is one. */
  const scrollWatchRef = useRef<(() => void) | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (scrollWatchRef.current !== null) {
      window.removeEventListener('scroll', scrollWatchRef.current, true);
      scrollWatchRef.current = null;
    }
  }, []);

  const clearIfTravelled = useCallback(
    (x: number, y: number) => {
      const origin = originRef.current;
      if (origin === null) return;
      if (Math.hypot(x - origin.x, y - origin.y) > GAME_MENU_MOVE_PX) clearTimer();
    },
    [clearTimer],
  );

  /** Start the press clock at a point; `x`/`y` are where the finger landed. */
  const arm = useCallback(
    (x: number, y: number) => {
      originRef.current = { x, y };
      cancelledRef.current = false;
      // The page itself is this screen's scroller, so its own offset is what
      // moves. Captured, because that event is dispatched at the document:
      // the window is on its way down to it either way, which a listener
      // waiting to be bubbled to is not.
      const from = window.scrollY;
      const watch = () => {
        if (Math.abs(window.scrollY - from) > GAME_MENU_SCROLL_PX) clearTimer();
      };
      scrollWatchRef.current = watch;
      window.addEventListener('scroll', watch, true);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onMenu(game, buttonRef.current, !cancelledRef.current);
      }, GAME_MENU_PRESS_MS);
    },
    [clearTimer, game, onMenu],
  );

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
        arm(event.clientX, event.clientY);
      }}
      // A finger's other way in. On a tile past the first screen iOS raises
      // no `pointerdown` at all (see above), so the touch arms the press when
      // nothing has; when both arrive, `pointerdown` comes first and this is
      // a no-op.
      onTouchStart={(event) => {
        if (timerRef.current !== null) return;
        const touch = event.touches[0];
        if (touch) arm(touch.clientX, touch.clientY);
      }}
      onPointerMove={(event) => clearIfTravelled(event.clientX, event.clientY)}
      // The same question asked of the touch stream, which outlives the
      // `pointercancel` that iOS raises partway through a hold.
      onTouchMove={(event) => {
        const touch = event.touches[0];
        if (touch) clearIfTravelled(touch.clientX, touch.clientY);
      }}
      onPointerUp={clearTimer}
      // A touch that ends after its own cancel raises no `pointerup`, so this
      // is what stands down a press the finger has already let go of.
      onTouchEnd={clearTimer}
      // The system taking the touch outright (a call, a system gesture) —
      // unlike `pointercancel`, this really is the end of it.
      onTouchCancel={clearTimer}
      onPointerLeave={(event) => {
        // A mouse leaving the button abandons the press. A touch raises this
        // only once the press is over or cancelled, and obeying it there would
        // undo everything above.
        if (event.pointerType !== 'touch') clearTimer();
      }}
      onPointerCancel={(event) => {
        cancelledRef.current = true;
        if (event.pointerType !== 'touch') clearTimer();
      }}
      onContextMenu={(event) => {
        // A right-click, and the keyboard's own menu key (Shift+F10): the
        // browser raises this same event for both, so the mouse route and one
        // keyboard route cost a few lines between them.
        event.preventDefault();
        // A press still armed here is the primary button raising the menu —
        // macOS ctrl+click — and, unlike a right-click, a click follows it
        // (the shape MinesBoard answers too). The sheet is told, so its guard
        // swallows that one click instead of letting it close the sheet the
        // instant it opens. A right-click and the menu key arm no press, and
        // the guard stays down for them (issue #120).
        const midPress = timerRef.current !== null;
        clearTimer();
        onMenu(game, buttonRef.current, midPress);
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

  /**
   * The search mode (issue #122): `null` while the home is the home, a string
   * — possibly empty — while the header is a field. One piece of state for
   * both the mode and the text, so leaving search always leaves an empty
   * field behind. Re-entering starts from nothing, which is the only shape a
   * feature that keeps no search history can have.
   */
  const [query, setQuery] = useState<string | null>(null);
  const searching = query !== null;
  const openSearch = useCallback(() => setQuery(''), []);
  const closeSearch = useCallback(() => setQuery(null), []);

  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchFieldRef = useRef<HTMLInputElement>(null);

  /**
   * Readable from the hardware-back listener below, which is registered once
   * and outlives every render that changes the query. Written during render
   * rather than in an effect, so the listener never answers with a mode the
   * screen has already left.
   */
  const searchingRef = useRef(searching);
  searchingRef.current = searching;
  /** The same, for the tile sheet: back closes it before it does anything else. */
  const menuOpenRef = useRef(menuGame !== null);
  menuOpenRef.current = menuGame !== null;

  /**
   * Focus follows the mode: into the field when it appears (which is also
   * what raises the on-screen keyboard for the tap that asked for it), and
   * back to the action that opened it when it goes. `returnFocus` is what
   * keeps the second half from firing on the first render, when nobody has
   * been anywhere yet and the focus belongs to the document.
   */
  const returnFocus = useRef(false);
  useEffect(() => {
    if (searching) {
      returnFocus.current = true;
      searchFieldRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      searchButtonRef.current?.focus();
    }
  }, [searching]);

  /**
   * Android's hardware back, for the collection itself. It lives here rather
   * than in the shell (App.tsx keeps exactly one owner per screen, and hands
   * this one over) because the answer depends on state only this screen has:
   * an open tile sheet closes (a dialog is what back closes first, on every
   * screen), searching closes the search, and the home — the root of the app
   * — is where back leaves it, exactly as it always has.
   *
   * The listener is registered once. It reads the mode through a ref instead
   * of closing over it, so a keystroke does not cost a deregister and a
   * re-register of an Android plugin listener.
   *
   * Not a doorway out of search: the browser's Back. Search is not in the
   * address (app/webRoute.ts carries games and nothing else), the same way
   * the settings screen is not — there, Back leaves the site, which is what
   * Back has always done on every screen that is not a game
   * (docs/WEB_VERSION.md「URL(ゲーム別の入口)」). Escape and the field's own
   * back arrow are the browser's ways out.
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('backButton', () => {
      if (menuOpenRef.current) setMenuGame(null);
      else if (searchingRef.current) closeSearch();
      else void CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
    });
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [closeSearch]);

  /**
   * A passive, do-nothing touch listener on the window for as long as this
   * screen is mounted. It changes nothing about what the page does with a
   * touch — it changes what iOS does with one before the page hears of it.
   *
   * WebKit on iOS decides per region whether a touch has listeners waiting
   * for it, and the region it draws for a listener is the box of the element
   * the listener hangs on. Every handler in this app hangs on React's root,
   * and `#root` is `height: 100%` — one viewport tall — with the collection
   * overflowing it. Measured on an iPhone 11 on iOS 26.6: a press on a tile
   * inside that first viewport-height of the document raised `pointerdown`
   * within about 16ms; a press on a tile below it never raised one (eighteen
   * presses at page-y ≤ 883 all had it, five at page-y ≥ 975 had none, on an
   * 896px viewport), and the touch events it did raise came late enough that
   * a 450ms hold counted from them felt like well over a second. That is the
   * "only the tiles on the first screen work" the bug was reported as — the
   * boundary moved with the favourites shelf, because the shelf is what
   * decides which tiles fit on the first screen. With one touch listener on
   * the window, whose region is the whole document, every press at every
   * scroll offset raised `pointerdown` in 12–19ms and the sheet opened at
   * 450ms (thirty-one presses, page-y up to 2724). The iOS 26.4 simulator
   * never dropped a `pointerdown`, so none of this shows there.
   *
   * Passive, so it can never be the reason a scroll waits on the page; and
   * only while the home is mounted, because it is the one screen whose
   * content reaches past the root's box. `GameButton` still arms from
   * `touchstart` when `pointerdown` does not come, for whatever WebKit does
   * next.
   */
  useEffect(() => {
    const listen = () => {};
    window.addEventListener('touchstart', listen, { capture: true, passive: true });
    return () => window.removeEventListener('touchstart', listen, { capture: true });
  }, []);

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

  /** The list the search mode shows: every game until something is typed. */
  const results = query === null ? null : searchGames(query);

  return (
    <div className="screen home-screen collection-screen">
      {/* Web build only — the shared PixApps header (docs/WEB_VERSION.md
          「サイトクローム」). Renders nothing on the native app, which has no
          site to return to. */}
      <WebChromeSlot />

      {/* One header, two shapes. Searching, it is the field and the way back
          out of it; otherwise it is the pair of actions that has always been
          there plus the one that opens the field. The settings gear keeps the
          far edge it has always had, so the new action arrives beside it
          rather than moving it. */}
      {query !== null ? (
        <header className="screen-header" role="search">
          <button type="button" className="icon-btn" aria-label={t('back')} onClick={closeSearch}>
            <IconBack />
          </button>
          {/*
            The app's only text field. It is `type="search"` for what that
            tells the platform (and its keyboard), but the browser's own
            decorations are reset in styles.css so it draws the same on every
            WebView; the way out is the arrow beside it, not a clear button
            inside it. Escape is the keyboard's version of that arrow — it is
            handled here rather than on the window so it can never reach past
            the field to something else that is listening (`GameActionSheet`
            closes on Escape too, and while it is open the focus is inside it).

            `autoCapitalize` and the rest are off because what goes in here is
            matched against a title, character for character, and a keyboard
            that helpfully capitalises or corrects the first word is a
            keyboard filling the field with something the player did not type.
          */}
          <input
            ref={searchFieldRef}
            type="search"
            className="game-search-field"
            value={query}
            placeholder={t('searchGames')}
            aria-label={t('searchGames')}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') closeSearch();
            }}
          />
        </header>
      ) : (
        <header className="screen-header">
          <span className="icon-btn-placeholder" />
          <div className="home-header-actions">
            <button
              ref={searchButtonRef}
              type="button"
              className="icon-btn"
              aria-label={t('searchGames')}
              onClick={openSearch}
            >
              <IconSearch />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label={t('settings')}
              onClick={onOpenSettings}
            >
              <IconGear />
            </button>
          </div>
        </header>
      )}

      {/* Searching replaces the body outright — hero, both shelves and the
          six sections — with one flat list of what matches. That is the
          "simplified categories" the mode is for: the same games in the same
          order, with the headings and the shortcuts taken away, because
          somebody who typed a name is not browsing shelves. The landmark
          keeps its name, so this is still the games list, filtered.

          With nothing typed it is every game, which is why opening search
          never shows an empty screen and clearing the field goes back to all
          thirty rather than to the empty state below. */}
      {results !== null ? (
        <nav className="game-sections" aria-label={t('gamesHeading')}>
          {results.length > 0 ? (
            <div className="game-grid">
              {results.map((game) => (
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
          ) : (
            /* One quiet line, and no suggestions, no "did you mean", no
               offer of something else to play. `role="status"` is what makes
               it reach a screen reader at all: nothing else about the page
               changes when the last match disappears. */
            <p className="game-search-empty" role="status">
              {t('searchNoResults')}
            </p>
          )}
        </nav>
      ) : (
        <>
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
        </>
      )}

      {/* Web build only — the home display unit (docs/ADS_POLICY.md「Web 版」).
          Renders nothing on the native app, whose only ad surface stays the
          anchored banner inside each game (BannerSlot). Kept outside the game
          list and far from anything tappable toward a game.

          Outside the search branch as well, and deliberately: unmounting the
          slot to open the search and mounting it again to close it would ask
          AdSense for a fresh impression every time somebody looked something
          up. The slot stays put and the results appear above it. */}
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
