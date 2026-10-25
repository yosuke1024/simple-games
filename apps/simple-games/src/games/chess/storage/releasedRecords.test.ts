/**
 * Published Web records frozen at the 2026-10-25 app promotion.
 * Source: pixapps-landing 5f6d89a32e8a2f3d88b4a68ac29121348e80945f,
 * public/simple-games/play, built from simple-games 364d526.
 * The copied build ran at localhost:5194 with external requests blocked by
 * CSP. Its game assets were unchanged; only capture helper buttons were added.
 * UI steps: finish the tutorial, play e2–e4, return Home before the CPU reply,
 * then select Black for the next game. chess.json contained these four records.
 * No storage injection or game-internal calls created them. No finished game
 * was captured, so this fixture does not establish completed-result coverage.
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { BLACK, EMPTY, PAWN, WHITE, encodeSessionMoves, isCpuTurn, parseSquare } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'ch.saveGame':
    '{"schemaVersion":1,"seed":"chess-mvnswhx4-czw1","difficulty":"easy","side":"white","moves":"e2e4","elapsedSeconds":24,"savedAt":1792931154629}',
  'ch.prefs': '{"schemaVersion":1,"playerIsWhite":false}',
  'ch.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'ch.stats':
    '{"schemaVersion":1,"totalPlaySeconds":24,"easy":{"played":1,"wins":0,"losses":0,"draws":0},"normal":{"played":0,"wins":0,"losses":0,"draws":0},"hard":{"played":0,"wins":0,"losses":0,"draws":0}}',
};

describe('records written by the published Chess build', () => {
  it('loads all four original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['ch.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['ch.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['ch.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['ch.saveGame']));
  });

  it('restores White’s ongoing game on the CPU turn, independently of the next-game Black preference', async () => {
    const kv = createMemoryKV(RELEASED);
    const session = await loadSavedGame(kv);
    expect(session).not.toBeNull();
    expect(session!.seed).toBe('chess-mvnswhx4-czw1');
    expect(session!.difficulty).toBe('easy');
    expect(session!.playerColor).toBe(WHITE);
    expect((await loadRecord(prefsSchema, kv)).playerIsWhite).toBe(false);
    expect(encodeSessionMoves(session!)).toBe('e2e4');
    expect(session!.game.position.board[parseSquare('e2')]).toBe(EMPTY);
    expect(session!.game.position.board[parseSquare('e4')]).toBe(PAWN);
    expect(session!.game.position.side).toBe(BLACK);
    expect(session!.game.moves).toHaveLength(1);
    expect(session!.game.undos).toHaveLength(1);
    expect(session!.game.outcome).toBeNull();
    expect(session!.elapsedSeconds).toBe(24);
    expect(isCpuTurn(session!)).toBe(true);
  });

  it('writes the restored game back byte for byte at its original save time', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(JSON.stringify(toPersisted(session!, 1792931154629))).toBe(RELEASED['ch.saveGame']);
  });
});
