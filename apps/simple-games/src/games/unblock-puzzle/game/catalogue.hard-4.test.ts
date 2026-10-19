/**
 * Every bundled Hard board, part 4 of 6 — checked in full, one by one, by
 * catalogueVerify.ts `checkEntry` (docs/UNBLOCK_PUZZLE_RULES.md §8, §17).
 * The Hard list is split six ways only so that the work spreads across test
 * workers; catalogue.test.ts says what is checked and why.
 */
import { checkSlice } from './catalogueVerify';

checkSlice('hard', 4, 6);
