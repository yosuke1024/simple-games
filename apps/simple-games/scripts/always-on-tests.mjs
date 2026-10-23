/**
 * 差分に関係なく毎回走らせるテストのディレクトリ。
 *
 * src/test/*.test.ts(x) の多く(gameI18nWiring / importBoundaries / refLeading /
 * homeActionsWiring / savedGameSlots / shareWiring / styles など)と
 * src/app/*.test.ts(x)・src/i18n/*.test.ts は node:fs でソースファイルを直接読む
 * テストで、import グラフを辿らない。だから vitest --changed はゲームファイルを
 * 変更してもこれらを「無関係」と判定して再実行しない。src/club/ も同じ:
 * club/ はゲームを import できない(importBoundaries 規則 5)ので、その検査
 * (club/ui/titles.test.ts)はゲームのカタログと challenge/contract.ts を文字列で
 * 読む。差分スコープで走らせる側 —— ローカルの verify-changed.mjs と CI の
 * test-scoped.mjs —— はこの 4 ディレクトリを必ず足す。ゲームの外で fs でソースを
 * 読むテストをここ以外に置かないのが、この一覧が完全であり続けるための約束
 * (ゲームの中で自分のファイルを読むテストは、test-scoped.mjs が「触ったゲームの
 * テスト全部」で受ける)。
 */
export const ALWAYS_ON_TEST_DIRS = ['src/test', 'src/app', 'src/i18n', 'src/club'];
