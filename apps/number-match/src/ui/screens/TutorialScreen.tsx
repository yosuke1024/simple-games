import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';

/** Static example tiles used inside the 3-step tutorial. */
function ExampleTiles({ values, note }: { values: string[]; note?: string }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="tutorial-tiles">
        {values.map((value, index) =>
          value === '.' ? (
            <span key={index} className="tutorial-tile tutorial-tile-empty" />
          ) : (
            <span key={index} className="tutorial-tile">
              {value}
            </span>
          ),
        )}
      </div>
      {note ? <span className="tutorial-note">{note}</span> : null}
    </div>
  );
}

/**
 * First run: 3 short steps, then straight into a game (spec §17).
 * Revisited from Home/Settings as "How to Play" with a Close action.
 */
export function TutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useApp();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('step1Title'),
      body: t('step1Body'),
      example: <ExampleTiles values={['4', '6']} note="4 + 6 = 10" />,
    },
    {
      title: t('step2Title'),
      body: t('step2Body'),
      example: <ExampleTiles values={['7', '.', '.', '7']} note="7 ─ ─ 7" />,
    },
    {
      title: t('step3Title'),
      body: t('step3Body'),
      example: <ExampleTiles values={['.', '.', '.', '.']} />,
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
            ✕
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
    </div>
  );
}
