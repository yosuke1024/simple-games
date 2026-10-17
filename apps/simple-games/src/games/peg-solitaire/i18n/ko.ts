/**
 * Peg Solitaire — the Korean catalog. Provenance (docs/PEG_SOLITAIRE_RULES.md
 * §15): `machine` — written by an AI from the English source; no native
 * speaker has read it. The title (`pegSolitaireName`) is a proper noun and
 * stays as-is. The English board is "영국식" (English style), so the button
 * does not read as the name of a language. Pieces are "말", as in the
 * Checkers catalog.
 */
import type { PegSolitaireMessages } from './en';

export const ko: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: '영국식',
  pegSolitaireBoard_triangle: '삼각형',
  pegSolitaireBoardLabel_english: '영국식 판, 구멍 33개',
  pegSolitaireBoardLabel_triangle: '삼각형 판, 구멍 15개',
  pegSolitaireHoleCount: '구멍 {count}개',

  pegSolitaireChooseBoard: '판 선택',
  pegSolitaireBestNote: '최소 {count}개 남김',
  pegSolitaireConfirmSwitchTitle: '진행 중인 게임을 바꿀까요?',
  pegSolitaireConfirmSwitchBody: '진행 중인 {current} 게임이 새 {next} 게임으로 바뀝니다.',

  pegSolitaireHoleGrid: '{row}행 {col}열: {content}',
  pegSolitaireHoleRow: '{row}줄 {place}번째 구멍: {content}',
  pegSolitaireContentPeg: '말',
  pegSolitaireContentPegRing: '말, 고리 표시 구멍',
  pegSolitaireContentEmpty: '빈 구멍',
  pegSolitaireContentEmptyRing: '고리 표시된 빈 구멍',
  pegSolitaireContentLanding: '빈 구멍, 여기로 뛸 수 있음',
  pegSolitaireContentLandingRing: '고리 표시된 빈 구멍, 여기로 뛸 수 있음',

  pegSolitairePegsLeft: '남은 말: {count}',
  pegSolitaireNoJump: '이 말은 지금 뛸 수 없습니다.',

  pegSolitairePerfectTitle: '완벽한 클리어!',
  pegSolitairePerfectBody: '마지막 말이 고리 표시 구멍에 남았습니다.',
  pegSolitaireSingleTitle: '말 1개 남음',
  pegSolitaireSingleBody: '마지막 말이 고리 표시 구멍 밖에 있습니다.',
  pegSolitaireStuckTitle: '더 뛸 수 없음',
  pegSolitaireStuckBody: '뛰어넘을 수 있는 말이 없습니다.',
  pegSolitairePegsLeftLabel: '남은 말',
  pegSolitaireFewestLabel: '이 판의 최소',
  pegSolitaireNewFewest: '이 판에서 가장 적게 남겼습니다.',
  pegSolitaireBoardFact: '판',
  pegSolitaireNewBoard: '새 판',

  pegSolitaireStatFewest: '최소 남은 말',
  pegSolitaireStatPerfect: '완벽한 클리어',

  pegSolitaireStep1Title: '뛰어넘어 없애기',
  pegSolitaireStep1Body: '말이 옆의 말을 뛰어넘어 빈 구멍으로 가면, 뛰어넘은 말은 없어집니다.',
  pegSolitaireStep2Title: '직선으로만',
  pegSolitaireStep2Body: '영국식은 위아래와 옆으로, 삼각형은 세 방향의 선을 따라 곧게 뜁니다.',
  pegSolitaireStep3Title: '마지막 하나 남기기',
  pegSolitaireStep3Body:
    '뛸 수 있는 말이 없으면 끝나며, 마지막 말을 고리 표시 구멍에 남기면 완벽한 클리어입니다.',
};
