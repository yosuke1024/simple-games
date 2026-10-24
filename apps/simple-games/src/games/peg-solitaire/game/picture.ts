/**
 * Positions written as pictures of the board, so that a test failure — or a
 * Quick Rules diagram — reads as the board itself (docs/PEG_SOLITAIRE_RULES.md
 * §1). `o` is a peg, `.` an empty hole.
 *
 * The cross is seven lines of seven characters, with spaces where the four
 * corners are cut away:
 *
 *     '  ooo  '
 *     '  ooo  '
 *     'ooooooo'
 *     'ooo.ooo'
 *     'ooooooo'
 *     '  ooo  '
 *     '  ooo  '
 *
 * The triangle is five lines, one per row, the holes separated by spaces
 * (any indentation is ignored):
 *
 *     '    .    '
 *     '   o o   '
 *     '  o o o  '
 *     ' o o o o '
 *     'o o o o o'
 *
 * A picture that does not match the board's shape is a mistake in the
 * caller, and throws rather than guessing.
 */
import type { BoardGeometry } from './boards';
import type { Pegs } from './types';

function cellOf(mark: string | undefined, where: string): boolean {
  if (mark === 'o') return true;
  if (mark === '.') return false;
  throw new Error(`picture: expected 'o' or '.' at ${where}, found ${JSON.stringify(mark)}`);
}

export function pegsFromPicture(geometry: BoardGeometry, picture: readonly string[]): Pegs {
  if (picture.length !== geometry.rows) {
    throw new Error(`picture: expected ${geometry.rows} rows, found ${picture.length}`);
  }
  if (geometry.kind === 'english') {
    const holes = new Set(geometry.holes.map((hole) => `${hole.row},${hole.col}`));
    picture.forEach((line, row) => {
      if (line.length !== geometry.cols) {
        throw new Error(`picture: row ${row} must be ${geometry.cols} characters`);
      }
      [...line].forEach((mark, col) => {
        if (!holes.has(`${row},${col}`) && mark !== ' ') {
          throw new Error(`picture: (${row}, ${col}) is not a hole`);
        }
      });
    });
    return geometry.holes.map((hole) =>
      cellOf(picture[hole.row]![hole.col], `(${hole.row}, ${hole.col})`),
    );
  }
  const rows = picture.map((line) => line.trim().split(/\s+/));
  rows.forEach((marks, row) => {
    if (marks.length !== row + 1) {
      throw new Error(`picture: triangle row ${row} must hold ${row + 1} holes`);
    }
  });
  return geometry.holes.map((hole) =>
    cellOf(rows[hole.row]![hole.col], `(${hole.row}, ${hole.col})`),
  );
}

/** The inverse of `pegsFromPicture`, with the triangle centred. */
export function pictureOf(geometry: BoardGeometry, pegs: Pegs): string[] {
  if (geometry.kind === 'english') {
    const lines = Array.from({ length: geometry.rows }, () => [...' '.repeat(geometry.cols)]);
    geometry.holes.forEach((hole, i) => (lines[hole.row]![hole.col] = pegs[i] ? 'o' : '.'));
    return lines.map((line) => line.join(''));
  }
  const rows: string[][] = Array.from({ length: geometry.rows }, () => []);
  geometry.holes.forEach((hole, i) => rows[hole.row]!.push(pegs[i] ? 'o' : '.'));
  return rows.map((marks, row) => {
    const pad = ' '.repeat(geometry.rows - 1 - row);
    return `${pad}${marks.join(' ')}${pad}`;
  });
}
