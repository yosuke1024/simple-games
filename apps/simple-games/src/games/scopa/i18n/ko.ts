/**
 * Korean catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * 스코파 / 프리미에라 / 7♦ / 다이아몬드 / 카드 / 가져가다 / 내려놓다 / 딜러 / 판 / 매치.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 * The table is 바닥, the usual word for the cards face up in the middle;
 * the point is not called by the sweep of another local game. Sentences
 * that carry a card name keep it after a colon, so no particle has to
 * follow a placeholder.
 */
import type { ScopaMessages } from './en';

export const ko: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: '가져가기',
  scopaStep1Body:
    '카드 한 장을 내고, 바닥에서 같은 숫자의 카드 한 장을, 없으면 더해서 그 숫자가 되는 카드들을 가져갑니다.',
  scopaStep2Title: '내려놓기, 또는 바닥 비우기',
  scopaStep2Body:
    '아무것도 가져가지 못하는 카드는 바닥에 내려놓고, 바닥의 카드를 모두 가져가면 1점, 스코파입니다.',
  scopaStep3Title: '11점이면 승리',
  scopaStep3Body:
    '판마다 카드 최다, 다이아몬드 최다, 7♦, 프리미에라에 1점씩 주고, 11점 이상으로 앞서면 이깁니다.',

  scopaYou: '나',
  scopaCpu: 'CPU',
  scopaSuit_spades: '스페이드',
  scopaSuit_hearts: '하트',
  scopaSuit_diamonds: '다이아몬드',
  scopaSuit_clubs: '클럽',
  scopaCardLabel: '{suit} {face}',

  scopaTableLabel: '바닥',
  scopaHandLabel: '내 패',
  scopaHandCanTake: '{card}, 가져갈 수 있음',
  scopaHandCannotTake: '{card}, 지금은 가져갈 수 없음',
  scopaTableCanTake: '{card}, 가져갈 수 있는 카드',
  scopaTableInGroup: '{card}, 고른 묶음에 포함',
  scopaPlaceHere: '여기에 내려놓기',
  scopaStockLabel: '더미: {n}장 남음',

  scopaCpuHandLabel: 'CPU의 패: {n}장',
  scopaBandLabel:
    '{who}: 매치 {score}점, 이번 판 카드 {cards}장, 다이아몬드 {diamonds}장, 스코파 {scopas}회{settebello}{dealer}',
  scopaBandSettebello: ', 7♦ 보유',
  scopaBandDealer: ', 딜러',
  scopaPrimieraLabel: '내 프리미에라: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: 아직 없음',

  scopaLineYourTurn: '내 차례: 카드 한 장을 냅니다',
  scopaLineCpuTurn: 'CPU 차례',
  scopaLineDealing: '세 장씩 나눠 주는 중',
  scopaLinePlace: '가져갈 카드가 없습니다: 내려놓거나 다른 카드를 고릅니다',
  scopaLineTakeOne: '다시 탭하면 가져갑니다',
  scopaLineChooseSame: '가져갈 카드를 고릅니다',
  scopaLineBuildSum: '합이 {n}에 맞도록 카드를 고릅니다 (지금 {sum})',
  scopaLineCpuTook: 'CPU가 가져감',
  scopaLineCpuPlaced: 'CPU가 내려놓음',
  scopaLineScopaYou: '스코파: 내가 바닥을 비웠습니다',
  scopaLineScopaCpu: '스코파: CPU가 바닥을 비웠습니다',
  scopaLineSweepYou: '바닥의 남은 카드: 나에게',
  scopaLineSweepCpu: '바닥의 남은 카드: CPU에게',
  scopaSayCpuTook: 'CPU가 낸 카드: {card}, 가져간 카드: {cards}',
  scopaSayCpuPlaced: 'CPU가 내려놓은 카드: {card}',
  scopaSaySweepYou: '바닥에 남은 카드는 내가 가져갑니다: {cards}',
  scopaSaySweepCpu: '바닥에 남은 카드는 CPU가 가져갑니다: {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: '{n}번째 판',
  scopaColCategory: '항목',
  scopaColPoint: '점수',
  scopaCatCards: '카드',
  scopaCatDiamonds: '다이아몬드',
  scopaCatPrimiera: '프리미에라',
  scopaCatScopa: '스코파',
  scopaPrimieraShort: '{total} (4무늬 중 {suits})',
  scopaDealPoints: '이번 판',
  scopaSweepYou: '바닥에 남은 카드, 내가 가져감: {n}장',
  scopaSweepCpu: '바닥에 남은 카드, CPU가 가져감: {n}장',
  scopaNextDeal: '다음 판',

  scopaWinTitle: '매치에서 이겼습니다',
  scopaLoseTitle: 'CPU가 매치에서 이겼습니다',
  scopaDecidingDeal: '마지막 판',

  scopaRecordNote: '{wins}승 · {losses}패',
  scopaWins: '승리',
  scopaLosses: '패배',
};
