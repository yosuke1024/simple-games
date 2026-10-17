/**
 * Quick Rules (docs/BRIDGES_RULES.md §12): three steps, one sentence each,
 * shown with a figure rather than explained in prose. There is no "Learn
 * More": the game's guide page is not published while it is in early release
 * (ui/landing.ts).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game at the
 * remembered difficulty (Easy on a first launch, §8), and hardware Back marks
 * it seen on the way out (state/GameContext.tsx).
 *
 * "The first pass" is read from `bg.flags`, and a lost flags record brings it
 * back over a player who may have a board suspended. That board is resumed,
 * whatever its difficulty, rather than replaced by a new one at the
 * remembered difficulty without a word (§10, §12).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useBridges } from '../../state/GameContext';
import { BridgesFigure } from '../components/BridgesFigure';

export function BridgesTutorialScreen() {
  const {
    tutorialCompleted,
    completeTutorial,
    startDifficulty,
    canResume,
    resumeGame,
    goHome,
    prefs,
  } = useBridges();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('bridgesStep1Title'),
      body: t('bridgesStep1Body'),
      // A finished board: every island carries exactly its number.
      example: (
        <BridgesFigure
          width={5}
          height={3}
          islands={[
            { index: 0, value: 3, state: 'complete' },
            { index: 4, value: 3, state: 'complete' },
            { index: 10, value: 1, state: 'complete' },
            { index: 14, value: 1, state: 'complete' },
          ]}
          bridges={[
            { from: 0, to: 4, count: 2 },
            { from: 0, to: 10, count: 1 },
            { from: 4, to: 14, count: 1 },
          ]}
        />
      ),
    },
    {
      title: t('bridgesStep2Title'),
      body: t('bridgesStep2Body'),
      // Two bridges across; the one down would cross them, so it cannot be built.
      example: (
        <BridgesFigure
          width={5}
          height={5}
          islands={[
            { index: 2, value: 1, state: 'open' },
            { index: 10, value: 2, state: 'complete' },
            { index: 14, value: 2, state: 'complete' },
            { index: 22, value: 1, state: 'open' },
          ]}
          bridges={[{ from: 10, to: 14, count: 2 }]}
          blocked={[{ from: 2, to: 22, at: 12 }]}
        />
      ),
    },
    {
      title: t('bridgesStep3Title'),
      body: t('bridgesStep3Body'),
      // One island selected, its partners ringed, one bridge already built.
      example: (
        <BridgesFigure
          width={5}
          height={4}
          islands={[
            { index: 6, value: 3, state: 'open', selected: true },
            { index: 9, value: 2, state: 'open', partner: true },
            { index: 16, value: 1, state: 'complete', partner: true },
            { index: 19, value: 2, state: 'open' },
          ]}
          bridges={[{ from: 6, to: 16, count: 1 }]}
          candidates={[{ from: 6, to: 9 }]}
        />
      ),
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
    <div className="screen tutorial-screen bg-tutorial">
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
      <WebBetaNotice gameId="bridges" />

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
