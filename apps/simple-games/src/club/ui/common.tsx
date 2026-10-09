/**
 * What every Club screen shares: the frame (the shell's own header, so the
 * Club reads as a screen of the app, not a second app), the one-line error
 * text, and the formatting of a game's facts. No state lives here.
 */
import type { ReactNode } from 'react';
import { ClubApiError } from '../api/errors';
import { contractFor } from '../contract/challenge';
import { formatDuration } from '@/ui/format';
import { IconBack } from '@/ui/components/icons';
import type { MessageKey, TranslateVars } from '@/i18n';

/** The nickname rule joining and renaming share (club.md §17-1): 1 to 24 characters once trimmed. */
export const NICKNAME_MAX = 24;

export type T = (key: MessageKey, vars?: TranslateVars) => string;

export function ScreenFrame({
  title,
  lead,
  onBack,
  right,
  t,
  children,
}: {
  title: string;
  /** Drawn before the title inside the heading (a game's tile); hidden from the heading's name. */
  lead?: ReactNode;
  onBack: () => void;
  right?: ReactNode;
  t: T;
  children: ReactNode;
}) {
  return (
    <div className="screen club-screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('clubBack')} onClick={onBack}>
          <IconBack />
        </button>
        {lead ? (
          <h1 className="club-title club-title-lead">
            {lead}
            <span className="club-title-text">{title}</span>
          </h1>
        ) : (
          <h1 className="club-title">{title}</h1>
        )}
        {right ?? <span className="icon-btn-placeholder" />}
      </header>
      <div className="settings-list club-body">{children}</div>
    </div>
  );
}

/**
 * A row's rank as the tables write it (`#4`). The first three sit on a gold,
 * silver or bronze disc (club.md §16-2, decision 48) — a mark inside this one
 * table, not a title anyone carries elsewhere. The disc shows the bare number;
 * the words stay for a screen reader. No number when the server stopped
 * counting below its ceiling (§16-1).
 */
export function RankMark({ rank, t }: { rank: number | null; t: T }) {
  if (rank === null) return <span className="club-rank" />;
  const text = t('clubRank', { n: rank });
  if (rank > 3) return <span className="club-rank">{text}</span>;
  return (
    <span className="club-rank">
      <span className={`club-medal club-medal-${rank}`} aria-hidden="true">
        {rank}
      </span>
      <span className="visually-hidden">{text}</span>
    </span>
  );
}

/** One line for any failure; the club's name is in it when we know it (club.md §10). */
export function errorText(error: unknown, t: T, clubName?: string): string {
  if (error instanceof ClubApiError) {
    switch (error.code) {
      case 'unreachable':
        return clubName ? t('clubUnreachable', { club: clubName }) : t('clubErr_unreachable');
      case 'unsupported_server':
      case 'unsupported_version':
        return t('clubVersionMismatch');
      case 'invite_expired':
        return t('clubErr_invite_expired');
      case 'too_many_members':
        return t('clubErr_too_many_members');
      case 'unauthorized':
        return t('clubErr_unauthorized');
      case 'forbidden':
        return t('clubErr_forbidden');
      case 'last_owner':
        return t('clubErr_last_owner');
      case 'not_found':
        return t('clubErr_not_found');
      case 'rate_limited':
        return t('clubErr_rate_limited');
      default:
        return t('clubErr_generic');
    }
  }
  if (error instanceof Error && error.message === 'too_many_connections') {
    return t('clubErr_too_many_connections');
  }
  return t('clubErr_generic');
}

/** Today as YYYY-MM-DD in LOCAL time — the reading the games' own daily dates use. */
export function todayLocal(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Games whose `easy` / `normal` / `hard` name a CPU opponent's strength, in the words their own screens use. */
const CPU_GAMES: ReadonlySet<string> = new Set(['gin-rummy', 'hearts', 'mancala', 'reversi']);

/** Dots and Boxes' `paramsKey` is the board size's name; the game's own buttons write the boxes per side. */
const DOTS_AND_BOXES_SIZES: Readonly<Record<string, string>> = {
  small: '3×3',
  medium: '4×4',
  large: '5×5',
};

/** Quick Math's tracks (its `paramsKey` is the track, lower-cased), in the words of the game's own bands. */
const QUICK_MATH_TRACKS: Readonly<Record<string, Parameters<T>[0]>> = {
  addsub: 'clubTier_qmAddSub',
  multiply: 'clubTier_qmMultiply',
  divide: 'clubTier_qmDivide',
  missing: 'clubTier_qmMissing',
  mixed: 'clubTier_qmMixed',
};

const SCHULTE_ORDERS: Readonly<Record<string, Parameters<T>[0]>> = {
  ascending: 'clubTier_ascending',
  descending: 'clubTier_descending',
  'odd-then-even': 'clubTier_oddThenEven',
};

/**
 * The mode words of a title (`Sudoku · Hard`), or null when the title is the
 * game alone (club.md §6-1「タイトルのモード語」). The `paramsKey` is the contract's table name and is
 * never shown as it stands: each game's keys are read in that game's own
 * words, and a key this function has no word for still shows as written (so a
 * new value is visibly unfinished, and `titles.test.ts` lists every value of
 * every contract to fail loudly instead).
 *
 * `daily` says the title already carries the Daily label.
 */
export function modeLabel(gameId: string, key: string, t: T, daily = false): string | null {
  // A game with one table, or a daily board, has nothing a title needs to add.
  if (key === 'standard' || key === 'daily') return null;

  // A level band says nothing about a daily board (Mahjong Solitaire deals its
  // flagship layout for the daily), and the title's Daily label names it.
  const contract = contractFor(gameId);
  if (contract?.levelRange !== undefined) {
    if (daily) return null;
    const range = contract.levelRange(key);
    if (range !== null) return t('clubTier_levels', { from: range[0], to: range[1] });
  }

  if (CPU_GAMES.has(gameId)) {
    if (key === 'easy') return t('clubTier_cpuEasy');
    if (key === 'normal') return t('clubTier_cpuNormal');
    if (key === 'hard') return t('clubTier_cpuHard');
  }

  if (gameId === 'dots-and-boxes') {
    const size = DOTS_AND_BOXES_SIZES[key];
    if (size !== undefined) return size;
  }

  if (gameId === 'quick-math') {
    const track = QUICK_MATH_TRACKS[key];
    if (track !== undefined) return t(track);
  }

  if (gameId === 'schulte-table') {
    const match = /^(\d+)x(\d+)-(ascending|descending|odd-then-even)$/.exec(key);
    if (match) {
      const order = SCHULTE_ORDERS[match[3]!];
      if (order !== undefined) return `${match[1]}×${match[2]} · ${t(order)}`;
    }
  }

  if (key === 'easy') return t('clubTier_easy');
  if (key === 'medium') return t('clubTier_medium');
  if (key === 'hard') return t('clubTier_hard');
  // Hit and Blow's middle difficulty is `normal`.
  if (key === 'normal') return t('clubTier_normal');
  // Solitaire's draw and Spider's suit count (their contracts' paramsKey).
  if (key === 'draw-1') return t('clubTier_draw1');
  if (key === 'draw-3') return t('clubTier_draw3');
  if (key === '1-suit') return t('clubTier_suit1');
  if (key === '2-suits') return t('clubTier_suits2');
  if (key === '4-suits') return t('clubTier_suits4');
  // A board size reads as the game's own screens write it: 8×8, not 8x8.
  return key.replace(/^(\d+)x(\d+)/, '$1×$2');
}

export function dateLabel(iso: string, locale: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  try {
    return new Date(time).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return new Date(time).toDateString();
  }
}

/** One fact as the result screen would show it; null for a fact this layer has no word for. */
export function factText(name: string, value: unknown, t: T): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (name === 'elapsedSeconds') return formatDuration(value);
  const label = FACT_LABELS[name];
  return label === undefined ? null : `${t(label)} ${value}`;
}

/** The facts the contracts send (club.md §6-1), each with its word; a fact not here is not drawn. */
const FACT_LABELS: Readonly<Record<string, Parameters<T>[0]>> = {
  moves: 'clubFact_moves',
  attempts: 'clubFact_attempts',
  score: 'clubFact_score',
  mistakes: 'clubFact_mistakes',
  hints: 'clubFact_hints',
  cpuScore: 'clubFact_cpuScore',
  level: 'clubFact_level',
  bestTile: 'clubFact_bestTile',
  lines: 'clubFact_lines',
  stage: 'clubFact_stage',
  obstaclesPassed: 'clubFact_obstacles',
};

const FACT_ORDER = ['elapsedSeconds', ...Object.keys(FACT_LABELS)];

/** A result's facts as one line, the comparison axis first. */
export function factsLine(gameId: string, raw: unknown, t: T): string {
  const contract = contractFor(gameId);
  const facts = contract?.validateFacts(raw);
  if (!contract || !facts) return '';
  const names = [contract.order, ...FACT_ORDER.filter((n) => n !== contract.order)];
  return names
    .map((name) => factText(name, facts[name], t))
    .filter((part): part is string => part !== null)
    .join('  ');
}

/** A record's headline fact: the axis alone. */
export function axisText(gameId: string, raw: unknown, t: T): string {
  const contract = contractFor(gameId);
  const facts = contract?.validateFacts(raw);
  if (!contract || !facts) return '';
  const value = facts[contract.order];
  if (contract.order === 'elapsedSeconds') return factText('elapsedSeconds', value, t) ?? '';
  return typeof value === 'number' ? String(value) : '';
}

/**
 * How far the viewer's best row is from the nearest strictly better value on
 * the table's axis (club.md §16-2「1 つ上まで」, decision 48): a time as the
 * time it is short by, any other axis as `{label} {n}`. Only the two numbers
 * are read — the facts were already shown through `validateFacts`, and the
 * gap needs nothing else from them. Empty when there is nothing to say: no
 * better value (the top of the table), a value that is not a number, or a gap
 * that rounds to nothing (never "0:00 to the next rank").
 */
export function axisGap(gameId: string, mine: unknown, nextValue: number | null, t: T): string {
  const contract = contractFor(gameId);
  if (contract === null || nextValue === null || !Number.isFinite(nextValue)) return '';
  if (typeof mine !== 'object' || mine === null) return '';
  const value = (mine as Record<string, unknown>)[contract.order];
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (contract.order === 'elapsedSeconds') {
    // Each side as the rows print it (whole seconds), so the gap is their visible difference.
    const gap = Math.abs(Math.floor(value) - Math.floor(nextValue));
    return gap === 0 ? '' : formatDuration(gap);
  }
  const gap = Math.round(Math.abs(value - nextValue));
  if (gap === 0) return '';
  const label = FACT_LABELS[contract.order];
  return label === undefined ? String(gap) : `${t(label)} ${gap}`;
}

/** Sort keys of the words many games share (easy < medium = normal < hard). */
const DIFFICULTY_ORDER: ReadonlyMap<string, number> = new Map([
  ['easy', 1],
  ['medium', 2],
  ['normal', 2],
  ['hard', 3],
]);
const DOTS_AND_BOXES_ORDER: ReadonlyMap<string, number> = new Map([
  ['small', 1],
  ['medium', 2],
  ['large', 3],
]);
const QUICK_MATH_ORDER: ReadonlyMap<string, number> = new Map([
  ['addsub', 1],
  ['multiply', 2],
  ['divide', 3],
  ['missing', 4],
  ['mixed', 5],
]);
const SCHULTE_ORDER: ReadonlyMap<string, number> = new Map([
  ['ascending', 0],
  ['descending', 1],
  ['odd-then-even', 2],
]);
/** Solitaire's draw and Spider's suit count, by the number they name. */
const COUNT_ORDER: ReadonlyMap<string, number> = new Map([
  ['draw-1', 1],
  ['draw-3', 3],
  ['1-suit', 1],
  ['2-suits', 2],
  ['4-suits', 4],
]);
/** A daily table comes after every mode of its game. */
const DAILY_ORDER = 1_000_000;
/** A key with no place here: after everything, then by its spelling (`sortModes`). */
const UNKNOWN_ORDER = Number.POSITIVE_INFINITY;

/**
 * Where a mode stands among its game's modes (club.md §16-2): the order the
 * chips of a table and the rows of "Your rankings" are drawn in. The server
 * lists tables by the spelling of their keys; the order a player reads is the
 * game's own — easier first, smaller first, Mahjong Solitaire's layouts by the
 * first level they cover. `titles.test.ts` holds every key of every contract
 * to it.
 */
export function modeOrder(gameId: string, key: string): number {
  if (key === 'standard') return 0;
  if (key === 'daily') return DAILY_ORDER;

  const contract = contractFor(gameId);
  if (contract?.levelRange !== undefined) {
    const range = contract.levelRange(key);
    return range === null ? UNKNOWN_ORDER : range[0];
  }
  if (gameId === 'dots-and-boxes') return DOTS_AND_BOXES_ORDER.get(key) ?? UNKNOWN_ORDER;
  if (gameId === 'quick-math') return QUICK_MATH_ORDER.get(key) ?? UNKNOWN_ORDER;
  if (gameId === 'schulte-table') {
    // Size first, then the order within a size: 3×3 ascending … 5×5 odds-then-evens.
    const match = /^(\d+)x\d+-(.+)$/.exec(key);
    const order = match ? SCHULTE_ORDER.get(match[2]!) : undefined;
    return match && order !== undefined ? Number(match[1]) * 10 + order : UNKNOWN_ORDER;
  }

  const known = DIFFICULTY_ORDER.get(key) ?? COUNT_ORDER.get(key);
  if (known !== undefined) return known;
  // A board size, by its side: 6×6 < 8×8 < 10×10.
  const size = /^(\d+)x\d+$/.exec(key);
  return size ? Number(size[1]) : UNKNOWN_ORDER;
}

/** Two of a game's mode keys in `modeOrder`; keys with the same place go by their spelling. */
export function compareModes(gameId: string, a: string, b: string): number {
  const x = modeOrder(gameId, a);
  const y = modeOrder(gameId, b);
  // Not `x - y`: two unknown keys are both Infinity, and Infinity - Infinity is NaN.
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A game's mode keys in `modeOrder`, each once. */
export function sortModes(gameId: string, keys: readonly string[]): string[] {
  return [...new Set(keys)].sort((a, b) => compareModes(gameId, a, b));
}
