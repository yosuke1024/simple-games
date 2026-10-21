/**
 * Quick Rules (docs/NESTED_TIC_TAC_TOE_RULES.md §9): three steps, one
 * sentence each, each with a figure of a position the game could be in, and
 * the send rule first — it is the one thing here no other title teaches.
 * Leads straight into play (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game (or
 * resuming the one already waiting, §8.3), and hardware Back marks it seen on
 * the way out (state/GameContext.tsx). The long-form rules live on the game's
 * landing page behind "Learn More", which is absent until the page exists
 * (ui/landing.ts) and quietly does nothing offline (docs/OFFLINE_POLICY.md).
 *
 * The early-release notice under the header is the shell's too
 * (docs/WEB_VERSION.md「先行公開(ベータ)」): a first visit opens here, and the
 * last step's button writes the first save, so the notice is read before
 * anything is saved.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useNestedTicTacToe } from '../../state/GameContext';
import { RulesFigure } from '../components/RulesFigure';

export function NestedTicTacToeTutorialScreen() {
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, startNewGame, goHome } =
    useNestedTicTacToe();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('nested-tic-tac-toe', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('nestedTicTacToeStep1Title'),
      body: t('nestedTicTacToeStep1Body'),
      example: <RulesFigure kind="send" />,
    },
    {
      title: t('nestedTicTacToeStep2Title'),
      body: t('nestedTicTacToeStep2Body'),
      example: <RulesFigure kind="free" />,
    },
    {
      title: t('nestedTicTacToeStep3Title'),
      body: t('nestedTicTacToeStep3Body'),
      example: <RulesFigure kind="win" />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Onto the match already waiting, if one is: the flag and the save are
      // separate records, and a lost or unreadable flags record must not cost
      // the player the match they left (§8.3). Otherwise the first match is
      // against the gentlest opponent, on the side the preference names.
      if (canResume) resumeGame();
      else startNewGame('easy');
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen nt-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      <WebBetaNotice gameId="nested-tic-tac-toe" />

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
