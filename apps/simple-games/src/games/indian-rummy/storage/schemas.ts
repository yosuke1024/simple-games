import type { SchemaDef } from '@/storage/schemas';
import { asInt, isRecord } from '@/storage/validate';
import { restore, type Card, type Session } from '../game';
import { isArrangementOf, sortHand } from '../game/handOrder';
import { IR_STORAGE_KEYS } from './keys';
export { IR_STORAGE_KEYS };
export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}
export const flagsSchema: SchemaDef<Flags> = {
  key: IR_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) =>
    isRecord(raw) && raw.schemaVersion === 1 && typeof raw.tutorialCompleted === 'boolean'
      ? { schemaVersion: 1, tutorialCompleted: raw.tutorialCompleted }
      : null,
};
export interface Stats {
  schemaVersion: 1;
  played: number;
  completed: number;
  wins: number;
  draws: number;
  totalPlaySeconds: number;
}
export const statsSchema: SchemaDef<Stats> = {
  key: IR_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    completed: 0,
    wins: 0,
    draws: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9),
      completed = asInt(raw.completed, 0, 1e9),
      wins = asInt(raw.wins, 0, 1e9),
      draws = asInt(raw.draws, 0, 1e9),
      totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (
      played === null ||
      completed === null ||
      wins === null ||
      draws === null ||
      totalPlaySeconds === null ||
      completed > played ||
      wins + draws > completed
    )
      return null;
    return { schemaVersion: 1, played, completed, wins, draws, totalPlaySeconds };
  },
};
export interface PersistedGame {
  schemaVersion: 2;
  savedAt: number;
  session: Session;
  /**
   * How the player has arranged seat 0's hand (docs/INDIAN_RUMMY_RULES.md,
   * "Hand arrangement"): the same cards as `session.hands[0]`, in their order.
   */
  handOrder: Card[];
}
export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: IR_STORAGE_KEYS.game,
  version: 2,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || (raw.schemaVersion !== 1 && raw.schemaVersion !== 2)) return null;
    const savedAt = asInt(raw.savedAt, 0, 1e15),
      session = restore(raw.session);
    if (savedAt === null || !session) return null;
    const hand = session.hands[0]!;
    // v1 had no arrangement: every hand was shown sorted, so that is the order
    // it resumes in. An arrangement that no longer lists this hand is not worth
    // the game it rides with, so it falls back the same way.
    const handOrder =
      raw.schemaVersion === 2 && isArrangementOf(raw.handOrder, hand)
        ? [...raw.handOrder]
        : sortHand(hand);
    return { schemaVersion: 2, savedAt, session, handOrder };
  },
};
