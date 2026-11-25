/**
 * The result card (docs/MAKE_THE_TARGET_RULES.md §9) and its variant after a
 * solution was shown (§5) — one component, because `ShareAction` belongs on a
 * result overlay and nowhere else (src/test/shareWiring.test.ts).
 *
 * A clear: the heading states the fact ("Target made."), the facts follow one
 * a line, and the time appears only here — showing it while playing would be
 * a clock counting up at someone doing a puzzle. The record is the player's
 * own, said quietly (§9): "Your fastest yet." only when the record was set (a
 * first clear, or strictly faster), with the difference to the old record
 * when there was one; otherwise the record and how far this clear was from
 * it. A retry of a solved problem is compared with nothing. The card waits
 * for the `useResultReveal` beat — the target's frame turning to the accent —
 * or appears at once under Reduced Motion.
 *
 * Free Play leads with a new problem, then the same one again (provisional,
 * §8); the daily is one problem a day, so it offers only the retry.
 *
 * A shown solution: the kept solution, one line a move, and only "New
 * problem" and Home — no retry, because retrying a problem whose answer is on
 * the screen is copying it (§5). There is no beat to wait for: nothing was
 * made.
 *
 * A held key's repeats press nothing on either card (§3): under Reduced
 * Motion the card is up the instant the last tile merges, and a held Enter
 * would otherwise reach its focused first offer.
 *
 * On a device in a Club, a clear goes to the Club House as the card appears
 * (§16): the time the card shows, read from the same clear seconds as the
 * card and the share. A Free Play clear goes to the difficulty's ranking
 * table; the daily — one problem for everyone — goes to that day's Today
 * challenge with its date and the dealt problem's digest. The card after a
 * shown solution sends nothing: nothing was made.
 */
import { useMemo, type KeyboardEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { boardDigestOf, solutionLines, type MakeTheTargetSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { ExpressionList } from './ExpressionList';

export interface MakeTheTargetResultOverlayProps {
  session: MakeTheTargetSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

/** A held Enter or Space presses a button once, not once per repeat (§3). */
function swallowRepeatedPress(event: KeyboardEvent<HTMLDivElement>) {
  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
}

export function MakeTheTargetResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: MakeTheTargetResultOverlayProps) {
  const { t } = useSettings();
  // The made target gets its beat before the card covers it (§4).
  const revealed = useResultReveal(session.status === 'solved');
  // The Club's one figure (§16), from the same clear seconds the card's time
  // and the share's `details` read below — nothing recomputed (docs/
  // architecture/club.md §6-1). Built above every return, as a hook must be.
  const clearSeconds = lastResult === null ? null : lastResult.seconds;
  const clubFacts = useMemo(
    () => (clearSeconds === null ? null : { elapsedSeconds: clearSeconds }),
    [clearSeconds],
  );

  const mode =
    session.mode === 'daily' ? t('modeDaily') : t(`makeTheTargetDifficulty_${session.difficulty}`);
  const count = String(session.problem.numbers.length);

  if (session.status === 'revealed') {
    const lines = solutionLines(session) ?? [];
    const title = t('makeTheTargetRevealedTitle', { target: session.problem.target });
    return (
      <div className="overlay overlay-result">
        <div
          className="dialog result tg-result"
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
          onKeyDownCapture={swallowRepeatedPress}
        >
          <h2 className="dialog-title">{title}</h2>
          <ExpressionList
            lines={lines}
            label={t('makeTheTargetSolutionLabel')}
            className="tg-result-lines"
          />
          <dl className="result-facts">
            <div>
              <dt>{t('difficulty')}</dt>
              <dd>{mode}</dd>
            </div>
            <div>
              <dt>{t('makeTheTargetNumbersLabel')}</dt>
              <dd>{count}</dd>
            </div>
          </dl>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
              {t('makeTheTargetNewBoard')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onHome}>
              {t('backHome')}
            </button>
          </div>
          <ShareAction
            gameId="make-the-target"
            outcome="played"
            details={[
              { label: t('difficulty'), value: mode },
              { label: t('makeTheTargetNumbersLabel'), value: count },
            ]}
          />
        </div>
        <ResultAdSlot />
      </div>
    );
  }

  if (!revealed || lastResult === null || clubFacts === null) return null;

  const time = formatDuration(lastResult.seconds);
  const { comparison } = lastResult;
  const canStartNew = session.mode === 'free';
  const title = t('makeTheTargetSolvedTitle');
  // The card's lines a share repeats (at most three) — and the Club's proof that
  // `clubFacts` says what the card says.
  const details = [
    { label: t('difficulty'), value: mode },
    { label: t('timeLabel'), value: time },
    { label: t('makeTheTargetNumbersLabel'), value: count },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear tg-result"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onKeyDownCapture={swallowRepeatedPress}
      >
        <h2 className="dialog-title">{title}</h2>

        <dl className="result-facts">
          <div>
            <dt>{t('difficulty')}</dt>
            <dd>{mode}</dd>
          </div>
          <div>
            <dt>{t('makeTheTargetNumbersLabel')}</dt>
            <dd>{count}</dd>
          </div>
          <div>
            <dt>{t('makeTheTargetTargetLabel')}</dt>
            <dd>{session.problem.target}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{time}</dd>
          </div>
        </dl>

        {comparison === null ? null : comparison.isNewBest ? (
          <p className="dialog-body">
            {t('makeTheTargetNewBestTime')}
            <BestDelta
              value={lastResult.seconds}
              previous={comparison.previousSeconds}
              kind="time"
            />
          </p>
        ) : (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(comparison.bestSeconds)}
            <BestDelta
              value={lastResult.seconds}
              previous={comparison.previousSeconds}
              kind="time"
            />
          </p>
        )}

        <div className="result-actions">
          {canStartNew ? (
            <>
              <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
                {t('makeTheTargetNewBoard')}
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
        <ShareAction gameId="make-the-target" outcome="completed" details={details} />
        <ClubResultAction
          gameId="make-the-target"
          outcome="completed"
          details={details}
          facts={clubFacts}
          seed={session.seed}
          params={{ difficulty: session.difficulty }}
          daily={session.mode === 'daily' ? session.dailyDate : null}
          boardDigest={session.mode === 'daily' ? boardDigestOf(session) : null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
