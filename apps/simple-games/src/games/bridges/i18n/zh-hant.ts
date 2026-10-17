/**
 * Traditional Chinese catalog for Bridges. Provenance (docs/BRIDGES_RULES.md
 * §14, docs/I18N_POLICY.md): `machine` — written with AI assistance and **not
 * read by a native speaker**. The title (`bridgesName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Taiwan usage like the other catalogs: 列 = row, 欄 = column.
 */
import type { BridgesMessages } from './en';

export const zhHant: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: '選擇盤面',
  bridgesDifficulty_easy: '簡單',
  bridgesDifficulty_medium: '中等',
  bridgesDifficulty_hard: '困難',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: '取代進行中的盤面？',
  bridgesConfirmSwitchBody: '進行中的「{current}」盤面會被新的「{next}」盤面取代。',
  bridgesBoardLabel: 'Bridges 盤面，{width} 乘 {height}，{islands} 座島',
  bridgesIslandOpen: '第 {row} 列第 {col} 欄的島 {value}：{value} 座橋中已有 {count} 座',
  bridgesIslandComplete: '第 {row} 列第 {col} 欄的島 {value}：已完成',
  bridgesIslandOver: '第 {row} 列第 {col} 欄的島 {value}：{count} 座橋，太多了',
  bridgesIslandSelected: '{island}。已選取',
  bridgesIslandPartner: '{island}。可與選取的島相連：2 座橋中已有 {bridges} 座',
  bridgesIslandHinted: '{island}。由提示標示',
  bridgesIslandHintRing: '{island}。由提示標示，在虛線圈裡',
  bridgesAnnounceNone: '第 {row1} 列第 {col1} 欄與第 {row2} 列第 {col2} 欄之間：沒有橋',
  bridgesAnnounceOne: '第 {row1} 列第 {col1} 欄與第 {row2} 列第 {col2} 欄之間：1 座橋',
  bridgesAnnounceTwo: '第 {row1} 列第 {col1} 欄與第 {row2} 列第 {col2} 欄之間：2 座橋',
  bridgesSplitNote: '所有數字都已滿足，但島分成了 {groups} 組。請把它們連成一體。',
  bridgesHintWrong: '標示的兩座島之間橋太多了。',
  bridgesHintOne: '標示的兩座島之間至少需要 1 座橋。',
  bridgesHintTwo: '標示的兩座島之間需要 2 座橋。',
  bridgesHintOneAt: '從虛線圈裡的島數一數：標示的兩座島之間至少需要 1 座橋。',
  bridgesHintTwoAt: '從虛線圈裡的島數一數：標示的兩座島之間需要 2 座橋。',
  bridgesHintNone: '從這裡找不到確定的一步。',
  bridgesHintWhere: '標示的島：第 {row1} 列第 {col1} 欄與第 {row2} 列第 {col2} 欄。',
  bridgesHintWhereRing:
    '標示的島：第 {row1} 列第 {col1} 欄與第 {row2} 列第 {col2} 欄。虛線圈：第 {row} 列第 {col} 欄。',
  bridgesSolvedTitle: '全部連通！',
  bridgesSolvedBody: '所有島都連成了一個網路。',
  bridgesHintsUsed: '使用的提示',
  bridgesNewBestTime: '你的最快紀錄。',
  bridgesNewBoard: '新盤面',
  bridgesSolvedCount: '完成的盤面',
  bridgesDailySection: '每日',
  bridgesDailiesCleared: '完成天數',
  bridgesAllModes: '所有模式',
  bridgesStep1Title: '數字就是橋數',
  bridgesStep1Body: '每座島連接的橋數正好等於它的數字。',
  bridgesStep2Title: '橫平豎直，最多兩座',
  bridgesStep2Body: '橋只能橫向或縱向筆直架設，不能交叉，同一對島之間最多兩座。',
  bridgesStep3Title: '全部連起來',
  bridgesStep3Body:
    '點一下一座島，再點帶圈的另一座島來架橋（再點一次變兩座，再點歸零），直到所有島連在一起。',
};
