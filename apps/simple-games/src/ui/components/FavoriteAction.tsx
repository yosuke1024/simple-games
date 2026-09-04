/**
 * The star in a game's own header: pin this game to the top of the collection,
 * or unpin it (issue #109).
 *
 * Why here as well as on the collection home. The moment somebody decides a
 * game is one of theirs is the moment they are looking at it — not later, back
 * on the list, remembering which tile to press and hold. The home's long press
 * is the shortcut for somebody who already knows; this is the one that gets
 * noticed.
 *
 * The direction is the same as `ShareAction` and `WebChromeSlot`: the game
 * reaches into `ui/components/` and names itself, and the shell stays ignorant
 * of what is inside a game (docs/ARCHITECTURE.md「レイヤー規則」). It goes in
 * the empty slot every game home already keeps opposite its back button, so no
 * game's header changes shape — the balance that was drawn by a placeholder is
 * now drawn by a control.
 *
 * On the game's HOME only, never on a board or a result: pinning is a decision
 * about the collection, and the board is where the game is (`favoriteWiring`
 * in src/test/ enforces both halves).
 */
import { useState } from 'react';
import { getFavoriteGames, toggleFavoriteGame } from '../../app/favoriteGames';
import type { GameId } from '../../app/registry';
import { useSettings } from '../../state/SettingsContext';
import { IconStar } from './icons';

export interface FavoriteActionProps {
  /** The game this header belongs to. It names itself; nothing infers it. */
  gameId: GameId;
}

export function FavoriteAction({ gameId }: FavoriteActionProps) {
  const { t } = useSettings();
  // Read once, then owned here: nothing else can change the shelf while a game
  // is on screen, and the collection home re-reads the module when it mounts.
  const [isFavorite, setIsFavorite] = useState(() => getFavoriteGames().includes(gameId));

  return (
    <button
      type="button"
      className={`icon-btn ${isFavorite ? 'favorite-btn-on' : ''}`}
      /**
       * The label says what pressing does, and carries the state by saying it:
       * "Remove from Favorites" can only be offered for a game that is pinned.
       * No `aria-pressed` beside it — the pair would be read out twice, once as
       * an instruction and once as a state. The Settings picker does use
       * `aria-pressed`, because there the label has to name the game instead.
       */
      aria-label={isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
      onClick={() => setIsFavorite(toggleFavoriteGame(gameId).includes(gameId))}
    >
      <IconStar filled={isFavorite} />
    </button>
  );
}
