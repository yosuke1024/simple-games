import { describe, expect, it } from 'vitest';
import { colOf, playbackIntervalMs, resolveSwap, rowOf } from '../game';
import { cascadingRound } from '../game/play-helpers';
import { replayFrames } from './replay';

describe('the replay frames (§10)', () => {
  const { round, swap, stages } = cascadingRound(3);
  const [a, b] = swap;
  const move = resolveSwap(round.board, a, b, round)!;
  const frames = replayFrames(move, a, b);

  it('is one frame per beat: the exchange, then one per stage', () => {
    expect(frames).toHaveLength(stages + 1);
    // The beat count playbackIntervalMs squeezes into a second is this one.
    expect(playbackIntervalMs(stages)! * frames.length).toBeLessThanOrEqual(1000);
  });

  it('opens on the exchanged board, the two gems sliding in from each other’s cell', () => {
    expect(frames[0]!.board).toEqual(move.swapped);
    expect(frames[0]!.motion.get(a)).toEqual({ dx: colOf(b) - colOf(a), dy: rowOf(b) - rowOf(a) });
    expect(frames[0]!.motion.get(b)).toEqual({ dx: colOf(a) - colOf(b), dy: rowOf(a) - rowOf(b) });
  });

  it('clears each stage on the beat before its board, and ends on the final board', () => {
    move.stages.forEach((stage, i) => {
      expect(frames[i]!.clearing).toEqual(stage.cleared);
      expect(frames[i + 1]!.board).toEqual(stage.board);
    });
    expect(frames[frames.length - 1]!.board).toEqual(move.board);
    expect(frames[frames.length - 1]!.clearing).toEqual([]);
  });

  it('drops each fallen gem from its old row, and each refill from above the board', () => {
    move.stages.forEach((stage, i) => {
      const motion = frames[i + 1]!.motion;
      for (const drop of stage.drops) {
        expect(motion.get(drop.to)).toEqual({ dx: 0, dy: rowOf(drop.from) - rowOf(drop.to) });
      }
      for (const spawn of stage.spawns) {
        const inColumn = stage.spawns.filter((s) => colOf(s.index) === colOf(spawn.index)).length;
        expect(motion.get(spawn.index)).toEqual({ dx: 0, dy: -inColumn });
        // It starts above row 0: off the board, where the plate clips it.
        expect(rowOf(spawn.index) - inColumn).toBeLessThan(0);
      }
    });
  });
});
