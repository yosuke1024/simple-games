/**
 * The one thing this game has to say at the end: who took more discs (§3).
 * It shows the final count, mentions the standing record against this
 * opponent quietly, and offers a free rematch. A loss is stated, never
 * scolded; there is no revival to buy and no ad to watch for one more move
 * (docs/REVERSI_RULES.md §8, ADS_POLICY.md).
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { ReversiSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import type { Stats } from '../../storage/schemas';

export interface ReversiResultOverlayProps {
  session: ReversiSession;
  lastResult: LastResult | null;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function ReversiResultOverlay({
  session,
  lastResult,
  stats,
  onRematch,
  onHome,
}: ReversiResultOverlayProps) {
  const { t } = useSettings();
  // The final position gets its beat before the card covers it (§11).
  const revealed = useResultReveal(session.status !== 'playing' && lastResult !== null);
  const mine = lastResult?.mine ?? 0;
  const theirs = lastResult?.theirs ?? 0;
  // The match's facts, once: the share's strings and the Club's figures are
  // read from the same fields (docs/architecture/club.md §6-1).
  const facts = useMemo(() => ({ score: mine, cpuScore: theirs }), [mine, theirs]);
  if (!revealed || !lastResult) return null;
  const details = [
    { label: t('reversiYou'), value: String(mine) },
    { label: t('reversiCpu'), value: String(theirs) },
  ];

  const title =
    session.status === 'won'
      ? t('reversiWinTitle')
      : session.status === 'lost'
        ? t('reversiLoseTitle')
        : t('reversiDrawTitle');
  const body =
    session.status === 'won'
      ? t('reversiWinBody')
      : session.status === 'lost'
        ? t('reversiLoseBody')
        : t('reversiDrawBody');
  const record = stats[session.difficulty];

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${session.status === 'won' ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('reversiYou')}</dt>
            <dd>{lastResult.mine}</dd>
          </div>
          <div>
            <dt>{t('reversiCpu')}</dt>
            <dd>{lastResult.theirs}</dd>
          </div>
        </dl>

        {/* The standing against this opponent, stated once — never a streak. */}
        <p className="dialog-body">
          {t('reversiRecordNote', { wins: record.wins, losses: record.losses })}
        </p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="reversi"
          outcome={session.status === 'won' ? 'completed' : 'played'}
          // The final count, win or lose or draw — it is the one honest
          // summary of a finished game, never a streak.
          details={details}
        />
        <ClubResultAction
          gameId="reversi"
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
