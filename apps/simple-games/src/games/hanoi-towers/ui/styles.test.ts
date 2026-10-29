// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
describe('hanoi-towers theme contract', () => {
  it('uses only theme variables the shell or the board defines', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'hanoi-towers.css'),
      'utf8',
    );
    const shared = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../ui/styles.css'),
      'utf8',
    );
    // The shell's tokens, plus the board's own wood colours declared in the two
    // blocks at the top of hanoi-towers.css (contrast.test.ts measures those).
    const defined = new Set(
      [...shared.matchAll(/(--[a-z0-9-]+)\s*:/gi), ...css.matchAll(/(--ht-[a-z0-9-]+)\s*:/gi)].map(
        (match) => match[1],
      ),
    );
    for (const [, token] of css.matchAll(/var\((--[a-z0-9-]+)/gi))
      expect(defined.has(token), token).toBe(true);
  });
});
