/**
 * The one thing this game has to say at the end: who holds more boxes (§3).
 * It states the final count, mentions the standing record on this board
 * quietly and offers a rematch. A loss is stated, never scolded; there is no
 * revival to buy and no ad to watch for one more line
 * (docs/DOTS_AND_BOXES_RULES.md §7, ADS_POLICY.md).
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { countBoxes, type DotsAndBoxesSession } from '../../game';
import type { Stats } from '../../storage/schemas';

export interface DotsAndBoxesResultOverlayProps {
  session: DotsAndBoxesSession;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function DotsAndBoxesResultOverlay({
  session,
  stats,
  onRematch,
  onHome,
}: DotsAndBoxesResultOverlayProps) {
  const { t } = useSettings();
  // The final board gets its beat before the card covers it (§10).
  const revealed = useResultReveal(session.status !== 'playing');
  const { player, cpu } = countBoxes(session.board);
  // The match's facts, once: the share's strings and the Club's figures are
  // read from the same fields (docs/architecture/club.md §6-1).
  const facts = useMemo(() => ({ score: player, cpuScore: cpu }), [player, cpu]);
  if (!revealed) return null;

  const title =
    session.status === 'won'
      ? t('dotsAndBoxesWinTitle')
      : session.status === 'lost'
        ? t('dotsAndBoxesLoseTitle')
        : t('dotsAndBoxesDrawTitle');
  const body =
    session.status === 'won'
      ? t('dotsAndBoxesWinBody')
      : session.status === 'lost'
        ? t('dotsAndBoxesLoseBody')
        : t('dotsAndBoxesDrawBody');
  const details = [
    { label: t('dotsAndBoxesYou'), value: String(player) },
    { label: t('dotsAndBoxesCpu'), value: String(cpu) },
  ];
  const record = stats[session.size];

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
            <dt>{t('dotsAndBoxesYou')}</dt>
            <dd>{player}</dd>
          </div>
          <div>
            <dt>{t('dotsAndBoxesCpu')}</dt>
            <dd>{cpu}</dd>
          </div>
        </dl>

        {/* The standing on this board, stated once — never a streak. */}
        <p className="dialog-body">
          {t('dotsAndBoxesRecordNote', { wins: record.wins, losses: record.losses })}
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
          gameId="dots-and-boxes"
          outcome={session.status === 'won' ? 'completed' : 'played'}
          // The final count, as the card shows it — the one honest summary
          // of a finished match, win or lose or draw.
          details={details}
        />
        <ClubResultAction
          gameId="dots-and-boxes"
          outcome="completed"
          details={details}
          facts={facts}
          seed={session.seed}
          params={{ size: session.size }}
          boardDigest={null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
