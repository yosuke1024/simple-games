/**
 * Quick Rules (docs/SPIDER_SOLITAIRE_RULES.md §11): three steps, one sentence
 * each, shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 *
 * The figures are drawn with the board's own card parts, and each one has to
 * obey the rule it teaches (§12). Step 2's figure is all one suit for exactly
 * that reason — it is the step about suits.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { cardOf, suitOf, type Card } from '../../game';
import { useSpider } from '../../state/GameContext';
import { rankText } from '../components/cardText';
import { SuitIcon } from '../components/suits';

/** One item in a figure: a card, a face-down card, or the arrow between them. */
type FigureItem = { readonly card: Card } | { readonly down: true } | { readonly arrow: true };

/** Figures are drawn at four suits, so every suit can appear. */
const FIGURE_SUITS = 4;

function CardsFigure({ items }: { items: FigureItem[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sp-figure">
        {items.map((item, index) =>
          'arrow' in item ? (
            <span key={index} className="sp-figure-arrow">
              →
            </span>
          ) : 'down' in item ? (
            <span key={index} className="sp-figure-card sp-card-back" />
          ) : (
            <span
              key={index}
              className={[
                'sp-figure-card',
                suitOf(item.card, FIGURE_SUITS) === 1 || suitOf(item.card, FIGURE_SUITS) === 2
                  ? 'sp-card-red'
                  : 'sp-card-black',
              ].join(' ')}
            >
              {rankText(item.card)}
              <SuitIcon suit={suitOf(item.card, FIGURE_SUITS)} />
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export function SpiderTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startFree, goHome } = useSpider();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('spider-solitaire', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('spiderStep1Title'),
      body: t('spiderStep1Body'),
      // A black 9 with a red 8 on it: legal here, and the point of the step —
      // in Spider the suits need not alternate, or even differ.
      example: (
        <CardsFigure
          items={[{ card: cardOf(0, 9, FIGURE_SUITS) }, { card: cardOf(1, 8, FIGURE_SUITS) }]}
        />
      ),
    },
    {
      title: t('spiderStep2Title'),
      body: t('spiderStep2Body'),
      // All spades, descending: the only kind of run that travels as one (§3).
      example: (
        <CardsFigure
          items={[
            { card: cardOf(0, 9, FIGURE_SUITS) },
            { card: cardOf(0, 8, FIGURE_SUITS) },
            { card: cardOf(0, 7, FIGURE_SUITS) },
          ]}
        />
      ),
    },
    {
      title: t('spiderStep3Title'),
      body: t('spiderStep3Body'),
      // The stock turning into one more card on a column.
      example: (
        <CardsFigure
          items={[{ down: true }, { arrow: true }, { card: cardOf(2, 4, FIGURE_SUITS) }]}
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
