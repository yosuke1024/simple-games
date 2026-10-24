/**
 * Japanese catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): written by
 * AI from the English source on 2026-10-21 and **not yet read by the
 * author** — nor by anyone else. It is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * スコパ / プリミエラ / 7♦ / ダイヤ / 札 / 取る / 置く / 配り手 / ディール / 対局.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 */
import type { ScopaMessages } from './en';

export const ja: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: '取る',
  scopaStep1Body: '札を1枚出し、場の同じ数字の札を1枚、無ければ足してその数になる札を取ります。',
  scopaStep2Title: '置く、または場を空に',
  scopaStep2Body: '何も取れない札は場に置かれ、場の札をすべて取るとスコパで1点です。',
  scopaStep3Title: '11点で勝ち',
  scopaStep3Body:
    'ディールごとに札の多さ・ダイヤの多さ・7♦・プリミエラで1点ずつ入り、11点以上で相手より多ければ勝ちです。',

  scopaYou: 'あなた',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'スペード',
  scopaSuit_hearts: 'ハート',
  scopaSuit_diamonds: 'ダイヤ',
  scopaSuit_clubs: 'クラブ',
  scopaCardLabel: '{suit}の{face}',

  scopaTableLabel: '場',
  scopaHandLabel: '自分の手札',
  scopaHandCanTake: '{card}、取れます',
  scopaHandCannotTake: '{card}、いまは取れません',
  scopaTableCanTake: '{card}、取れます',
  scopaTableInGroup: '{card}、組に入っています',
  scopaPlaceHere: 'ここに置く',
  scopaStockLabel: '山、残り{n}枚',

  scopaCpuHandLabel: 'CPUの手札: {n}枚',
  scopaBandLabel:
    '{who}: 通算{score}点、このディール: 札{cards}枚、ダイヤ{diamonds}枚、スコパ{scopas}回{settebello}{dealer}',
  scopaBandSettebello: '、7♦あり',
  scopaBandDealer: '、配り手',
  scopaPrimieraLabel: '自分のプリミエラ: {total}',
  scopaPrimieraSuit: '{suit}: {card}、{value}',
  scopaPrimieraMissing: '{suit}: まだなし',

  scopaLineYourTurn: 'あなたの番: 札を1枚出します',
  scopaLineCpuTurn: 'CPUの番',
  scopaLineDealing: '3枚ずつ配っています',
  scopaLinePlace: '何も取れません: 場に置くか、別の札を選びます',
  scopaLineTakeOne: 'もう一度タップで取ります',
  scopaLineChooseSame: '取る札を選びます',
  scopaLineBuildSum: '足して{n}になる札を選びます(いま{sum})',
  scopaLineCpuTook: 'CPUが取った',
  scopaLineCpuPlaced: 'CPUが置いた',
  scopaLineScopaYou: 'スコパ: あなたが場を空にしました',
  scopaLineScopaCpu: 'スコパ: CPUが場を空にしました',
  scopaLineSweepYou: '場の残り札: あなたへ',
  scopaLineSweepCpu: '場の残り札: CPUへ',
  scopaSayCpuTook: 'CPUは{card}を出して{cards}を取りました',
  scopaSayCpuPlaced: 'CPUは{card}を置きました',
  scopaSaySweepYou: '場に残った札はあなたが取ります: {cards}',
  scopaSaySweepCpu: '場に残った札はCPUが取ります: {cards}',

  scopaSayThen: '{first}。{then}',

  scopaDealTitle: '第{n}ディール',
  scopaColCategory: '区分',
  scopaColPoint: '点',
  scopaCatCards: '札',
  scopaCatDiamonds: 'ダイヤ',
  scopaCatPrimiera: 'プリミエラ',
  scopaCatScopa: 'スコパ',
  scopaPrimieraShort: '{total}(4スート中{suits})',
  scopaDealPoints: 'このディール',
  scopaSweepYou: '場に残った札をあなたが取りました: {n}枚',
  scopaSweepCpu: '場に残った札をCPUが取りました: {n}枚',
  scopaNextDeal: '次のディールへ',

  scopaWinTitle: 'あなたの勝ち',
  scopaLoseTitle: 'CPUの勝ち',
  scopaDecidingDeal: '最後のディール',

  scopaRecordNote: '{wins}勝 · {losses}敗',
  scopaWins: '勝ち',
  scopaLosses: '負け',
};
