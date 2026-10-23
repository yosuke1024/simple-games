import { useSettings } from '@/state/SettingsContext';
import { availableColours, COLOURS, region, SYMBOLS, type Session } from '../../game';
export function Board({
  session,
  onPlay,
}: {
  session: Session;
  onPlay: (colour: number) => void;
  hint: number | null;
}) {
  const { t } = useSettings();
  const connected = new Set(region(session.board, session.size));
  const available = availableColours(session.board, session.size);
  return (
    <>
      <div className="cf-board" role="table" aria-label={t('colorFloodBoard')}>
        {Array.from({ length: session.size }, (_, row) => (
          <div role="row" className="cf-row" key={row}>
            {session.board
              .slice(row * session.size, (row + 1) * session.size)
              .map((colour, col) => (
                <span
                  role="cell"
                  key={col}
                  className={`cf-tile cf-colour-${colour} ${connected.has(row * session.size + col) ? 'cf-connected' : ''} ${row === 0 && col === 0 ? 'cf-origin' : ''}`}
                  aria-label={t('colorFloodCell', {
                    row: row + 1,
                    col: col + 1,
                    symbol: SYMBOLS[colour]!,
                  })}
                >
                  <span aria-hidden="true">{SYMBOLS[colour]}</span>
                </span>
              ))}
          </div>
        ))}
      </div>
      <div className="cf-palette" role="group" aria-label={t('colorFloodChooseColour')}>
        {COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            className={`cf-colour-${colour} cf-paint`}
            disabled={!available.includes(colour)}
            aria-label={t('colorFloodColour', { number: colour + 1, symbol: SYMBOLS[colour] })}
            onClick={() => onPlay(colour)}
            onKeyDown={(event) => {
              if (event.repeat && (event.key === 'Enter' || event.key === ' '))
                event.preventDefault();
            }}
          >
            <span aria-hidden="true">{SYMBOLS[colour]}</span>
            <small aria-hidden="true">{colour + 1}</small>
          </button>
        ))}
      </div>
    </>
  );
}
