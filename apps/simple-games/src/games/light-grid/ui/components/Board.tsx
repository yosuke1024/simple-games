import { useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { neighbours, type Session } from '../../game';
import { LightSymbol } from './LightSymbol';
export function Board({
  session,
  onPlay,
  hint,
}: {
  session: Session;
  onPlay: (index: number) => void;
  hint: number | null;
}) {
  const { t } = useSettings();
  const [focused, setFocused] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const active = Math.min(focused, session.board.length - 1);
  const affected = hint === null ? [] : neighbours(session.size, hint);
  return (
    <div className="lg-board-frame">
      <div
        className="lg-column-labels"
        aria-hidden="true"
        style={{ gridTemplateColumns: `repeat(${session.size}, 1fr)` }}
      >
        {Array.from({ length: session.size }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <div
        className="lg-row-labels"
        aria-hidden="true"
        style={{ gridTemplateRows: `repeat(${session.size}, 1fr)` }}
      >
        {Array.from({ length: session.size }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
      <div
        className="lg-board"
        role="group"
        aria-label={t('lightGridBoard')}
        style={{ gridTemplateColumns: `repeat(${session.size}, 1fr)` }}
      >
        {session.board.map((on, index) => (
          <button
            key={index}
            type="button"
            className={`lg-cell ${on ? 'lg-lit' : 'lg-dark'} ${hint === index ? 'lg-hinted' : ''} ${affected.includes(index) ? 'lg-affected' : ''}`}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            tabIndex={index === active ? 0 : -1}
            aria-pressed={Boolean(on)}
            aria-label={t('lightGridCell', {
              row: Math.floor(index / session.size) + 1,
              col: (index % session.size) + 1,
              state: `${t(on ? 'lightGridOn' : 'lightGridOff')}${hint === index ? `, ${t('hint')}` : affected.includes(index) ? `, ${t('lightGridHintAffected')}` : ''}`,
            })}
            aria-describedby={hint === index ? 'lg-hint-instruction' : undefined}
            onFocus={() => setFocused(index)}
            onClick={() => onPlay(index)}
            onKeyDown={(event) => {
              if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                return;
              }
              if (event.altKey || event.ctrlKey || event.metaKey) return;
              let next = index;
              if (event.key === 'ArrowLeft' && index % session.size > 0) next--;
              else if (event.key === 'ArrowRight' && index % session.size < session.size - 1)
                next++;
              else if (event.key === 'ArrowUp' && index >= session.size) next -= session.size;
              else if (event.key === 'ArrowDown' && index < session.size * (session.size - 1))
                next += session.size;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = session.board.length - 1;
              else if (!event.key.startsWith('Arrow')) return;
              event.preventDefault();
              buttons.current[next]?.focus();
            }}
          >
            <LightSymbol on={Boolean(on)} />
            {hint === index ? (
              <span className="lg-hint-marker" aria-hidden="true">
                1
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
