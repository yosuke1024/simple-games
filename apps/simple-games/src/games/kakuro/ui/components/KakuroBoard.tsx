/**
 * The Kakuro board (docs/KAKURO_RULES.md §1, §4, §5, §6, §13).
 *
 * THE CLUE SQUARES ARE TEXT. Each sum is a real element holding real ASCII
 * digits, and each clue square carries a label that says the sums IN WORDS —
 * "Right, sum 16 across 2 cells. Down, sum 7 across 3 cells". Drawn as a
 * decoration and hidden from assistive technology, this board would be an
 * empty grid: a Kakuro hands the player no digits at all, so the clues are not
 * an aid to the puzzle, they ARE the puzzle (§1, §13). Naming the shape
 * instead ("sigma", "slash") would leave a listener with no way to tell which
 * of the two sums runs right and which runs down, and that is the only thing
 * the square says.
 *
 * A clue square is not a <button>. It is not somewhere a digit goes (§4), so
 * "not tappable" is a fact about the markup rather than a rule some handler
 * has to remember — and it has no pressed look either (§13). It stays in the
 * reading, which is the half of §13 that "not tappable" must not cost.
 *
 * Every white square repeats both of its runs' sums (§13). It reads long, and
 * that is the trade the rules make on purpose: here the clue lives OUTSIDE the
 * square being filled, so a listener not told it here has to travel to the
 * clue square and back for every square they fill. **Moves cost more than
 * words.**
 *
 * Violations show all the time (§5), and they are a statement about the rules,
 * never a comparison against the hidden answer: a digit that is legal but not
 * final is told nothing, because nothing is wrong with it yet. Marking a digit
 * that disagrees with the answer is the separate, optional half of §5, and
 * arrives here as `highlightMistakes`.
 */
import { memo, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  EMPTY,
  cluesOf,
  colOf,
  hasBit,
  isWhite,
  mistakesOf,
  rowOf,
  runsAt,
  violationsOf,
  type Hint,
  type KakuroSession,
} from '../../game';

export interface KakuroBoardProps {
  session: KakuroSession;
  selected: number | null;
  /** The last hint: a settled square with its proof, or a break (§6). */
  hint: Hint | null;
  /** Whether a digit that disagrees with the answer is marked (§5, setting). */
  highlightMistakes: boolean;
  onCellTap: (index: number) => void;
}

const NO_CELLS: ReadonlySet<number> = new Set();

export const KakuroBoard = memo(function KakuroBoard({
  session,
  selected,
  hint,
  highlightMistakes,
  onCellTap,
}: KakuroBoardProps) {
  const { t } = useSettings();
  const { size, layout, board, table } = session;
  const clues = cluesOf(session);
  const violations = violationsOf(session);
  const mistakes = highlightMistakes ? mistakesOf(session) : NO_CELLS;

  // Which run each clue square carries, by direction. `cluesOf` says what a
  // square has to draw; this says which run the number names, so the same
  // square can also report the run's length, its break and its highlight —
  // all four read off the one run table, so they cannot disagree.
  interface Carried {
    readonly right: number | null;
    readonly down: number | null;
  }
  const NEITHER: Carried = { right: null, down: null };
  const carriedRuns = new Map<number, Carried>();
  table.runs.forEach((run, position) => {
    const held = carriedRuns.get(run.clue) ?? NEITHER;
    carriedRuns.set(
      run.clue,
      run.axis === 'row' ? { ...held, right: position } : { ...held, down: position },
    );
  });
  const carriedBy = (index: number): Carried => carriedRuns.get(index) ?? NEITHER;

  /** A clue square whose run is broken tints with its digits (§5, §13). */
  const clueIsBroken = (index: number): boolean => {
    const held = carriedBy(index);
    return (
      (held.right !== null && violations.runs.has(held.right)) ||
      (held.down !== null && violations.runs.has(held.down))
    );
  };

  // The two runs of the selected square, and everything they touch (§4).
  const activeRuns = selected === null ? [] : runsAt(session, selected);
  const runCells = new Set<number>();
  const activeClues = new Set<number>();
  for (const position of activeRuns) {
    const run = table.runs[position]!;
    for (const cell of run.cells) runCells.add(cell);
    activeClues.add(run.clue);
  }

  // What the hint points at: the squares it settles (or the break it found),
  // the written digits that carry the proof, and the runs they were read off.
  // A break outranks a deduction, so it is drawn in the warn colour.
  const broken = hint?.kind === 'violation';
  const targets = new Set<number>(
    hint === null
      ? []
      : hint.kind === 'violation'
        ? hint.cells
        : hint.step.kind === 'placement'
          ? [hint.step.index]
          : hint.step.eliminations.map((elimination) => elimination.index),
  );
  const support = new Set<number>(hint?.kind === 'step' ? hint.step.support : []);
  const hintRuns = hint === null ? [] : hint.kind === 'violation' ? hint.runs : hint.step.runs;
  const reason = new Set<number>();
  const hintClues = new Set<number>();
  for (const position of hintRuns) {
    const run = table.runs[position];
    if (!run) continue;
    for (const cell of run.cells) reason.add(cell);
    hintClues.add(run.clue);
  }

  /** One run as a sentence: the direction first, then the sum, then how far. */
  const runWords = (position: number): string => {
    const run = table.runs[position]!;
    return run.axis === 'row'
      ? t('kakuroClueRight', { sum: run.sum, n: run.cells.length })
      : t('kakuroClueDown', { sum: run.sum, n: run.cells.length });
  };

  return (
    <div
      className="kakuro-board"
      role="group"
      aria-label={t('kakuroBoardLabel', { size })}
      style={{ '--kakuro-size': size } as CSSProperties}
    >
      {layout.cells.map((_kind, index) => {
        const row = rowOf(index, size) + 1;
        const col = colOf(index, size) + 1;

        if (!isWhite(layout, index)) {
          const clue = clues[index] ?? NEITHER;
          const held = carriedBy(index);
          const carries = clue.right !== null || clue.down !== null;
          const spoken = carries ? [t('kakuroClueCell', { row, col })] : [];
          if (held.right !== null) spoken.push(runWords(held.right));
          if (held.down !== null) spoken.push(runWords(held.down));
          const isClueBroken = clueIsBroken(index);
          const classes = [
            'kakuro-clue',
            clue.right !== null && clue.down !== null ? 'kakuro-clue-split' : '',
            isClueBroken ? 'kakuro-clue-broken' : '',
            !isClueBroken && hintClues.has(index) ? 'kakuro-clue-hint' : '',
            !isClueBroken && !hintClues.has(index) && activeClues.has(index)
              ? 'kakuro-clue-active'
              : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={index}
              className={classes}
              role="img"
              aria-label={carries ? spoken.join('. ') : t('kakuroClueBlank', { row, col })}
            >
              {clue.right !== null ? <span className="kakuro-clue-right">{clue.right}</span> : null}
              {clue.down !== null ? <span className="kakuro-clue-down">{clue.down}</span> : null}
            </div>
          );
        }

        const value = board.entries[index] ?? EMPTY;
        const notes = value === EMPTY ? (board.notes[index] ?? 0) : 0;
        const isSelected = selected === index;
        const isBroken = violations.cells.has(index);

        // Position and state, then both of this square's runs, then the break —
        // the order a person would read the square in (§13).
        const spoken = [
          value === EMPTY
            ? t('kakuroCellEmpty', { row, col })
            : t('kakuroCellEntry', { value, row, col }),
          ...runsAt(session, index).map(runWords),
        ];
        if (isBroken) spoken.push(t('kakuroRuleBroken'));

        const classes = [
          'kakuro-cell',
          isSelected ? 'kakuro-cell-selected' : runCells.has(index) ? 'kakuro-cell-run' : '',
          isBroken ? 'kakuro-cell-broken' : '',
          !isBroken && mistakes.has(index) ? 'kakuro-cell-mistake' : '',
          support.has(index) ? 'kakuro-cell-support' : '',
          reason.has(index) ? 'kakuro-cell-reason' : '',
          targets.has(index) ? (broken ? 'kakuro-cell-hint-broken' : 'kakuro-cell-hint') : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={index}
            type="button"
            className={classes}
            aria-label={spoken.join('. ')}
            aria-pressed={isSelected}
            onClick={() => onCellTap(index)}
          >
            {value !== EMPTY ? (
              value
            ) : notes !== 0 ? (
              <span className="kakuro-notes" aria-hidden="true">
                {Array.from({ length: 9 }, (_slot, offset) => (
                  <span key={offset} className="kakuro-note">
                    {hasBit(notes, offset + 1) ? offset + 1 : ''}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
