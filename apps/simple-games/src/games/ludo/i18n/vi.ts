import type { LudoMessages } from './en';

export const vi: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Chọn đối thủ',
  ludoDifficulty_easy: 'Dễ',
  ludoDifficulty_normal: 'Vừa',
  ludoDifficulty_hard: 'Khó',
  ludoRecordNote: 'Thắng {wins} · Thua {losses}',
  ludoConfirmSwitchTitle: 'Thay trận đang chơi?',
  ludoConfirmSwitchBody: 'Trận {current} của bạn sẽ được thay bằng trận {next} mới.',

  // ---- the board ----
  ludoBoardLabel: 'Bàn cờ Ludo',
  ludoYou: 'Bạn',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '{home} trong 4 quân đã về nhà',
  ludoSafeSquare: 'Ô an toàn',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'trong chuồng',
  ludoWhereSquare: 'ở ô {n}',
  ludoWhereSafe: 'ở ô an toàn {n}',
  ludoWhereColumn: 'ở ô {n} của hành lang về đích',
  ludoWhereHome: 'đã về nhà',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'Di chuyển quân của bạn {where}',

  // ---- the die and the turn ----
  ludoRollAction: 'Đổ',
  ludoRollLabel: 'Đổ xúc xắc',
  ludoDieLabel: 'Xúc xắc ra {die}',
  ludoDieUnrolled: 'Xúc xắc chưa được đổ',
  ludoTurnRoll: 'Đến lượt bạn — đổ xúc xắc.',
  ludoTurnMove: 'Bạn đổ được {die}. Chạm vào một quân để di chuyển.',
  ludoTurnCpu: 'CPU {n} đang chơi…',
  ludoAutoPass: 'Không quân nào đi được với số đó — lượt này bị bỏ qua.',
  ludoThirdSix: 'Ba lần liền ra số sáu — lượt chuyển sang chỗ khác.',
  ludoRollAgain: 'Ra số sáu — đổ lại lần nữa.',

  // ---- the end of a match ----
  ludoWinTitle: 'Bạn thắng!',
  ludoWinBody: 'Cả bốn quân của bạn đã về nhà.',
  ludoLoseTitle: 'CPU {n} thắng',
  ludoLoseBody: 'Cả bốn quân của họ đã về nhà. Trận sau chơi miễn phí.',
  ludoNoContestTitle: 'Không có kết quả',
  ludoNoContestBody:
    'Trận đấu chạm giới hạn số lần đổ mà chưa ai về nhà. Nó được tính là đã chơi, nhưng không tính thắng cũng không tính thua.',
  ludoWins: 'Thắng',
  ludoLosses: 'Thua',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'Ra số sáu để đưa một quân ra',
  ludoStep1Body:
    'Đổ xúc xắc, rồi chạm vào một quân để di chuyển. Chỉ những quân luật cho phép mới chạm được — các quân khác đứng yên.',
  ludoStep2Title: 'Ra số sáu được đổ lại',
  ludoStep2Body:
    'Ra số sáu thì bạn được đổ thêm một lần nữa. Nhưng ba lần sáu liên tiếp thì lượt chuyển sang chỗ khác mà không quân nào được đi.',
  ludoStep3Title: 'Đè lên quân đối phương sẽ đuổi nó về',
  ludoStep3Body:
    'Mọi quân đối phương ở ô đó lập tức về lại chuồng của họ. Ô an toàn thì miễn nhiễm với việc này. Ăn quân không cho bạn thêm lượt đổ — chỉ số sáu mới cho điều đó.',
  ludoStep4Title: 'Chồng quân của mình lên nhau chẳng bảo vệ được gì',
  ludoStep4Body:
    'Hai quân của bạn cùng đứng một ô không chặn ai và cũng không bảo vệ ai. Nếu đối phương đè lên đó, cả chồng quân về chuồng cùng lúc — một chồng quân là mục tiêu, không phải pháo đài.',
  ludoStep5Title: 'Về nhà phải đúng số',
  ludoStep5Body:
    'Số đổ mà vượt quá đích thì quân đó không được đi. Đưa cả bốn quân về nhà để thắng. Mỗi số đến từ seed của trận đấu, cả sáu mặt có cùng khả năng, và không chỗ nào bị đổ khác đi.',
};
