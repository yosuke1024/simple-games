/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const ko: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: '방문: {count} / {total}',
  knightTourBoard: '보드',
  knightTourCurrent: '나이트, 현재 칸',
  knightTourVisitNumber: '{count}번째 방문',
  knightTourLegal: '이동 가능한 칸',
  knightTourEmpty: '아직 방문하지 않음',
  knightTourCell: '{row}행 {col}열: {content}',
  knightTourPaused: '일시 정지 중입니다. 준비되면 계속하세요.',
  knightTourStuck: '이동할 곳이 없습니다. 되돌려 다른 길을 찾아보세요.',
  knightTourInstruction: '점이 있는 칸으로 L자 이동하세요.',
  knightTourNewBoard: '새 보드',
  knightTourWon: '모든 칸 방문 완료!',
  knightTourWins: '완료',
  knightTourStep1Title: 'L자로 이동',
  knightTourStep1Body:
    '나이트는 한 방향으로 두 칸, 직각으로 한 칸 이동합니다. 점은 이동 가능한 칸입니다.',
  knightTourStep2Title: '각 칸에 한 번씩',
  knightTourStep2Body: '방문한 칸에 순서가 표시됩니다. 같은 칸에 다시 갈 수 없습니다.',
  knightTourStep3Title: '천천히 탐색',
  knightTourStep3Body: '모든 칸을 방문하면 완료됩니다. 막히면 되돌려 다른 길을 시도하세요.',
};
