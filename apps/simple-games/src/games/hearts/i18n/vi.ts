import type { HeartsMessages } from './en';

export const vi: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: 'Chọn đối thủ',
  heartsDifficulty_easy: 'Dễ',
  heartsDifficulty_normal: 'Vừa',
  heartsDifficulty_hard: 'Khó',
  heartsRecordNote: 'Thắng {wins} · Thua {losses} · Hòa {draws}',
  heartsConfirmSwitchTitle: 'Thay trận đang chơi?',
  heartsConfirmSwitchBody: 'Trận {current} của bạn sẽ được thay bằng trận {next} mới.',

  heartsTableLabel: 'Bàn Hearts',
  heartsHandLabel: 'Bài trên tay bạn',
  heartsTrickLabel: 'Vòng bài trên bàn',
  heartsTrayLabel: 'Những lá bạn sẽ chuyển đi',
  heartsYou: 'Bạn',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'Bạn: {hand} điểm ván này, {total} điểm cả trận',
  heartsSeatLabel: 'CPU {n}: {cards} lá, {hand} điểm ván này, {total} điểm cả trận',
  heartsTookLastTrick: 'Đã ăn vòng vừa rồi',
  heartsCardLabel: '{rank} {suit}',
  heartsSuit_spades: 'bích',
  heartsSuit_hearts: 'cơ',
  heartsSuit_diamonds: 'rô',
  heartsSuit_clubs: 'chuồn',
  heartsCardBlocked: '{card}, lúc này chưa đánh được',
  heartsCardChosen: '{card}, đã chọn để chuyển đi',
  heartsTrickCard: '{card}, {seat}',

  heartsPassPrompt: 'Chọn ba lá để chuyển đi',
  heartsPassLeft: 'Chuyển sang trái',
  heartsPassAcross: 'Chuyển sang đối diện',
  heartsPassRight: 'Chuyển sang phải',
  heartsPassConfirm: 'Chuyển ba lá này',
  heartsPassWaiting: 'Đang đợi những chỗ còn lại…',

  heartsPlayPrompt: 'Chạm vào một lá, chạm lần nữa để đánh ra',
  heartsCpuTurn: 'CPU {n} đang đánh…',
  heartsTrickYou: 'Bạn ăn vòng này',
  heartsTrickCpu: 'CPU {n} ăn vòng này',

  heartsHandTitle: 'Tính điểm ván',
  heartsMoonTitle: 'Ăn trọn 26 điểm',
  heartsMoonYou: 'Bạn ăn trọn cả hai mươi sáu điểm, nên ba chỗ còn lại mỗi bên nhận 26.',
  heartsMoonCpu: 'CPU {n} ăn trọn cả hai mươi sáu điểm, nên tất cả những chỗ còn lại nhận 26.',
  heartsThisHand: 'Ván này',
  heartsMatchTotal: 'Cả trận',
  heartsNextHand: 'Ván tiếp',

  heartsWinTitle: 'Bạn thắng!',
  heartsWinBody: 'Khi có người vượt một trăm điểm, bạn là người ít điểm nhất.',
  heartsLoseTitle: 'CPU thắng',
  heartsLoseBody: 'Một chỗ khác kết thúc với ít điểm hơn. Trận sau chơi miễn phí.',
  heartsDrawTitle: 'Hòa',
  heartsDrawBody: 'Bạn kết thúc bằng điểm với một chỗ khác ở mức thấp nhất.',
  heartsFinalScores: 'Điểm cuối cùng',

  heartsWins: 'Thắng',
  heartsLosses: 'Thua',
  heartsDraws: 'Hòa',

  heartsStep1Title: 'Chuyển đi ba lá',
  heartsStep1Body:
    'Trước hầu hết các ván, bạn chọn ba lá và chuyển đi — sang trái, rồi sang phải, rồi sang đối diện, rồi một ván không ai chuyển.',
  heartsStep2Title: 'Theo đúng chất',
  heartsStep2Body:
    'Lá đầu tiên định ra chất, còn giữ chất đó thì phải theo, và lá lớn nhất của chất đó ăn cả vòng.',
  heartsStep3Title: 'Ít điểm nhất thì thắng',
  heartsStep3Body:
    'Mỗi lá cơ bạn ăn về là một điểm và Q bích là mười ba điểm, nên khi có người vượt một trăm, ai ít điểm nhất là người thắng.',
};
