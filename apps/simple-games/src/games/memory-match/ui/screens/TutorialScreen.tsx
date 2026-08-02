/**
 * Quick Rules (docs/MEMORY_MATCH_RULES.md §11): three steps, one sentence
 * each, shown with a figure rather than explained in prose.
 *
 * There is no "Learn More" link yet: this game has no landing page, and a
 * link that 404s is worse than no link (ui/landing.ts). Add the button back
 * the day the guide exists on the landing site.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { useMemoryMatch } from '../../state/GameContext';
import { MemorySymbol } from '../components/symbols';

interface FigureCard {
  /** Symbol index, or null for a face-down card. */
  readonly symbol: number | null;
  readonly matched?: boolean;
}

/**
 * A 3×2 corner of a board. Every figure is a position the game could actually
 * be in — a figure that broke the rules would teach the wrong thing.
 */
function BoardFigure({ cards }: { cards: FigureCard[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="mm-figure">
        {cards.map((card, index) => (
          <span
            key={index}
            className={[
              'mm-figure-card',
              card.symbol === null ? 'mm-figure-card-down' : '',
              card.matched ? 'mm-figure-card-matched' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {card.symbol !== null ? <MemorySymbol symbol={card.symbol} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function MemoryTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, goHome } = useMemoryMatch();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('memoryStep1Title'),
      body: t('memoryStep1Body'),
      // Two cards turned, and they match: the pair locks face up.
      example: (
        <BoardFigure
          cards={[
            { symbol: 4, matched: true },
            { symbol: null },
            { symbol: 4, matched: true },
            { symbol: null },
            { symbol: null },
            { symbol: null },
          ]}
        />
      ),
    },
    {
      title: t('memoryStep2Title'),
      body: t('memoryStep2Body'),
      // A miss: both cards stay visible — there is no timer to beat.
      example: (
        <BoardFigure
          cards={[
            { symbol: 2 },
            { symbol: null },
            { symbol: 8 },
            { symbol: null },
            { symbol: null },
            { symbol: null },
          ]}
        />
      ),
    },
    {
      title: t('memoryStep3Title'),
      body: t('memoryStep3Body'),
      // The finished corner: everything matched (§2).
      example: (
        <BoardFigure
          cards={[
            { symbol: 4, matched: true },
            { symbol: 2, matched: true },
            { symbol: 4, matched: true },
            { symbol: 8, matched: true },
            { symbol: 8, matched: true },
            { symbol: 2, matched: true },
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
      startDifficulty('easy');
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
    </div>
  );
}
