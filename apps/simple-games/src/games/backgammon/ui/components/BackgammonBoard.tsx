/**
 * The board (docs/BACKGAMMON_RULES.md §1, §7, §11): twenty-four points in
 * two rows, the bar between them, the trays at the right — twenty-six fixed
 * buttons in all. Tapping is two-stage: pick up a checker, then put it down
 * on one of the points that light up. Nothing is pressable unless it is a
 * checker with a step or a place the held checker may go, so nothing is ever
 * refused and nothing has to scold.
 *
 * The board is kept in the player's numbering: the 1-point is bottom right
 * and the 24-point top right, the player moving right-to-left along the
 * bottom after coming down the top (§1). Checkers are stacked five high; a
 * sixth and beyond is a count on the top one (§11).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { BAR, OFF, PLAYER, type Board, type Dist } from '../../game/types';
import type { LastStep } from '../../state/GameContext';
import type { Target } from '../useBackgammonSelection';

const STACK_SHOWN = 5;

export interface BackgammonBoardProps {
  board: Board;
  /** The player's checker picked up, as a distance (25 = bar), or null. */
  selected: Dist | null;
  /** Where the picked-up checker may go — empty while nothing is held. */
  targets: readonly Target[];
  /** Which distances hold a checker the player may pick up right now. */
  movable: readonly Dist[];
  /** False while a dialog is up or it is not the player's move: nothing is pressable. */
  playing: boolean;
  lastStep: LastStep | null;
  onPoint: (dist: Dist) => void;
}

/** The player's point number of a player's distance (identity) — kept for clarity. */
const pointOf = (dist: Dist): number => dist;

function Checkers({ count, mine, arrived, stepId, top }: {
  count: number;
  mine: boolean;
  arrived: boolean;
  stepId: number;
  top: boolean;
}) {
  const shown = Math.min(count, STACK_SHOWN);
  return (
    <span className={`bk-stack ${top ? 'bk-stack-top' : 'bk-stack-bottom'}`} aria-hidden="true">
      {Array.from({ length: shown }, (_, index) => {
        const last = index === shown - 1;
        return (
          <span
            key={last && arrived ? `arrived-${stepId}` : index}
            className={[
              'bk-checker',
              mine ? 'bk-checker-you' : 'bk-checker-cpu',
              last && arrived ? 'bk-checker-arrived' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {last && count > STACK_SHOWN ? <span className="bk-checker-count">{count}</span> : null}
          </span>
        );
      })}
    </span>
  );
}

export const BackgammonBoard = memo(function BackgammonBoard({
  board,
  selected,
  targets,
  movable,
  playing,
  lastStep,
  onPoint,
}: BackgammonBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const targetSet = new Map(targets.map((target) => [target.to, target]));
  const movableSet = new Set(movable);

  // Where the last step landed, in the player's numbering, for the mark (§11).
  const arrivedPoint =
    lastStep === null || lastStep.borneOff
      ? null
      : lastStep.by === PLAYER
        ? lastStep.to
        : 25 - lastStep.to;
  const arrivedOnBar = lastStep !== null && lastStep.hit;

  const renderPoint = (point: number, top: boolean) => {
    const count = board.points[point] ?? 0;
    const mine = count > 0;
    const dist = pointOf(point);
    const isTarget = targetSet.has(dist);
    const isSelected = selected === dist;
    const pickable = movableSet.has(dist);
    const label = isTarget
      ? t('backgammonPointTarget', { point })
      : isSelected
        ? t('backgammonPointSelected', { point })
        : count === 0
          ? t('backgammonPointEmpty', { point })
          : mine
            ? t('backgammonPointYours', { point, count })
            : t('backgammonPointCpu', { point, count: -count });
    return (
      <button
        key={point}
        type="button"
        className={[
          'bk-point',
          top ? 'bk-point-top' : 'bk-point-bottom',
          point % 2 === 0 ? 'bk-point-even' : 'bk-point-odd',
          isSelected ? 'bk-point-selected' : '',
          isTarget ? 'bk-point-target' : '',
          pickable ? 'bk-point-pickable' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={label}
        aria-pressed={pickable || isSelected ? isSelected : undefined}
        disabled={!playing || (!isTarget && !pickable && !isSelected)}
        onClick={() => onPoint(dist)}
      >
        <span className="bk-point-shape" aria-hidden="true" />
        {count !== 0 ? (
          <Checkers
            count={Math.abs(count)}
            mine={mine}
            arrived={arrivedPoint === point}
            stepId={lastStep?.stepId ?? 0}
            top={top}
          />
        ) : null}
        {isTarget ? <span className="bk-target-mark" aria-hidden="true" /> : null}
      </button>
    );
  };

  const playerBar = board.bar[0];
  const cpuBar = board.bar[1];
  const barSelected = selected === BAR;
  const barPickable = movableSet.has(BAR);
  const barLabel = barSelected
    ? t('backgammonBarSelected')
    : playerBar > 0
      ? t('backgammonBarYours', { count: playerBar })
      : cpuBar > 0
        ? t('backgammonBarCpu', { count: cpuBar })
        : t('backgammonBarEmpty');

  const offTarget = targetSet.has(OFF);

  return (
    <div
      className={`bk-board ${reducedMotion ? 'bk-board-still' : ''}`}
      role="group"
      aria-label={t('backgammonBoardLabel')}
    >
      <div className="bk-half bk-half-top">
        {[13, 14, 15, 16, 17, 18].map((point) => renderPoint(point, true))}
        <button
          type="button"
          className={['bk-bar', barSelected ? 'bk-bar-selected' : '', barPickable ? 'bk-point-pickable' : '']
            .filter(Boolean)
            .join(' ')}
          aria-label={barLabel}
          aria-pressed={barPickable || barSelected ? barSelected : undefined}
          disabled={!playing || (!barPickable && !barSelected)}
          onClick={() => onPoint(BAR)}
        >
          {cpuBar > 0 ? (
            <Checkers count={cpuBar} mine={false} arrived={arrivedOnBar && lastStep?.by === PLAYER} stepId={lastStep?.stepId ?? 0} top />
          ) : null}
          {playerBar > 0 ? (
            <Checkers count={playerBar} mine arrived={arrivedOnBar && lastStep?.by !== PLAYER} stepId={lastStep?.stepId ?? 0} top={false} />
          ) : null}
        </button>
        {[19, 20, 21, 22, 23, 24].map((point) => renderPoint(point, true))}
        <div className="bk-tray bk-tray-cpu" aria-hidden="true">
          {Array.from({ length: Math.min(board.off[1], STACK_SHOWN) }, (_, i) => (
            <span key={i} className="bk-off-checker bk-checker-cpu" />
          ))}
          {board.off[1] > 0 ? <span className="bk-tray-count">{board.off[1]}</span> : null}
        </div>
      </div>
      <div className="bk-half bk-half-bottom">
        {[12, 11, 10, 9, 8, 7].map((point) => renderPoint(point, false))}
        <span className="bk-bar bk-bar-lower" aria-hidden="true" />
        {[6, 5, 4, 3, 2, 1].map((point) => renderPoint(point, false))}
        <button
          type="button"
          className={`bk-tray bk-tray-you ${offTarget ? 'bk-point-target' : ''}`}
          aria-label={offTarget ? t('backgammonOffTarget') : t('backgammonOffTray', { you: board.off[0], cpu: board.off[1] })}
          disabled={!playing || !offTarget}
          onClick={() => onPoint(OFF)}
        >
          {Array.from({ length: Math.min(board.off[0], STACK_SHOWN) }, (_, i) => (
            <span key={i} className="bk-off-checker bk-checker-you" aria-hidden="true" />
          ))}
          {board.off[0] > 0 ? <span className="bk-tray-count" aria-hidden="true">{board.off[0]}</span> : null}
          {offTarget ? <span className="bk-target-mark" aria-hidden="true" /> : null}
        </button>
      </div>
    </div>
  );
});
