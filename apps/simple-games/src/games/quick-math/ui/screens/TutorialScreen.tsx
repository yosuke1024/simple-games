/**
 * Quick Rules (docs/QUICK_MATH_RULES.md §11): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules live
 * on the game's landing page behind "Learn More", which quietly does nothing
 * offline (docs/OFFLINE_POLICY.md) and is absent until the page exists.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { BLANK, type Question } from '../../game';
import { useQuickMath } from '../../state/GameContext';
import { QuestionView } from '../components/QuestionView';

/**
 * A real question, drawn by the real component (§11: figures, not prose). Using
 * the game's own renderer is what stops the tutorial from showing a layout the
 * board cannot actually produce.
 */
function QuestionFigure({ question, entry }: { question: Question; entry: string }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <QuestionView question={question} entry={entry} digits={2} />
    </div>
  );
}

export function QuickMathTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useQuickMath();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('quick-math', locale);
  const [step, setStep] = useState(0);

  // `7 + 8 = 15`, shown empty, part-typed, and answered. One question across
  // three steps, so they read as one go rather than three unrelated pictures.
  const question: Question = { form: 'binary', tokens: [7, '+', 8, '=', BLANK], answer: 15 };

  const steps = [
    {
      title: t('qmathStep1Title'),
      body: t('qmathStep1Body'),
      example: <QuestionFigure question={question} entry="" />,
    },
    {
      title: t('qmathStep2Title'),
      body: t('qmathStep2Body'),
      example: <QuestionFigure question={question} entry="1" />,
    },
    {
      title: t('qmathStep3Title'),
      body: t('qmathStep3Body'),
      example: <QuestionFigure question={question} entry="15" />,
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
