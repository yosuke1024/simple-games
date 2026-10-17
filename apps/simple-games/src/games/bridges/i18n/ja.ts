/**
 * Japanese catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14):
 * written by AI as a draft and **not yet read by the author** — not a reviewed
 * translation. The title (`bridgesName`) is a proper noun and stays as-is in
 * every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const ja: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: '盤面を選ぶ',
  bridgesDifficulty_easy: 'かんたん',
  bridgesDifficulty_medium: 'ふつう',
  bridgesDifficulty_hard: 'むずかしい',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: '進行中の盤面を置き換えますか？',
  bridgesConfirmSwitchBody: '進行中の{current}の盤面は、新しい{next}の盤面に置き換わります。',
  bridgesBoardLabel: 'Bridges の盤面、{width}×{height}、島 {islands} 個',
  bridgesIslandOpen: '{row}行 {col}列の島 {value}：橋 {count} / {value} 本',
  bridgesIslandComplete: '{row}行 {col}列の島 {value}：完成',
  bridgesIslandOver: '{row}行 {col}列の島 {value}：橋 {count} 本、多すぎます',
  bridgesIslandSelected: '{island}。選択中',
  bridgesIslandPartner: '{island}。選択中の島とつなげます：いま {bridges} / 2 本',
  bridgesIslandHinted: '{island}。ヒントで強調',
  bridgesIslandHintRing: '{island}。ヒントで強調、点線の輪',
  bridgesAnnounceNone: '{row1}行 {col1}列と {row2}行 {col2}列の間：橋なし',
  bridgesAnnounceOne: '{row1}行 {col1}列と {row2}行 {col2}列の間：橋 1 本',
  bridgesAnnounceTwo: '{row1}行 {col1}列と {row2}行 {col2}列の間：橋 2 本',
  bridgesSplitNote:
    'すべての数字を満たしましたが、島が {groups} つのグループに分かれています。1 つにつなげてください。',
  bridgesHintWrong: '強調した 2 つの島の間の橋が多すぎます。',
  bridgesHintOne: '強調した 2 つの島の間には、少なくとも 1 本の橋が要ります。',
  bridgesHintTwo: '強調した 2 つの島の間には、橋が 2 本要ります。',
  bridgesHintOneAt:
    '点線の輪の島を数えてみてください。強調した 2 つの島の間に、少なくとも 1 本の橋が要ります。',
  bridgesHintTwoAt:
    '点線の輪の島を数えてみてください。強調した 2 つの島の間に、橋が 2 本要ります。',
  bridgesHintNone: '今わかる手が見つかりません。',
  bridgesHintWhere: '強調した島：{row1}行 {col1}列と {row2}行 {col2}列。',
  bridgesHintWhereRing:
    '強調した島：{row1}行 {col1}列と {row2}行 {col2}列。点線の輪：{row}行 {col}列。',
  bridgesSolvedTitle: 'すべてつながりました！',
  bridgesSolvedBody: 'すべての島が 1 つのネットワークになりました。',
  bridgesHintsUsed: 'ヒント使用',
  bridgesNewBestTime: '自己ベスト更新。',
  bridgesNewBoard: '新しい盤面',
  bridgesSolvedCount: 'クリア数',
  bridgesDailySection: 'デイリー',
  bridgesDailiesCleared: '達成日数',
  bridgesAllModes: 'すべてのモード',
  bridgesStep1Title: '数字は橋の本数',
  bridgesStep1Body: '島の数字と同じ本数の橋を、その島からかけます。',
  bridgesStep2Title: '縦か横に、2 本まで',
  bridgesStep2Body: '橋は縦か横にまっすぐ渡り、交差せず、同じ 2 つの島の間は 2 本までです。',
  bridgesStep3Title: '全部を 1 つに',
  bridgesStep3Body:
    '島をタップし、輪の付いた相手をタップして橋をかけ（もう一度で 2 本、次で 0 本）、すべての島をつなぎます。',
};
