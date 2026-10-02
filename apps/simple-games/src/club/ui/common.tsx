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
  onBack,
  right,
  t,
  children,
}: {
  title: string;
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
        <h1 className="club-title">{title}</h1>
        {right ?? <span className="icon-btn-placeholder" />}
      </header>
      <div className="settings-list club-body">{children}</div>
    </div>
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
