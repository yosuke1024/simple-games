/**
 * A member's standing in a table, drawn once for two screens (club.md §9「Your
 * rankings」, 「Member」): the Club screen shows the viewer's own, the Member
 * screen shows another member's, and both are the same row in the same order
 * (the shelves': category, registry, the mode's place — never by rank, never by
 * recency) and filtered by the same rule (a game this device can open). Pure
 * drawing and ordering; the screens decide what a press does.
 */
import { availableGames } from '@/app/gameChannel';
import { GAME_CATEGORIES, type GameDefinition } from '@/app/registry';
import { GameTile } from '@/ui/components/GameTile';
import { IconChevronRight } from '@/ui/components/icons';
import type { RankingMine } from '../api/types';
import { axisGap, axisText, compareModes, rankingTitle, RankMark, type T } from './common';

/** A shelf game with its place in registry order. */
export type ShelfGames = Map<string, { game: GameDefinition; index: number }>;

/**
 * The games this device can open that have a table contract, in registry
 * order (app/gameChannel.ts: a web-beta title is not on the app's shelves, so
 * it is not on the Club's either).
 */
export function shelfGames(): ShelfGames {
  return new Map(
    availableGames()
      .filter((game) => game.challenge !== undefined)
      .map((game, index) => [game.id as string, { game, index }]),
  );
}

/**
 * The tables of games this device can open, in the shelves' order (club.md
 * §9): category, then registry, then the mode's place. A new array; the server's
 * order (the spelling of the keys) is left as it came.
 */
export function sortByShelf(rows: readonly RankingMine[], games: ShelfGames): RankingMine[] {
  const categoryOf = (gameId: string) => {
    const game = games.get(gameId)?.game;
    return game ? GAME_CATEGORIES.findIndex((c) => c.id === game.category) : -1;
  };
  return rows
    .filter((row) => games.has(row.gameId))
    .sort(
      (a, b) =>
        categoryOf(a.gameId) - categoryOf(b.gameId) ||
        games.get(a.gameId)!.index - games.get(b.gameId)!.index ||
        compareModes(a.gameId, a.paramsKey, b.paramsKey),
    );
}

/**
 * One table a member is in (club.md §9「Your rankings」): the game's tile, the
 * table's title, then on a second line that wraps on a narrow phone — the rank
 * (none below the server's counting ceiling), the table's size, the member's
 * best value and, unless they are first, how far the next rank is.
 */
export function StandingRow({
  row,
  game,
  t,
  onOpen,
}: {
  row: RankingMine;
  game: GameDefinition;
  t: T;
  onOpen: () => void;
}) {
  const title = rankingTitle(row.gameId, row.paramsKey, t);
  const rank = row.best.rank;
  const entries = t('clubEntries', { n: row.entryCount });
  const value = axisText(row.gameId, row.best.entry.facts, t);
  const gap = axisGap(row.gameId, row.best.entry.facts, row.best.nextValue, t);
  const toNext = gap === '' ? '' : t('clubToNext', { gap });
  const label = [title, rank === null ? '' : t('clubRank', { n: rank }), entries, value, toNext]
    .filter((part) => part !== '')
    .join(' · ');
  return (
    <button
      type="button"
      className="settings-row club-line club-mine"
      aria-label={label}
      onClick={onOpen}
    >
      <GameTile game={game} />
      <span className="club-mine-text">
        <span className="settings-row-label">{title}</span>
        <span className="club-mine-facts">
          <span className="club-mine-place">
            {/* The first three wear the table's disc; below them the rank is words like the rest. */}
            {rank !== null && rank <= 3 ? <RankMark rank={rank} t={t} /> : null}
            {rank !== null && rank > 3 ? `${t('clubRank', { n: rank })} · ${entries}` : entries}
          </span>
          {value ? <span className="club-mine-value">{value}</span> : null}
          {toNext ? <span>{toNext}</span> : null}
        </span>
      </span>
      <span className="settings-row-chevron" aria-hidden="true">
        <IconChevronRight />
      </span>
    </button>
  );
}
