/**
 * The mahjong board (docs/MAHJONG_SOLITAIRE_RULES.md §1, §2, §3, §12).
 *
 * One button per remaining tile, each carrying its face and whether it can
 * be taken in its label, so a screen reader can read the board rather than a
 * wall of "button". Layers are drawn by data order (z, then y, then x — the
 * layout data is stored in paint order), lifted up-left per layer with a
 * deeper shadow, which is what makes five decks legible at 37px tiles (§12,
 * measured on the static mock).
 *
 * Tapping a blocked tile does nothing and scolds nobody (§3): no sound, no
 * shake. Selection is the caller's business — this component only reports
 * taps.
 */
import { memo, type CSSProperties } from 'react';
import type { MessageKey, TranslateVars } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import {
  currentFreeTiles,
  remainingCount,
  removedFlags,
  type MahjongSession,
  type TileFace,
} from '../../game';
import { TileFaceSvg } from './TileFaceSvg';

export interface MahjongBoardProps {
  session: MahjongSession;
  selected: number | null;
  /** The pair the last hint pointed at, or null (§8). */
  hintPair: readonly [number, number] | null;
  onTileTap: (index: number) => void;
}

type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/** The face name a screen reader hears (§12). Static keys, no composition. */
export function faceLabel(t: Translate, face: TileFace): string {
  const n = Number(face.slice(1));
  switch (face[0]) {
    case 'c':
      return t('mahjongFaceCharacters', { n });
    case 'o':
      return t('mahjongFaceDots', { n });
    case 'b':
      return t('mahjongFaceBamboo', { n });
    case 'f':
      return t('mahjongFaceFlower', { n });
    case 's':
      return t('mahjongFaceSeason', { n });
    default:
      break;
  }
  switch (face) {
    case 'we':
      return t('mahjongFaceEast');
    case 'ws':
      return t('mahjongFaceSouth');
    case 'ww':
      return t('mahjongFaceWest');
    case 'wn':
      return t('mahjongFaceNorth');
    case 'dr':
      return t('mahjongFaceDragonRed');
    case 'dg':
      return t('mahjongFaceDragonGreen');
    default:
      return t('mahjongFaceDragonWhite');
  }
}

export const MahjongBoard = memo(function MahjongBoard({
  session,
  selected,
  hintPair,
  onTileTap,
}: MahjongBoardProps) {
  const { t } = useSettings();
  const { layout } = session;
  const removed = removedFlags(session);
  const free = new Set(currentFreeTiles(session));

  const cols = (Math.max(...layout.tiles.map((tile) => tile.x)) + 2) / 2;
  const rows = (Math.max(...layout.tiles.map((tile) => tile.y)) + 2) / 2;

  return (
    <div
      className="mj-board"
      role="group"
      aria-label={t('mahjongBoardLabel', { n: remainingCount(session) })}
      style={{ '--mj-cols': cols, '--mj-rows': rows } as CSSProperties}
    >
      {layout.tiles.map((tile, index) => {
        if (removed[index]) return null;
        const face = session.faces[index]!;
        const name = faceLabel(t, face);
        const label =
          selected === index
            ? t('mahjongTileSelected', { tile: name })
            : free.has(index)
              ? t('mahjongTileFree', { tile: name })
              : t('mahjongTileBlocked', { tile: name });
        const classes = [
          'mj-tile',
          `mj-z${tile.z}`,
          selected === index ? 'mj-selected' : '',
          hintPair && (hintPair[0] === index || hintPair[1] === index) ? 'mj-hint' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={index}
            type="button"
            className={classes}
            aria-label={label}
            aria-pressed={selected === index}
            style={{ '--mj-x': tile.x, '--mj-y': tile.y, '--mj-z': tile.z } as CSSProperties}
            onClick={() => onTileTap(index)}
          >
            <span className="mj-tile-body" aria-hidden="true" />
            <TileFaceSvg face={face} />
          </button>
        );
      })}
    </div>
  );
});
