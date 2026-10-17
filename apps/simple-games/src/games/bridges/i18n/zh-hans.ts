/**
 * Simplified Chinese catalog for Bridges. Provenance (docs/BRIDGES_RULES.md
 * §14, docs/I18N_POLICY.md): `machine` — written with AI assistance and **not
 * read by a native speaker**. The title (`bridgesName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * 行 = row, 列 = column.
 */
import type { BridgesMessages } from './en';

export const zhHans: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: '选择盘面',
  bridgesDifficulty_easy: '简单',
  bridgesDifficulty_medium: '中等',
  bridgesDifficulty_hard: '困难',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: '替换进行中的盘面？',
  bridgesConfirmSwitchBody: '进行中的“{current}”盘面会被新的“{next}”盘面替换。',
  bridgesBoardLabel: 'Bridges 盘面，{width} 乘 {height}，{islands} 座岛',
  bridgesIslandOpen: '第 {row} 行第 {col} 列的岛 {value}：{value} 座桥中已有 {count} 座',
  bridgesIslandComplete: '第 {row} 行第 {col} 列的岛 {value}：已完成',
  bridgesIslandOver: '第 {row} 行第 {col} 列的岛 {value}：{count} 座桥，太多了',
  bridgesIslandSelected: '{island}。已选中',
  bridgesIslandPartner: '{island}。可与选中的岛相连：2 座桥中已有 {bridges} 座',
  bridgesIslandHinted: '{island}。由提示高亮',
  bridgesIslandHintRing: '{island}。由提示高亮，在虚线圈里',
  bridgesAnnounceNone: '第 {row1} 行第 {col1} 列与第 {row2} 行第 {col2} 列之间：没有桥',
  bridgesAnnounceOne: '第 {row1} 行第 {col1} 列与第 {row2} 行第 {col2} 列之间：1 座桥',
  bridgesAnnounceTwo: '第 {row1} 行第 {col1} 列与第 {row2} 行第 {col2} 列之间：2 座桥',
  bridgesSplitNote: '所有数字都已满足，但岛分成了 {groups} 组。请把它们连成一体。',
  bridgesHintWrong: '高亮的两座岛之间桥太多了。',
  bridgesHintOne: '高亮的两座岛之间至少需要 1 座桥。',
  bridgesHintTwo: '高亮的两座岛之间需要 2 座桥。',
  bridgesHintOneAt: '从虚线圈里的岛数一数：高亮的两座岛之间至少需要 1 座桥。',
  bridgesHintTwoAt: '从虚线圈里的岛数一数：高亮的两座岛之间需要 2 座桥。',
  bridgesHintNone: '从这里找不到确定的一步。',
  bridgesHintWhere: '高亮的岛：第 {row1} 行第 {col1} 列与第 {row2} 行第 {col2} 列。',
  bridgesHintWhereRing:
    '高亮的岛：第 {row1} 行第 {col1} 列与第 {row2} 行第 {col2} 列。虚线圈：第 {row} 行第 {col} 列。',
  bridgesSolvedTitle: '全部连通！',
  bridgesSolvedBody: '所有岛都连成了一个网络。',
  bridgesHintsUsed: '使用的提示',
  bridgesNewBestTime: '你的最快纪录。',
  bridgesNewBoard: '新盘面',
  bridgesSolvedCount: '完成的盘面',
  bridgesDailySection: '每日',
  bridgesDailiesCleared: '完成天数',
  bridgesAllModes: '所有模式',
  bridgesStep1Title: '数字就是桥数',
  bridgesStep1Body: '每座岛连接的桥数正好等于它的数字。',
  bridgesStep2Title: '横平竖直，最多两座',
  bridgesStep2Body: '桥只能横向或纵向笔直架设，不能交叉，同一对岛之间最多两座。',
  bridgesStep3Title: '全部连起来',
  bridgesStep3Body:
    '点按一座岛，再点按带圈的另一座岛来架桥（再点一次变两座，再点归零），直到所有岛连在一起。',
};
