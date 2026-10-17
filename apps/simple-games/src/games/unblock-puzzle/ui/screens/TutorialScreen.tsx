/**
 * Quick Rules (docs/UNBLOCK_PUZZLE_RULES.md §13): three steps, one sentence
 * each, shown with a figure rather than explained in prose — blocks slide
 * along their own line; the target leaves through the exit on the right; one
 * slide is one move, however far it goes. There is no "Learn More": the
 * game's guide page is not published while it is in early release
 * (ui/landing.ts).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a board
 * straight away, at the difficulty the home would lead with, and hardware
 * Back marks it seen on the way out (state/GameContext.tsx).
 */
import { Fragment, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useUnblockPuzzle } from '../../state/GameContext';
import { UnblockFigure } from '../components/UnblockFigure';

export function UnblockPuzzleTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startFree, resumeGame, sessions, prefs, goHome } =
    useUnblockPuzzle();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('unblockPuzzleStep1Title'),
      body: t('unblockPuzzleStep1Body'),
      // An upright block that slides down, a lying one that slides either way.
      example: (
        <UnblockFigure
          cols={6}
          rows={3}
          exitRow={null}
          blocks={[
            { x: 0, y: 0, w: 1, h: 2, kind: 'v' },
            { x: 2, y: 1, w: 2, h: 1, kind: 'h' },
          ]}
          arrows={[
            { x1: 0.5, y1: 2.15, x2: 0.5, y2: 2.85 },
            { x1: 1.85, y1: 1.5, x2: 1.15, y2: 1.5 },
            { x1: 4.15, y1: 1.5, x2: 5.6, y2: 1.5 },
          ]}
        />
      ),
    },
    {
      title: t('unblockPuzzleStep2Title'),
      body: t('unblockPuzzleStep2Body'),
      // The way cleared, the target heads out through the gap in the frame.
      example: (
        <UnblockFigure
          cols={6}
          rows={4}
          exitRow={1}
          blocks={[
            { x: 1, y: 1, w: 2, h: 1, kind: 'target' },
            { x: 4, y: 2, w: 1, h: 2, kind: 'v' },
            { x: 0, y: 3, w: 3, h: 1, kind: 'h' },
            { x: 4, y: 0, w: 2, h: 1, kind: 'h' },
          ]}
          arrows={[{ x1: 3.15, y1: 1.5, x2: 5.75, y2: 1.5 }]}
        />
      ),
    },
    {
      title: t('unblockPuzzleStep3Title'),
      body: t('unblockPuzzleStep3Body'),
      // Three cells in one slide, counted once.
      example: (
        <UnblockFigure
          cols={6}
          rows={1}
          exitRow={null}
          blocks={[
            { x: 0, y: 0, w: 2, h: 1, kind: 'h', was: true },
            { x: 3, y: 0, w: 2, h: 1, kind: 'h' },
          ]}
          arrows={[{ x1: 1.85, y1: 0.5, x2: 2.85, y2: 0.5 }]}
          badge={{ x: 5.5, y: 0.5, value: 1 }}
        />
      ),
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Quick Rules can come back with a Free Play board still in progress
      // (its flags record unreadable, §12). That board is picked up, never
      // replaced without the question the home would ask (§11).
      if (sessions.free?.status === 'playing') resumeGame('free');
      else startFree(prefs.difficulty);
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen ub-tutorial">
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
          is on every step, in one place, so the steps keep their layout.
          Nothing on the app, or once the title is released. */}
      <WebBetaNotice gameId="unblock-puzzle" />

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        {/* Keyed by step, so each step's figure is its own picture. */}
        <Fragment key={step}>{current.example}</Fragment>
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
