import { useSettings } from '@/state/SettingsContext';
import { availableColours, COLOURS, region, SYMBOLS, type Session } from '../../game';
import { ColourMark } from './ColourMark';
export function Board({ session, onPlay }: { session: Session; onPlay: (colour: number) => void }) {
  const { t } = useSettings();
  const connected = new Set(region(session.board, session.size));
  const available = availableColours(session.board, session.size);
  return (
    <>
      <div className="cf-board-frame">
        <div className="cf-board" role="table" aria-label={t('colorFloodBoard')}>
          {Array.from({ length: session.size }, (_, row) => (
            <div role="row" className="cf-row" key={row}>
              {session.board
                .slice(row * session.size, (row + 1) * session.size)
                .map((colour, col) => {
                  const index = row * session.size + col;
                  const inRegion = connected.has(index);
                  const edges = inRegion
                    ? [
                        row === 0 || !connected.has(index - session.size) ? 'cf-edge-top' : '',
                        row === session.size - 1 || !connected.has(index + session.size)
                          ? 'cf-edge-bottom'
                          : '',
                        col === 0 || !connected.has(index - 1) ? 'cf-edge-left' : '',
                        col === session.size - 1 || !connected.has(index + 1)
                          ? 'cf-edge-right'
                          : '',
                      ].join(' ')
                    : '';
                  return (
                    <span
                      role="cell"
                      key={col}
                      className={`cf-tile cf-colour-${colour} ${inRegion ? 'cf-connected' : ''} ${edges} ${index === 0 ? 'cf-origin' : ''}`}
                      aria-label={t('colorFloodCell', {
                        row: row + 1,
                        col: col + 1,
                        symbol: SYMBOLS[colour]!,
                      })}
                    >
                      <ColourMark colour={colour} />
                    </span>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
      <p className="cf-palette-label">{t('colorFloodChooseColour')}</p>
      <div className="cf-palette" role="group" aria-label={t('colorFloodChooseColour')}>
        {COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            className={`cf-colour-${colour} cf-paint ${colour === session.board[0] ? 'cf-current' : ''}`}
            disabled={!available.includes(colour)}
            aria-label={t('colorFloodColour', { number: colour + 1, symbol: SYMBOLS[colour] })}
            onClick={() => onPlay(colour)}
            onKeyDown={(event) => {
              if (event.repeat && (event.key === 'Enter' || event.key === ' '))
                event.preventDefault();
            }}
          >
            <ColourMark colour={colour} />
            <small aria-hidden="true">{colour + 1}</small>
          </button>
        ))}
      </div>
    </>
  );
}
