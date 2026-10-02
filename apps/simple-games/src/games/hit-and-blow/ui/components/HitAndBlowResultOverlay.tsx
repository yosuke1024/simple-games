/**
 * The one thing this game has to say at the end: the code is cracked, in how
 * many guesses (docs/HIT_AND_BLOW_RULES.md §5, §7). The count is compared with
 * the player's own record for this difficulty and nothing else, and quietly:
 * a first solve says nothing about a record, an exact tie says nothing either
 * (BestDelta). There is no losing screen, because there is no losing (§5).
 * The time is not on the card — it lives in the statistics only (§10).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { guessCount, type HitAndBlowSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface HitAndBlowResultOverlayProps {
  session: HitAndBlowSession;
  lastResult: LastResult | null;
  onNewGame: () => void;
  onHome: () => void;
}

export function HitAndBlowResultOverlay({
  session,
  lastResult,
  onNewGame,
  onHome,
}: HitAndBlowResultOverlayProps) {
  const { t } = useSettings();
  // The solved row gets its beat before the card covers it (§10).
  const revealed = useResultReveal(session.status === 'won');
  if (!revealed) return null;

  // The run's facts, once: the share's strings and the Club's figures are
  // read from the same session fields (docs/architecture/club.md §6-1).
  const attempts = guessCount(session);
  const guesses = String(attempts);
  const details = [{ label: t('hitAndBlowGuessesLabel'), value: guesses }];
  const facts = { attempts };

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('hitAndBlowWinTitle')}
      >
        <h2 className="dialog-title">{t('hitAndBlowWinTitle')}</h2>
        <p className="dialog-body">{t('hitAndBlowWinBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('hitAndBlowGuessesLabel')}</dt>
            <dd>{guesses}</dd>
          </div>
        </dl>

        {/* The record to beat, stated once and quietly — never a target. */}
        {lastResult?.isNewBest && lastResult.previousBest !== null ? (
          <p className="dialog-body">
            {t('hitAndBlowNewBest')}
            <BestDelta value={lastResult.guesses} previous={lastResult.previousBest} kind="count" />
          </p>
        ) : lastResult && !lastResult.isNewBest ? (
          <p className="dialog-body">
            {t('hitAndBlowBestNote', { count: lastResult.best })}
            <BestDelta value={lastResult.guesses} previous={lastResult.previousBest} kind="count" />
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="hit-and-blow" outcome="completed" details={details} />
        <ClubResultAction
          gameId="hit-and-blow"
          outcome="completed"
          details={details}
          facts={facts}
          seed={session.seed}
          params={{ difficulty: session.difficulty }}
          boardDigest={null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
