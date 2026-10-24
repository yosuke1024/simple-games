/**
 * The end of a round (docs/GEM_SWAP_RULES.md §5, §9): a factual title, how
 * the round ended in one line, the score and the gem count, and the score
 * against the player's own best for that gem count — never anyone else's.
 * No praise, no "great combo", nothing to buy and nothing to watch.
 *
 * The next round is one tap away, in the two shapes the ↻ in the top bar
 * offers: "New board" (first — a fresh seed at the preferred gem count) and
 * "Retry same board" (the same seed and gem count: the same opening board
 * and the same refills). The same labels and the same functions as the ↻
 * dialog, so the two places never disagree about what "again" does
 * (docs/ARCHITECTURE.md「ヘッダの ↻ は結果カードと同じ 2 択」). There is no
 * Undo here (§6).
 *
 * The share says what this card says: every round is `played` — a round has
 * a score, not a win (docs/ARCHITECTURE.md「結果画面の共有」).
 *
 * The finished board gets its beat before the card covers it
 * (`useResultReveal`, after the last move's replay); under Reduced Motion the
 * card is there at once. A held Enter or Space presses a button once.
 */
import type { KeyboardEvent } from 'react';
import type { MessageKey } from '@/i18n';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { EndReason } from '../../game';
import type { LastResult } from '../../state/GameContext';

/** One key per ending, never one sentence with the reason glued in (§11). */
const END_KEYS: Readonly<Record<EndReason, MessageKey>> = {
  swaps: 'gemSwapEnd_swaps',
  stuck: 'gemSwapEnd_stuck',
  cap: 'gemSwapEnd_cap',
};

export interface GemSwapResultOverlayProps {
  /** The round's result, or null while there is none to show (or its replay is still on). */
  result: LastResult | null;
  /** A fresh seed at the preferred gem count — the home's New Game (§9). */
  onNewBoard: () => void;
  /** The same seed and gem count again (§9). */
  onRetry: () => void;
  onHome: () => void;
}

/** A held Enter or Space presses a button once, not once per repeat. */
function swallowRepeatedPress(event: KeyboardEvent<HTMLDivElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

export function GemSwapResultOverlay({
  result,
  onNewBoard,
  onRetry,
  onHome,
}: GemSwapResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(result !== null);
  if (!revealed || result === null) return null;

  const title = t('gemSwapResultTitle');
  const kinds = t('gemSwapKindsCount', { count: result.colors });
  const details = [
    { label: t('score'), value: String(result.score) },
    { label: t('gemSwapKinds'), value: kinds },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onKeyDownCapture={swallowRepeatedPress}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{t(END_KEYS[result.endReason])}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>{t('gemSwapKinds')}</dt>
            <dd>{kinds}</dd>
          </div>
        </dl>

        {/* The best for this gem count — said only once there is one, and
            only for a round the best is made of (§5). */}
        {!result.counted ? (
          <p className="dialog-body">{t('gemSwapNotCounted')}</p>
        ) : result.isNewBest ? (
          <p className="dialog-body">
            {t('gemSwapNewBest', { kinds })}
            <BestDelta
              value={result.score}
              previous={result.previousBest}
              kind="count"
              lowerIsBetter={false}
            />
          </p>
        ) : result.best > 0 ? (
          <p className="dialog-body">
            {t('gemSwapBestWith', { kinds, score: result.best })}
            <BestDelta
              value={result.score}
              previous={result.previousBest}
              kind="count"
              lowerIsBetter={false}
            />
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
            {t('gemSwapNewBoard')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="gem-swap" outcome="played" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
