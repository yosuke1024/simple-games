#!/usr/bin/env node
/**
 * iOS の版をタグに合わせるための道具(docs/RELEASE_CHECKLIST.md §4.7 / §7)。
 *
 *   node scripts/ios-version.mjs check              内部の整合だけを見る(CI で毎回)
 *   node scripts/ios-version.mjs check --tag v1.2.0 タグと一致するかまで見る(リリース時)
 *   node scripts/ios-version.mjs set 1.2.0          pbxproj の 2 つの値を書き直す
 *
 * Android の版は git タグから導出されるのでソースに版が無い
 * (.github/workflows/android-release.yml)。iOS はそうできない —— Archive は
 * Mac の上で人間が回すので、`MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` は
 * Xcode プロジェクトに書かれた値がそのまま出荷される(ios/ExportOptions.plist の
 * `manageAppVersionAndBuildNumber` = false)。手で持つ値は必ず腐る:
 * 実際 v1.0.1 から v1.1.2 までの 4 つのタグの間、pbxproj は 1.0 / 1 のままだった。
 *
 * だからここで機械が見る。守るのは 3 つ:
 *
 *   1. `MARKETING_VERSION` が正規形の MAJOR.MINOR.PATCH(先頭ゼロなし・
 *      minor / patch は 100 未満)であること —— Android の versionCode と
 *      同じ制約。両ストアの版を同じ数から作るため。
 *   2. `CURRENT_PROJECT_VERSION` が Android の versionCode と同じ式
 *      (major * 10000 + minor * 100 + patch)で導けること。App Store の
 *      ビルド番号も単調増加でなければならず、2 つのストアで別々の数を
 *      手で管理する理由が無い。
 *   3. Debug / Release の両方が同じ値を持つこと。片方だけ上げると、
 *      手元で確かめた版と出荷した版が違うものになる。
 *
 * `--tag` を渡すと 4 つ目 —— そのタグの版であること —— まで見る。タグを打つ
 * ワークフローが唯一「このリリースは何番か」を知っている場所なので、
 * iOS の版がそこからずれていたらリリースを止める。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PBXPROJ = join(HERE, '..', 'ios/App/App.xcodeproj/project.pbxproj');

/** Android の versionCode と同じ式(android-release.yml「Resolve version from tag」)。 */
export function buildNumberFor(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  return major * 10000 + minor * 100 + patch;
}

/** 先頭ゼロを認めないのは Android と同じ理由: 1.01.0 と 1.1.0 が同じ番号になる。 */
const CANONICAL = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

export function validateVersion(version) {
  if (!CANONICAL.test(version)) {
    return `版は MAJOR.MINOR.PATCH の形にしてください(先頭ゼロなし。受け取った値: ${version})`;
  }
  const [, , minor, patch] = CANONICAL.exec(version);
  if (Number(minor) >= 100 || Number(patch) >= 100) {
    return `minor / patch は 100 未満にしてください(${version} はビルド番号が別の版と衝突します)`;
  }
  return null;
}

function readPbxproj() {
  return readFileSync(PBXPROJ, 'utf8');
}

function valuesOf(source, key) {
  return [...source.matchAll(new RegExp(`^\\s*${key} = (.+);$`, 'gm'))].map((m) => m[1]);
}

/**
 * pbxproj の中身だけを見る純関数。CLI と `src/test/iosVersion.test.ts` の
 * 両方がここを呼ぶ —— CI のステップだけに置くと、手元の `pnpm test` が
 * 緑のままタグを打ててしまう。
 */
export function versionErrors(source, tag) {
  const marketing = valuesOf(source, 'MARKETING_VERSION');
  const build = valuesOf(source, 'CURRENT_PROJECT_VERSION');
  const errors = [];

  // 0 件は「設定が消えた」であって「問題なし」ではない。cap sync や Xcode の
  // 移行でキーごと落ちたときに黙って通らないようにする。
  if (marketing.length === 0) errors.push('MARKETING_VERSION が pbxproj にありません。');
  if (build.length === 0) errors.push('CURRENT_PROJECT_VERSION が pbxproj にありません。');

  const uniqueMarketing = [...new Set(marketing)];
  const uniqueBuild = [...new Set(build)];
  if (uniqueMarketing.length > 1) {
    errors.push(
      `Debug / Release の MARKETING_VERSION が食い違っています: ${uniqueMarketing.join(' / ')}`,
    );
  }
  if (uniqueBuild.length > 1) {
    errors.push(
      `Debug / Release の CURRENT_PROJECT_VERSION が食い違っています: ${uniqueBuild.join(' / ')}`,
    );
  }

  const version = uniqueMarketing[0];
  if (version) {
    const invalid = validateVersion(version);
    if (invalid) {
      errors.push(`MARKETING_VERSION: ${invalid}`);
    } else if (uniqueBuild.length === 1) {
      const expected = String(buildNumberFor(version));
      if (uniqueBuild[0] !== expected) {
        errors.push(
          `CURRENT_PROJECT_VERSION は ${expected} のはずです(${version} から導出。実際の値: ${uniqueBuild[0]})`,
        );
      }
    }
  }

  if (tag !== undefined) {
    const tagged = tag.startsWith('v') ? tag.slice(1) : tag;
    if (version !== tagged) {
      errors.push(
        `タグ ${tag} のリリースなのに iOS の版は ${version} です。` +
          `\`pnpm --filter simple-games ios:version set ${tagged}\` を実行してからタグを打ち直してください。`,
      );
    }
  }

  return errors;
}

/** リポジトリの pbxproj をそのまま見る(テストもこれを呼んで実物を見る)。 */
export function pbxprojErrors(tag) {
  return versionErrors(readPbxproj(), tag);
}

function check(tag) {
  const source = readPbxproj();
  const errors = versionErrors(source, tag);

  if (errors.length > 0) {
    console.error('iOS の版が揃っていません:');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }

  const [version] = valuesOf(source, 'MARKETING_VERSION');
  const [build] = valuesOf(source, 'CURRENT_PROJECT_VERSION');
  console.log(`ok  iOS: MARKETING_VERSION ${version} / CURRENT_PROJECT_VERSION ${build}`);
}

function set(version) {
  const invalid = validateVersion(version);
  if (invalid) {
    console.error(invalid);
    process.exit(1);
  }
  const source = readPbxproj();
  const build = buildNumberFor(version);
  const updated = source
    .replace(/^(\s*)MARKETING_VERSION = .+;$/gm, `$1MARKETING_VERSION = ${version};`)
    .replace(/^(\s*)CURRENT_PROJECT_VERSION = .+;$/gm, `$1CURRENT_PROJECT_VERSION = ${build};`);
  if (updated === source) {
    console.error('pbxproj に書き換える設定が見つかりませんでした。');
    process.exit(1);
  }
  writeFileSync(PBXPROJ, updated);
  console.log(
    `iOS: MARKETING_VERSION ${version} / CURRENT_PROJECT_VERSION ${build} に更新しました。`,
  );
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === 'check') {
    const tagIndex = rest.indexOf('--tag');
    if (tagIndex !== -1 && !rest[tagIndex + 1]) {
      console.error('--tag にはタグ名が要ります: node scripts/ios-version.mjs check --tag v1.2.0');
      process.exit(1);
    }
    check(tagIndex === -1 ? undefined : rest[tagIndex + 1]);
  } else if (command === 'set') {
    if (!rest[0]) {
      console.error('版を渡してください: node scripts/ios-version.mjs set 1.2.0');
      process.exit(1);
    }
    set(rest[0]);
  } else {
    console.error('使い方: node scripts/ios-version.mjs check [--tag v1.2.0] | set <version>');
    process.exit(1);
  }
}

/* テストは versionErrors / pbxprojErrors を import するだけなので、
   直接起動されたときにしか CLI は動かない。 */
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
