/**
 * Quick Rules (docs/CHESS_RULES.md §8): three steps, one sentence each, each
 * with a figure drawn from the board's own squares and pieces. Castling, en
 * passant and promotion are not written here: the dots and the picker teach
 * them as they come up. Leads straight into play
 * (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game (or
 * resuming the one already waiting, §7.1), and hardware Back marks it seen on
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
import { useChess } from '../../state/GameContext';
import { RulesFigure } from '../components/RulesFigure';

export function ChessTutorialScreen() {
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, startNewGame, goHome } =
    useChess();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('chess', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('chessStep1Title'),
      body: t('chessStep1Body'),
      example: <RulesFigure kind="moves" />,
    },
    {
      title: t('chessStep2Title'),
      body: t('chessStep2Body'),
      example: <RulesFigure kind="capture" />,
    },
    {
      title: t('chessStep3Title'),
      body: t('chessStep3Body'),
      example: <RulesFigure kind="mate" />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Onto the game already waiting, if one is: the flag and the save are
      // separate records, and a lost or unreadable flags record must not cost
      // the player the game they left (§7.1). Otherwise the first game is
      // against the gentlest opponent, on the side the preference names.
      if (canResume) resumeGame();
      else startNewGame('easy');
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen ch-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      <WebBetaNotice gameId="chess" />

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
