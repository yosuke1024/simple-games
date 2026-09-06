/**
 * `ios-version.mjs` は node が直接動かすリリース用のスクリプトなので素の JS で
 * 書いてある。それを src/test から呼ぶための型だけをここに置く(実装は .mjs 側)。
 */

/** Android の versionCode と同じ式。`1.2.0` → `10200`。 */
export function buildNumberFor(version: string): number;

/** 正規形なら null、そうでなければ理由の文言を返す。 */
export function validateVersion(version: string): string | null;

/** pbxproj の中身を渡して、揃っていない点を並べる(空配列なら ok)。 */
export function versionErrors(source: string, tag?: string): string[];

/** リポジトリの pbxproj をそのまま見る。 */
export function pbxprojErrors(tag?: string): string[];
