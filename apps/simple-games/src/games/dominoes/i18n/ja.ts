/**
 * Japanese catalog. The title (`dominoesName`) is a proper noun and stays
 * as-is in every locale (docs/I18N_POLICY.md). Tiles are 牌, the boneyard is
 * 山, and pips are 目 — the words a Japanese domino rule book uses.
 */
import type { DominoesMessages } from './en';

export const ja: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: '{wins}勝 · {losses}敗',

  dominoesTileLabel: '牌 {a}–{b}',
  dominoesLineLabel: '場の列:{count}枚、左端 {left}、右端 {right}',
  dominoesHandLabel: 'あなたの手牌',
  dominoesPlayLeft: '左端({value})に置く',
  dominoesPlayRight: '右端({value})に置く',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: '山',
  dominoesCpuTiles: 'CPUの手牌 {count}枚',
  dominoesBoneyardTiles: '山 残り{count}枚',
  dominoesDraw: '引く',
  dominoesPass: 'パス',

  dominoesYourTurn: 'あなたの番です',
  dominoesCpuTurn: 'CPUが考えています…',
  dominoesCpuDrew: 'CPUが山から1枚引きました',
  dominoesCpuPassed: 'CPUはパスしました。あなたの番です',
  dominoesMustDraw: '置ける牌がありません。山から引きます',
  dominoesNoTileFits: '置ける牌がなく、山も空です。パスします',
  dominoesChooseEnd: 'この牌を置く端を選びます',
  dominoesOpenedYou: 'あなたが {tile} で始めました',
  dominoesOpenedCpu: 'CPUが {tile} で始めました。あなたの番です',

  dominoesWinTitle: 'あなたの勝ち!',
  dominoesWinBodyOut: '最後の牌を出し切りました。',
  dominoesWinBodyBlocked: 'どちらも置けなくなり、あなたの目の合計のほうが少なくなりました。',
  dominoesLoseTitle: 'CPUの勝ち',
  dominoesLoseBodyOut: 'CPUが最後の牌を出し切りました。',
  dominoesLoseBodyBlocked: 'どちらも置けなくなり、CPUの目の合計のほうが少なくなりました。',
  dominoesDrawTitle: '引き分け',
  dominoesDrawBody: 'どちらも置けなくなり、目の合計が同じでした。',
  dominoesScoreYou: 'あなたの得点 {points}',
  dominoesScoreCpu: 'CPUの得点 {points}',
  dominoesPipsLeft: '残りの目:あなた {you}、CPU {cpu}',

  dominoesWins: '勝ち',
  dominoesLosses: '負け',
  dominoesDraws: '引き分け',

  dominoesStep1Title: '端の目に合わせる',
  dominoesStep1Body: '列のどちらかの端と同じ目を持つ牌をつなげます。',
  dominoesStep2Title: '置けなければ引く',
  dominoesStep2Body: '置ける牌がなければ、置けるまで山から引きます。山が空のときだけパスします。',
  dominoesStep3Title: '先に出し切る',
  dominoesStep3Body: '最後の牌を出したら勝ち。相手に残った目の合計が得点です。',
};
