import { useEffect, useMemo, useState } from 'react';
import {
  FLAG_CASTLE,
  FLAG_EN_PASSANT,
  isCapture,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
  type Move,
} from '../game/types';
import type { Target } from '../game/session';

/** The same two taps and promotion choice drive both local and nearby matches. */
export function useChessSelection(
  legal: readonly Move[],
  playing: boolean,
  positionKey: string | number,
  onPlay: (from: number, to: number, promotion: number) => void,
) {
  const [selected, setSelected] = useState<number | null>(null);
  const [promotion, setPromotion] = useState<{ from: number; to: number } | null>(null);
  const clear = () => {
    setSelected(null);
    setPromotion(null);
  };
  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [positionKey, playing]);
  const selectable = useMemo(
    () => (playing ? [...new Set(legal.map(moveFrom))] : []),
    [legal, playing],
  );
  const targets = useMemo(() => {
    const result: Target[] = [];
    if (!playing || selected === null) return result;
    for (const move of legal) {
      if (moveFrom(move) !== selected || result.some((t) => t.to === moveTo(move))) continue;
      result.push({
        to: moveTo(move),
        capture: isCapture(move),
        promotion: movePromotion(move) !== 0,
        castle: (moveFlags(move) & FLAG_CASTLE) !== 0,
        enPassant: (moveFlags(move) & FLAG_EN_PASSANT) !== 0,
      });
    }
    return result;
  }, [legal, playing, selected]);
  const play = (from: number, to: number, kind: number) => {
    if (!playing) return;
    onPlay(from, to, kind);
    clear();
  };
  return {
    selected,
    promotion,
    selectable,
    targets,
    clear,
    cancelPromotion: () => setPromotion(null),
    pickPromotion: (kind: number) => {
      if (promotion) play(promotion.from, promotion.to, kind);
    },
    onSquare: (square: number) => {
      if (!playing) return;
      const target = selected === null ? undefined : targets.find((t) => t.to === square);
      if (target && selected !== null) {
        if (target.promotion) setPromotion({ from: selected, to: square });
        else play(selected, square, 0);
      } else setSelected(selectable.includes(square) && square !== selected ? square : null);
    },
  };
}
