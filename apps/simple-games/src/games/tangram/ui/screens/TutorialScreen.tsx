/**
 * Quick Rules (docs/TANGRAM_RULES.md §9): three steps, one sentence each,
 * each with a small picture made of the board's own parts, leading straight
 * into play (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」). The first step's
 * sentence is interim, like §4 — Phase 0 has not been run.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a figure (the
 * suspended Free Play one if there is one, else the next of the tier last
 * chosen — §8), and hardware Back marks it seen on the way out
 * (state/GameContext.tsx). There is no guide page yet, so "Learn More" is
 * absent (ui/landing.ts).
 *
 * The early-release notice under the header is the shell's too
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): a first visit opens here rather
 * than on the home, and the last step's button writes the first save, so the
 * notice is read before anything is saved — on every step, in one place.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useTangram } from '../../state/GameContext';
import { TangramFigure } from '../components/TangramFigure';

export function TangramTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startFromTutorial, goHome } = useTangram();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('tangram', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('tangramStep1Title'), body: t('tangramStep1Body') },
    { title: t('tangramStep2Title'), body: t('tangramStep2Body') },
    { title: t('tangramStep3Title'), body: t('tangramStep3Body') },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startFromTutorial();
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen tn-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      <WebBetaNotice gameId="tangram" />

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <div className="tutorial-example">
          <TangramFigure step={step} />
        </div>
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
