/**
 * Korean catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/ko.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const ko: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: '보드 선택',
  unblockPuzzleDifficulty_easy: '쉬움',
  unblockPuzzleDifficulty_medium: '보통',
  unblockPuzzleDifficulty_hard: '어려움',
  unblockPuzzleRange: '이동 {min}–{max}회',
  unblockPuzzleRangeOpen: '이동 {min}회 이상',
  unblockPuzzleConfirmSwitchTitle: '진행 중인 보드를 바꿀까요?',
  unblockPuzzleConfirmSwitchBody: '진행 중인 {current} 보드가 새 {next} 보드로 바뀝니다.',
  unblockPuzzleBoardLabel: '보드, 가로 {cols} 세로 {rows}. 출구는 {row}행 오른쪽 끝에 있습니다.',
  unblockPuzzleBlockTarget: '목표 블록, {row}행, {from}~{to}열. 빈칸: 왼쪽 {left}, 오른쪽 {right}.',
  unblockPuzzleBlockH: '가로 블록, {row}행, {from}~{to}열. 빈칸: 왼쪽 {left}, 오른쪽 {right}.',
  unblockPuzzleBlockV: '세로 블록, {col}열, {from}~{to}행. 빈칸: 위 {up}, 아래 {down}.',
  unblockPuzzleMovesStatus: '이동 {moves} · 최소 {min}',
  unblockPuzzleMoveLeft: '왼쪽으로 이동',
  unblockPuzzleMoveRight: '오른쪽으로 이동',
  unblockPuzzleMoveUp: '위로 이동',
  unblockPuzzleMoveDown: '아래로 이동',
  unblockPuzzleSelectPrompt: '움직일 블록을 탭하세요',
  unblockPuzzleHintTarget: '힌트: 목표 블록을 {toFrom}–{toTo}열로 미세요.',
  unblockPuzzleHintH: '힌트: {row}행 {from}–{to}열의 블록을 {toFrom}–{toTo}열로 미세요.',
  unblockPuzzleHintV: '힌트: {col}열 {from}–{to}행의 블록을 {toFrom}–{toTo}행으로 미세요.',
  unblockPuzzleHintShown: '표시된 블록을 점선 위치로 미세요.',
  unblockPuzzleHintNone: '여기서는 이동을 찾지 못했습니다.',
  unblockPuzzleSolvedTitle: '클리어!',
  unblockPuzzleSolvedBody: '목표 블록이 빠져나갔습니다.',
  unblockPuzzleSolvedOptimal: '가장 적은 이동으로 빠져나갔습니다.',
  unblockPuzzleFewestLabel: '최소 이동 수',
  unblockPuzzleNetCellsLabel: '순 이동 칸 수',
  unblockPuzzleHintsUsed: '사용한 힌트',
  unblockPuzzleNewBestTime: '{difficulty} 최단 시간 기록입니다.',
  unblockPuzzleNewBestDailyMoves: '오늘 보드의 최소 이동 기록입니다.',
  unblockPuzzleNewBoard: '새 보드',
  unblockPuzzleSolvedCount: '클리어한 보드',
  unblockPuzzleOptimalCount: '최소 이동으로 클리어',
  unblockPuzzleOverallSection: '전체',
  unblockPuzzleDailiesCleared: '클리어한 데일리 챌린지',
  unblockPuzzleStep1Title: '자기 줄을 따라 밀기',
  unblockPuzzleStep1Body: '블록은 자기 줄을 따라 좌우 또는 위아래로만 움직입니다.',
  unblockPuzzleStep2Title: '목표 블록 빼내기',
  unblockPuzzleStep2Body: '목표 블록을 오른쪽 출구로 빼내면 클리어입니다.',
  unblockPuzzleStep3Title: '한 번 밀면 1회 이동',
  unblockPuzzleStep3Body:
    '몇 칸을 밀어도 1회 이동으로 세며, 되돌리기와 힌트는 언제든 쓸 수 있습니다.',
};
