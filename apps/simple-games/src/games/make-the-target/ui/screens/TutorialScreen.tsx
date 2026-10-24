/**
 * Quick Rules (docs/MAKE_THE_TARGET_RULES.md §11): three steps, one sentence
 * each, each with a still picture drawn with the board's own classes — the
 * order of a move and its direction (the first number is the left term), the
 * answer taking the two numbers' place, and the last number matching the
 * target. There is no "Learn More": the game's guide page is not published
 * while it is in early release (ui/landing.ts).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a problem at
 * the remembered difficulty (Easy on a first launch, §8), and hardware Back
 * marks it seen on the way out (state/GameContext.tsx).
 *
 * "The first pass" is read from `tg.flags`, and a lost flags record brings it
 * back over a player who may have a Free Play problem suspended. That problem
 * is resumed, whatever its difficulty, rather than replaced by a new one
 * without a word (§8).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useMakeTheTarget } from '../../state/GameContext';
import { TargetFigure } from '../components/TargetFigure';

export function MakeTheTargetTutorialScreen() {
  const {
    tutorialCompleted,
    completeTutorial,
    startDifficulty,
    canResume,
    resumeGame,
    goHome,
    prefs,
  } = useMakeTheTarget();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('makeTheTargetStep1Title'),
      body: t('makeTheTargetStep1Body'),
      // 7 chosen first, then −: the next number tapped is on the right.
      example: <TargetFigure tiles={[3, 7]} selected={1} operator="-" />,
    },
    {
      title: t('makeTheTargetStep2Title'),
      body: t('makeTheTargetStep2Body'),
      // 7 − 3: the 7's place is empty, and 4 stands where the 3 was.
      example: <TargetFigure tiles={[4, null]} />,
    },
    {
      title: t('makeTheTargetStep3Title'),
      body: t('makeTheTargetStep3Body'),
      // One number left, equal to the target: made.
      example: <TargetFigure target={12} made tiles={[null, 12, null]} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      if (canResume('free')) resumeGame('free');
      else startDifficulty(prefs.difficulty);
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen tg-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      {/* The early-release note (docs/WEB_VERSION.md「保存データ」). A first
          visit opens here rather than on the home, and the last step's button
          writes the first save, so the note is read before any step. */}
      <WebBetaNotice gameId="make-the-target" />

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
    </div>
  );
}
