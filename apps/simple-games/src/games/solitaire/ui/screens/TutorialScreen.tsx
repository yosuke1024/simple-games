/**
 * Quick Rules (docs/SOLITAIRE_RULES.md §11): three steps, one sentence each,
 * shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { cardOf, type Card } from '../../game';
import { useSolitaire } from '../../state/GameContext';
import { rankText } from '../components/cardText';
import { SuitIcon } from '../components/suits';

interface FigureCard {
  /** A card, or null for a face-down card. */
  readonly card: Card | null;
  readonly marked?: boolean;
}

/** A few cards from the real table, drawn the way the board draws them. */
function CardsFigure({ cards }: { cards: FigureCard[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sol-figure">
        {cards.map((item, index) =>
          item.card === null ? (
            <span key={index} className="sol-figure-card sol-card-back" />
          ) : (
            <span
              key={index}
              className={[
                'sol-figure-card',
                Math.floor(item.card / 13) === 1 || Math.floor(item.card / 13) === 2
                  ? 'sol-card-red'
                  : 'sol-card-black',
                item.marked ? 'sol-figure-card-marked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
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

export function SolitaireTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startFree, goHome } = useSolitaire();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('solitaire', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('solStep1Title'),
      body: t('solStep1Body'),
      // Black 8, red 7, black 6 — the figure has to obey §3 itself, or it
      // teaches the opposite of what the step says. Every card is marked so
      // the eye follows the colour alternating down the run.
      example: (
        <CardsFigure
          cards={[
            { card: cardOf(0, 8), marked: true },
            { card: cardOf(1, 7), marked: true },
            { card: cardOf(3, 6), marked: true },
          ]}
        />
      ),
    },
    {
      title: t('solStep2Title'),
      body: t('solStep2Body'),
      // Moving the run frees the face-down card behind it.
      example: (
        <CardsFigure
          cards={[
            { card: null },
            { card: cardOf(3, 10), marked: true },
            { card: cardOf(2, 9), marked: true },
          ]}
        />
      ),
    },
    {
      title: t('solStep3Title'),
      body: t('solStep3Body'),
      // The foundations climb by suit from the ace (§3).
      example: (
        <CardsFigure
          cards={[
            { card: cardOf(1, 1), marked: true },
            { card: cardOf(1, 2), marked: true },
            { card: cardOf(1, 3), marked: true },
          ]}
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
