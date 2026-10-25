/**
 * Nested Tic-Tac-Toe — the Vietnamese catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = bàn nhỏ · square = ô · send =
 * gửi · take / taken = chiếm / đã chiếm (never "thắng", which is the match) ·
 * closed = đã đóng · open = còn mở · first / second = Đi trước / Đi sau ·
 * cross / circle = quân X / quân O — Vietnamese names the two marks of cờ
 * ca-rô by the letters X and O, so the letters are the names here (the
 * drawn glyphs ✕ ○ are still never written).
 */
import type { NestedTicTacToeMessages } from './en';

export const vi: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'Chọn đối thủ',
  nestedTicTacToeDifficulty_easy: 'Dễ',
  nestedTicTacToeDifficulty_normal: 'Thường',
  nestedTicTacToeDifficulty_hard: 'Khó',
  nestedTicTacToeRecordNote: 'Thắng {wins} · Thua {losses}',
  nestedTicTacToeChooseSideLabel: 'Ai đi trước',
  nestedTicTacToePlayFirst: 'Đi trước',
  nestedTicTacToePlaySecond: 'Đi sau',
  nestedTicTacToePlayFirstLabel: 'Đi trước, cầm quân X',
  nestedTicTacToePlaySecondLabel: 'Đi sau, cầm quân O',
  nestedTicTacToeConfirmSwitchTitle: 'Thay ván đang chơi?',
  nestedTicTacToeConfirmSwitchBody: 'Ván {current} của bạn sẽ được thay bằng ván {next} mới.',
  nestedTicTacToeBoardLabel: 'Bàn cờ Nested Tic-Tac-Toe, chín bàn nhỏ',
  nestedTicTacToeSmallOpen: 'Bàn nhỏ {board}: còn mở',
  nestedTicTacToeSmallPlayable: 'Bàn nhỏ {board}: còn mở, đánh ở đây',
  nestedTicTacToeSmallMine: 'Bàn nhỏ {board}: bạn đã chiếm',
  nestedTicTacToeSmallCpu: 'Bàn nhỏ {board}: CPU đã chiếm',
  nestedTicTacToeSmallOpponent: 'Bàn nhỏ {board}: {player} đã chiếm',
  nestedTicTacToeSmallDrawn: 'Bàn nhỏ {board}: hòa (đã đóng)',
  nestedTicTacToeCellEmpty: 'Bàn nhỏ {board}, ô {square}: trống',
  nestedTicTacToeCellPlayable: 'Bàn nhỏ {board}, ô {square}: đánh ở đây',
  nestedTicTacToeCellYourCross: 'Bàn nhỏ {board}, ô {square}: quân X của bạn',
  nestedTicTacToeCellYourCircle: 'Bàn nhỏ {board}, ô {square}: quân O của bạn',
  nestedTicTacToeCellCpuCross: 'Bàn nhỏ {board}, ô {square}: quân X của CPU',
  nestedTicTacToeCellOpponentCross: 'Bàn nhỏ {board}, ô {square}: quân X của {player}',
  nestedTicTacToeCellCpuCircle: 'Bàn nhỏ {board}, ô {square}: quân O của CPU',
  nestedTicTacToeCellOpponentCircle: 'Bàn nhỏ {board}, ô {square}: quân O của {player}',
  nestedTicTacToeYourTurnSent: 'Lượt của bạn — đánh vào bàn có khung',
  nestedTicTacToeYourTurnFree: 'Lượt của bạn — đánh vào bàn còn mở bất kỳ',
  nestedTicTacToeCpuTurn: 'Lượt của CPU',
  nestedTicTacToeWinTitle: 'Bạn thắng',
  nestedTicTacToeWinBody: 'Ba bàn của bạn thẳng hàng.',
  nestedTicTacToeLoseTitle: 'CPU thắng',
  nestedTicTacToeLoseBody: 'CPU đã chiếm ba bàn thẳng hàng.',
  nestedTicTacToeDrawTitle: 'Hòa',
  nestedTicTacToeDrawBody: 'Mọi bàn nhỏ đã đóng, và không bên nào có ba bàn thẳng hàng.',
  nestedTicTacToeBoardsYou: 'Bàn của bạn',
  nestedTicTacToeBoardsCpu: 'Bàn của CPU',
  nestedTicTacToeWins: 'Thắng',
  nestedTicTacToeLosses: 'Thua',
  nestedTicTacToeDraws: 'Hòa',
  nestedTicTacToeStep1Title: 'Nước đi của bạn gửi đối thủ',
  nestedTicTacToeStep1Body:
    'Vị trí bạn đánh trong một bàn nhỏ quyết định bàn mà đối thủ đánh tiếp theo.',
  nestedTicTacToeStep2Title: 'Đã chiếm hoặc đầy: bàn còn mở bất kỳ',
  nestedTicTacToeStep2Body: 'Nếu bàn đó đã bị chiếm hoặc đã đầy, hãy đánh vào bàn còn mở bất kỳ.',
  nestedTicTacToeStep3Title: 'Ba bàn thẳng hàng',
  nestedTicTacToeStep3Body:
    'Ba quân thẳng hàng chiếm một bàn nhỏ; ba bàn đã chiếm thẳng hàng thì thắng.',
};
