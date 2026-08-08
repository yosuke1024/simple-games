/**
 * Quick Rules (docs/TAKUZU_RULES.md §12): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useTakuzu } from '../../state/GameContext';

/**
 * One or two lines of a real board. Every figure is a line the game could
 * actually deal — all three rules hold in each of them — because a figure that
 * broke the rules would teach the wrong thing.
 *
 * `mark` names the cell the step is about, as [line, cell].
 */
function LineFigure({
  lines,
  mark,
}: {
  lines: readonly string[];
  mark?: readonly [number, number];
}) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="takuzu-figure">
        {lines.map((cells, line) => (
          <div key={line} className="takuzu-figure-line">
            {[...cells].map((cell, index) => (
              <span
                key={index}
                className={[
                  'takuzu-figure-cell',
                  cell === '0' ? 'takuzu-cell-zero' : '',
                  cell === '1' ? 'takuzu-cell-one' : '',
                  mark?.[0] === line && mark[1] === index ? 'takuzu-figure-cell-mark' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="takuzu-figure-digit">{cell === '.' ? '' : cell}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TakuzuTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useTakuzu();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('takuzu', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('takuzuStep1Title'),
      body: t('takuzuStep1Body'),
      // Two ones already sit together, so the third square can only be a zero.
      example: <LineFigure lines={['110010']} mark={[0, 2]} />,
    },
    {
      title: t('takuzuStep2Title'),
      body: t('takuzuStep2Body'),
      // A finished line: three zeros, three ones.
      example: <LineFigure lines={['010110']} />,
    },
    {
      title: t('takuzuStep3Title'),
      body: t('takuzuStep3Body'),
      // Two finished lines that are allowed to stand together, because the
      // marked square is where they part.
      example: <LineFigure lines={['010110', '010101']} mark={[1, 4]} />,
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
