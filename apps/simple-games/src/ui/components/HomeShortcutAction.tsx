/**
 * "Add to Home Screen" in a game's own header, beside the favourite star
 * (issue #110) — Android only, and only where the launcher takes pin
 * requests (`homeShortcutsAvailable`, settled once at boot). Everywhere else
 * this renders nothing, and the header is exactly what it was before.
 *
 * Why here as well as in the collection's tile sheet: the same reason the
 * star is here (FavoriteAction.tsx). The moment somebody wants a door straight
 * to this game is the moment they are standing in it, not later, back on the
 * list, remembering which tile to press and hold. The sheet is the shortcut
 * for somebody who already knows; this is the one that gets noticed.
 *
 * Same contract as the sheet's action (services/homeShortcut/homeShortcut.ts):
 * the OS shows its own confirmation and never reports back, nothing is shown
 * for any ending, and favourites are untouched. There is no "already added"
 * state to draw, because no launcher will tell us — and a launcher that
 * removed the icon may not have unpinned it, so guessing would hide the door
 * exactly when it is wanted back.
 *
 * On the game's HOME only, like the star (`homeActionsWiring` in src/test/).
 */
import { GAMES, type GameId } from '../../app/registry';
import {
  homeShortcutsAvailable,
  requestHomeShortcut,
} from '../../services/homeShortcut/homeShortcut';
import { useSettings } from '../../state/SettingsContext';
import { IconAddToHome } from './icons';

export interface HomeShortcutActionProps {
  /** The game this header belongs to. It names itself; nothing infers it. */
  gameId: GameId;
}

export function HomeShortcutAction({ gameId }: HomeShortcutActionProps) {
  const { t } = useSettings();
  if (!homeShortcutsAvailable()) return null;
  const game = GAMES.find((entry) => entry.id === gameId);
  if (!game) return null;

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={t('addToHomeScreen')}
      onClick={() => {
        void requestHomeShortcut(game);
      }}
    >
      <IconAddToHome />
    </button>
  );
}
