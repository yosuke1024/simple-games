/**
 * Quick Rules (docs/DOMINOES_RULES.md §10): three steps, one sentence each,
 * shown with a small figure of tiles rather than explained in prose. There is
 * no "Learn More" — the game has no published guide yet, and `gameLandingUrl`
 * answers null for it until it does.
 */
import { useState, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconChevronRight, IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useDominoes } from '../../state/GameContext';
import { TileBack, TileFace } from '../components/TileFace';

/** One tile of a figure: lying down unless it is a double (§11). */
function FigureTile({
  first,
  second,
  fresh = false,
}: {
  first: number;
  second: number;
  fresh?: boolean;
}) {
  const upright = first === second;
  return (
    <span
      className={['dm-tile', upright ? 'dm-tile-double' : '', fresh ? 'dm-figure-fresh' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <TileFace first={first} second={second} upright={upright} />
    </span>
  );
}

function Figure({ children }: { children: ReactNode }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="dm-figure">{children}</div>
    </div>
  );
}

/** A 1 at the right end, and the 1–4 joining it there. */
const MATCH = (
  <Figure>
    <FigureTile first={3} second={5} />
    <FigureTile first={5} second={5} />
    <FigureTile first={5} second={1} />
    <FigureTile first={1} second={4} fresh />
  </Figure>
);

/** Nothing fits, so a tile comes off the boneyard. */
const DRAW = (
  <Figure>
    <TileBack />
    <TileBack />
    <TileBack />
    <IconChevronRight className="dm-figure-arrow" />
    <FigureTile first={2} second={6} fresh />
  </Figure>
);

/** The other hand's leftover tiles, and the points they are worth. */
const SCORE = (
  <Figure>
    <FigureTile first={2} second={3} />
    <FigureTile first={4} second={6} />
    <span className="dm-figure-arrow">=</span>
    <span className="dm-figure-total">15</span>
  </Figure>
);

export function DominoesTutorialScreen() {
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, startNewGame, goHome } =
    useDominoes();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('dominoes', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('dominoesStep1Title'), body: t('dominoesStep1Body'), example: MATCH },
    { title: t('dominoesStep2Title'), body: t('dominoesStep2Body'), example: DRAW },
    { title: t('dominoesStep3Title'), body: t('dominoesStep3Body'), example: SCORE },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Straight into play — onto the game already waiting, if one is: the
      // flag and the save are separate records, and a lost flag write must
      // not cost the player the game they left (Yacht's shape).
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
