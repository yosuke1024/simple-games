/**
 * The BETA mark on a title card (collection home: shelves, rows and sections)
 * for a title on the browser's early-release channel (docs/WEB_VERSION.md
 * 「先行公開(ベータ)」, issue #194). It is part of the button's accessible name
 * on purpose — "Crown Grid BETA" is what the card says — and the space before
 * it is a real text node, so the name reads as two words and not one. Nothing
 * for a released title, so the thirty shipped cards are byte-for-byte what
 * they were.
 *
 * Its own module, apart from `WebBetaNotice`, for the bundle's sake: this is
 * the half the collection home (the entry chunk) needs, and it reads only the
 * definition it is handed. The notice a game's home renders is the half that
 * looks the game up in the registry, and keeping that out of the entry's
 * imports is what leaves the chunk graph exactly as it was before the channel
 * existed (scripts/bundle-size.mjs measures the entry by that graph).
 */
import type { GameDefinition } from '../../app/registry';

/** The badge text is a proper mark, not a word — the same in every locale. */
export const BETA_BADGE = 'BETA';

export function GameBetaBadge({ game }: { game: GameDefinition }) {
  if (game.channel !== 'web-beta') return null;
  return (
    <>
      {' '}
      <span className="beta-badge">{BETA_BADGE}</span>
    </>
  );
}
