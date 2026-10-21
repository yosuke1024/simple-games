/**
 * Tangram — the Korean catalog. Provenance (docs/TANGRAM_RULES.md §11):
 * `machine` — written by an AI from the English source on 2026-10-21; nobody
 * has read it, native speaker or author. The title (`tangramName`) stays
 * "Tangram".
 *
 * Terms: 실루엣, 도형 (figure), 조각 (piece), 트레이 (tray), 보드 (board),
 * 꼭짓점 / 변 (corner / edge). No particle ever follows a `{var}`: the
 * figure and piece names end in a number or a word whose final sound varies,
 * so a noun (도형) or a pause comes after the slot instead. Tiers and the
 * daily follow the puzzle shelf (쉬움 / 보통 / 어려움, 데일리).
 */
import type { TangramMessages } from './en';

export const ko: TangramMessages = {
  tangramName: 'Tangram',

  tangramTier_easy: '쉬움',
  tangramTier_medium: '보통',
  tangramTier_hard: '어려움',
  tangramFigureName: '{tier} {number}',
  tangramDailyName: '데일리, {date}',
  tangramSilhouetteLabel: '실루엣: {figure}',

  tangramConfirmReplaceTitle: '진행 중인 도형을 바꿀까요?',
  tangramConfirmReplaceBody: '진행 중인 {current} 도형이 {next} 도형으로 바뀝니다.',

  tangramPiece_L1: '큰 삼각형 1',
  tangramPiece_L2: '큰 삼각형 2',
  tangramPiece_M: '중간 삼각형',
  tangramPiece_P: '평행사변형',
  tangramPiece_SQ: '정사각형',
  tangramPiece_S1: '작은 삼각형 1',
  tangramPiece_S2: '작은 삼각형 2',
  tangramPieceInTray: '{piece}, {angle}° 회전, 트레이에 있음',
  tangramPieceInTrayFlipped: '{piece}, {angle}° 회전, 뒤집힘, 트레이에 있음',
  tangramPieceOnBoard: '{piece}, {angle}° 회전, 보드 위에 있음',
  tangramPieceOnBoardFlipped: '{piece}, {angle}° 회전, 뒤집힘, 보드 위에 있음',
  tangramPieceFixed: '{piece}, {angle}° 회전, 제자리에 고정됨',
  tangramPieceFixedFlipped: '{piece}, {angle}° 회전, 뒤집힘, 제자리에 고정됨',

  tangramRotate: '회전하기',
  tangramFlip: '뒤집기',

  tangramLifted:
    '들어 올린 조각: {piece}. 화살표 키로 옮기고, Enter로 놓고, Esc로 트레이에 되돌립니다.',
  tangramFitsOutlineVertex: '놓을 수 있음, 실루엣의 꼭짓점',
  tangramFitsOutlineEdge: '놓을 수 있음, 실루엣의 변',
  tangramFitsPieceVertex: '놓을 수 있음, 다른 조각의 꼭짓점',
  tangramFitsPieceEdge: '놓을 수 있음, 다른 조각의 변',
  tangramNoFit: '여기에는 놓을 수 없음',

  tangramStep1Title: '끌어서 돌리기',
  tangramStep1Body:
    '조각을 실루엣으로 끌어다 놓고, 탭해서 돌립니다(평행사변형은 뒤집기 버튼으로 뒤집습니다).',
  tangramStep2Title: '안쪽에, 겹치지 않게',
  tangramStep2Body: '조각은 실루엣 안에만 놓을 수 있고, 다른 조각 위에는 놓을 수 없습니다.',
  tangramStep3Title: '빈틈없이 채우기',
  tangramStep3Body: '일곱 조각이 실루엣을 빈틈없이 채우면 도형이 완성됩니다.',

  tangramResultTitle: '도형 완성',
  tangramNextFigure: '다음 도형',
  tangramTierLabel: '난이도',
  tangramFigureLabel: '도형',

  tangramStatStarted: '시작한 도형',
  tangramStatCompleted: '완성한 도형',
  tangramStatDifferent: '완성한 서로 다른 도형',
  tangramStatDays: '완료한 일수',
  tangramStatsAll: '전체 플레이',
};
