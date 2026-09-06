/**
 * iOS の版が pbxproj の中で揃っていること(scripts/ios-version.mjs)。
 *
 * Android の版はタグから導出されるのでソースに版が無いが、iOS は Mac の上で
 * 人間が Archive するので Xcode プロジェクトの値がそのまま出荷される
 * (ios/ExportOptions.plist の `manageAppVersionAndBuildNumber` = false)。
 * 手で持つ値は腐る —— v1.0.1 から v1.1.2 までの 4 つのタグの間、ここは
 * 1.0 / 1 のまま出荷される状態だった。
 *
 * リリース時のタグとの一致は android-release.yml が見る(タグを知っているのは
 * あそこだけ)。ここで見るのは、それ以前に壊れうるもの —— 形式・Debug と
 * Release の一致・ビルド番号の導出 —— で、手元の `pnpm test` にも出るように
 * している。CI のステップだけに置くと、開発中は緑のまま気づけない。
 */
import { describe, expect, it } from 'vitest';
import {
  buildNumberFor,
  pbxprojErrors,
  validateVersion,
  versionErrors,
} from '../../scripts/ios-version.mjs';

/** 実際の pbxproj と同じ形の最小の断片。 */
function pbxproj(marketing: string, build: string): string {
  return [
    '\t\t\tbuildSettings = {',
    `\t\t\t\tCURRENT_PROJECT_VERSION = ${build};`,
    `\t\t\t\tMARKETING_VERSION = ${marketing};`,
    '\t\t\t};',
  ].join('\n');
}

describe('iOS の版', () => {
  it('リポジトリの pbxproj が揃っている', () => {
    expect(pbxprojErrors()).toEqual([]);
  });

  it('ビルド番号は Android の versionCode と同じ式で導く', () => {
    expect(buildNumberFor('1.2.0')).toBe(10200);
    expect(buildNumberFor('1.0.1')).toBe(10001);
    expect(buildNumberFor('2.13.7')).toBe(21307);
  });

  it('先頭ゼロと 100 以上の minor / patch を受け付けない', () => {
    expect(validateVersion('1.2.0')).toBeNull();
    // 1.01.0 と 1.1.0 は同じビルド番号になり、片方が永久に出せなくなる。
    expect(validateVersion('1.01.0')).not.toBeNull();
    expect(validateVersion('1.2')).not.toBeNull();
    expect(validateVersion('1.100.0')).not.toBeNull();
    expect(validateVersion('1.0.100')).not.toBeNull();
  });

  it('Debug と Release が食い違っていたら落ちる', () => {
    const source = `${pbxproj('1.2.0', '10200')}\n${pbxproj('1.1.0', '10200')}`;
    expect(versionErrors(source)).toHaveLength(1);
  });

  it('ビルド番号が版から導けない値なら落ちる', () => {
    expect(versionErrors(pbxproj('1.2.0', '1'))).toHaveLength(1);
  });

  it('設定ごと消えていたら落ちる(0 件は「問題なし」ではない)', () => {
    expect(versionErrors('buildSettings = {};').length).toBeGreaterThan(0);
  });

  it('タグを渡すと、その版であることまで見る', () => {
    const source = pbxproj('1.2.0', '10200');
    expect(versionErrors(source, 'v1.2.0')).toEqual([]);
    expect(versionErrors(source, 'v1.2.1')).toHaveLength(1);
  });
});
