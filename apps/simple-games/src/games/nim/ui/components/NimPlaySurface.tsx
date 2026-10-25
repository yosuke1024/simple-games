import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconUndo } from '@/ui/components/icons';
import type { Move } from '../../game';

export interface NimPlaySurfaceProps {
  heaps: readonly number[];
  last: Move | null;
  positionKey: string | number;
  blocked: boolean;
  onTake: (move: Move) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  paused?: boolean;
  onResume?: () => void;
}
/** Shared selection, count preview and confirmation for CPU and Nearby games. */
export function NimPlaySurface({
  heaps,
  last,
  positionKey,
  blocked,
  onTake,
  onUndo,
  canUndo,
  paused,
  onResume,
}: NimPlaySurfaceProps) {
  const { t } = useSettings();
  const [row, setRow] = useState<number | null>(null);
  const [count, setCount] = useState(1);
  useEffect(() => {
    setRow(null);
    setCount(1);
  }, [positionKey, blocked]);
  const take = () => {
    if (blocked || row === null) return;
    onTake({ row, count });
    setRow(null);
  };
  return (
    <>
      <div className="nim-heaps" aria-label={t('nimName')}>
        {heaps.map((stones, index) => (
          <button
            type="button"
            key={index}
            className={`nim-heap ${row === index ? 'nim-selected' : ''}`}
            disabled={blocked || !stones}
            aria-pressed={row === index}
            aria-label={t('nimRow', { row: index + 1, count: stones })}
            onClick={() => {
              setRow(index);
              setCount(1);
            }}
          >
            <span className="nim-row-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="nim-stones" aria-hidden="true">
              {stones ? (
                Array.from({ length: stones }, (_, i) => (
                  <span
                    key={i}
                    className={`nim-stone ${row === index && i >= stones - count ? 'nim-remove' : ''}`}
                  />
                ))
              ) : (
                <span className="nim-empty">—</span>
              )}
            </span>
            <span className="nim-total" aria-hidden="true">
              {stones}
            </span>
          </button>
        ))}
      </div>
      <p className="nim-last" aria-live="polite">
        {last ? t('nimLastMove', { row: last.row + 1, count: last.count }) : t('nimGoal')}
      </p>
      <div className="nim-controls">
        <div className="nim-control-heading">
          <p className="nim-instruction">
            {row === null ? t('nimChooseRow') : t('nimChooseCount')}
          </p>
          <output className="nim-preview" aria-live="polite">
            {row === null ? '—' : `${heaps[row]} − ${count} = ${heaps[row]! - count}`}
          </output>
        </div>
        <div className="nim-counts" role="group" aria-label={t('nimChooseCount')}>
          {Array.from({ length: 8 }, (_, i) => (
            <button
              type="button"
              key={i}
              disabled={blocked || row === null || i >= heaps[row]!}
              className={`nim-count ${row !== null && count === i + 1 ? 'nim-count-selected' : ''}`}
              aria-pressed={row !== null && count === i + 1}
              onClick={() => setCount(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="nim-actions">
          {onUndo && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canUndo}
              onClick={onUndo}
            >
              <IconUndo />
              {t('undo')}
            </button>
          )}
          {paused ? (
            <button type="button" className="btn btn-primary" onClick={onResume}>
              {t('resume')}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={blocked || row === null}
              onClick={take}
            >
              {t('nimTake', { count })}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
