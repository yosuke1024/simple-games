/**
 * The end of a run (docs/SNAKE_RULES.md §4, §9, §10): how it ended, the
 * score, the snake's length, and the best at that speed, measured only
 * against the player's own record. There is nothing to buy and nothing to
 * watch: no continue, no extra life. The next run is free and one tap away,
 * in either of the two shapes the ↻ in the top bar offers: "Retry same board"
 * (the same seed and speed) or "New Game" (a fresh seed at the preferred
 * speed, as the home's New Game) — the same labels and the same functions, so
 * the two places never disagree about what "again" does (§6,
 * docs/ARCHITECTURE.md「ヘッダの ↻ は結果カードと同じ 2 択」).
 *
 * The share says what this card says and nothing more: a full board is
 * `completed`, every crash is `played` (docs/ARCHITECTURE.md「結果画面の共有」).
 *
 * The stopped board — the × on the head — gets its beat before the card
 * covers it (`useResultReveal`); under Reduced Motion the card is there at
 * once (§13).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { LastResult } from '../../state/GameContext';

export interface SnakeResultOverlayProps {
  result: LastResult | null;
  onRetry: () => void;
  /** A fresh seed at the preferred speed — the home's New Game (§6). */
  onNewBoard: () => void;
  onHome: () => void;
}

export function SnakeResultOverlay({
  result,
  onRetry,
  onNewBoard,
  onHome,
}: SnakeResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(result !== null);
  if (!revealed || result === null) return null;

  const cleared = result.outcome === 'cleared';
  const title = cleared ? t('snakeClearedTitle') : t('snakeOverTitle');
  const body = cleared
    ? t('snakeClearedBody')
    : result.crash === 'self'
      ? t('snakeOverSelf')
      : t('snakeOverWall');
  const speed = t(`snakeSpeed_${result.speed}`);
  const details = [
    { label: t('score'), value: String(result.score) },
    { label: t('snakeSpeed'), value: speed },
  ];

  return (
    <div className="overlay overlay-result">
      <div className="dialog result" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>{t('snakeLength')}</dt>
            <dd>{result.length}</dd>
          </div>
          <div>
            <dt>{t('snakeSpeed')}</dt>
            <dd>{speed}</dd>
          </div>
        </dl>

        {/* The record at this speed — said only once there is one: "best 0" is
            not a record, it is the absence of one (§10). */}
        {result.isNewBestScore && result.score > 0 ? (
          <p className="dialog-body">
            {t('snakeNewBest', { speed })}
            <BestDelta
              value={result.score}
              previous={result.previousBestScore}
              kind="count"
              lowerIsBetter={false}
            />
          </p>
        ) : result.bestScore > 0 ? (
          <p className="dialog-body">
            {t('snakeBestAt', { speed, score: result.bestScore })}
            <BestDelta
              value={result.score}
              previous={result.previousBestScore}
              kind="count"
              lowerIsBetter={false}
            />
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="snake" outcome={cleared ? 'completed' : 'played'} details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
