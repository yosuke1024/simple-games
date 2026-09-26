/**
 * Quick Rules (docs/HIT_AND_BLOW_RULES.md §9): three steps, one sentence
 * each, shown with a figure rather than explained in prose. The figures use
 * the board's own symbols and history row, so what they show is what the
 * game will look like. There is no "Learn More" yet — the game has no landing
 * page while it is in early release (ui/landing.ts decides that, not this
 * screen).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { judge } from '../../game';
import { useHitAndBlow } from '../../state/GameContext';
import { GuessRow, Pegs } from '../components/GuessRow';

/** The hidden row: four covered slots. Decorative. */
function HiddenRowFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="hb-figure-code">
        {[0, 1, 2, 3].map((slot) => (
          <span key={slot} className="hb-slot hb-slot-hidden">
            ?
          </span>
        ))}
      </div>
    </div>
  );
}

/** A secret for the figures (circle, star, square, heart) and a guess against it. */
const FIGURE_SECRET = [0, 4, 2, 7];
const FIGURE_GUESS = [0, 2, 5, 1];

/** A checked guess with its pegs. Decorative. */
function GuessFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="hb-figure-row">
        <GuessRow guess={FIGURE_GUESS} feedback={judge(FIGURE_SECRET, FIGURE_GUESS)} number={1} />
      </div>
    </div>
  );
}

/** The two pegs, named. Decorative: the sentence below says the same. */
function LegendFigure({ hit, blow }: { hit: string; blow: string }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="hb-legend">
        <span className="hb-legend-item">
          <Pegs feedback={{ hits: 1, blows: 0 }} slots={1} />
          {hit}
        </span>
        <span className="hb-legend-item">
          <Pegs feedback={{ hits: 0, blows: 1 }} slots={1} />
          {blow}
        </span>
      </div>
    </div>
  );
}

export function HitAndBlowTutorialScreen() {
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, startNewGame, goHome } =
    useHitAndBlow();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('hit-and-blow', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('hitAndBlowStep1Title'),
      body: t('hitAndBlowStep1Body'),
      example: <HiddenRowFigure />,
    },
    {
      title: t('hitAndBlowStep2Title'),
      body: t('hitAndBlowStep2Body'),
      example: <GuessFigure />,
    },
    {
      title: t('hitAndBlowStep3Title'),
      body: t('hitAndBlowStep3Body'),
      example: <LegendFigure hit={t('hitAndBlowHit')} blow={t('hitAndBlowBlow')} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Straight into play — onto the game already waiting, if one is: the
      // flag and the save are separate records, and a lost flag write must
      // not cost the player the game they left (Yacht's shape).
      // Otherwise the first game is the smallest one; the others are one tap away on
      // the home screen (§9).
      if (canResume) resumeGame();
      else startNewGame('easy');
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
