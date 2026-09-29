/**
 * Quick Rules (docs/BINARY_BALANCE_RULES.md §12): three steps, one sentence
 * each, shown with a figure rather than explained in prose, leading straight
 * into play (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」). There is no "Learn
 * More" while the game is in early release — ui/landing.ts decides that, not
 * this screen.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game, and
 * hardware Back marks it seen on the way out (state/GameContext.tsx).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useBinaryBalance } from '../../state/GameContext';
import { MarkGlyph } from '../components/MarkGlyph';

/**
 * One short run of real cells. `cells` is '0' (circle), '1' (square) or '.'
 * per cell; `links` holds the character between each neighbouring pair — '='
 * or 'x', or ' ' for none. Drawn with the board's own cell classes and
 * glyphs, so what the figure shows is what the board will look like.
 * Decorative; the sentence beside it carries the meaning.
 *
 * `mark` names the cell the step is about, as [line, cell].
 */
function LineFigure({
  lines,
  mark,
}: {
  lines: readonly { cells: string; links?: string }[];
  mark?: readonly [number, number];
}) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="bn-figure">
        {lines.map(({ cells, links = '' }, line) => (
          <div key={line} className="bn-figure-line">
            {[...cells].flatMap((cell, index) => {
              const parts = [
                <span
                  key={`c${index}`}
                  className={[
                    'bn-figure-cell',
                    cell === '0' ? 'bn-cell-circle' : '',
                    cell === '1' ? 'bn-cell-square' : '',
                    mark?.[0] === line && mark[1] === index ? 'bn-figure-cell-mark' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {cell === '0' || cell === '1' ? (
                    <span className="bn-glyph">
                      <MarkGlyph mark={cell === '0' ? 0 : 1} />
                    </span>
                  ) : null}
                </span>,
              ];
              const link = links[index];
              if (index < cells.length - 1) {
                parts.push(
                  <span key={`l${index}`} className="bn-figure-link">
                    {link === '=' ? '=' : link === 'x' ? '×' : ''}
                  </span>,
                );
              }
              return parts;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BinaryBalanceTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, prefs, goHome } =
    useBinaryBalance();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('binary-balance', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('binaryBalanceStep1Title'),
      body: t('binaryBalanceStep1Body'),
      // Two squares already sit together, so the marked cell can only be a circle.
      example: <LineFigure lines={[{ cells: '011001' }]} mark={[0, 3]} />,
    },
    {
      title: t('binaryBalanceStep2Title'),
      body: t('binaryBalanceStep2Body'),
      // A finished line: three circles, three squares.
      example: <LineFigure lines={[{ cells: '010110' }]} />,
    },
    {
      title: t('binaryBalanceStep3Title'),
      body: t('binaryBalanceStep3Body'),
      // `=` keeps a pair alike; `×` makes it differ.
      example: (
        <LineFigure
          lines={[
            { cells: '00', links: '=' },
            { cells: '10', links: 'x' },
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
      startDifficulty(prefs.difficulty);
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
