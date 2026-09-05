/**
 * The shell's own controls in a game home's header, opposite the back
 * button: "Add to Home Screen" (Android only, issue #110) and the favourite
 * star (issue #109). One component rather than two tags in every game, so
 * the header keeps exactly two children — the back button and this group —
 * and `.screen-header`'s space-between layout never has a third thing to
 * spread. A game passes its `gameId` and nothing else; which of these exist
 * on a given platform is the shell's business.
 *
 * The direction is the one every shared control in a game takes (docs/
 * ARCHITECTURE.md「レイヤー規則」): the game reaches into `ui/components/` and
 * names itself. `homeActionsWiring` in src/test/ checks every game home
 * carries this once, with its own id, and nowhere else.
 */
import type { GameId } from '../../app/registry';
import { FavoriteAction } from './FavoriteAction';
import { HomeShortcutAction } from './HomeShortcutAction';

export interface GameHomeActionsProps {
  /** The game this header belongs to. It names itself; nothing infers it. */
  gameId: GameId;
}

export function GameHomeActions({ gameId }: GameHomeActionsProps) {
  return (
    <span className="home-header-actions">
      <HomeShortcutAction gameId={gameId} />
      <FavoriteAction gameId={gameId} />
    </span>
  );
}
