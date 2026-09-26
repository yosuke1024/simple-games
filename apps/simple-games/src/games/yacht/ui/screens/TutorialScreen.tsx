/**
 * Quick Rules (docs/YACHT_RULES.md §8): three steps, one or two sentences
 * each, shown with a figure rather than explained in prose. The figures are
 * dice and digits only — nothing in them needs translating.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useYacht } from '../../state/GameContext';
import { DieFace } from '../components/YachtDice';

/** A row of five small dice; `kept` ones are drawn lifted and framed. */
function DiceFigure({ faces, kept = [] }: { faces: readonly number[]; kept?: readonly number[] }) {
  return (
    <div className="yt-figure-dice">
      {faces.map((face, index) => (
        <span
          key={index}
          className={`yt-figure-die ${kept.includes(index) ? 'yt-figure-die-kept' : ''}`}
        >
          <DieFace face={face} />
        </span>
      ))}
    </div>
  );
}

/** Keeping the three fours: tap a die and it stays out of the next throw. */
function KeepFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <DiceFigure faces={[6, 4, 4, 2, 4]} kept={[1, 2, 4]} />
    </div>
  );
}

/** The others thrown again, with two of the turn's three throws used. */
function RerollFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <DiceFigure faces={[4, 4, 4, 1, 4]} kept={[1, 2, 4]} />
      <div className="yt-figure-rolls">
        <span className="yt-figure-roll yt-figure-roll-used" />
        <span className="yt-figure-roll yt-figure-roll-used" />
        <span className="yt-figure-roll" />
      </div>
    </div>
  );
}

/** Four fours go in a box as 16, and the turn is over. */
function ScoreFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <DiceFigure faces={[4, 4, 4, 1, 4]} />
      <span className="yt-figure-box">16</span>
    </div>
  );
}

export function YachtTutorialScreen() {
  const { tutorialCompleted, canResume, completeTutorial, startNewGame, resumeGame, goHome } =
    useYacht();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('yacht', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('yachtStep1Title'), body: t('yachtStep1Body'), example: <KeepFigure /> },
    { title: t('yachtStep2Title'), body: t('yachtStep2Body'), example: <RerollFigure /> },
    { title: t('yachtStep3Title'), body: t('yachtStep3Body'), example: <ScoreFigure /> },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Straight into play (§8) — onto the sheet already waiting, if one is:
      // the flag and the save are separate records, and a lost flag write
      // must not cost the player the game they left.
      if (canResume) resumeGame();
      else startNewGame();
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
