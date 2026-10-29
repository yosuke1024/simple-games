#!/usr/bin/env node
/**
 * Board frame: paint the shallow lift above the paper ring (2026-10-29).
 *
 * The collection's board frame (2026-10-24, #267) is four shadows:
 *
 *     0 0 0 3px var(--paper),          a 3px paper ring
 *     0 0 0 4px var(--line),           a 1px line outside it
 *     0 3px 0 var(--line),             a 3px hard lift under the board
 *     0 8px 18px var(--accent-ring-soft)
 *
 * Box shadows paint in reverse order (the first listed is on top), so the
 * 3px lift sat entirely under the 3px paper ring and was never visible —
 * every board showed only the 1px outer line. Loop Puzzle's inset variant
 * was the one board where the lift showed. Moving the lift to the front of
 * the list paints it over the ring's bottom edge, which is what the comment
 * beside every copy promised ("a paper edge and shallow lift").
 *
 *   node scripts/codemods/2026-10-29-board-lift-order.mjs          # apply
 *   node scripts/codemods/2026-10-29-board-lift-order.mjs --check  # count only
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMES = join(APP, 'src/games');
const check = process.argv.includes('--check');

const pattern =
  /^(\s*)0 0 0 3px var\(--paper\),\n\s*0 0 0 4px var\(--line\),\n\s*0 3px 0 var\(--line\),\n(\s*)0 8px 18px var\(--accent-ring-soft\)/gm;

let files = 0;
let hits = 0;
for (const id of readdirSync(GAMES)) {
  const path = join(GAMES, id, 'ui', `${id}.css`);
  let css;
  try {
    css = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  const next = css.replace(pattern, (_m, indent, last) =>
    [
      `${indent}0 3px 0 var(--line),`,
      `${indent}0 0 0 3px var(--paper),`,
      `${indent}0 0 0 4px var(--line),`,
      `${last}0 8px 18px var(--accent-ring-soft)`,
    ].join('\n'),
  );
  if (next !== css) {
    const n = (css.match(pattern) || []).length;
    hits += n;
    files += 1;
    console.log(`${check ? 'would rewrite' : 'rewrote'} ${id}: ${n}`);
    if (!check) writeFileSync(path, next);
  }
}
console.log(`${files} files, ${hits} frames`);
