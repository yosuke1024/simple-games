#!/usr/bin/env node
/**
 * Release gate: every game a native build can share already has its share
 * landing on pixapps.ai (docs/architecture/share-links.md, RELEASE_CHECKLIST.md §7).
 *
 *   pnpm share:check --ref v1.8.5        (from apps/simple-games)
 *   node scripts/share-landing-check.mjs --ref v1.8.5 [--base <share URL root>]
 *
 * The app shares `https://pixapps.ai/simple-games/share/<id>/` for every game
 * without a registry `channel`. A device without the app, or one whose OS has
 * not verified the domain, opens that address in the browser, so a game the
 * build carries but the site has no page for is a 404 in someone's messages.
 * The site gets its pages from the landing repo's sync of this registry at
 * whatever ref the web was last published from, which can trail the tag.
 *
 * So: read registry.ts at the release ref with git (never the working tree),
 * pick the games without a channel, and request each address exactly as a
 * recipient would. Each must answer 200 itself (a redirect fails) with that
 * game's own landing: HTML carrying `data-game="<id>"` and no
 * `class="availability"` sentence, which is how the landing's template
 * (pixapps-landing tools/build-simple-games-share.js) marks a page that says
 * the game is not in the app, Web-only or retired. No cache-busting query:
 * an edge copy of an old 404 is what the recipient would get too.
 *
 * Release tooling outside apps/*\/src, so the app's no-network rule
 * (.github/scripts/check-principles.sh) does not reach it and the app never
 * runs it. It sends plain GETs for public pages: no cookies, no identifiers.
 *
 * `readRegistryGames` is also the app-side copy of the contract the landing's
 * sync depends on (src/test/shareLanding.test.ts).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import ts from 'typescript';
// Declared here, not in eslint.config.js: this is the one script that talks to
// the network, and the list there says what every script may use.
/* global fetch, AbortSignal */

export const SHARE_LANDING_BASE = 'https://pixapps.ai/simple-games/share/';
const REGISTRY = 'apps/simple-games/src/app/registry.ts';
const FIELDS = ['id', 'title', 'glyph', 'channel'];
const CHANNELS = ['web-beta', 'in-development'];
const PARALLEL = 6;
const TIMEOUT_MS = 15000;

/**
 * The title cards of `GAMES` as a literal reader sees them, in order: the
 * landing's sync parses registry.ts the same way and never executes it. Throws
 * on any shape that reader could misread: GAMES not an array literal, an entry
 * that is not an object literal, a spread that could carry a hidden `channel`,
 * or one of the four fields given as anything but a plain string literal.
 */
export function readRegistryGames(source) {
  const file = ts.createSourceFile('registry.ts', source, ts.ScriptTarget.Latest, true);
  let array;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === 'GAMES')
      array = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!array || !ts.isArrayLiteralExpression(array)) {
    throw new Error('GAMES must be initialised with an array literal');
  }
  return array.elements.map((node, index) => {
    if (!ts.isObjectLiteralExpression(node))
      throw new Error(`GAMES[${index}] is not an object literal`);
    const game = {};
    for (const prop of node.properties) {
      if (ts.isSpreadAssignment(prop)) throw new Error(`GAMES[${index}] spreads properties`);
      const key =
        prop.name && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
          ? prop.name.text
          : undefined;
      if (key === undefined || !FIELDS.includes(key)) {
        if (prop.name && ts.isComputedPropertyName(prop.name)) {
          throw new Error(`GAMES[${index}] has a computed property name`);
        }
        continue;
      }
      if (!ts.isPropertyAssignment(prop) || !ts.isStringLiteral(prop.initializer)) {
        throw new Error(`GAMES[${index}].${key} is not a string literal`);
      }
      game[key] = prop.initializer.text;
    }
    for (const key of ['id', 'title', 'glyph']) {
      if (!game[key]) throw new Error(`GAMES[${index}] has no literal ${key}`);
    }
    if (game.channel !== undefined && !CHANNELS.includes(game.channel)) {
      throw new Error(`GAMES[${index}].channel "${game.channel}" is unknown`);
    }
    return game;
  });
}

/** The games a native build offers, and therefore shares: no channel. Registry order. */
export function appGameIds(games) {
  return games.filter((game) => game.channel === undefined).map((game) => game.id);
}

/** Why this response is not `id`'s own share landing, or null when it is. */
export function landingProblem(id, { status, location, contentType, body }) {
  if (status !== 200) return `HTTP ${status}${location ? ` → ${location}` : ''}`;
  if (!/^text\/html\b/i.test(contentType ?? ''))
    return `not HTML (${contentType || 'no content type'})`;
  if (!body.includes(`data-game="${id}"`)) return 'not this game’s landing page';
  if (body.includes('class="availability"')) return 'the page says the game is not in the app';
  return null;
}

async function check(id, base) {
  const url = new URL(`${id}/`, base).toString();
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = response.status === 200 ? await response.text() : '';
    const problem = landingProblem(id, {
      status: response.status,
      location: response.headers.get('location'),
      contentType: response.headers.get('content-type') ?? '',
      body,
    });
    return problem ? `${url}: ${problem}` : null;
  } catch (error) {
    return `${url}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function parseArgs(args) {
  const options = { ref: 'HEAD', base: SHARE_LANDING_BASE };
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = [args[i], args[i + 1]];
    if (value === undefined || !['--ref', '--base'].includes(flag)) {
      throw new Error(
        'Usage: share-landing-check.mjs [--ref <tag or commit>] [--base <share URL root>]',
      );
    }
    options[flag.slice(2)] = value;
  }
  if (!options.base.endsWith('/')) options.base += '/';
  return options;
}

async function main() {
  const { ref, base } = parseArgs(process.argv.slice(2));
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf8',
    });
  const commit = git('rev-parse', '--verify', `${ref}^{commit}`).trim();
  const ids = appGameIds(readRegistryGames(git('show', `${commit}:${REGISTRY}`)));
  if (ids.length === 0) throw new Error(`No app games in ${REGISTRY} at ${ref}`);

  const failures = [];
  for (let i = 0; i < ids.length; i += PARALLEL) {
    const results = await Promise.all(ids.slice(i, i + PARALLEL).map((id) => check(id, base)));
    failures.push(...results.filter((result) => result !== null));
  }
  console.log(`${ref} (${commit.slice(0, 8)}): ${ids.length} app games, ${base}`);
  if (failures.length > 0) {
    console.error(`${failures.length} without a share landing:\n  ${failures.join('\n  ')}`);
    console.error('Publish the web build from this ref first (pixapps-landing Publish workflow).');
    process.exitCode = 1;
    return;
  }
  console.log(`All ${ids.length} share landings answer 200.`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
