/**
 * The clear card (docs/UNBLOCK_PUZZLE_RULES.md §9, §10). The facts of the run
 * — moves against the board's fewest, the net cells moved, the time, the hints
 * — and nothing to chase: no score, no stars. The time appears only here,
 * because showing it while playing would be a clock counting up at someone
 * doing a puzzle. There is no losing card, because there is no losing (§3).
 *
 * "Net cells moved" is worded as what it is (§4, §16): each move counts the
 * distance from where it began to where it ended, so a block slid two cells
 * right and one back counts one. The label never says "slid".
 *
 * A record is mentioned only when this clear beat one the player already had
 * — the fastest clear at this difficulty in Free Play, the fewest moves for
 * the day's board in a daily — and quietly (§10).
 *
 * Free Play leads with a new board and offers the same one again second (§9);
 * the daily is one board a day, so there is no other board to offer.
 *
 * A held key's repeats press nothing on the card (§5). The last move is often
 * an Enter on the focused arrow button; under Reduced Motion the card is up
 * the instant the target leaves, and a held Enter's repeats would reach the
 * focused first offer and deal a new board over a result not yet seen. A
 * repeat is not a new press.
 */
import type { KeyboardEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { UnblockSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface UnblockPuzzleResultOverlayProps {
  session: UnblockSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

/** A held Enter or Space presses a button once, not once per repeat (§5). */
function swallowRepeatedPress(event: KeyboardEvent<HTMLDivElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

export function UnblockPuzzleResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: UnblockPuzzleResultOverlayProps) {
  const { t } = useSettings();
  // The finished board gets its beat before the card covers it (§14).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed || lastResult === null) return null;

  const { facts } = lastResult;
  const canStartNew = session.mode === 'free';

  // What the card shows, headline first, is what a share repeats (at most three).
  const details = [
    { label: t('movesLabel'), value: String(facts.moves) },
    { label: t('unblockPuzzleFewestLabel'), value: String(facts.minMoves) },
    { label: t('timeLabel'), value: formatDuration(facts.seconds) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear ub-result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('unblockPuzzleSolvedTitle')}
        onKeyDownCapture={swallowRepeatedPress}
      >
        <h2 className="dialog-title">{t('unblockPuzzleSolvedTitle')}</h2>
        <p className="dialog-body">
          {lastResult.optimal ? t('unblockPuzzleSolvedOptimal') : t('unblockPuzzleSolvedBody')}
        </p>

        <dl className="result-facts ub-result-facts">
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{facts.moves}</dd>
          </div>
          <div>
            <dt>{t('unblockPuzzleFewestLabel')}</dt>
            <dd>{facts.minMoves}</dd>
          </div>
          <div>
            <dt>{t('unblockPuzzleNetCellsLabel')}</dt>
            <dd>{facts.cellsMoved}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(facts.seconds)}</dd>
          </div>
          <div>
            <dt>{t('unblockPuzzleHintsUsed')}</dt>
            <dd>{facts.hints}</dd>
          </div>
        </dl>

        {lastResult.improved ? (
          <p className="dialog-body">
            {session.mode === 'daily'
              ? t('unblockPuzzleNewBestDailyMoves')
              : t('unblockPuzzleNewBestTime', {
                  difficulty: t(`unblockPuzzleDifficulty_${session.difficulty}`),
                })}
            <BestDelta
              value={session.mode === 'daily' ? facts.moves : facts.seconds}
              previous={lastResult.previous}
              kind={session.mode === 'daily' ? 'count' : 'time'}
            />
          </p>
        ) : null}

        <div className="result-actions">
          {canStartNew ? (
            <>
              <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
                {t('unblockPuzzleNewBoard')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onRetry}>
                {t('tryAgain')}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
              {t('tryAgain')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="unblock-puzzle" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
