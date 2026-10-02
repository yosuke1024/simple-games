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

/** `easy` / `medium` / `hard` are translated; anything else is shown as the contract named it. */
export function tierLabel(key: string, t: T): string {
  if (key === 'easy') return t('clubTier_easy');
  if (key === 'medium') return t('clubTier_medium');
  if (key === 'hard') return t('clubTier_hard');
  // Solitaire's draw and Spider's suit count (their contracts' paramsKey).
  if (key === 'draw-1') return t('clubTier_draw1');
  if (key === 'draw-3') return t('clubTier_draw3');
  if (key === '1-suit') return t('clubTier_suit1');
  if (key === '2-suits') return t('clubTier_suits2');
  if (key === '4-suits') return t('clubTier_suits4');
  // A board size reads as the game's own screens write it: 8×8, not 8x8.
  return key.replace(/^(\d+)x(\d+)/, '$1×$2');
}

/**
 * The paramsKey of a game with one table (`standard`) or of a daily board
 * (Water Sort's `daily`) says nothing a title needs: the title is the game,
 * and a daily already carries the Daily label.
 */
export const isSilentTier = (key: string): boolean => key === 'standard' || key === 'daily';

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
