import type { CrownGridMessages } from './en';

export const ja: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: '盤面を選ぶ',
  crownGridDifficulty_easy: 'かんたん',
  crownGridDifficulty_medium: 'ふつう',
  crownGridDifficulty_hard: 'むずかしい',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: '中断中の盤面を置き換えますか？',
  crownGridConfirmSwitchBody: '中断中の「{current}」は、新しい「{next}」の盤面に置き換わります。',
  crownGridBoardLabel: 'Crown Grid の盤面、{size}×{size}',
  crownGridCellEmpty: '空、{row}行 {col}列、領域 {region}',
  crownGridCellCross: '×、{row}行 {col}列、領域 {region}',
  crownGridCellCrown: '王冠、{row}行 {col}列、領域 {region}',
  crownGridRuleBroken: 'ルール違反',
  crownGridHintViolation: '強調された王冠がルールを破っています。',
  crownGridHintWrong: '印の王冠は成立しません。',
  crownGridHintSingle_row: '強調された行で王冠を置けるのは、枠のついたマスだけです。',
  crownGridHintSingle_col: '強調された列で王冠を置けるのは、枠のついたマスだけです。',
  crownGridHintSingle_region: '強調された領域で王冠を置けるのは、枠のついたマスだけです。',
  crownGridHintConfine_regionRow:
    '強調された領域の王冠は色のついたマスのどれかで、すべて同じ行にあります。その行のほかのマス(枠つき)には置けません。',
  crownGridHintConfine_regionCol:
    '強調された領域の王冠は色のついたマスのどれかで、すべて同じ列にあります。その列のほかのマス(枠つき)には置けません。',
  crownGridHintConfine_rowRegion:
    '強調された行の王冠は色のついたマスのどれかで、すべて同じ領域にあります。その領域のほかのマス(枠つき)には置けません。',
  crownGridHintConfine_colRegion:
    '強調された列の王冠は色のついたマスのどれかで、すべて同じ領域にあります。その領域のほかのマス(枠つき)には置けません。',
  crownGridHintAttack_row:
    '枠のついたマスに王冠を置くと、色のついたマスがすべて使えなくなり、強調された行に王冠を置ける場所がなくなります。',
  crownGridHintAttack_col:
    '枠のついたマスに王冠を置くと、色のついたマスがすべて使えなくなり、強調された列に王冠を置ける場所がなくなります。',
  crownGridHintAttack_region:
    '枠のついたマスに王冠を置くと、色のついたマスがすべて使えなくなり、強調された領域に王冠を置ける場所がなくなります。',
  crownGridHintPair_regionsRows:
    '強調された 2 つの領域の王冠は色のついたマスのどれかで、ちょうど 2 つの行に収まります。その 2 行のほかのマス(枠つき)には置けません。',
  crownGridHintPair_regionsCols:
    '強調された 2 つの領域の王冠は色のついたマスのどれかで、ちょうど 2 つの列に収まります。その 2 列のほかのマス(枠つき)には置けません。',
  crownGridHintPair_rowsRegions:
    '強調された 2 つの行の王冠は色のついたマスのどれかで、ちょうど 2 つの領域に収まります。その 2 領域のほかのマス(枠つき)には置けません。',
  crownGridHintPair_colsRegions:
    '強調された 2 つの列の王冠は色のついたマスのどれかで、ちょうど 2 つの領域に収まります。その 2 領域のほかのマス(枠つき)には置けません。',
  crownGridHintHypothesis_row:
    '枠のついたマスに王冠を置いてみると、そこから決まっていく手の先で、強調された行に王冠を置ける場所がなくなります。だからここには置けません。',
  crownGridHintHypothesis_col:
    '枠のついたマスに王冠を置いてみると、そこから決まっていく手の先で、強調された列に王冠を置ける場所がなくなります。だからここには置けません。',
  crownGridHintHypothesis_region:
    '枠のついたマスに王冠を置いてみると、そこから決まっていく手の先で、強調された領域に王冠を置ける場所がなくなります。だからここには置けません。',
  crownGridHintNone: '今わかる手が見つかりません。',
  crownGridSolvedTitle: '完成！',
  crownGridSolvedBody: 'すべての行・列・領域に王冠が 1 つずつ入りました。',
  crownGridHintsUsed: '使ったヒント',
  crownGridNewBestTime: '自己最速です。',
  crownGridNewBoard: '新しい盤面',
  crownGridDailySection: 'デイリー',
  crownGridDailiesSolved: '達成日数',
  crownGridStep1Title: '王冠は 1 つずつ',
  crownGridStep1Body: 'どの行・どの列・どの色にも、王冠がちょうど 1 つ入ります。',
  crownGridStep2Title: '王冠は隣り合わない',
  crownGridStep2Body: '王冠どうしは隣り合いません。斜めもだめです。',
  crownGridStep3Title: 'タップとなぞり',
  crownGridStep3Body:
    'タップで ×、王冠、空と切り替わり、なぞると × をまとめて置けます。詰まったらヒントを。',
};
