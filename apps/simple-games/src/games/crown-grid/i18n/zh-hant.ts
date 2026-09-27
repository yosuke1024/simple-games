import type { CrownGridMessages } from './en';

export const zhHant: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: '選擇盤面',
  crownGridDifficulty_easy: '簡單',
  crownGridDifficulty_medium: '中等',
  crownGridDifficulty_hard: '困難',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: '要換掉進行中的盤面嗎？',
  crownGridConfirmSwitchBody: '進行中的「{current}」會被新的「{next}」盤面取代。',
  crownGridBoardLabel: 'Crown Grid 盤面，{size}×{size}',
  crownGridCellEmpty: '空白，第 {row} 列第 {col} 欄，區域 {region}',
  crownGridCellCross: '叉，第 {row} 列第 {col} 欄，區域 {region}',
  crownGridCellCrown: '王冠，第 {row} 列第 {col} 欄，區域 {region}',
  crownGridRuleBroken: '違反規則',
  crownGridHintViolation: '標示的王冠違反了規則。',
  crownGridHintWrong: '標記的王冠不可能正確。',
  crownGridHintSingle_row: '標示的這一列只剩一個方格能放王冠：就是有框線的那個。',
  crownGridHintSingle_col: '標示的這一欄只剩一個方格能放王冠：就是有框線的那個。',
  crownGridHintSingle_region: '標示的這個區域只剩一個方格能放王冠：就是有框線的那個。',
  crownGridHintConfine_regionRow:
    '標示的區域只能把王冠放在上色的方格裡，這些方格都在同一列——所以這一列裡其餘的方格（有框線的）都不可能。',
  crownGridHintConfine_regionCol:
    '標示的區域只能把王冠放在上色的方格裡，這些方格都在同一欄——所以這一欄裡其餘的方格（有框線的）都不可能。',
  crownGridHintConfine_rowRegion:
    '標示的這一列只能把王冠放在上色的方格裡，這些方格都在同一個區域——所以這個區域裡其餘的方格（有框線的）都不可能。',
  crownGridHintConfine_colRegion:
    '標示的這一欄只能把王冠放在上色的方格裡，這些方格都在同一個區域——所以這個區域裡其餘的方格（有框線的）都不可能。',
  crownGridHintAttack_row:
    '如果在有框線的方格放一個王冠，會排除所有上色的方格，讓標示的這一列無處安放它的王冠。',
  crownGridHintAttack_col:
    '如果在有框線的方格放一個王冠，會排除所有上色的方格，讓標示的這一欄無處安放它的王冠。',
  crownGridHintAttack_region:
    '如果在有框線的方格放一個王冠，會排除所有上色的方格，讓標示的這個區域無處安放它的王冠。',
  crownGridHintPair_regionsRows:
    '標示的這兩個區域，只能把王冠放在上色的方格裡，而這些方格剛好落在兩列——所以這兩列裡其餘的方格（有框線的）都不可能。',
  crownGridHintPair_regionsCols:
    '標示的這兩個區域，只能把王冠放在上色的方格裡，而這些方格剛好落在兩欄——所以這兩欄裡其餘的方格（有框線的）都不可能。',
  crownGridHintPair_rowsRegions:
    '標示的這兩列，只能把王冠放在上色的方格裡，而這些方格剛好落在兩個區域——所以這兩個區域裡其餘的方格（有框線的）都不可能。',
  crownGridHintPair_colsRegions:
    '標示的這兩欄，只能把王冠放在上色的方格裡，而這些方格剛好落在兩個區域——所以這兩個區域裡其餘的方格（有框線的）都不可能。',
  crownGridHintHypothesis_row:
    '試著在有框線的方格放一個王冠：由此推出的連鎖步驟會讓標示的這一列無處安放王冠，所以這裡不可能是王冠。',
  crownGridHintHypothesis_col:
    '試著在有框線的方格放一個王冠：由此推出的連鎖步驟會讓標示的這一欄無處安放王冠，所以這裡不可能是王冠。',
  crownGridHintHypothesis_region:
    '試著在有框線的方格放一個王冠：由此推出的連鎖步驟會讓標示的這個區域無處安放王冠，所以這裡不可能是王冠。',
  crownGridHintNone: '目前還推不出下一步。',
  crownGridSolvedTitle: '完成！',
  crownGridSolvedBody: '每一列、每一欄和每個區域都有一個王冠。',
  crownGridHintsUsed: '使用的提示',
  crownGridNewBestTime: '你的最快紀錄。',
  crownGridNewBoard: '新盤面',
  crownGridDailySection: '每日',
  crownGridDailiesSolved: '過關天數',
  crownGridDailyBacklogHint: '之前的日期隨時可以挑戰。',
  crownGridStep1Title: '各一個王冠',
  crownGridStep1Body: '每一列、每一欄和每種顏色都恰好有一個王冠。',
  crownGridStep2Title: '王冠互不相鄰',
  crownGridStep2Body: '兩個王冠不能相鄰，斜向也不行。',
  crownGridStep3Title: '點按與拖曳',
  crownGridStep3Body: '點按方格依序切換叉、王冠、空白；拖曳可連續標叉。卡住了？可以求提示。',
};
