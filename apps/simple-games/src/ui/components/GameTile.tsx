/**
 * A title's mark: its glyph on its own accent tile.
 *
 * The tile carries the title's accent by class, which `ui/styles.css` maps to
 * the same tokens `:root[data-game='…']` sets while that game is mounted —
 * one set of accent values, used in both places. Number Match needs no class:
 * its accent is the series default, which is what the shell is already painted
 * with (docs/ARCHITECTURE.md「タイトルごとのアクセント色」).
 *
 * Shared rather than local because the sheet a long press opens draws the same
 * mark as the home it was opened from (issue #109). The Favorites picker in
 * Settings deliberately does not — see `.favorite-pick` in ui/styles.css.
 */
import type { GameDefinition } from '../../app/registry';

export function GameTile({ game }: { game: GameDefinition }) {
  return (
    <span className={`game-tile accent-${game.id}`} aria-hidden="true">
      {game.glyph}
    </span>
  );
}
