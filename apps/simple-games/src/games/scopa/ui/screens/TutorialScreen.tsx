/**
 * Quick Rules (docs/SCOPA_RULES.md §10): three steps, one sentence each,
 * leading straight into play (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」).
 * The figures are drawn from the table's own card parts, and each one obeys
 * the rule it teaches (ui/tutorialFigures.ts): the 5♣ is marked onto the 5♥
 * only, though 2♠ + 3♦ also make five; the 7♥ takes 2♣ + 5♠ and empties the
 * table; the four best cards really do add up to 81. Nothing in a figure
 * needs translating — faces are ASCII, suits are shapes, values are digits.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a match, and
 * hardware Back marks it seen on the way out (state/GameContext.tsx). The
 * long-form rules live on the game's landing page behind "Learn More", which
 * is absent until the page exists (ui/landing.ts).
 *
 * The early-release notice under the header is the shell's too
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): a first visit opens here, and the
 * last step's button writes the first save, so the notice is read first.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { primieraValueOf, type Card } from '../../game';
import { useScopa } from '../../state/GameContext';
import { MiniCard, ScopaMark } from '../components/CardFace';
import { FIGURE_PRIMIERA, FIGURE_SAME, FIGURE_SCOPA } from '../tutorialFigures';

function Row({ cards, marked = [] }: { cards: readonly Card[]; marked?: readonly Card[] }) {
  return (
    <span className="sc-figure-row">
      {cards.map((card) => (
        <MiniCard
          key={card}
          card={card}
          className={`sc-figure-card ${marked.includes(card) ? 'sc-figure-marked' : ''}`}
        />
      ))}
    </span>
  );
}

function SameFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sc-figure">
        <Row cards={FIGURE_SAME.table} marked={FIGURE_SAME.marked} />
        <MiniCard card={FIGURE_SAME.lifted} className="sc-figure-card sc-figure-lifted" />
      </div>
    </div>
  );
}

function ScopaFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sc-figure sc-figure-across">
        <MiniCard card={FIGURE_SCOPA.played} className="sc-figure-card" />
        <Row cards={FIGURE_SCOPA.table} marked={FIGURE_SCOPA.table} />
        <span className="sc-figure-arrow">→</span>
        <span className="sc-figure-empty">
          <ScopaMark />
        </span>
      </div>
    </div>
  );
}

function PrimieraFigure() {
  const total = FIGURE_PRIMIERA.best.reduce((sum, card) => sum + primieraValueOf(card), 0);
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sc-figure sc-figure-across">
        <MiniCard card={FIGURE_PRIMIERA.settebello} className="sc-figure-card" />
        <span className="sc-figure-gap" />
        {FIGURE_PRIMIERA.best.map((card) => (
          <span key={card} className="sc-primiera-slot">
            <MiniCard card={card} />
            <span className="sc-primiera-value">{primieraValueOf(card)}</span>
          </span>
        ))}
        <span className="sc-primiera-total">= {total}</span>
      </div>
    </div>
  );
}

export function ScopaTutorialScreen() {
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, startNewGame, goHome } =
    useScopa();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('scopa', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('scopaStep1Title'), body: t('scopaStep1Body'), example: <SameFigure /> },
    { title: t('scopaStep2Title'), body: t('scopaStep2Body'), example: <ScopaFigure /> },
    { title: t('scopaStep3Title'), body: t('scopaStep3Body'), example: <PrimieraFigure /> },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Onto the match already waiting, if one is: the flag and the save are
      // separate records, and a lost flag must not cost the player the match
      // they left (§9.3). Otherwise the first match.
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

      <WebBetaNotice gameId="scopa" />

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
