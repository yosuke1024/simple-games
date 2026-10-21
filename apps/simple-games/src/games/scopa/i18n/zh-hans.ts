/**
 * Simplified Chinese catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * 斯科帕 / 普利米耶拉 / 7♦ / 方块 / 牌 / 取走 / 放置 / 发牌者 / 局 / 对局.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 */
import type { ScopaMessages } from './en';

export const zhHans: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: '取牌',
  scopaStep1Body: '出一张牌：取走桌上点数相同的一张牌；若没有，就取走加起来等于该点数的几张牌。',
  scopaStep2Title: '放置，或取光桌面',
  scopaStep2Body: '什么都取不走的牌放到桌上；把桌上的牌全部取走得 1 分，叫作斯科帕。',
  scopaStep3Title: '11 分获胜',
  scopaStep3Body:
    '每局牌最多、方块最多、拿到 7♦、普利米耶拉胜出各得 1 分；达到 11 分或以上且领先即获胜。',

  scopaYou: '你',
  scopaCpu: 'CPU',
  scopaSuit_spades: '黑桃',
  scopaSuit_hearts: '红心',
  scopaSuit_diamonds: '方块',
  scopaSuit_clubs: '梅花',
  scopaCardLabel: '{suit}{face}',

  scopaTableLabel: '桌面',
  scopaHandLabel: '你的手牌',
  scopaHandCanTake: '{card}，可以取牌',
  scopaHandCannotTake: '{card}，现在取不了牌',
  scopaTableCanTake: '{card}，可以取走',
  scopaTableInGroup: '{card}，已选入组合',
  scopaPlaceHere: '放在这里',
  scopaStockLabel: '牌库：剩 {n} 张',

  scopaCpuHandLabel: 'CPU 手牌：{n} 张',
  scopaBandLabel:
    '{who}：全场 {score} 分；本局：牌 {cards} 张，方块 {diamonds} 张，斯科帕 {scopas} 次{settebello}{dealer}',
  scopaBandSettebello: '，有 7♦',
  scopaBandDealer: '，发牌者',
  scopaPrimieraLabel: '你的普利米耶拉：{total}',
  scopaPrimieraSuit: '{suit}：{card}，{value}',
  scopaPrimieraMissing: '{suit}：还没有',

  scopaLineYourTurn: '轮到你了：出一张牌',
  scopaLineCpuTurn: '轮到 CPU',
  scopaLineDealing: '正在给每人发三张牌',
  scopaLinePlace: '这张牌取不走任何牌：放到桌上，或换一张',
  scopaLineTakeOne: '再点一次取走',
  scopaLineChooseSame: '选择要取走的牌',
  scopaLineBuildSum: '选出加起来等于 {n} 的牌（目前 {sum}）',
  scopaLineCpuTook: 'CPU 取走',
  scopaLineCpuPlaced: 'CPU 放置',
  scopaLineScopaYou: '斯科帕：你取光了桌面',
  scopaLineScopaCpu: '斯科帕：CPU 取光了桌面',
  scopaLineSweepYou: '桌上剩下的牌：归你',
  scopaLineSweepCpu: '桌上剩下的牌：归 CPU',
  scopaSayCpuTook: 'CPU 打出 {card}，取走 {cards}',
  scopaSayCpuPlaced: 'CPU 放置了 {card}',
  scopaSaySweepYou: '你取走桌上剩下的牌：{cards}',
  scopaSaySweepCpu: 'CPU 取走桌上剩下的牌：{cards}',

  scopaSayThen: '{first}。{then}',

  scopaDealTitle: '第 {n} 局',
  scopaColCategory: '项目',
  scopaColPoint: '得分',
  scopaCatCards: '牌数',
  scopaCatDiamonds: '方块',
  scopaCatPrimiera: '普利米耶拉',
  scopaCatScopa: '斯科帕',
  scopaPrimieraShort: '{total}（4 种花色中 {suits} 种）',
  scopaDealPoints: '本局',
  scopaSweepYou: '桌上剩下的牌，由你取走：{n} 张',
  scopaSweepCpu: '桌上剩下的牌，由 CPU 取走：{n} 张',
  scopaNextDeal: '下一局',

  scopaWinTitle: '你赢得了对局',
  scopaLoseTitle: 'CPU 赢得了对局',
  scopaDecidingDeal: '最后一局',

  scopaRecordNote: '{wins} 胜 · {losses} 负',
  scopaWins: '胜',
  scopaLosses: '负',
};
