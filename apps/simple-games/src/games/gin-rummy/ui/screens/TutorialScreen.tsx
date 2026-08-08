/**
 * Quick Rules: three steps, one sentence each, shown with a figure rather than
 * explained in prose. The long-form rules live on the game's landing page
 * behind "Learn More", which quietly does nothing offline
 * (docs/OFFLINE_POLICY.md) and is absent entirely until that page exists
 * (src/ui/landing.ts).
 *
 * The figures are drawn from the table's own card parts, so they cannot drift
 * away from what the game actually looks like — and each one obeys the rule it
 * teaches: the run really is a run, and the hand really does hold eight points
 * of deadwood.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { cardOf, isRed, suitOf, type Card } from '../../game';
import { useGinRummy } from '../../state/GameContext';
import { rankText } from '../components/cardText';
import { SuitIcon } from '../components/suits';

/** One item in a figure: a card, the face-down stock, or an arrow between them. */
type FigureItem = { readonly card: Card } | { readonly back: true } | { readonly arrow: true };

function CardsFigure({ items }: { items: readonly FigureItem[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="gr-figure">
        {items.map((item, index) =>
          'arrow' in item ? (
            <span key={index} className="gr-figure-arrow">
              →
            </span>
          ) : 'back' in item ? (
            <span key={index} className="gr-figure-card gr-figure-back" />
          ) : (
            <span
              key={index}
              className={`gr-figure-card ${isRed(item.card) ? 'gr-card-red' : 'gr-card-black'}`}
            >
              {rankText(item.card)}
              <SuitIcon suit={suitOf(item.card)} />
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function GinRummyTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useGinRummy();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('gin-rummy', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('ginStep1Title'),
      body: t('ginStep1Body'),
      // The turn itself: one card comes off the stock, one card goes down.
      example: <CardsFigure items={[{ back: true }, { arrow: true }, { card: cardOf(1, 9) }]} />,
    },
    {
      title: t('ginStep2Title'),
      body: t('ginStep2Body'),
      // 5-6-7 of clubs: a real run, in one suit, at consecutive ranks.
      example: (
        <CardsFigure
          items={[{ card: cardOf(3, 5) }, { card: cardOf(3, 6) }, { card: cardOf(3, 7) }]}
        />
      ),
    },
    {
      title: t('ginStep3Title'),
      body: t('ginStep3Body'),
      // Eight points left over — under the limit, so this hand may knock.
      example: (
        <div className="tutorial-example" aria-hidden="true">
          <div className="gr-figure">
            <span className="gr-figure-card gr-card-black">
              {rankText(cardOf(0, 8))}
              <SuitIcon suit={0} />
            </span>
            <span className="gr-figure-note">{t('ginDeadwood')} 8</span>
          </div>
        </div>
      ),
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // The first match is against the gentlest opponent; the others are one
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
