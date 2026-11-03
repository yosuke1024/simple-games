import { useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { capacity, COLS, ROWS, type Cell } from '../../game';
export function Orbs({ cell, limit }: { cell: Cell; limit: number }) {
  return (
    <span className={'ct-orbs ct-owner-' + cell.owner} aria-hidden="true">
      <span className="ct-pieces">
        {Array.from({ length: Math.min(cell.count, 6) }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <span className="ct-capacity">
        {Array.from({ length: limit }, (_, i) => (
          <b key={i} className={i < cell.count ? 'is-full' : ''} />
        ))}
      </span>
    </span>
  );
}
export function Board({
  board,
  blocked,
  onPlay,
  lastCell,
}: {
  board: Cell[];
  blocked: boolean;
  onPlay: (cell: number) => void;
  lastCell: number | null;
}) {
  const { t } = useSettings();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focus, setFocus] = useState(0);
  return (
    <div
      className="ct-board"
      role="group"
      aria-label={t('chainTerritoryField')}
      onKeyDown={(e) => {
        if (
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey
        )
          return;
        e.preventDefault();
        const x = focus % COLS,
          y = Math.floor(focus / COLS);
        const nx = Math.max(
          0,
          Math.min(COLS - 1, x + (e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0)),
        );
        const ny = Math.max(
          0,
          Math.min(ROWS - 1, y + (e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0)),
        );
        const next = ny * COLS + nx;
        setFocus(next);
        refs.current[next]?.focus();
      }}
    >
      {board.map((cell, i) => (
        <button
          key={i}
          type="button"
          ref={(el) => {
            refs.current[i] = el;
          }}
          tabIndex={focus === i ? 0 : -1}
          onFocus={() => setFocus(i)}
          className={
            'ct-cell ' + (lastCell === i ? 'ct-last ' : '') + (cell.owner === 1 ? 'ct-yours' : '')
          }
          aria-disabled={blocked || cell.owner === 2}
          aria-label={t('chainTerritoryCell', {
            row: Math.floor(i / COLS) + 1,
            col: (i % COLS) + 1,
            owner: t(
              cell.owner === 1
                ? 'chainTerritoryYou'
                : cell.owner === 2
                  ? 'chainTerritoryCpu'
                  : 'chainTerritoryEmpty',
            ),
            n: cell.count,
            max: capacity(i),
          })}
          onClick={() => {
            if (!blocked && cell.owner !== 2) onPlay(i);
          }}
        >
          <Orbs cell={cell} limit={capacity(i)} />
        </button>
      ))}
    </div>
  );
}
