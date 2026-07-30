import { LANDING_BASE_URL } from '@simple-games/brand';
import { useState } from 'react';
import { useApp } from '../../state/GameContext';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { openExternal } from '@/ui/openExternal';

/**
 * Static example tiles used inside the 3-step tutorial.
 * `mark` shows ○ / ✕ so the allowed and blocked cases read at a glance,
 * without any wording to translate.
 */
function ExampleTiles({
  values,
  note,
  mark,
  blockedAt,
}: {
  values: string[];
  note?: string;
  mark?: 'ok' | 'no';
  /** Indices drawn as "in the way" (matches the in-game blocked styling). */
  blockedAt?: number[];
}) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="tutorial-tiles">
        {mark ? (
          <span className={`tutorial-mark tutorial-mark-${mark}`}>{mark === 'ok' ? '○' : '✕'}</span>
        ) : null}
        {values.map((value, index) =>
          value === '.' ? (
            <span key={index} className="tutorial-tile tutorial-tile-empty" />
          ) : (
            <span
              key={index}
              className={`tutorial-tile ${blockedAt?.includes(index) ? 'tutorial-tile-blocked' : ''}`}
            >
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
  const { t, locale } = useSettings();
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
      example: (
        <>
          <ExampleTiles values={['7', '.', '.', '7']} mark="ok" />
          <ExampleTiles values={['7', '3', '7']} mark="no" blockedAt={[1]} />
        </>
      ),
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

      {/* Quick Rules live here; the long-form rules live on the game's
          landing page. Offline the tap quietly does nothing (openExternal). */}
      <div className="home-links">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => openExternal(`${LANDING_BASE_URL}/games/number-match/${locale}/`)}
        >
          {t('learnMore')}
        </button>
      </div>
    </div>
  );
}
