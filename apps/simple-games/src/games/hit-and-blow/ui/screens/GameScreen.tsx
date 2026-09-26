/**
 * The Hit & Blow game screen (docs/HIT_AND_BLOW_RULES.md §3, §4, §10).
 *
 * The history is on top and scrolls inside its own region; the row being
 * composed, the palette and Check stay fixed at the bottom, so the controls
 * never move as the history grows. There is no clock (§10) and no help
 * button (§6): the history, always in view, is the help.
 *
 * The keyboard is an adapter over the same handlers the buttons call
 * (issue #93): 1–8 put a symbol, Backspace takes the last one off, Enter
 * checks — never a keyboard-only behaviour.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { guessCount, isDraftFull, judge, POOL_FOR } from '../../game';
import { useHitAndBlow } from '../../state/GameContext';
import { DIFFICULTY_KEY } from '../difficultyKey';
import { GuessRow } from '../components/GuessRow';
import { HitAndBlowResultOverlay } from '../components/HitAndBlowResultOverlay';
import { SymbolGlyph, symbolKey } from '../components/Symbol';

/**
 * Enter on a focused button is that button's own activation — a palette
 * symbol, a slot, New Game. Only Enter pressed elsewhere means Check, so a
 * keyboard user tabbing through the palette is never answered with a guess.
 */
const isButtonTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest('button') !== null;

export function HitAndBlowGameScreen() {
  const {
    session,
    lastResult,
    pushSymbol,
    popSymbol,
    clearSlot,
    checkGuess,
    goHome,
    startNewGame,
  } = useHitAndBlow();
  const { t } = useSettings();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const onPush = useCallback(
    (symbol: number) => {
      if (!session || symbol >= POOL_FOR[session.difficulty]) return;
      // Already in the row: the palette button is disabled, but a digit key
      // has no disabled look, so it is refused out loud (§3).
      if (session.draft.includes(symbol)) {
        sounds.invalid();
        void haptics.invalid();
        return;
      }
      if (pushSymbol(symbol)) {
        sounds.select();
        void haptics.tap();
      }
    },
    [pushSymbol, session],
  );

  const onClearSlot = useCallback(
    (slot: number) => {
      if (clearSlot(slot)) void haptics.tap();
    },
    [clearSlot],
  );

  const onPop = useCallback(() => {
    if (popSymbol()) void haptics.tap();
  }, [popSymbol]);

  const onCheck = useCallback(() => {
    // A winning guess is answered by the clear below, not by this as well.
    if (checkGuess() !== 'playing') return;
    sounds.match();
    void haptics.match();
  }, [checkGuess]);

  // The win, exactly once per transition.
  const status = session?.status ?? 'playing';
  const previousStatus = useRef(status);
  useEffect(() => {
    if (status === 'won' && previousStatus.current === 'playing') {
      sounds.clear();
      void haptics.clear();
    }
    previousStatus.current = status;
  }, [status]);

  // The newest row into view, inside the history's own region (§10). Its own
  // scrollTop rather than scrollIntoView: the page itself must never move.
  const rows = session?.guesses.length ?? 0;
  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [rows]);

  const feedback = useMemo(
    () => (session ? session.guesses.map((guess) => judge(session.secret, guess)) : []),
    [session],
  );

  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    // The digits follow the palette's order (§1): 1 is the first symbol.
    if (/^[1-8]$/.test(event.key)) {
      if (!event.repeat) onPush(Number(event.key) - 1);
      return true;
    }
    if (event.key === 'Backspace') {
      if (!event.repeat) onPop();
      return true;
    }
    if (event.key === 'Enter' && !isButtonTarget(event.target)) {
      if (!event.repeat) onCheck();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmNewGame);

  if (!session) return null;

  const won = session.status === 'won';
  const full = isDraftFull(session.draft);
  const pool = POOL_FOR[session.difficulty];
  const nameOf = (symbol: number) => t(symbolKey(symbol));
  // The guess being composed is the next one; once solved, the last one.
  const counter = won ? guessCount(session) : guessCount(session) + 1;

  return (
    <div className="screen game-screen hb-screen">
      <div className="game-content" inert={won || confirmNewGame}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">{t(DIFFICULTY_KEY[session.difficulty])}</span>
            <span className="hb-counter">{t('hitAndBlowGuessCounter', { n: counter })}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="hb-body">
          <div className="hb-history" ref={historyRef}>
            {session.guesses.length === 0 ? (
              <p className="hb-history-empty">{t('hitAndBlowHistoryEmpty')}</p>
            ) : (
              <ol className="hb-history-list" aria-label={t('hitAndBlowHistoryLabel')}>
                {session.guesses.map((guess, index) => {
                  const result = feedback[index]!;
                  return (
                    <li key={index}>
                      <GuessRow
                        guess={guess}
                        feedback={result}
                        number={index + 1}
                        label={t('hitAndBlowRowLabel', {
                          n: index + 1,
                          symbols: guess.map(nameOf).join(', '),
                          hits: result.hits,
                          blows: result.blows,
                        })}
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="hb-input">
            <div className="hb-draft" role="group" aria-label={t('hitAndBlowDraftLabel')}>
              {session.draft.map((symbol, slot) => (
                <button
                  key={slot}
                  type="button"
                  className={`hb-slot ${symbol === null ? 'hb-slot-empty' : ''}`}
                  aria-label={
                    symbol === null
                      ? t('hitAndBlowSlotEmpty', { n: slot + 1 })
                      : t('hitAndBlowSlotFilled', { n: slot + 1, symbol: nameOf(symbol) })
                  }
                  disabled={symbol === null}
                  onClick={() => onClearSlot(slot)}
                >
                  {symbol === null ? null : <SymbolGlyph symbol={symbol} />}
                </button>
              ))}
            </div>

            <div
              className={`hb-palette hb-palette-${pool}`}
              role="group"
              aria-label={t('hitAndBlowPaletteLabel')}
            >
              {Array.from({ length: pool }, (_, symbol) => {
                const used = session.draft.includes(symbol);
                return (
                  <button
                    key={symbol}
                    type="button"
                    className="hb-pick"
                    aria-label={nameOf(symbol)}
                    aria-pressed={used}
                    disabled={used || full}
                    onClick={() => onPush(symbol)}
                  >
                    <SymbolGlyph symbol={symbol} />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn btn-primary hb-check"
              disabled={!full}
              onClick={onCheck}
            >
              {t('hitAndBlowCheck')}
            </button>
          </div>
        </div>

        <BannerSlot />
      </div>

      <HitAndBlowResultOverlay
        session={session}
        lastResult={lastResult}
        onNewGame={() => startNewGame(session.difficulty)}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame(session.difficulty);
        }}
      />
    </div>
  );
}
