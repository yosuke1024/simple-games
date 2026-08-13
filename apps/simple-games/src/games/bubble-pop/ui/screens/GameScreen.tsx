/**
 * The Bubble Pop game screen (docs/plans/2026-08-08-mahjong-bubble-ludo.md
 * §Bubble Pop).
 *
 * The status row carries the level and the shots left before the next
 * ceiling drop — a dot row, not a countdown number (§3) — reusing the same
 * shared arcade chrome Brick Breaker's life dots use (ui/styles.css's
 * `.game-status*`, built for "two games use it identically" and now a
 * third). Retry is instant and free: an attempt is a minute or two, so
 * there is nothing worth a confirmation dialog.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import type { BubbleColor } from '../../game/types';
import { useBubblePop } from '../../state/GameContext';
import { BubbleBoard, type BubbleHud } from '../components/BubbleBoard';
import { BubbleResultOverlay } from '../components/BubbleResultOverlay';

const INITIAL_HUD: BubbleHud = {
  shotsUntilDescent: 0,
  descentEvery: 0,
  current: 'blue',
  next: 'blue',
};

export function BubbleGameScreen() {
  const { attempt, lastResult, reportRunEnd, bookPlaySeconds, retryLevel, startNextLevel, goHome } =
    useBubblePop();
  const { t } = useSettings();
  const [hud, setHud] = useState<BubbleHud>(INITIAL_HUD);

  if (!attempt) return null;
  const settled = lastResult !== null;

  const colorName = (color: BubbleColor) => t(`bubbleColor_${color}`);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={settled}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-status-level">
              {t('modeLevel', { n: attempt.level })}
              <span className="game-status-sub">
                {t('bubbleShotsLabel', { n: hud.shotsUntilDescent })}
              </span>
            </span>
            <span
              className="game-lives"
              role="img"
              aria-label={t('bubbleShotsLabel', { n: hud.shotsUntilDescent })}
            >
              {Array.from({ length: hud.descentEvery }, (_, i) => (
                <span
                  key={i}
                  className={`game-life-dot ${i < hud.shotsUntilDescent ? '' : 'game-life-dot-spent'}`}
                />
              ))}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={retryLevel}
          >
            <IconRetry />
          </button>
        </header>

        <div className="game-board-body">
          <BubbleBoard
            key={`${attempt.level}:${attempt.nonce}`}
            level={attempt.level}
            onRunEnd={reportRunEnd}
            onBookSeconds={bookPlaySeconds}
            onHudChange={setHud}
            labels={{
              board: t('bubbleBoardLabel'),
              swap: t('bubbleSwapLabel'),
              current: (color) => t('bubbleCurrentLabel', { color: colorName(color) }),
              next: (color) => t('bubbleNextLabel', { color: colorName(color) }),
              aiming: (row, col) => t('bubbleAimLabel', { row, col }),
            }}
          />
        </div>

        <BannerSlot />
      </div>

      <BubbleResultOverlay
        result={lastResult}
        onNextLevel={startNextLevel}
        onRetry={retryLevel}
        onHome={goHome}
      />
    </div>
  );
}
