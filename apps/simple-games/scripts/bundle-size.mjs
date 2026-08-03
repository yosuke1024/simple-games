#!/usr/bin/env node
/**
 * ビルドサイズの計測と予算 Gate(issue #26)。
 *
 *   node scripts/bundle-size.mjs check    予算・ベースラインと突き合わせて検証
 *   node scripts/bundle-size.mjs update   size-baseline.json を現在の実測値で書き直す
 *
 * 「軽快に起動する」はブランドプロミスであって感想ではないので、数字で守る。
 * dist/(Android 用)と dist-web/(Web 用)の両方を raw / gzip で計測し、
 *
 *   1. ゲーム固有チャンク(game-<id>-*.js)が 1 本でも予算を超えたら FAIL
 *   2. エントリチャンクがベースラインから予算比率を超えて育ったら FAIL
 *   3. ホームの初期グラフ(エントリからの静的 import 連鎖)にゲームチャンクが
 *      混入していたら FAIL(.vite/manifest.json を辿る)
 *   4. ベースラインからの増減は常に表示する(どのチャンクが原因かまで)
 *
 * しきい値を超えるのが正しいこともある。そのときは `pnpm size:update` で
 * ベースラインを意図的に更新し、理由を PR に書く。黙って通る道はない。
 *
 * ゲームチャンクがまだ存在しないビルド(分割前)では 1〜3 を自動でスキップし、
 * 計測とベースライン比較だけを行う。
 */
import { gzipSync } from 'node:zlib';
import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
  appendFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const BASELINE_PATH = join(APP, 'size-baseline.json');
const GAMES_DIR = join(APP, 'src/games');

// ---------- 予算(変えるときは docs/ARCHITECTURE.md のサイズ Gate 節も更新) ----------

/** ゲーム 1 本のチャンク合計(JS+CSS, gzip)の上限。issue #26 の初期ガードレール。 */
const GAME_CHUNK_GZIP_BUDGET = 500 * 1024;
/** エントリチャンク(gzip)がベースラインからこれ以上育ったら意図確認を求める。 */
const ENTRY_GROWTH_RATIO = 1.1;

// ---------- 計測 ----------

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(path));
    else out.push(path);
  }
  return out;
}

function fileType(name) {
  if (/\.m?js$/.test(name)) return 'js';
  if (name.endsWith('.css')) return 'css';
  if (/\.(woff2?|ttf|otf)$/.test(name)) return 'font';
  if (/\.(png|jpe?g|webp|svg|gif|ico)$/.test(name)) return 'image';
  if (/\.(mp3|ogg|wav|m4a)$/.test(name)) return 'audio';
  if (name.endsWith('.html')) return 'html';
  return 'other';
}

/** ディレクトリ名がそのままゲーム id(レジストリと同じ規約)。 */
function gameIds() {
  return readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** `game-<id>-<hash>.js` を id へ引き当てる。id 自体がハイフンを含むので前方一致で。 */
function gameOfChunk(name, ids) {
  for (const id of ids) {
    if (name.startsWith(`game-${id}-`)) return id;
  }
  return null;
}

function measureDist(distDir, ids) {
  const files = [];
  for (const path of listFiles(distDir)) {
    const rel = relative(distDir, path);
    if (rel.startsWith('.vite/')) continue; // manifest はビルドの説明であって配布物ではない
    const raw = statSync(path).size;
    const gzip = gzipSync(readFileSync(path), { level: 9 }).length;
    files.push({ rel, name: basename(rel), raw, gzip, type: fileType(rel) });
  }

  const total = { raw: 0, gzip: 0 };
  const byType = {};
  for (const f of files) {
    total.raw += f.raw;
    total.gzip += f.gzip;
    byType[f.type] ??= { raw: 0, gzip: 0 };
    byType[f.type].raw += f.raw;
    byType[f.type].gzip += f.gzip;
  }

  // エントリ = index-*.js。ゲームチャンクは JS と、その隣に出る同名 CSS の合計。
  const entry = files.filter((f) => f.type === 'js' && /^index-/.test(f.name));
  const games = {};
  for (const f of files) {
    const id = gameOfChunk(f.name, ids);
    if (id === null) continue;
    games[id] ??= { raw: 0, gzip: 0 };
    games[id].raw += f.raw;
    games[id].gzip += f.gzip;
  }

  return {
    files,
    total,
    byType,
    entryGzip: entry.reduce((sum, f) => sum + f.gzip, 0),
    games,
  };
}

// ---------- 初期グラフ Gate ----------

/**
 * .vite/manifest.json のエントリから静的 imports だけを辿り、ゲームチャンクへ
 * 届いたら失敗として返す。動的 import(dynamicImports)は辿らない — それが
 * 「選んだときだけ読む」の定義そのもの。
 */
function staticallyReachableGameChunks(distDir, ids) {
  const manifestPath = join(distDir, '.vite/manifest.json');
  if (!existsSync(manifestPath)) return null; // 分割前のビルド、または manifest 無効
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entries = Object.entries(manifest).filter(([, chunk]) => chunk.isEntry);
  const seen = new Set();
  const queue = entries.map(([key]) => key);
  const offenders = new Set();
  while (queue.length > 0) {
    const key = queue.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) continue;
    const id = gameOfChunk(basename(chunk.file), ids);
    if (id !== null) offenders.add(id);
    for (const dep of chunk.imports ?? []) queue.push(dep);
  }
  return [...offenders].sort();
}

// ---------- 出力 ----------

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function diffLabel(current, previous) {
  if (previous === undefined || previous === null) return '(新規)';
  const delta = current - previous;
  if (delta === 0) return '±0';
  const sign = delta > 0 ? '+' : '';
  const pct = previous > 0 ? ` (${sign}${((delta / previous) * 100).toFixed(1)}%)` : '';
  return `${sign}${kb(delta)}${pct}`;
}

function summarize(label, m, base, ids) {
  const lines = [];
  lines.push(`## ${label}`);
  lines.push(
    `合計: ${kb(m.total.raw)} (gzip ${kb(m.total.gzip)}) ${diffLabel(m.total.gzip, base?.totalGzip)}`,
  );
  for (const [type, sizes] of Object.entries(m.byType).sort()) {
    lines.push(
      `  ${type.padEnd(6)} ${kb(sizes.raw).padStart(10)}  gzip ${kb(sizes.gzip).padStart(10)}`,
    );
  }
  lines.push(`エントリ (gzip): ${kb(m.entryGzip)} ${diffLabel(m.entryGzip, base?.entryGzip)}`);
  const knownGames = ids.filter((id) => m.games[id]);
  if (knownGames.length > 0) {
    lines.push('ゲームチャンク (gzip):');
    for (const id of knownGames) {
      lines.push(
        `  ${id.padEnd(16)} ${kb(m.games[id].gzip).padStart(10)} ${diffLabel(m.games[id].gzip, base?.games?.[id])}`,
      );
    }
  }
  return lines.join('\n');
}

// ---------- main ----------

const command = process.argv[2];
if (command !== 'check' && command !== 'update') {
  console.error('usage: bundle-size.mjs check | update');
  process.exit(2);
}

const targets = [
  { key: 'dist', label: 'dist/ (Android 用)', dir: join(APP, 'dist'), buildCmd: 'pnpm build' },
  {
    key: 'distWeb',
    label: 'dist-web/ (Web 用)',
    dir: join(APP, 'dist-web'),
    buildCmd: 'pnpm --filter simple-games build:web',
  },
];

for (const target of targets) {
  if (!existsSync(target.dir)) {
    console.error(`${target.label} がありません。先に \`${target.buildCmd}\` を実行してください。`);
    process.exit(1);
  }
}

const ids = gameIds();
const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : null;

let fail = 0;
const report = [];
const problems = [];
const next = {};

for (const target of targets) {
  const m = measureDist(target.dir, ids);
  const base = baseline?.[target.key];
  report.push(summarize(target.label, m, base, ids));

  next[target.key] = {
    totalGzip: m.total.gzip,
    entryGzip: m.entryGzip,
    games: Object.fromEntries(ids.filter((id) => m.games[id]).map((id) => [id, m.games[id].gzip])),
  };

  const split = Object.keys(m.games).length > 0;
  if (split) {
    // 1. ゲームごとの予算
    for (const [id, sizes] of Object.entries(m.games)) {
      if (sizes.gzip > GAME_CHUNK_GZIP_BUDGET) {
        problems.push(
          `${target.label}: game-${id} が gzip ${kb(sizes.gzip)} で予算 ${kb(GAME_CHUNK_GZIP_BUDGET)} を超過。` +
            ' 軽量化できない根拠を PR に書いた上で予算を見直すこと。',
        );
      }
    }
    // 2. 全ゲームにチャンクがあるか(静的 import へ逆戻りすると消える)
    for (const id of ids) {
      if (!m.games[id]) {
        problems.push(
          `${target.label}: game-${id} のチャンクがありません。静的 import へ戻っていないか確認してください。`,
        );
      }
    }
    // 3. 初期グラフ
    const offenders = staticallyReachableGameChunks(target.dir, ids);
    if (offenders === null) {
      problems.push(
        `${target.label}: .vite/manifest.json がなく初期グラフを検証できません(vite.config.ts の build.manifest)。`,
      );
    } else if (offenders.length > 0) {
      problems.push(
        `${target.label}: ホームの初期グラフにゲームチャンクが静的に届いています: ${offenders.join(', ')}`,
      );
    }
  }

  // 4. エントリの成長(ベースライン比)
  if (command === 'check' && base?.entryGzip) {
    const limit = base.entryGzip * ENTRY_GROWTH_RATIO;
    if (m.entryGzip > limit) {
      problems.push(
        `${target.label}: エントリ gzip ${kb(m.entryGzip)} がベースライン ${kb(base.entryGzip)} の ` +
          `${ENTRY_GROWTH_RATIO} 倍を超過。意図した増加なら \`pnpm size:update\` で更新し理由を PR へ。`,
      );
    }
  }
}

const output = report.join('\n\n');
console.log(output);

if (command === 'update') {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`\nベースラインを更新しました: ${relative(process.cwd(), BASELINE_PATH)}`);
  process.exit(0);
}

if (baseline === null) {
  problems.push(
    'size-baseline.json がありません。`pnpm size:update` で生成してコミットしてください。',
  );
}

if (problems.length > 0) {
  fail = 1;
  console.error('\nFAIL:');
  for (const p of problems) console.error(`  - ${p}`);
} else {
  console.log('\nサイズ Gate: ok');
}

// CI のジョブサマリへも同じ表を残す(どの PR で何が育ったかを追える)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Bundle size\n\n\`\`\`\n${output}\n\`\`\`\n${problems.length ? `\n**FAIL**\n${problems.map((p) => `- ${p}`).join('\n')}\n` : ''}`,
    'utf8',
  );
}

process.exit(fail);
