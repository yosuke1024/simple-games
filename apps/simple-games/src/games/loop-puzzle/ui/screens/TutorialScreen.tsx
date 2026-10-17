/**
 * Quick Rules (docs/LOOP_PUZZLE_RULES.md): at most three steps, one sentence
 * each, leading straight into play (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」).
 * Scaffolded by scripts/new-game.mjs with three placeholder steps: write the
 * real ones from the rule doc, and give each a figure that shows a position
 * the game could actually be in.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game, and
 * hardware Back marks it seen on the way out (state/GameContext.tsx). The
 * long-form rules live on the game's landing page behind "Learn More", which
 * is absent until the page exists (ui/landing.ts) and quietly does nothing
 * offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useLoopPuzzle } from '../../state/GameContext';

export function LoopPuzzleTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startPlaceholderRound, goHome } = useLoopPuzzle();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('loop-puzzle', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('loopPuzzleStep1Title'), body: t('loopPuzzleStep1Body') },
    { title: t('loopPuzzleStep2Title'), body: t('loopPuzzleStep2Body') },
    { title: t('loopPuzzleStep3Title'), body: t('loopPuzzleStep3Body') },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startPlaceholderRound();
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
