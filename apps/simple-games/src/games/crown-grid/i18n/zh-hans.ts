import type { CrownGridMessages } from './en';

export const zhHans: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: '选择盘面',
  crownGridDifficulty_easy: '简单',
  crownGridDifficulty_medium: '中等',
  crownGridDifficulty_hard: '困难',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: '替换进行中的盘面？',
  crownGridConfirmSwitchBody: '进行中的“{current}”会被新的“{next}”盘面替换。',
  crownGridBoardLabel: 'Crown Grid 盘面，{size}×{size}',
  crownGridCellEmpty: '空，第 {row} 行第 {col} 列，区域 {region}',
  crownGridCellCross: '叉，第 {row} 行第 {col} 列，区域 {region}',
  crownGridCellCrown: '王冠，第 {row} 行第 {col} 列，区域 {region}',
  crownGridRuleBroken: '违反规则',
  crownGridHintViolation: '高亮的王冠违反了规则。',
  crownGridHintWrong: '标记的王冠不可能正确。',
  crownGridHintSingle_row: '高亮的这一行只剩一个格子能放王冠：就是描边的那个。',
  crownGridHintSingle_col: '高亮的这一列只剩一个格子能放王冠：就是描边的那个。',
  crownGridHintSingle_region: '高亮的这个区域只剩一个格子能放王冠：就是描边的那个。',
  crownGridHintConfine_regionRow:
    '高亮的区域只能把王冠放在着色的格子里，这些格子都在同一行——所以这一行里其余的格子（描边的）都不可能。',
  crownGridHintConfine_regionCol:
    '高亮的区域只能把王冠放在着色的格子里，这些格子都在同一列——所以这一列里其余的格子（描边的）都不可能。',
  crownGridHintConfine_rowRegion:
    '高亮的这一行只能把王冠放在着色的格子里，这些格子都在同一个区域——所以这个区域里其余的格子（描边的）都不可能。',
  crownGridHintConfine_colRegion:
    '高亮的这一列只能把王冠放在着色的格子里，这些格子都在同一个区域——所以这个区域里其余的格子（描边的）都不可能。',
  crownGridHintAttack_row:
    '如果在描边的格子放一个王冠，会排除所有着色的格子，让高亮的这一行无处安放它的王冠。',
  crownGridHintAttack_col:
    '如果在描边的格子放一个王冠，会排除所有着色的格子，让高亮的这一列无处安放它的王冠。',
  crownGridHintAttack_region:
    '如果在描边的格子放一个王冠，会排除所有着色的格子，让高亮的这个区域无处安放它的王冠。',
  crownGridHintPair_regionsRows:
    '高亮的这两个区域，只能把王冠放在着色的格子里，而这些格子刚好落在两行——所以这两行里其余的格子（描边的）都不可能。',
  crownGridHintPair_regionsCols:
    '高亮的这两个区域，只能把王冠放在着色的格子里，而这些格子刚好落在两列——所以这两列里其余的格子（描边的）都不可能。',
  crownGridHintPair_rowsRegions:
    '高亮的这两行，只能把王冠放在着色的格子里，而这些格子刚好落在两个区域——所以这两个区域里其余的格子（描边的）都不可能。',
  crownGridHintPair_colsRegions:
    '高亮的这两列，只能把王冠放在着色的格子里，而这些格子刚好落在两个区域——所以这两个区域里其余的格子（描边的）都不可能。',
  crownGridHintHypothesis_row:
    '试着在描边的格子放一个王冠：由此推出的连锁步骤会让高亮的这一行无处安放王冠，所以这里不可能是王冠。',
  crownGridHintHypothesis_col:
    '试着在描边的格子放一个王冠：由此推出的连锁步骤会让高亮的这一列无处安放王冠，所以这里不可能是王冠。',
  crownGridHintHypothesis_region:
    '试着在描边的格子放一个王冠：由此推出的连锁步骤会让高亮的这个区域无处安放王冠，所以这里不可能是王冠。',
  crownGridHintNone: '现在没有可确定的一步。',
  crownGridSolvedTitle: '完成！',
  crownGridSolvedBody: '每一行、每一列和每个区域都有一个王冠。',
  crownGridHintsUsed: '使用的提示',
  crownGridNewBestTime: '你的最快纪录。',
  crownGridNewBoard: '新盘面',
  crownGridDailySection: '每日',
  crownGridDailiesSolved: '通关天数',
  crownGridDailyBacklogHint: '之前的日期随时可以挑战。',
  crownGridStep1Title: '各一个王冠',
  crownGridStep1Body: '每一行、每一列和每种颜色都恰好有一个王冠。',
  crownGridStep2Title: '王冠互不相邻',
  crownGridStep2Body: '两个王冠不能挨在一起，斜着也不行。',
  crownGridStep3Title: '点按与拖动',
  crownGridStep3Body: '点按格子依次切换叉、王冠、空；拖动可连续标叉。卡住了？可以求提示。',
};
