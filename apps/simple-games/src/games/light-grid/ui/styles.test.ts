// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
describe('light-grid theme contract', () => {
  it('uses only theme variables the shell defines', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'light-grid.css'),
      'utf8',
    );
    const shared = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../../../ui/styles.css'),
      'utf8',
    );
    // The game's own --lg-* tokens (the two blocks at the top of light-grid.css;
    // contrast.test.ts measures them) count as defined, so every alias in them
    // is still checked against the shell.
    const defined = new Set(
      [...shared.matchAll(/(--[a-z0-9-]+)\s*:/gi), ...css.matchAll(/(--lg-[a-z0-9-]+)\s*:/gi)].map(
        (match) => match[1],
      ),
    );
    for (const [, token] of css.matchAll(/var\((--[a-z0-9-]+)/gi))
      expect(defined.has(token), token).toBe(true);
  });

  it('keeps the band a pressed lens leaves part of the lens, so a press on its top edge still clicks it', () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'light-grid.css'),
      'utf8',
    );
    // The lens sinks a pixel under the press…
    expect(css).toMatch(/\n\.lg-cell:active \{\s*transform: translateY\(1px\);/);
    // …and the ::after strip (the gloss owns ::before) keeps the vacated band
    // part of it (the technique of echo-pads.css): one 1px border plus one 1px
    // sink above the padding box, as tall as the sink. A hint's dashed ring is
    // the ::after of the lenses it would flip, so the strip resets the ring's
    // border, radius and pointer-events (`none`) while one of those is held.
    const strip = /\n\.lg-cell:active::after \{([^}]*)\}/.exec(css)?.[1];
    expect(strip, '.lg-cell:active::after').toBeDefined();
    expect(strip).toMatch(/content:\s*'';/);
    expect(strip).toMatch(/position:\s*absolute;/);
    expect(strip).toMatch(/top:\s*-2px;/);
    expect(strip).toMatch(/right:\s*-1px;/);
    expect(strip).toMatch(/left:\s*-1px;/);
    expect(strip).toMatch(/height:\s*1px;/);
    expect(strip).toMatch(/border:\s*0;/);
    expect(strip).toMatch(/pointer-events:\s*auto;/);
    // The ring it replaces is still declared with those properties.
    expect(css).toMatch(/\n\.lg-affected::after \{[^}]*pointer-events:\s*none;/);
  });
});
