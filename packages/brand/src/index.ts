/**
 * Simple Games by PixApps — brand constants.
 *
 * Simple Games is a label (series name) owned by PixApps, not a separate company.
 * Keep this package tiny: names, taglines, and the shared color palette only.
 * Game-specific concepts must not leak into this package.
 */

export const SERIES_NAME = 'Simple Games';
export const SERIES_BY_LINE = 'by PixApps';
export const SERIES_ATTRIBUTION = 'A Simple Game by PixApps';
export const SERIES_CREDIT = 'Simple Games by PixApps';

/** Primary series message (English). */
export const SERIES_TAGLINE_EN = 'Fully free. Fully offline. Simply playable.';
/** Supporting series message (English). */
export const SERIES_SUBLINE_EN = 'No account. No purchases. No internet required.';
/** Primary series message (Japanese). */
export const SERIES_TAGLINE_JA = '完全無課金。完全オフライン。すぐ遊べる。';

/**
 * Shared palette: quiet, low-stimulation colors that stay readable during
 * long play sessions. Each game may extend but should start from these.
 */
export const brandColors = {
  /** Main text on light backgrounds. */
  ink: '#22303c',
  /** Light theme background. */
  paper: '#f6f4ef',
  /** Dark theme background. */
  paperDark: '#12181f',
  /** Main text on dark backgrounds. */
  inkDark: '#e8e6e1',
  /** Calm accent used for selection / primary actions. */
  accent: '#3d8b76',
  /** Soft accent surface (light theme). */
  accentSoft: '#dcece6',
  /** Soft accent surface (dark theme). */
  accentSoftDark: '#1e3a32',
  /** Gentle warning (game over, destructive confirm). Never alarm-red. */
  warn: '#c26d4f',
} as const;

export type BrandColors = typeof brandColors;
