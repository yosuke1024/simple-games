/**
 * The three Quick Rules pictures (docs/GEM_SWAP_RULES.md §8), drawn with the
 * board's own gems (GemIcon) and its own bar (SwapsBar), so what they show is
 * what the game shows. Each is a small window of a board the rules allow —
 * no run on a settled board, and a swap that makes exactly the run shown.
 * No translatable text is drawn: the picture's meaning is its alt text.
 */
import { GemIcon } from './GemIcon';
import { SwapsBar } from './SwapsBar';

export type FigureKind = 'swap' | 'clear' | 'round';

const COLS = 4;

/** Two neighbours about to trade places: the swap lines up three hexagons in row 2. */
const SWAP_ROWS: readonly (readonly number[])[] = [
  [1, 3, 0, 2],
  [0, 0, 4, 2],
  [3, 1, 2, 4],
];

/** Row 2's three hexagons have cleared; the gems above fall, new ones arrive at the top. */
const CLEAR_ROWS: readonly (readonly (number | null)[])[] = [
  [2, 4, 1, 3],
  [null, null, null, 2],
  [3, 1, 2, 4],
];

function Grid({
  rows,
  marked,
  arriving,
}: {
  rows: readonly (readonly (number | null)[])[];
  marked?: ReadonlySet<string>;
  arriving?: ReadonlySet<string>;
}) {
  return (
    <div className="gs-fig-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
      {rows.map((row, r) =>
        row.map((kind, c) => {
          const at = `${r},${c}`;
          return (
            <span
              key={at}
              className={[
                'gs-fig-cell',
                kind === null ? 'gs-fig-cell-empty' : '',
                marked?.has(at) ? 'gs-fig-cell-marked' : '',
                arriving?.has(at) ? 'gs-fig-cell-arriving' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {kind === null ? null : <GemIcon kind={kind} />}
            </span>
          );
        }),
      )}
    </div>
  );
}

/** Arrows over a grid, in cell units (column, row). */
function Arrows({ lines, rows }: { lines: readonly (readonly number[])[]; rows: number }) {
  return (
    <svg
      className="gs-fig-arrows"
      viewBox={`0 0 ${COLS} ${rows}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
      ))}
    </svg>
  );
}

export function TutorialFigure({ kind }: { kind: FigureKind }) {
  if (kind === 'round') {
    return (
      <div className="gs-fig gs-fig-round">
        <span className="gs-fig-score">42</span>
        <SwapsBar left={18} className="gs-fig-bar" />
      </div>
    );
  }
  if (kind === 'swap') {
    return (
      <div className="gs-fig">
        <Grid rows={SWAP_ROWS} marked={new Set(['0,2', '1,2'])} />
        {/* Up and down between the two marked cells of column 3. */}
        <Arrows
          rows={SWAP_ROWS.length}
          lines={[
            [2.5, 0.78, 2.5, 1.22],
            [2.42, 0.86, 2.5, 0.78],
            [2.58, 0.86, 2.5, 0.78],
            [2.42, 1.14, 2.5, 1.22],
            [2.58, 1.14, 2.5, 1.22],
          ]}
        />
      </div>
    );
  }
  return (
    <div className="gs-fig">
      <Grid rows={CLEAR_ROWS} arriving={new Set(['0,0', '0,1', '0,2'])} />
      {/* Each of the three columns falls by one. */}
      <Arrows
        rows={CLEAR_ROWS.length}
        lines={[0.5, 1.5, 2.5].flatMap((x) => [
          [x, 0.82, x, 1.5],
          [x - 0.1, 1.38, x, 1.5],
          [x + 0.1, 1.38, x, 1.5],
        ])}
      />
    </div>
  );
}
