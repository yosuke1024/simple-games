/**
 * The Sky Fighter game screen (docs/SKY_FIGHTER_RULES.md §2, §3).
 *
 * The status row carries the stage, the score, and the hearts — the game's
 * own measures, never a clock (§6 of the product principles: no timer
 * pressure). Below it, one compact line names the weapon build (§5): a
 * letter and a level per axis, small enough to ignore mid-fight. Retry is
 * instant and free (§8).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import type { WeaponUpgradeKind } from '../../game/types';
import { useSkyFighter } from '../../state/GameContext';
import { initialHud, SkyBoard, type BoardHud } from '../components/SkyBoard';
import { SkyResultOverlay } from '../components/SkyResultOverlay';
import { REWARD_NAME_KEYS } from '../rewardText';

/** The letters are initials of the untranslated axis names — HUD shorthand,
    expanded for the screen reader from the same keys the overlay uses. */
const WEAPON_LETTERS: readonly { kind: WeaponUpgradeKind; letter: string }[] = [
  { kind: 'power', letter: 'P' },
  { kind: 'rapid', letter: 'R' },
  { kind: 'spread', letter: 'S' },
  { kind: 'missile', letter: 'M' },
];

export function SkyGameScreen() {
  const {
    attempt,
    lastResult,
    reportRunEnd,
    reportStageCleared,
    bookPlaySeconds,
    retryLevel,
    goHome,
  } = useSkyFighter();
  const { t } = useSettings();
  const [hud, setHud] = useState<BoardHud>(() => initialHud(attempt?.level ?? 1));

  if (!attempt) return null;
  const settled = lastResult !== null;
  const pickup = hud.pickup;

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={settled}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-status-level">
              {t('sfStage', { n: hud.stage })}
              <span className="game-status-sub">
                {hud.boss ? t('sfBoss') : t('sfWave', { n: hud.wave, m: hud.waves })}
              </span>
            </span>
            <span className="sf-score" aria-label={t('score')}>
              {hud.score}
            </span>
            <span className="game-lives" role="img" aria-label={t('livesLeft', { n: hud.lives })}>
              {Array.from({ length: hud.maxLives }, (_, i) => (
                <span
                  key={i}
                  className={`game-life-dot ${i < hud.lives ? '' : 'game-life-dot-spent'}`}
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

        <div className="sf-weapons" role="status">
          {WEAPON_LETTERS.map(({ kind, letter }) => (
            <span
              key={kind}
              className={`sf-weapon-chip ${hud.upgrades[kind] > 0 ? 'sf-weapon-chip-live' : ''}`}
              aria-label={`${t(REWARD_NAME_KEYS[kind])} ${hud.upgrades[kind]}`}
            >
              {letter}
              {hud.upgrades[kind]}
            </span>
          ))}
        </div>

        <div className="game-board-body sf-board-area">
          <SkyBoard
            key={`${attempt.level}:${attempt.nonce}`}
            level={attempt.level}
            runSeed={attempt.runSeed}
            onRunEnd={reportRunEnd}
            onStageCleared={reportStageCleared}
            onBookSeconds={bookPlaySeconds}
            onHudChange={setHud}
            ariaLabel={t('sfBoardLabel')}
          />
          {pickup !== null ? (
            // Keyed by seq: every catch restarts the little announcement (§5).
            <div key={pickup.seq} className="sf-toast" role="status">
              {pickup.kind === 'life'
                ? t('sfPickupLife')
                : pickup.kind === 'bonus'
                  ? t('sfUpBonus')
                  : t('sfPickupPlus', { name: t(REWARD_NAME_KEYS[pickup.kind]) })}
            </div>
          ) : null}
        </div>

        <BannerSlot />
      </div>

      <SkyResultOverlay result={lastResult} onRetry={retryLevel} onHome={goHome} />
    </div>
  );
}
