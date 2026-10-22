/**
 * Quick Rules (docs/BOUNCE_UP_RULES.md §6): three steps, one sentence each,
 * each with a still figure drawn by the board's own pieces
 * (components/ClimbFigure.tsx), leading straight into play
 * (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」). Moving and vanishing
 * platforms are not taught here: they appear from segments 300 and 600 and
 * read by their shape on the board (§6).
 *
 * Two things here are the shell's contract (src/test/tutorialBackWiring.test.tsx,
 * issue #142): the heading is the shared `howToPlay` string, and the close
 * button exists only once the tutorial has been completed — the first pass
 * ends by opening a Normal `ready` board (one tap from playing, no width to
 * choose first — §4「幅」), and hardware Back marks it seen on the way out
 * (state/GameContext.tsx). There is no Learn More: the game has no guide
 * page (§6).
 *
 * The early-release notice is the shell's too (docs/WEB_VERSION.md
 * 「先行公開(ベータ)」): a first visit opens here, and the last step's button
 * writes the first save, so the notice is read before anything is saved.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useBounceUp } from '../../state/GameContext';
import { ClimbFigure, type FigureKind } from '../components/ClimbFigure';

export function BounceUpTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startRun, goHome } = useBounceUp();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps: { title: string; body: string; figure: FigureKind }[] = [
    { title: t('bounceUpStep1Title'), body: t('bounceUpStep1Body'), figure: 'move' },
    { title: t('bounceUpStep2Title'), body: t('bounceUpStep2Body'), figure: 'wrap' },
    { title: t('bounceUpStep3Title'), body: t('bounceUpStep3Body'), figure: 'fall' },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startRun();
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen bo-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      <WebBetaNotice gameId="bounce-up" />

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <ClimbFigure kind={current.figure} />
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
    </div>
  );
}
