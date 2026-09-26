/**
 * Quick Rules (docs/CROWN_GRID_RULES.md §12): three steps, one sentence each,
 * shown with a figure rather than explained in prose. There is no "Learn
 * More" yet — the game has no landing page while it is in early release
 * (ui/landing.ts decides that, not this screen).
 */
import { useState, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useCrownGrid } from '../../state/GameContext';
import { CrownGlyph } from '../components/CrownGlyph';
import { tileClasses } from '../tileClasses';

/**
 * A small real board: `regions` as rows of letters, `marks` as rows of '.',
 * 'x' and 'q'. Drawn with the board's own cell classes — tiles, region
 * boundaries, the two glyphs — so what the figure shows is what the board
 * will look like (§13's tile rules, shared with `CrownGridBoard` through
 * `tileClasses`). Decorative; the sentence beside it carries the meaning.
 */
function Figure({ regions, marks }: { regions: readonly string[]; marks: readonly string[] }) {
  const size = regions.length;
  const regionAt = (index: number): number =>
    (regions[Math.floor(index / size)]?.charCodeAt(index % size) ?? 97) - 'a'.charCodeAt(0);
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="cg-board cg-figure" style={{ '--cg-size': size } as CSSProperties}>
        <div className="cg-cells">
          {regions.flatMap((line, row) =>
            [...line].map((_, col) => {
              const index = row * size + col;
              const mark = marks[row]?.[col] ?? '.';
              const classes = ['cg-cell', ...tileClasses(index, size, regionAt)].join(' ');
              return (
                <span key={index} className={classes} data-region={regionAt(index)}>
                  {mark === 'q' ? (
                    <span className="cg-glyph cg-glyph-crown">
                      <CrownGlyph />
                    </span>
                  ) : mark === 'x' ? (
                    <span className="cg-glyph cg-glyph-cross">×</span>
                  ) : null}
                </span>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

export function CrownGridTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, prefs, goHome } = useCrownGrid();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('crown-grid', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('crownGridStep1Title'),
      body: t('crownGridStep1Body'),
      // A finished 4×4: one crown in each row, column and colour.
      example: (
        <Figure
          regions={['aabb', 'abbb', 'ccdb', 'cddd']}
          marks={['.q..', '...q', 'q...', '..q.']}
        />
      ),
    },
    {
      title: t('crownGridStep2Title'),
      body: t('crownGridStep2Body'),
      // A crown, and the eight squares around it that are therefore out.
      example: <Figure regions={['aab', 'aab', 'aab']} marks={['xxx', 'xqx', 'xxx']} />,
    },
    {
      title: t('crownGridStep3Title'),
      body: t('crownGridStep3Body'),
      // A crown placed and the ×s a drag left along its row and around it.
      example: (
        <Figure
          regions={['aabb', 'abbb', 'ccdb', 'cddd']}
          marks={['xqxx', 'xxx.', '....', '....']}
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
