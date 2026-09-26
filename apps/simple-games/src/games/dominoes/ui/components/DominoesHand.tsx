/**
 * The player's hand (docs/DOMINOES_RULES.md §3, §11): a wrapping row of tile
 * buttons, each standing upright the way a hand is held. Only a tile that
 * fits an open end is enabled on the player's turn — the rules made visible,
 * not a hint about which to play. A tile that fits both ends (and they
 * differ) is a toggle: the first tap lifts it and turns the line's ends into
 * buttons, a second tap puts it back.
 *
 * Between turns every tile is disabled but not dimmed: the hand is not
 * "unavailable", it is simply not the player's move, and fading all of it in
 * and out on every CPU beat would be noise.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { legalEnds, needsEndChoice, sameTile, tileId, type Line, type Tile } from '../../game';
import { TileFace } from './TileFace';

export interface DominoesHandProps {
  hand: readonly Tile[];
  line: Line;
  /** The player's action, and nothing in the way of it. */
  active: boolean;
  selected: Tile | null;
  onTile: (tile: Tile) => void;
}

export const DominoesHand = memo(function DominoesHand({
  hand,
  line,
  active,
  selected,
  onTile,
}: DominoesHandProps) {
  const { t } = useSettings();
  return (
    <div className="dm-hand" role="group" aria-label={t('dominoesHandLabel')}>
      {hand.map((tile) => {
        const fits = legalEnds(line, tile).length > 0;
        const isSelected = selected !== null && sameTile(selected, tile);
        return (
          <button
            key={tileId(tile)}
            type="button"
            className={[
              'dm-hand-tile',
              active && !fits ? 'dm-hand-tile-off' : '',
              isSelected ? 'dm-hand-tile-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={t('dominoesTileLabel', { a: tile[0], b: tile[1] })}
            aria-pressed={needsEndChoice(line, tile) ? isSelected : undefined}
            disabled={!active || !fits}
            onClick={() => onTile(tile)}
          >
            <TileFace first={tile[0]} second={tile[1]} upright />
          </button>
        );
      })}
    </div>
  );
});
