/**
 * Quick Rules (docs/LUDO_RULES.md §11): five steps, one sentence each, shown
 * with a figure drawn from the board's own parts so it cannot drift away from
 * what the game actually looks like.
 *
 * **Two of the five exist because we differ from the mainstream** (§0, §13),
 * and a player who learned Ludo from another app will otherwise be wrong about
 * both:
 *
 *   - Stacking your own pawns blocks nothing and guards nothing. Most
 *     implementations make a same-colour pair a blockade; here a pile is a
 *     target, and an enemy landing on it sends the whole stack back at once.
 *   - Capturing does not earn another throw. Only a six does.
 *
 * The dice step says only what is true and checkable — the faces come from the
 * match seed, each is equally likely, and no seat is thrown for differently
 * (§3). No competitor is named and no accusation is answered.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useLudo } from '../../state/GameContext';

/** One figure: a row of pawn chips, with an optional arrow between them. */
type FigureItem =
  { readonly seat: 0 | 1 | 2 | 3 } | { readonly arrow: true } | { readonly die: number };

function Figure({ items }: { items: readonly FigureItem[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="ld-figure">
        {items.map((item, index) =>
          'arrow' in item ? (
            <span key={index} className="ld-figure-arrow">
              →
            </span>
          ) : 'die' in item ? (
            <span key={index} className="ld-figure-die">
              {item.die}
            </span>
          ) : (
            <span key={index} className={`ld-chip ld-chip-big ld-seat-${item.seat}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function LudoTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useLudo();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('ludo', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('ludoStep1Title'),
      body: t('ludoStep1Body'),
      // A six, and a pawn of yours steps out of the yard.
      example: <Figure items={[{ die: 6 }, { arrow: true }, { seat: 0 }]} />,
    },
    {
      title: t('ludoStep2Title'),
      body: t('ludoStep2Body'),
      // Three sixes in a row: the third one is where the turn ends.
      example: <Figure items={[{ die: 6 }, { die: 6 }, { die: 6 }]} />,
    },
    {
      title: t('ludoStep3Title'),
      body: t('ludoStep3Body'),
      // Your pawn lands where two enemy pawns stand, and both go back.
      example: <Figure items={[{ seat: 0 }, { arrow: true }, { seat: 2 }, { seat: 2 }]} />,
    },
    {
      title: t('ludoStep4Title'),
      body: t('ludoStep4Body'),
      // Two of yours on one square is exactly the pile that gets taken.
      example: <Figure items={[{ seat: 0 }, { seat: 0 }, { arrow: true }, { seat: 3 }]} />,
    },
    {
      title: t('ludoStep5Title'),
      body: t('ludoStep5Body'),
      // The exact count: one to go, and a one is what takes it.
      example: <Figure items={[{ die: 1 }, { arrow: true }, { seat: 0 }]} />,
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
