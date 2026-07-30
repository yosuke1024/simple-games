/**
 * Quick Rules (docs/MINESWEEPER_RULES.md §11): three steps, one sentence each,
 * shown as a picture rather than explained in prose. The long-form rules live
 * on the game's landing page behind "Learn More", which quietly does nothing
 * offline (docs/OFFLINE_POLICY.md).
 */
import { LANDING_BASE_URL } from '@simple-games/brand';
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { openExternal } from '@/ui/openExternal';
import { useMinesweeper } from '../../state/GameContext';

/**
 * A 3x3 figure. Each token is one cell: '#' closed, 'F' flagged, '*' a mine,
 * '.' opened and empty, a digit opened with that number. Decorative — the
 * sentence beside it carries the meaning.
 */
function MiniBoard({ cells, focus }: { cells: readonly string[]; focus?: number }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="mines-tutorial-board">
        {cells.map((token, index) => {
          const open = token !== '#' && token !== 'F';
          const classes = [
            'mines-cell',
            open ? 'mines-cell-open' : 'mines-cell-shut',
            token === '*' ? 'mines-cell-mine' : '',
            index === focus ? 'mines-cell-hint' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <span
              key={index}
              className={classes}
              data-count={/^[1-8]$/.test(token) ? token : undefined}
            >
              {token === 'F' ? '⚑' : token === '*' ? '✸' : token === '#' || token === '.' ? '' : token}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function MinesTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, goHome } = useMinesweeper();
  const { t, locale } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('minesStep1Title'),
      body: t('minesStep1Body'),
      // A 2 with exactly two mines around it: the rule, drawn once.
      example: <MiniBoard cells={['#', '*', '#', '#', '2', '#', '*', '#', '#']} focus={4} />,
    },
    {
      title: t('minesStep2Title'),
      body: t('minesStep2Body'),
      // The same board with one of them flagged, and the 1 that justified it.
      example: <MiniBoard cells={['#', 'F', '#', '1', '1', '1', '.', '.', '.']} focus={1} />,
    },
    {
      title: t('minesStep3Title'),
      body: t('minesStep3Body'),
      // Everything open but the flagged mine: what winning looks like.
      example: <MiniBoard cells={['1', 'F', '1', '1', '1', '1', '.', '.', '.']} />,
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

      <div className="home-links">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => openExternal(`${LANDING_BASE_URL}/games/minesweeper/${locale}/`)}
        >
          {t('learnMore')}
        </button>
      </div>
    </div>
  );
}
