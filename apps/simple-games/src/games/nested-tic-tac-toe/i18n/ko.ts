/**
 * Nested Tic-Tac-Toe — the Korean catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = 작은 보드 (board = 보드, as in
 * Checkers and Reversi) · square = 칸 · send = 보내다 · take / taken =
 * 차지하다 / 차지함 (never "이기다", which is the match) · closed = 닫힘 ·
 * open = 열림 · first / second = 선공 / 후공 · cross / circle = 가위표 /
 * 동그라미.
 */
import type { NestedTicTacToeMessages } from './en';

export const ko: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: '상대를 고르세요',
  nestedTicTacToeDifficulty_easy: '쉬움',
  nestedTicTacToeDifficulty_normal: '보통',
  nestedTicTacToeDifficulty_hard: '어려움',
  nestedTicTacToeRecordNote: '{wins}승 · {losses}패',
  nestedTicTacToeChooseSideLabel: '누가 먼저 둘까요',
  nestedTicTacToePlayFirst: '선공',
  nestedTicTacToePlaySecond: '후공',
  nestedTicTacToePlayFirstLabel: '선공, 가위표로 둠',
  nestedTicTacToePlaySecondLabel: '후공, 동그라미로 둠',
  nestedTicTacToeConfirmSwitchTitle: '진행 중인 대국을 바꿀까요?',
  nestedTicTacToeConfirmSwitchBody: '진행 중인 {current} 대국이 새 {next} 대국으로 바뀝니다.',
  nestedTicTacToeBoardLabel: 'Nested Tic-Tac-Toe 보드, 작은 보드 9개',
  nestedTicTacToeSmallOpen: '작은 보드 {board}: 열림',
  nestedTicTacToeSmallPlayable: '작은 보드 {board}: 열림, 여기에 두기',
  nestedTicTacToeSmallMine: '작은 보드 {board}: 내가 차지함',
  nestedTicTacToeSmallCpu: '작은 보드 {board}: CPU가 차지함',
  nestedTicTacToeSmallOpponent: '작은 보드 {board}: {player}가 차지함',
  nestedTicTacToeSmallDrawn: '작은 보드 {board}: 무승부(닫힘)',
  nestedTicTacToeCellEmpty: '작은 보드 {board}, {square}번 칸: 비어 있음',
  nestedTicTacToeCellPlayable: '작은 보드 {board}, {square}번 칸: 여기에 두기',
  nestedTicTacToeCellYourCross: '작은 보드 {board}, {square}번 칸: 내 가위표',
  nestedTicTacToeCellYourCircle: '작은 보드 {board}, {square}번 칸: 내 동그라미',
  nestedTicTacToeCellCpuCross: '작은 보드 {board}, {square}번 칸: CPU의 가위표',
  nestedTicTacToeCellOpponentCross: '작은 보드 {board}, {square}번 칸: {player}의 가위표',
  nestedTicTacToeCellCpuCircle: '작은 보드 {board}, {square}번 칸: CPU의 동그라미',
  nestedTicTacToeCellOpponentCircle: '작은 보드 {board}, {square}번 칸: {player}의 동그라미',
  nestedTicTacToeYourTurnSent: '내 차례 — 테두리가 있는 보드에 두세요',
  nestedTicTacToeYourTurnFree: '내 차례 — 열린 보드 어디에나 두세요',
  nestedTicTacToeCpuTurn: 'CPU 차례',
  nestedTicTacToeWinTitle: '이겼습니다',
  nestedTicTacToeWinBody: '내 보드 세 개가 한 줄로 이어졌습니다.',
  nestedTicTacToeLoseTitle: 'CPU 승리',
  nestedTicTacToeLoseBody: 'CPU가 한 줄로 이어진 보드 세 개를 차지했습니다.',
  nestedTicTacToeDrawTitle: '무승부',
  nestedTicTacToeDrawBody:
    '모든 작은 보드가 닫혔고, 어느 쪽도 보드 세 개를 한 줄로 잇지 못했습니다.',
  nestedTicTacToeBoardsYou: '내 보드',
  nestedTicTacToeBoardsCpu: 'CPU 보드',
  nestedTicTacToeWins: '승리',
  nestedTicTacToeLosses: '패배',
  nestedTicTacToeDraws: '무승부',
  nestedTicTacToeStep1Title: '둔 자리가 상대를 보냅니다',
  nestedTicTacToeStep1Body: '작은 보드 안에서 둔 자리가, 상대가 다음에 둘 보드를 정합니다.',
  nestedTicTacToeStep2Title: '차지됐거나 가득 차면: 열린 보드 어디나',
  nestedTicTacToeStep2Body: '그 보드가 차지됐거나 가득 찼으면, 열린 보드 어디에나 둡니다.',
  nestedTicTacToeStep3Title: '보드 세 개를 한 줄로',
  nestedTicTacToeStep3Body:
    '한 줄로 세 개를 놓으면 작은 보드를 차지하고, 차지한 보드 세 개를 한 줄로 이으면 이깁니다.',
};
