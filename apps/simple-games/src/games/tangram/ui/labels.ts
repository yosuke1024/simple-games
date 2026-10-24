/**
 * What a screen reader hears about the figure and its pieces
 * (docs/TANGRAM_RULES.md §10, §11): every string is one catalog entry with
 * `{var}` slots — never words joined in code — and no position is ever read
 * out (a coordinate is not something anyone can act on).
 */
import type { useSettings } from '@/state/SettingsContext';
import type { Orientation, PieceId, SnapTarget, Tier } from '../game';

export type Translate = ReturnType<typeof useSettings>['t'];

/** "Easy 3" — the figure's tier and its number in that tier (§2). Never its name (§11). */
export const figureName = (t: Translate, tier: Tier, number: number): string =>
  t('tangramFigureName', { tier: t(`tangramTier_${tier}`), number });

/** The top bar's and the result card's name for a figure: "Easy 3", or the daily's date. */
export function figureTitle(
  t: Translate,
  mode: 'free' | 'daily',
  tier: Tier,
  number: number,
  dailyDate: string | null,
): string {
  return mode === 'daily' && dailyDate !== null
    ? t('tangramDailyName', { date: dailyDate })
    : figureName(t, tier, number);
}

/** A piece: its kind, its turn, its side (the parallelogram only), where it is, and whether it is fixed. */
export function pieceLabel(
  t: Translate,
  id: PieceId,
  o: Orientation,
  onBoard: boolean,
  fixed: boolean,
): string {
  const vars = { piece: t(`tangramPiece_${id}`), angle: o.r * 45 };
  if (fixed) return t(o.f ? 'tangramPieceFixedFlipped' : 'tangramPieceFixed', vars);
  if (onBoard) return t(o.f ? 'tangramPieceOnBoardFlipped' : 'tangramPieceOnBoard', vars);
  return t(o.f ? 'tangramPieceInTrayFlipped' : 'tangramPieceInTray', vars);
}

const FITS: Readonly<Record<SnapTarget, Parameters<Translate>[0]>> = {
  'outline-vertex': 'tangramFitsOutlineVertex',
  'outline-edge': 'tangramFitsOutlineEdge',
  'piece-vertex': 'tangramFitsPieceVertex',
  'piece-edge': 'tangramFitsPieceEdge',
};

/**
 * While a piece is lifted (§10): whether it can be placed where it is drawn,
 * and if so what it is touching. Never why it cannot (§3).
 */
export const fitMessage = (t: Translate, target: SnapTarget | null): string =>
  target === null ? t('tangramNoFit') : t(FITS[target]);
