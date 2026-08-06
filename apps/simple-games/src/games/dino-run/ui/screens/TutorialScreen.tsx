/**
 * Quick Rules (docs/DINO_RUN_RULES.md §11): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md).
 *
 * The figures are the same blocky vocabulary the board draws in, so what is
 * learned here is what appears on the track.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useDinoRun } from '../../state/GameContext';

/** Tap, and the runner clears what is standing on the track (§3, §4). */
function JumpFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="dr-figure" viewBox="0 0 160 90" role="presentation">
        <path d="M0 74 H160" stroke="var(--ink-soft)" strokeWidth="2" fill="none" />
        <path
          d="M30 66 Q64 14 98 66"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeDasharray="4 5"
          fill="none"
        />
        <g fill="var(--ink)">
          <rect x="22" y="46" width="14" height="12" />
          <rect x="14" y="52" width="12" height="10" />
          <rect x="16" y="62" width="4" height="8" />
          <rect x="24" y="62" width="4" height="8" />
        </g>
        <g fill="var(--accent)">
          <rect x="100" y="50" width="6" height="24" />
          <rect x="94" y="58" width="6" height="4" />
          <rect x="94" y="58" width="4" height="10" />
          <rect x="106" y="54" width="6" height="4" />
          <rect x="108" y="54" width="4" height="10" />
        </g>
      </svg>
    </div>
  );
}

/** Hold, and the runner flattens under what is flying at head height (§3). */
function DuckFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="dr-figure" viewBox="0 0 160 90" role="presentation">
        <path d="M0 74 H160" stroke="var(--ink-soft)" strokeWidth="2" fill="none" />
        <g fill="var(--accent)">
          <rect x="86" y="44" width="26" height="8" />
          <rect x="106" y="40" width="12" height="8" />
          <rect x="90" y="34" width="16" height="8" />
        </g>
        <g fill="var(--ink)">
          <rect x="18" y="58" width="30" height="10" />
          <rect x="44" y="54" width="14" height="10" />
          <rect x="22" y="68" width="5" height="6" />
          <rect x="34" y="68" width="5" height="6" />
        </g>
        <path
          d="M62 40 V60 M62 60 L56 54 M62 60 L68 54"
          stroke="var(--ink-soft)"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

/** One touch ends the run, and the track only gets faster (§5, §7). */
function SpeedFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="dr-figure" viewBox="0 0 160 90" role="presentation">
        <path d="M0 74 H160" stroke="var(--ink-soft)" strokeWidth="2" fill="none" />
        <g fill="var(--ink)">
          <rect x="26" y="46" width="14" height="12" />
          <rect x="18" y="52" width="12" height="10" />
          <rect x="20" y="62" width="4" height="12" />
          <rect x="28" y="62" width="4" height="12" />
        </g>
        <g fill="var(--ink-soft)">
          <rect x="4" y="50" width="10" height="3" />
          <rect x="0" y="58" width="14" height="3" />
          <rect x="6" y="66" width="8" height="3" />
        </g>
        <g fill="var(--accent)">
          <rect x="72" y="52" width="6" height="22" />
          <rect x="66" y="60" width="6" height="4" />
          <rect x="104" y="46" width="6" height="28" />
          <rect x="110" y="54" width="6" height="4" />
          <rect x="132" y="52" width="6" height="22" />
          <rect x="126" y="58" width="6" height="4" />
        </g>
      </svg>
    </div>
  );
}

export function DinoTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startRun, goHome } = useDinoRun();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('dino-run', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('dinoStep1Title'), body: t('dinoStep1Body'), example: <JumpFigure /> },
    { title: t('dinoStep2Title'), body: t('dinoStep2Body'), example: <DuckFigure /> },
    { title: t('dinoStep3Title'), body: t('dinoStep3Body'), example: <SpeedFigure /> },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startRun();
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
