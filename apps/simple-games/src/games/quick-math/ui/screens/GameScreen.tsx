/**
 * The Quick Math game screen (docs/QUICK_MATH_RULES.md §1, §3, §4).
 *
 * The progress counter is on screen because it says how much is left, which is
 * a fact. The clock is not, and neither is the wrong-answer tally: both are
 * recorded and shown at the finish, so nothing here pushes the player to hurry
 * or reminds them how they are doing while they think.
 *
 * The digits being typed live here rather than in the session (§9): they are
 * interface state, they are never saved, and clearing them is what a wrong
 * answer does. `sessionEpoch` clears them when a different set arrives.
 *
 * There is no undo and no hint (§8). The backspace key is not an undo — it
 * corrects a mistype before the answer is judged, and stops existing the
 * moment it is.
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { answerDigits, currentQuestion } from '../../game';
import { useQuickMath } from '../../state/GameContext';
import { Keypad } from '../components/Keypad';
import { QuestionView } from '../components/QuestionView';
import { QuickMathResultOverlay } from '../components/QuickMathResultOverlay';

export function QuickMathGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    submitAnswer,
    goHome,
    restartCurrent,
    startNextLevel,
  } = useQuickMath();
  const { t } = useSettings();
  const [entry, setEntry] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);

  // A new set means an empty box, whichever way it arrived.
  useEffect(() => setEntry(''), [sessionEpoch]);

  const question = session ? currentQuestion(session) : null;
  const digits = question ? answerDigits(question) : 1;

  const onDigit = useCallback(
    (digit: number) => {
      if (!question) return;
      const next = entry + String(digit);
      if (next.length < digits) {
        setEntry(next);
        sounds.select();
        return;
      }
      // Long enough: judge it (§3). Either way the box empties.
      setEntry('');
      if (submitAnswer(Number(next))) {
        sounds.select();
        void haptics.tap();
      }
      // A wrong answer is answered with silence: no buzz, no warning tone. The
      // question simply comes back (§3).
    },
    [digits, entry, question, submitAnswer],
  );

  const onBackspace = useCallback(() => setEntry((value) => value.slice(0, -1)), []);

  /* Keyboard as an adapter over the keypad above (issue #93, #143): 0-9 type a
     digit, Backspace takes one back — the same two handlers the keys on screen
     call, and nothing else. There is no Enter, because there is no OK key to
     mirror: an answer is judged when it reaches the answer's length (§3).

     Key repeat is ignored on both. A held 7 must not fill the box a frame at a
     time, and a held Backspace must not empty it. Backspace answers `true`
     even with nothing typed, so the browser never treats it as "navigate back"
     mid-question. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (question === null) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const { key } = event;
    if (key.length === 1 && key >= '0' && key <= '9') {
      if (!event.repeat) onDigit(Number(key));
      return true;
    }
    if (key === 'Backspace') {
      if (!event.repeat) onBackspace();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status !== 'cleared' && !confirmRestart);

  if (!session) return null;

  const cleared = session.status === 'cleared';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={cleared || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="qmath-status">
            <span className="qmath-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span>
              {session.solvedCount} / {session.questions.length}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="qmath-body">
          {question ? <QuestionView question={question} entry={entry} digits={digits} /> : null}
        </div>

        <Keypad onDigit={onDigit} onBackspace={onBackspace} backspaceDisabled={entry === ''} />

        <BannerSlot />
      </div>

      <QuickMathResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNextLevel={startNextLevel}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmRestart}
        title={t('tryAgain')}
        body={t('qmathConfirmRestartBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          restartCurrent();
        }}
      />
    </div>
  );
}
