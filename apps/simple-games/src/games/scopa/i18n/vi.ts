/**
 * Vietnamese catalog for Scopa.
 *
 * Provenance (docs/SCOPA_RULES.md §12, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-21. **No native speaker
 * has read it**, and it is not to be treated as reviewed.
 * The title (`scopaName`) stays “Scopa” in every locale. Terms follow the
 * glossary in §12 (the point / primiera / 7♦ / the ♦ category / cards /
 * take / place / dealer / deal / match):
 * scopa / primiera / 7♦ / rô / lá / lấy / đặt / người chia / ván / trận.
 * Counts stay out of plural forms, as in `en` (“name: number”).
 */
import type { ScopaMessages } from './en';

export const vi: ScopaMessages = {
  scopaName: 'Scopa',

  scopaStep1Title: 'Lấy',
  scopaStep1Body:
    'Đánh một lá: lấy một lá trên bàn cùng giá trị, hoặc nếu không có, lấy các lá cộng lại bằng giá trị đó.',
  scopaStep2Title: 'Đặt, hoặc lấy sạch bàn',
  scopaStep2Body:
    'Lá không lấy được gì sẽ được đặt lên bàn, còn lấy hết các lá trên bàn thì được một điểm: một scopa.',
  scopaStep3Title: 'Mười một điểm là thắng',
  scopaStep3Body:
    'Mỗi ván có một điểm cho mỗi mục: nhiều lá nhất, nhiều rô nhất, lá 7♦ và primiera; ai có từ 11 điểm trở lên mà đang dẫn trước thì thắng.',

  scopaYou: 'Bạn',
  scopaCpu: 'CPU',
  scopaSuit_spades: 'bích',
  scopaSuit_hearts: 'cơ',
  scopaSuit_diamonds: 'rô',
  scopaSuit_clubs: 'chuồn',
  scopaCardLabel: '{face} {suit}',

  scopaTableLabel: 'Bàn',
  scopaHandLabel: 'Bài trên tay bạn',
  scopaHandCanTake: '{card}, lấy được',
  scopaHandCannotTake: '{card}, lúc này không lấy được',
  scopaTableCanTake: '{card}, có thể lấy',
  scopaTableInGroup: '{card}, trong nhóm của bạn',
  scopaPlaceHere: 'Đặt vào đây',
  scopaStockLabel: 'Nọc: còn {n}',

  scopaCpuHandLabel: 'Số lá trên tay CPU: {n}',
  scopaBandLabel:
    '{who}: {score} điểm cả trận; ván này: số lá {cards}, số rô {diamonds}, scopa {scopas}{settebello}{dealer}',
  scopaBandSettebello: ', có lá 7♦',
  scopaBandDealer: ', người chia',
  scopaPrimieraLabel: 'Primiera của bạn: {total}',
  scopaPrimieraSuit: '{suit}: {card}, {value}',
  scopaPrimieraMissing: '{suit}: chưa có',

  scopaLineYourTurn: 'Lượt của bạn: đánh một lá',
  scopaLineCpuTurn: 'Lượt của CPU',
  scopaLineDealing: 'Đang chia mỗi người ba lá',
  scopaLinePlace: 'Lá này không lấy được gì: đặt xuống, hoặc chọn lá khác',
  scopaLineTakeOne: 'Chạm lần nữa để lấy',
  scopaLineChooseSame: 'Chọn lá muốn lấy',
  scopaLineBuildSum: 'Chọn các lá cộng lại bằng {n} (hiện có {sum})',
  scopaLineCpuTook: 'CPU đã lấy',
  scopaLineCpuPlaced: 'CPU đã đặt',
  scopaLineScopaYou: 'Scopa: bạn đã lấy sạch bàn',
  scopaLineScopaCpu: 'Scopa: CPU đã lấy sạch bàn',
  scopaLineSweepYou: 'Những lá cuối trên bàn: về bạn',
  scopaLineSweepCpu: 'Những lá cuối trên bàn: về CPU',
  scopaSayCpuTook: 'CPU đánh {card} và lấy {cards}',
  scopaSayCpuPlaced: 'CPU đặt {card}',
  scopaSaySweepYou: 'Bạn lấy các lá còn lại trên bàn: {cards}',
  scopaSaySweepCpu: 'CPU lấy các lá còn lại trên bàn: {cards}',

  scopaSayThen: '{first}. {then}',

  scopaDealTitle: 'Ván {n}',
  scopaColCategory: 'Mục',
  scopaColPoint: 'Điểm',
  scopaCatCards: 'Số lá',
  scopaCatDiamonds: 'Rô',
  scopaCatPrimiera: 'Primiera',
  scopaCatScopa: 'Scopa',
  scopaPrimieraShort: '{total} ({suits}/4 chất)',
  scopaDealPoints: 'Ván này',
  scopaSweepYou: 'Lá còn lại trên bàn, bạn lấy: {n}',
  scopaSweepCpu: 'Lá còn lại trên bàn, CPU lấy: {n}',
  scopaNextDeal: 'Ván tiếp',

  scopaWinTitle: 'Bạn thắng trận',
  scopaLoseTitle: 'CPU thắng trận',
  scopaDecidingDeal: 'Ván cuối',

  scopaRecordNote: 'Thắng {wins} · Thua {losses}',
  scopaWins: 'Thắng',
  scopaLosses: 'Thua',
};
