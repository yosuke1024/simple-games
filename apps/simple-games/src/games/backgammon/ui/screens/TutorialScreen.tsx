/**
 * Quick Rules (docs/BACKGAMMON_RULES.md §10): three steps, one sentence each
 * with a figure, leading straight into play (docs/PRODUCT_PRINCIPLES.md
 * 「初回体験の原則」). The figures are drawn with the board's own parts.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a match, and
 * hardware Back marks it seen on the way out (state/GameContext.tsx). The
 * long-form rules live on the game's landing page behind "Learn More", which
 * is absent until the page exists (ui/landing.ts).
 *
 * The early-release notice under the header is the shell's too: a first
 * visit opens here rather than on the home, and the last step's button
 * writes the first save, so the notice is read before anything is saved.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useBackgammon } from '../../state/GameContext';

function Figure({ step }: { step: number }) {
  // Three points of a home board and the tray, drawn with the board's shapes.
  const points = (y: number, down: boolean) =>
    [0, 1, 2, 3].map((i) => {
      const x = 8 + i * 22;
      const d = down
        ? `M${x} ${y}h20L${x + 10} ${y + 34}z`
        : `M${x} ${y}h20L${x + 10} ${y - 34}z`;
      return <path key={i} d={d} className={i % 2 ? 'bk-fig-point-a' : 'bk-fig-point-b'} />;
    });
  return (
    <svg className="bk-figure" viewBox="0 0 120 64" aria-hidden="true">
      {step === 0 ? (
        <>
          {points(60, false)}
          <circle cx="40" cy="52" r="7" className="bk-fig-you" />
          <circle cx="18" cy="52" r="7" className="bk-fig-you" />
          <path d="M34 30h-20" className="bk-fig-arrow" markerEnd="url(#bk-arrow)" />
          <rect x="84" y="6" width="14" height="14" rx="3" className="bk-fig-die" />
          <rect x="102" y="6" width="14" height="14" rx="3" className="bk-fig-die" />
          <circle cx="91" cy="13" r="1.8" className="bk-fig-pip" />
          <circle cx="106" cy="10" r="1.8" className="bk-fig-pip" />
          <circle cx="112" cy="16" r="1.8" className="bk-fig-pip" />
          <defs>
            <marker id="bk-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0L6 3L0 6z" className="bk-fig-arrow-head" />
            </marker>
          </defs>
        </>
      ) : step === 1 ? (
        <>
          {points(60, false)}
          <circle cx="62" cy="52" r="7" className="bk-fig-cpu" />
          <circle cx="18" cy="52" r="7" className="bk-fig-you" />
          <path d="M26 44q18-26 30-8" className="bk-fig-arrow" markerEnd="url(#bk-arrow2)" />
          <rect x="100" y="4" width="12" height="56" rx="3" className="bk-fig-bar" />
          <circle cx="106" cy="16" r="5" className="bk-fig-cpu" />
          <defs>
            <marker id="bk-arrow2" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0L6 3L0 6z" className="bk-fig-arrow-head" />
            </marker>
          </defs>
        </>
      ) : (
        <>
          {points(60, false)}
          <circle cx="18" cy="52" r="7" className="bk-fig-you" />
          <circle cx="18" cy="37" r="7" className="bk-fig-you" />
          <circle cx="40" cy="52" r="7" className="bk-fig-you" />
          <rect x="100" y="4" width="14" height="56" rx="3" className="bk-fig-bar" />
          <rect x="102" y="46" width="10" height="4" className="bk-fig-you" />
          <rect x="102" y="40" width="10" height="4" className="bk-fig-you" />
          <path d="M70 40h24" className="bk-fig-arrow" markerEnd="url(#bk-arrow3)" />
          <defs>
            <marker id="bk-arrow3" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0L6 3L0 6z" className="bk-fig-arrow-head" />
            </marker>
          </defs>
        </>
      )}
    </svg>
  );
}

export function BackgammonTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, difficulty, goHome } = useBackgammon();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('backgammon', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('backgammonStep1Title'), body: t('backgammonStep1Body') },
    { title: t('backgammonStep2Title'), body: t('backgammonStep2Body') },
    { title: t('backgammonStep3Title'), body: t('backgammonStep3Body') },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startNewGame(difficulty);
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

      <WebBetaNotice gameId="backgammon" />

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <Figure step={step} />
        <h2 className="tutorial-title">{current.title}</h2>
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
