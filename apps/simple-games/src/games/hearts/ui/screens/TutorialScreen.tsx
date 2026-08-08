/**
 * Quick Rules: three steps, one sentence each, shown with a figure rather than
 * explained in prose. The long-form rules live on the game's landing page
 * behind "Learn More", which quietly does nothing offline
 * (docs/OFFLINE_POLICY.md) and is absent entirely until that page exists
 * (src/ui/landing.ts).
 *
 * The figures are drawn from the table's own card parts, so they cannot drift
 * away from what the game actually looks like — and each one obeys the rule it
 * teaches: three cards really do go to the pass, the card that follows really
 * is of the suit that was led, and the two cards with a price on them really
 * are the ones that cost.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { cardOf, isRed, RANK_ACE, RANK_QUEEN, suitOf, type Card } from '../../game';
import { useHearts } from '../../state/GameContext';
import { rankText } from '../components/cardText';
import { SuitIcon } from '../components/suits';

/** One item in a figure: a card, an arrow, or a price hung beside a card. */
type FigureItem = { readonly card: Card; readonly note?: string } | { readonly arrow: true };

function CardsFigure({ items }: { items: readonly FigureItem[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="ht-figure">
        {items.map((item, index) =>
          'arrow' in item ? (
            <span key={index} className="ht-figure-arrow">
              →
            </span>
          ) : (
            <span key={index} className="ht-figure-pair">
              <span
                className={`ht-figure-card ${isRed(item.card) ? 'ht-card-red' : 'ht-card-black'}`}
              >
                {rankText(item.card)}
                <SuitIcon suit={suitOf(item.card)} />
              </span>
              {item.note === undefined ? null : <span className="ht-figure-note">{item.note}</span>}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function HeartsTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useHearts();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('hearts', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('heartsStep1Title'),
      body: t('heartsStep1Body'),
      // Three cards leaving the hand: the pass, and exactly three of them.
      example: (
        <CardsFigure
          items={[
            { card: cardOf(0, 12) },
            { card: cardOf(1, 13) },
            { card: cardOf(2, 3) },
            { arrow: true },
          ]}
        />
      ),
    },
    {
      title: t('heartsStep2Title'),
      body: t('heartsStep2Body'),
      // Clubs led, clubs followed — and the higher club is the one that takes it.
      example: <CardsFigure items={[{ card: cardOf(3, 4) }, { card: cardOf(3, 8) }]} />,
    },
    {
      title: t('heartsStep3Title'),
      body: t('heartsStep3Body'),
      // The whole price list: a heart is one, the queen of spades is thirteen.
      example: (
        <CardsFigure
          items={[
            { card: cardOf(1, RANK_ACE), note: '+1' },
            { card: cardOf(0, RANK_QUEEN), note: '+13' },
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
      // The first match is against the gentlest opponents; the others are one
      // tap away on the home screen.
      startNewGame('easy');
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
