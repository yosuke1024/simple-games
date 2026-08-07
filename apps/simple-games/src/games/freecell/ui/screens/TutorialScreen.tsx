/**
 * Quick Rules (docs/FREECELL_RULES.md §11): three steps, one sentence each,
 * shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 *
 * The figures are drawn from the board's own card parts, so they cannot drift
 * away from what the table actually looks like — and each one has to obey the
 * rule it teaches (§12).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { cardOf, type Card } from '../../game';
import { useFreeCell } from '../../state/GameContext';
import { rankText } from '../components/cardText';
import { SuitIcon } from '../components/suits';

/** One item in a figure: a card, an empty free cell, or the arrow between them. */
type FigureCard = { readonly card: Card } | { readonly card: null } | { readonly arrow: true };

/** A few cards from the real table, drawn the way the board draws them. */
function CardsFigure({ cards }: { cards: FigureCard[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="fc-figure">
        {cards.map((item, index) =>
          'arrow' in item ? (
            <span key={index} className="fc-figure-arrow">
              →
            </span>
          ) : item.card === null ? (
            <span key={index} className="fc-figure-card fc-figure-slot" />
          ) : (
            <span
              key={index}
              className={[
                'fc-figure-card',
                Math.floor(item.card / 13) === 1 || Math.floor(item.card / 13) === 2
                  ? 'fc-card-red'
                  : 'fc-card-black',
              ].join(' ')}
            >
              {rankText(item.card)}
              <SuitIcon suit={Math.floor(item.card / 13) as 0 | 1 | 2 | 3} />
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function FreeCellTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startFree, goHome } = useFreeCell();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('freecell', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('fcStep1Title'),
      body: t('fcStep1Body'),
      // Black 8, red 7, black 6 — the figure has to obey §3 itself, or it
      // teaches the opposite of what the step says.
      example: (
        <CardsFigure
          cards={[{ card: cardOf(0, 8) }, { card: cardOf(1, 7) }, { card: cardOf(3, 6) }]}
        />
      ),
    },
    {
      title: t('fcStep2Title'),
      body: t('fcStep2Body'),
      // A card leaving the table for an empty cell: the move this game is
      // named after.
      example: <CardsFigure cards={[{ card: cardOf(2, 4) }, { arrow: true }, { card: null }]} />,
    },
    {
      title: t('fcStep3Title'),
      body: t('fcStep3Body'),
      // The foundations climb by suit from the ace (§3).
      example: (
        <CardsFigure
          cards={[{ card: cardOf(1, 1) }, { card: cardOf(1, 2) }, { card: cardOf(1, 3) }]}
        />
      ),
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startFree();
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
