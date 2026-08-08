/**
 * Quick Rules (docs/MAHJONG_SOLITAIRE_RULES.md §11): three steps, one
 * sentence each, shown with a figure rather than explained in prose. The
 * long-form rules live on the game's landing page behind "Learn More", which
 * quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import type { TileFace } from '../../game';
import { useMahjong } from '../../state/GameContext';
import { TileFaceSvg } from '../components/TileFaceSvg';

/**
 * A miniature row of tiles. Every figure shows faces the game really deals;
 * a figure that broke the rules would teach the wrong thing.
 */
function TileFigure({ faces, marked }: { faces: readonly TileFace[]; marked?: readonly number[] }) {
  return (
    <div className="tutorial-example mj-figure" aria-hidden="true">
      {faces.map((face, index) => (
        <span
          key={index}
          className={`mj-figure-tile ${marked?.includes(index) ? 'mj-figure-marked' : ''}`}
        >
          <span className="mj-tile-body" />
          <TileFaceSvg face={face} />
        </span>
      ))}
    </div>
  );
}

export function MahjongTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useMahjong();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('mahjong-solitaire', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('mahjongStep1Title'),
      body: t('mahjongStep1Body'),
      // A matching pair among strangers — the two 3s of Characters.
      example: <TileFigure faces={['c3', 'o5', 'c3', 'b7']} marked={[0, 2]} />,
    },
    {
      title: t('mahjongStep2Title'),
      body: t('mahjongStep2Body'),
      // Two different flowers: a legal pair (§2 — group matching).
      example: <TileFigure faces={['f1', 'f3']} marked={[0, 1]} />,
    },
    {
      title: t('mahjongStep3Title'),
      body: t('mahjongStep3Body'),
      example: <TileFigure faces={['we', 'we']} marked={[0, 1]} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startLevel(progress.highestUnlocked);
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        {current.example}
        <p className="tutorial-body">{current.body}</p>
      </div>

      <div className="tutorial-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            {t('back')}
          </button>
        ) : (
          <span />
        )}
        {lastStep ? (
          <button type="button" className="btn btn-primary" onClick={finish}>
            {tutorialCompleted ? t('close') : t('startPlaying')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {t('next')}
          </button>
        )}
      </div>

      {learnMoreUrl ? (
        <div className="home-links">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openExternal(learnMoreUrl)}
          >
            {t('learnMore')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
