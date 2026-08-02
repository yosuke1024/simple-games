/**
 * The cols×rows card grid (docs/MEMORY_MATCH_RULES.md §1, §3, §12).
 *
 * Cards never move; they turn. Each card keeps its cell, and the face-up
 * state flips the inner element, so the browser animates a turn in place.
 * Reduced Motion turns the transition off and the card is simply showing its
 * other side (§12).
 *
 * A matched card stops being a control: a button that never responds again is
 * worse than no button (the same reasoning as the Sliding Puzzle gap). It is
 * still announced, with its symbol, so a board read aloud stays whole.
 *
 * That swap is why the found pair needs `pairing` below. A card that becomes
 * matched changes element — button to image — so React builds a new node, and
 * a CSS *transition* has no previous value to move from: the second card of a
 * pair would appear face up without ever turning. The pair the player just
 * found is tracked here so it can be handed a keyframed turn instead, which
 * plays on a freshly built node, and then the two are acknowledged (§12).
 */
import { memo, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { colOf, rowOf, type Deck, type Layout } from '../../game';
import { MemorySymbol } from './symbols';

export interface MemoryBoardProps {
  deck: Deck;
  layout: Layout;
  matched: readonly boolean[];
  faceUp: readonly number[];
  onFlip: (index: number) => void;
}

/**
 * The pair found on this board while it was on screen. `turn` is the card
 * that was still face down when the pair landed — only that one has a turn to
 * play; the first card of the attempt was already showing.
 */
interface Pairing {
  readonly cards: readonly number[];
  readonly turn: number | null;
}

export const MemoryBoard = memo(function MemoryBoard({
  deck,
  layout,
  matched,
  faceUp,
  onFlip,
}: MemoryBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const previousRef = useRef<{ matched: readonly boolean[]; faceUp: readonly number[] } | null>(
    null,
  );

  // A different board — new deal, restart, or a resumed game arriving. It
  // starts from wherever it starts; nothing on it was just found.
  useLayoutEffect(() => {
    previousRef.current = null;
    setPairing(null);
  }, [deck]);

  // Runs before paint, so the found pair is already carrying its classes on
  // the first frame it exists.
  useLayoutEffect(() => {
    const previous = previousRef.current;
    previousRef.current = { matched, faceUp };
    if (!previous) return;

    const found: number[] = [];
    for (let index = 0; index < matched.length; index++) {
      if (matched[index] && !previous.matched[index]) found.push(index);
    }
    if (found.length === 0) return;

    // The card the player had already turned stays as it is; the other one
    // has to turn (§3 — a pair is only ever found by turning the second).
    const turn = found.find((index) => !previous.faceUp.includes(index));
    setPairing({ cards: found, turn: turn ?? null });
  }, [matched, faceUp]);

  return (
    <div
      className={`mm-board ${reducedMotion ? 'mm-board-still' : ''}`}
      style={{ '--mm-cols': layout.cols, '--mm-rows': layout.rows } as CSSProperties}
      role="group"
      aria-label={t('memoryBoardLabel', { cols: layout.cols, rows: layout.rows })}
    >
      {deck.map((symbol, index) => {
        const row = rowOf(index, layout) + 1;
        const col = colOf(index, layout) + 1;
        // Symbols are announced 1-based: "symbol 0" reads like an error.
        const spoken = symbol + 1;

        if (matched[index]) {
          const justFound = pairing?.cards.includes(index) ?? false;
          return (
            <div
              key={index}
              className={`mm-card mm-card-matched ${justFound ? 'mm-card-found' : ''}`}
              role="img"
              aria-label={t('memoryCardMatched', { n: spoken, row, col })}
            >
              <span
                className={`mm-card-inner mm-card-inner-up ${
                  pairing?.turn === index ? 'mm-card-turning' : ''
                }`}
              >
                <span className="mm-card-face mm-card-front">
                  <MemorySymbol symbol={symbol} />
                </span>
                <span className="mm-card-face mm-card-back" />
              </span>
            </div>
          );
        }

        const isUp = faceUp.includes(index);
        return (
          <button
            key={index}
            type="button"
            className="mm-card"
            aria-label={
              isUp
                ? t('memoryCardUp', { n: spoken, row, col })
                : t('memoryCardDown', { row, col })
            }
            onClick={() => onFlip(index)}
          >
            <span className={`mm-card-inner ${isUp ? 'mm-card-inner-up' : ''}`}>
              <span className="mm-card-face mm-card-front">
                <MemorySymbol symbol={symbol} />
              </span>
              <span className="mm-card-face mm-card-back" />
            </span>
          </button>
        );
      })}
    </div>
  );
});
