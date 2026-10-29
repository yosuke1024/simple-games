// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
describe('color-flood theme contract', () => {
  it('uses only theme variables the shell defines', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'color-flood.css'),
      'utf8',
    );
    const shared = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../ui/styles.css'),
      'utf8',
    );
    const defined = new Set([...shared.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]));
    // The six tile colours and the light on them are the game's own tokens,
    // declared in the two blocks at the top of its stylesheet (contrast.test.ts
    // measures them); everything else must come from the shell.
    const own = new Set([...css.matchAll(/(--cf-[a-z0-9-]+)\s*:/gi)].map((match) => match[1]));
    for (const [, token] of css.matchAll(/var\((--[a-z0-9-]+)/gi))
      expect(defined.has(token) || own.has(token), token).toBe(true);
  });
});
