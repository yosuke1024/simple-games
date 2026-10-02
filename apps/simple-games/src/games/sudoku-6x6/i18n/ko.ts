/**
 * Korean catalog for Sudoku 6×6 — a machine translation of the English
 * source, not yet reviewed (docs/I18N_POLICY.md). The title
 * (`sudoku6x6Name`) is a proper noun. Wording follows the 9×9 Sudoku
 * catalog wherever the meaning is the same.
 */
import type { Sudoku6x6Messages } from './en';

export const ko: Sudoku6x6Messages = {
  sudoku6x6Name: 'Sudoku 6×6',
  sudoku6x6ChooseBoard: '판 선택',
  sudoku6x6Difficulty_easy: '쉬움',
  sudoku6x6Difficulty_medium: '보통',
  sudoku6x6Difficulty_hard: '어려움',
  sudoku6x6ConfirmSwitchTitle: '진행 중인 판을 바꿀까요?',
  sudoku6x6ConfirmSwitchBody: '진행 중인 {current} 게임이 새로운 {next} 판으로 바뀝니다.',
  sudoku6x6GridLabel: '스도쿠 6×6 판',
  sudoku6x6PadLabel: '숫자 키패드',
  sudoku6x6PadKey: '{value}, {n}개 남음',
  sudoku6x6PadNoteKey: '메모 {value}',
  sudoku6x6CellEmpty: '빈칸, {row}행 {col}열',
  sudoku6x6CellGiven: '{value}, 고정, {row}행 {col}열',
  sudoku6x6CellEntry: '{value}, {row}행 {col}열',
  sudoku6x6Erase: '지우기',
  sudoku6x6Notes: '메모',
  sudoku6x6HintOnlyDigit: '이 칸에 들어갈 숫자는 하나뿐입니다.',
  sudoku6x6HintOnlyCell: '여기서 {value}가 들어갈 곳은 이 칸뿐입니다.',
  sudoku6x6HintLockedLine: '이 블록에서 {value}는 표시된 줄에만 들어갈 수 있습니다.',
  sudoku6x6HintLockedBox: '이 줄에서 {value}는 표시된 블록 안에만 들어갈 수 있습니다.',
  sudoku6x6HintRuledOut: '이 칸들 덕분에 같은 영역의 다른 칸에서 그 숫자를 지울 수 있습니다.',
  sudoku6x6HintNone: '아직 확정할 수 있는 칸이 없습니다.',
  sudoku6x6SolvedTitle: '완성!',
  sudoku6x6SolvedBody: '모든 가로줄, 세로줄, 블록에 1-6이 들어갔습니다.',
  sudoku6x6Mistakes: '실수',
  sudoku6x6HintsUsed: '사용한 힌트',
  sudoku6x6NewBestTime: '지금까지 중 가장 빠릅니다.',
  sudoku6x6NewBoard: '새 판',
  sudoku6x6DailySection: '데일리',
  sudoku6x6DailiesSolved: '완성한 날',
  sudoku6x6HighlightMistakes: '실수 표시',
  sudoku6x6HighlightMistakesNote: '틀린 숫자를 넣는 즉시 표시합니다. 중복은 항상 표시됩니다.',
  sudoku6x6Step1Title: '1-6을 한 번씩',
  sudoku6x6Step1Body: '가로줄, 세로줄, 2×3 블록마다 1부터 6까지 한 번씩 들어갑니다.',
  sudoku6x6Step2Title: '채우고 메모하기',
  sudoku6x6Step2Body: '칸을 고르고 숫자를 누르세요. 메모를 켜면 후보 숫자를 적어 둘 수 있습니다.',
  sudoku6x6Step3Title: '막히면 힌트',
  sudoku6x6Step3Body: '힌트는 다음에 확실한 칸과 그 이유를 알려 줍니다.',
};
