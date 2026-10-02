/**
 * Japanese catalog of Number Path (docs/I18N_POLICY.md: provenance `author`).
 * The title is a proper noun and stays as-is.
 */
import type { NumberPathMessages } from './en';

export const ja: NumberPathMessages = {
  numberPathName: 'Number Path',
  numberPathChooseBoard: '盤面を選ぶ',
  numberPathDifficulty_easy: 'かんたん',
  numberPathDifficulty_medium: 'ふつう',
  numberPathDifficulty_hard: 'むずかしい',
  numberPathBoardNote: '{width}×{height}',
  numberPathBoardLabel: 'Number Path の盤面、{width}×{height}',
  numberPathCellPlain: '{row}行 {col}列',
  numberPathCellNumber: '数字 {n}、{row}行 {col}列',
  numberPathOnPath: '道の {step} 番目',
  numberPathOffPath: '道の外',
  numberPathHintNext: '印のマスが次の 1 マスです。',
  numberPathHintBack: '道が正解から外れています。印のマスまで戻ってください。',
  numberPathHintNone: '今はヒントがありません。',
  numberPathHintMarked: 'ヒント',
  numberPathSolvedTitle: '完成！',
  numberPathSolvedBody: '1 本の線で、全マスを順番どおりに。',
  numberPathHintsUsed: '使ったヒント',
  numberPathNewBestTime: '自己最速です。',
  numberPathNewBoard: '新しい盤面',
  numberPathSolvedCount: 'クリアした盤面',
  numberPathDailySection: 'デイリー',
  numberPathDailiesSolved: 'クリアした日数',
  numberPathStep1Title: '数字を順にたどる',
  numberPathStep1Body: '1 から 1 本の線を引き、数字を順に通ります。',
  numberPathStep2Title: '全部のマスを 1 回ずつ',
  numberPathStep2Body: '線は全マスをちょうど 1 回通り、最後の数字で終わります。',
  numberPathStep3Title: '壁は越えない',
  numberPathStep3Body: '太い辺は壁。戻るときは線をなぞり返すか、線の途中をタップします。',
};
