// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
describe('maze-escape theme contract', () => {
  it('uses only theme variables the shell defines, or the --me-* tokens its own two blocks declare', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'maze-escape.css'),
      'utf8',
    );
    const shared = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../ui/styles.css'),
      'utf8',
    );
    const defined = new Set([...shared.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]));
    // The board's own colours are declared at the top of maze-escape.css and
    // measured in contrast.test.ts; a typo in a var() name is still caught.
    for (const [, token] of css.matchAll(/(--me-[a-z0-9-]+)\s*:/gi)) defined.add(token);
    for (const [, token] of css.matchAll(/var\((--[a-z0-9-]+)/gi))
      expect(defined.has(token), token).toBe(true);
  });
});
