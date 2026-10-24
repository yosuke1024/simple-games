/**
 * Traditional Chinese catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * 斯科帕 / 普利米耶拉 / 7♦ / 方塊 / 牌 / 取走 / 放置 / 發牌者 / 局 / 對局.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 */
import type { ScopaMessages } from './en';

export const zhHant: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: '取牌',
  scopaStep1Body: '出一張牌：取走桌上點數相同的一張牌；若沒有，就取走加起來等於該點數的幾張牌。',
  scopaStep2Title: '放置，或取光桌面',
  scopaStep2Body: '什麼都取不走的牌放到桌上；把桌上的牌全部取走得 1 分，叫作斯科帕。',
  scopaStep3Title: '11 分獲勝',
  scopaStep3Body:
    '每局牌最多、方塊最多、拿到 7♦、普利米耶拉勝出各得 1 分；達到 11 分或以上且領先即獲勝。',

  scopaYou: '你',
  scopaCpu: 'CPU',
  scopaSuit_spades: '黑桃',
  scopaSuit_hearts: '紅心',
  scopaSuit_diamonds: '方塊',
  scopaSuit_clubs: '梅花',
  scopaCardLabel: '{suit}{face}',

  scopaTableLabel: '桌面',
  scopaHandLabel: '你的手牌',
  scopaHandCanTake: '{card}，可以取牌',
  scopaHandCannotTake: '{card}，現在取不了牌',
  scopaTableCanTake: '{card}，可以取走',
  scopaTableInGroup: '{card}，已選入組合',
  scopaPlaceHere: '放在這裡',
  scopaStockLabel: '牌庫：剩 {n} 張',

  scopaCpuHandLabel: 'CPU 手牌：{n} 張',
  scopaBandLabel:
    '{who}：全場 {score} 分；本局：牌 {cards} 張，方塊 {diamonds} 張，斯科帕 {scopas} 次{settebello}{dealer}',
  scopaBandSettebello: '，有 7♦',
  scopaBandDealer: '，發牌者',
  scopaPrimieraLabel: '你的普利米耶拉：{total}',
  scopaPrimieraSuit: '{suit}：{card}，{value}',
  scopaPrimieraMissing: '{suit}：還沒有',

  scopaLineYourTurn: '輪到你了：出一張牌',
  scopaLineCpuTurn: '輪到 CPU',
  scopaLineDealing: '正在給每人發三張牌',
  scopaLinePlace: '這張牌取不走任何牌：放到桌上，或換一張',
  scopaLineTakeOne: '再點一次取走',
  scopaLineChooseSame: '選擇要取走的牌',
  scopaLineBuildSum: '選出加起來等於 {n} 的牌（目前 {sum}）',
  scopaLineCpuTook: 'CPU 取走',
  scopaLineCpuPlaced: 'CPU 放置',
  scopaLineScopaYou: '斯科帕：你取光了桌面',
  scopaLineScopaCpu: '斯科帕：CPU 取光了桌面',
  scopaLineSweepYou: '桌上剩下的牌：歸你',
  scopaLineSweepCpu: '桌上剩下的牌：歸 CPU',
  scopaSayCpuTook: 'CPU 打出 {card}，取走 {cards}',
  scopaSayCpuPlaced: 'CPU 放置了 {card}',
  scopaSaySweepYou: '你取走桌上剩下的牌：{cards}',
  scopaSaySweepCpu: 'CPU 取走桌上剩下的牌：{cards}',

  scopaSayThen: '{first}。{then}',

  scopaDealTitle: '第 {n} 局',
  scopaColCategory: '項目',
  scopaColPoint: '得分',
  scopaCatCards: '牌數',
  scopaCatDiamonds: '方塊',
  scopaCatPrimiera: '普利米耶拉',
  scopaCatScopa: '斯科帕',
  scopaPrimieraShort: '{total}（4 種花色中 {suits} 種）',
  scopaDealPoints: '本局',
  scopaSweepYou: '桌上剩下的牌，由你取走：{n} 張',
  scopaSweepCpu: '桌上剩下的牌，由 CPU 取走：{n} 張',
  scopaNextDeal: '下一局',

  scopaWinTitle: '你贏得了對局',
  scopaLoseTitle: 'CPU 贏得了對局',
  scopaDecidingDeal: '最後一局',

  scopaRecordNote: '{wins} 勝 · {losses} 敗',
  scopaWins: '勝',
  scopaLosses: '敗',
};
