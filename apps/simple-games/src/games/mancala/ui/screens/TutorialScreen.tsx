/**
 * Quick Rules (docs/MANCALA_RULES.md §9): three steps, one sentence each,
 * shown with a figure rather than explained in prose. Each figure is the
 * board before the move the step is about: the pit to sow ringed, the pits
 * its seeds reach tinted, the place the last seed lands filled — and, for the
 * capture, the pit across that it takes.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useMancala } from '../../state/GameContext';

/** The pit sown from, pits the seeds reach, where the last lands, and what a capture takes. */
type Mark = 'from' | 'to' | 'last' | 'take' | null;

interface FigureSpec {
  /** Top row as drawn, left to right (the CPU's pits 12 … 7). */
  readonly cpuRow: readonly number[];
  /** Bottom row as drawn, left to right (the player's pits 0 … 5). */
  readonly playerRow: readonly number[];
  readonly cpuStore: number;
  readonly playerStore: number;
  /** Marks by drawn position: 'c0'…'c5' top row, 'p0'…'p5' bottom, 'cs'/'ps' stores. */
  readonly marks: Readonly<Record<string, Mark>>;
}

/** A small, still copy of the board — digits only, no dots (§9). */
function BoardFigure({ spec }: { spec: FigureSpec }) {
  const cell = (key: string, count: number, className: string) => {
    const mark = spec.marks[key] ?? null;
    return (
      <span key={key} className={`${className} ${mark ? `mc-fig-${mark}` : ''}`}>
        {count}
      </span>
    );
  };
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="mc-figure">
        {cell('cs', spec.cpuStore, 'mc-fig-store mc-fig-store-cpu')}
        {spec.cpuRow.map((count, i) => cell(`c${i}`, count, 'mc-fig-pit mc-fig-pit-cpu'))}
        {spec.playerRow.map((count, i) => cell(`p${i}`, count, 'mc-fig-pit mc-fig-pit-you'))}
        {cell('ps', spec.playerStore, 'mc-fig-store mc-fig-store-you')}
      </div>
    </div>
  );
}

/** Pit 2's four seeds go to the next four pits along. */
const SOW: FigureSpec = {
  cpuRow: [4, 4, 4, 4, 4, 4],
  playerRow: [4, 4, 4, 4, 4, 4],
  cpuStore: 0,
  playerStore: 0,
  marks: { p1: 'from', p2: 'to', p3: 'to', p4: 'to', p5: 'last' },
};

/** Pit 3's four seeds: the last one lands in the store. */
const AGAIN: FigureSpec = {
  cpuRow: [4, 4, 4, 4, 4, 4],
  playerRow: [4, 4, 4, 4, 4, 4],
  cpuStore: 0,
  playerStore: 0,
  marks: { p2: 'from', p3: 'to', p4: 'to', p5: 'to', ps: 'last' },
};

/** Pit 2's two seeds end in the empty pit 4, across from five. */
const CAPTURE: FigureSpec = {
  cpuRow: [4, 4, 4, 5, 4, 4],
  playerRow: [4, 2, 4, 0, 5, 5],
  cpuStore: 3,
  playerStore: 0,
  marks: { p1: 'from', p2: 'to', p3: 'last', c3: 'take' },
};

export function MancalaTutorialScreen() {
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, startNewGame, goHome } =
    useMancala();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('mancala', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('mancalaStep1Title'),
      body: t('mancalaStep1Body'),
      example: <BoardFigure spec={SOW} />,
    },
    {
      title: t('mancalaStep2Title'),
      body: t('mancalaStep2Body'),
      example: <BoardFigure spec={AGAIN} />,
    },
    {
      title: t('mancalaStep3Title'),
      body: t('mancalaStep3Body'),
      example: <BoardFigure spec={CAPTURE} />,
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
      // Otherwise the first match is against the gentlest opponent; the others are one
      // tap away on the home screen (§4, §9).
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
