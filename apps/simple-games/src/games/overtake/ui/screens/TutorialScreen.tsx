/**
 * Quick Rules (docs/OVERTAKE_RULES.md §10): three steps, one sentence each,
 * each with a still figure drawn by the board's own pieces
 * (components/RaceFigure.tsx), leading straight into play
 * (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」).
 *
 * Step 2 says the control that actually works (§10): mode A's sentence only
 * for Drag on mapping A, ▼'s sentence for mode B and for Buttons — chosen by
 * `quickRulesVariant` from `DRAG_MAPPING` and `ot.prefs`. A first visit has
 * chosen nothing yet, so it reads the default's.
 *
 * Two things here are the shell's contract (src/test/tutorialBackWiring.test.tsx,
 * issue #142): the heading is the shared `howToPlay` string, and the close
 * button exists only once the tutorial has been completed — the first pass
 * ends by opening the frontier's race, and hardware Back marks it seen on
 * the way out (state/GameContext.tsx). There is no Learn More: the game has
 * no guide page (§10).
 *
 * The early-release notice is the shell's too (docs/WEB_VERSION.md
 * 「先行公開(ベータ)」): a first visit opens here, and the last step's button
 * writes the first save, so the notice is read before anything is saved.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { quickRulesVariant } from '../../game/input';
import { useOvertake } from '../../state/GameContext';
import { homeLevel } from '../../state/statsLogic';
import { RaceFigure } from '../components/RaceFigure';

export function OvertakeTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, controls, goHome } =
    useOvertake();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('overtakeStep1Title'), body: t('overtakeStep1Body'), figure: 'lanes' as const },
    {
      title: t('overtakeStep2Title'),
      body:
        quickRulesVariant(controls) === 'A'
          ? t('overtakeStep2BodyDrag')
          : t('overtakeStep2BodyHold'),
      figure: 'ease' as const,
    },
    { title: t('overtakeStep3Title'), body: t('overtakeStep3Body'), figure: 'finish' as const },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startLevel(homeLevel(progress));
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

      <WebBetaNotice gameId="overtake" />

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <RaceFigure kind={current.figure} />
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
