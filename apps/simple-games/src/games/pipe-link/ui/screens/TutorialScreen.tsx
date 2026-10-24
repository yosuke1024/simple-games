/**
 * Quick Rules (docs/PIPE_LINK_RULES.md §9): three steps, one sentence each,
 * each shown with a figure drawn by the board's own tile drawing. There is no
 * "Learn More": the game's guide page is not published while it is in early
 * release (ui/landing.ts). Counter-clockwise turns, the right button and Undo
 * are left out on purpose (§9): they do not fit three steps, and they are on
 * the screen as buttons and spoken names.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game at the
 * remembered difficulty (Easy on a first launch, §8), and hardware Back marks
 * it seen on the way out (state/GameContext.tsx).
 *
 * "The first pass" is read from `pn.flags`, and a lost flags record brings it
 * back over a player who may have a board suspended. That board is resumed
 * rather than replaced by a new one without a word (§8).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { usePipeLink } from '../../state/GameContext';
import { PipeFigure, TurnFigure, type FigureTile } from '../components/PipeFigure';

/**
 * A finished 3×3 with the source in the middle: a spanning tree, every pipe
 * met (§2). Row-major.
 */
const SOLVED_3X3: readonly FigureTile[] = [
  { type: 'end', orientation: 1, lit: true },
  { type: 'tee', orientation: 1, lit: true },
  { type: 'end', orientation: 3, lit: true },
  { type: 'end', orientation: 2, lit: true },
  { type: 'tee', orientation: 0, lit: true, source: true },
  { type: 'elbow', orientation: 2, lit: true },
  { type: 'elbow', orientation: 0, lit: true },
  { type: 'elbow', orientation: 3, lit: true },
  { type: 'end', orientation: 0, lit: true },
];

/**
 * The same board with its last end turned left, at the elbow beside it, which
 * does not face back: it alone is not lit.
 */
const ONE_UNLIT_3X3: readonly FigureTile[] = SOLVED_3X3.map((tile, index) =>
  index === 8 ? { type: 'end', orientation: 3, lit: false } : tile,
);

export function PipeLinkTutorialScreen() {
  const {
    tutorialCompleted,
    completeTutorial,
    startDifficulty,
    canResume,
    resumeGame,
    goHome,
    prefs,
  } = usePipeLink();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('pipeLinkStep1Title'), body: t('pipeLinkStep1Body'), example: <TurnFigure /> },
    {
      title: t('pipeLinkStep2Title'),
      body: t('pipeLinkStep2Body'),
      example: <PipeFigure width={3} tiles={ONE_UNLIT_3X3} />,
    },
    {
      title: t('pipeLinkStep3Title'),
      body: t('pipeLinkStep3Body'),
      example: <PipeFigure width={3} tiles={SOLVED_3X3} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      if (canResume('difficulty')) resumeGame('difficulty');
      else startDifficulty(prefs.difficulty);
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen pn-tutorial">
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
          writes the first save, so the note is read before any step — and it
          is on every step, in one place. */}
      <WebBetaNotice gameId="pipe-link" />

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
