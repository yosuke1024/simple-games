import type { DominoesMessages } from './en';

export const vi: DominoesMessages = {
  dominoesName: 'Dominoes',
  dominoesRecordNote: 'Thắng {wins} · Thua {losses}',

  dominoesTileLabel: 'Quân {a}–{b}',
  dominoesLineLabel: 'Hàng chơi: {count} quân, đầu trái {left}, đầu phải {right}',
  dominoesHandLabel: 'Quân của bạn',
  dominoesPlayLeft: 'Đặt vào đầu trái ({value})',
  dominoesPlayRight: 'Đặt vào đầu phải ({value})',
  dominoesCpuShort: 'CPU',
  dominoesBoneyardShort: 'Nọc',
  dominoesCpuTiles: 'CPU đang cầm {count} quân',
  dominoesBoneyardTiles: 'Nọc: {count} quân',
  dominoesDraw: 'Rút',
  dominoesPass: 'Bỏ qua',

  dominoesYourTurn: 'Lượt của bạn',
  dominoesCpuTurn: 'CPU đang suy nghĩ…',
  dominoesCpuDrew: 'CPU đã rút một quân',
  dominoesCpuPassed: 'CPU đã bỏ qua lượt. Lượt của bạn',
  dominoesMustDraw: 'Không có quân nào đặt được. Hãy rút từ nọc',
  dominoesNoTileFits: 'Không có quân nào đặt được và nọc đã hết. Hãy bỏ qua',
  dominoesChooseEnd: 'Chọn một đầu để đặt quân này',
  dominoesOpenedYou: 'Bạn đã mở màn bằng {tile}',
  dominoesOpenedCpu: 'CPU đã mở màn bằng {tile}. Lượt của bạn',

  dominoesWinTitle: 'Bạn thắng!',
  dominoesWinBodyOut: 'Bạn đã đặt hết quân của mình.',
  dominoesWinBodyBlocked: 'Không ai đặt được nữa, và số chấm của bạn ít hơn.',
  dominoesLoseTitle: 'CPU thắng',
  dominoesLoseBodyOut: 'CPU đã đặt hết quân của nó.',
  dominoesLoseBodyBlocked: 'Không ai đặt được nữa, và số chấm của CPU ít hơn.',
  dominoesDrawTitle: 'Hòa',
  dominoesDrawBody: 'Không ai đặt được nữa, và số chấm bằng nhau.',
  dominoesScoreYou: 'Bạn được {points} điểm',
  dominoesScoreCpu: 'CPU được {points} điểm',
  dominoesPipsLeft: 'Số chấm còn lại: bạn {you}, CPU {cpu}',

  dominoesWins: 'Thắng',
  dominoesLosses: 'Thua',
  dominoesDraws: 'Hòa',

  dominoesStep1Title: 'Khớp một đầu',
  dominoesStep1Body: 'Đặt một quân có số khớp với một trong hai đầu hở của hàng.',
  dominoesStep2Title: 'Bí? Rút quân',
  dominoesStep2Body:
    'Nếu không có quân nào đặt được, hãy rút từ nọc đến khi có quân đặt được. Chỉ bỏ qua khi nọc đã hết.',
  dominoesStep3Title: 'Hết quân trước để thắng',
  dominoesStep3Body:
    'Đặt hết quân để thắng. Số chấm còn lại trong tay đối thủ chính là điểm của bạn.',
};
