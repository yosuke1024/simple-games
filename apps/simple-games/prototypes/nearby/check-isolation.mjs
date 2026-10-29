import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const app = join(root, '../..');
const gameIds = readdirSync(join(app, 'src/nearby/games'))
  .filter((name) => name.endsWith('View.tsx'))
  .map((name) => name.slice(0, -'View.tsx'.length));

function reachableModules(chunks, file) {
  const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));
  const seen = new Set();
  const modules = new Set();
  const pending = [file];
  while (pending.length) {
    const next = pending.pop();
    if (seen.has(next)) continue;
    seen.add(next);
    const chunk = byFile.get(next);
    assert.ok(chunk, `Missing chunk evidence: ${next}`);
    for (const id of chunk.modules) modules.add(id);
    pending.push(...chunk.imports);
  }
  return [...modules];
}
const forbiddenNearbyModule = (id) =>
  /^src\/club(?:\/|$)/.test(id) ||
  /^src\/ui\/(?:clubBridge|components\/ClubResultAction)\.[cm]?[jt]sx?$/.test(id) ||
  /^src\/games\/[^/]+\/(?:storage|state|challenge)\//.test(id) ||
  (/^src\/games\/[^/]+\/game\/(?:[^/]+\/)*(?:cpu|ai)(?:[/.]|$)/i.test(id) &&
    id !== 'src/games/ludo/game/cpu.ts') ||
  /^src\/games\/nim\/game\/index\.ts$/.test(id) ||
  /^src\/games\/[^/]+\/ui\/(?:screens\/|[^/]*Root\.)/.test(id);

// A source import gate alone misses manual chunk grouping. Prove this audit
// sees CPU/provider/storage/Club modules hidden behind a shared chunk as well.
const probe = [
  { file: 'nearby.js', imports: ['mixed.js'], modules: ['src/nearby/NearbyRoot.tsx'] },
  {
    file: 'mixed.js',
    imports: [],
    modules: [
      'src/games/chess/game/cpu/search.ts',
      'src/games/chess/state/GameContext.tsx',
      'src/games/chess/storage/schemas.ts',
      'src/club/index.ts',
    ],
  },
];
assert.equal(reachableModules(probe, 'nearby.js').filter(forbiddenNearbyModule).length, 4);
assert.equal(forbiddenNearbyModule('src/games/chess/game/types.ts'), false);
assert.equal(forbiddenNearbyModule('src/games/chess/ui/components/ChessBoard.tsx'), false);
assert.equal(forbiddenNearbyModule('src/games/nim/game/index.ts'), true);

function checkBuiltNearby(directory, native) {
  const evidence = JSON.parse(
    readFileSync(join(app, 'build-metadata', `nearby-${native ? 'native' : 'web'}.json`), 'utf8'),
  );
  assert.equal(evidence.version, 1);
  const { chunks } = evidence;
  assert.ok(Array.isArray(chunks) && chunks.length > 20, 'Empty chunk evidence');
  for (const chunk of chunks) {
    const hash = createHash('sha256')
      .update(readFileSync(join(directory, chunk.file)))
      .digest('hex');
    assert.equal(hash, chunk.sha256, `Stale build evidence: ${chunk.file}`);
  }
  const nearby = chunks.filter((chunk) => chunk.modules.some((id) => id.startsWith('src/nearby/')));
  if (!native) {
    assert.equal(nearby.length, 0, 'Nearby source modules leaked into the Web build');
    return;
  }
  assert.equal(
    gameIds.length,
    14,
    'Update the selected-game evidence when the supported set changes',
  );
  assert.ok(nearby.length > 14, 'Nearby entries unexpectedly merged into one chunk');
  const manifest = JSON.parse(readFileSync(join(directory, '.vite/manifest.json'), 'utf8'));
  const initialModules = new Set(
    Object.values(manifest)
      .filter((entry) => entry.isEntry)
      .flatMap((entry) => reachableModules(chunks, entry.file)),
  );
  assert.ok(
    ![...initialModules].some((id) => id.startsWith('src/nearby/')),
    'Nearby modules leaked into the initial app entry',
  );
  assert.ok(
    !initialModules.has('src/games/ludo/game/cpu.ts'),
    'Ludo CPU leaked into the initial entry',
  );
  assert.deepEqual(
    [...initialModules]
      .filter(forbiddenNearbyModule)
      .filter(
        (id) =>
          id !== 'src/ui/clubBridge.ts' &&
          !/^src\/games\/[^/]+\/(?:storage\/keys|challenge\/contract)\.ts$/.test(id),
      ),
    [],
    'Solo CPU/provider/storage/Club leaked into the initial app entry',
  );
  // Shared shell helpers can live in the already-loaded entry chunk alongside
  // registry key/contract leaves and the dormant Club bridge. The source gate
  // prohibits Nearby calling those APIs; here audit what opening Nearby loads.
  for (const chunk of nearby) {
    const illegal = reachableModules(chunks, chunk.file)
      .filter((id) => !initialModules.has(id))
      .filter(forbiddenNearbyModule);
    assert.deepEqual(illegal, [], `Solo CPU/provider/storage/Club reachable from ${chunk.file}`);
  }
  const core = nearby.find((chunk) => chunk.modules.includes('src/nearby/NearbyRoot.tsx'));
  assert.ok(core, 'Missing Nearby root');
  for (const selected of [null, ...gameIds]) {
    const entry =
      selected === null
        ? core
        : nearby.find((chunk) => chunk.modules.includes(`src/nearby/games/${selected}View.tsx`));
    assert.ok(entry, `Missing Nearby game view: ${selected}`);
    const modules = reachableModules(chunks, entry.file);
    if (selected !== null)
      assert.ok(
        modules.includes(`src/nearby/games/${selected}.ts`),
        `${selected} view is missing its matching adapter`,
      );
    for (const game of gameIds) {
      if (game === selected) continue;
      assert.ok(
        !modules.includes(`src/nearby/games/${game}View.tsx`),
        `${selected ?? 'room'} eagerly loads ${game}'s view`,
      );
      // Session retains a small Yacht rules default for compatibility; its
      // visual surface, and every other adapter, still load only on selection.
      if (game !== 'yacht')
        assert.ok(
          !modules.includes(`src/nearby/games/${game}.ts`),
          `${selected ?? 'room'} eagerly loads ${game}'s adapter`,
        );
    }
  }
}
function walk(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, extensions);
    return extensions.test(entry.name) ? [path] : [];
  });
}
const forbidden =
  /NearbyPoc|prototypes\/nearby|9b5d100[012]-7a4c-4e13-a280-75d53c01a268|_sgnearby\._tcp/i;
if (!forbidden.test('NearbyPoc') || !forbidden.test('_sgnearby._tcp'))
  throw new Error('Isolation matcher is broken');
const files = [
  ...walk(join(app, 'src'), /\.[cm]?[jt]sx?$/),
  ...walk(join(app, 'dist'), /\.(js|html|css|json)$/),
  ...walk(join(app, 'dist-web'), /\.(js|html|css|json)$/),
  ...walk(join(app, 'android/app/src/main'), /\.(java|kt|xml)$/),
  ...walk(join(app, 'ios/App/App'), /\.(swift|plist)$/),
];
for (const path of files)
  if (forbidden.test(readFileSync(path, 'utf8')))
    throw new Error(`PoC leaked into production: ${relative(app, path)}`);
// Product-owned Nearby Play uses distinct service identifiers. Permissions are
// now intentional; importing the development application remains prohibited.
const web = walk(join(app, 'dist-web'), /\.(js|html|css|json)$/);
for (const path of web)
  if (/NearbyPlay|_sgnearplay\._tcp|9b5d200[012]-7a4c/i.test(readFileSync(path, 'utf8')))
    throw new Error(`Native Nearby Play leaked into Web: ${relative(app, path)}`);
checkBuiltNearby(join(app, 'dist'), true);
checkBuiltNearby(join(app, 'dist-web'), false);
console.log(
  `Nearby isolation: ${files.length} files checked; no prototype in product, no Nearby in Web, 14 selected views stay lazy. Only Ludo's pure CPU is permitted; solo storage/providers/Club remain excluded.`,
);
