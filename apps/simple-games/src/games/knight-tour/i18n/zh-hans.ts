/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const zhHans: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: '已访问：{count} / {total}',
  knightTourBoard: '棋盘',
  knightTourCurrent: '骑士，当前格',
  knightTourVisitNumber: '第 {count} 次访问',
  knightTourLegal: '可移动的目标',
  knightTourEmpty: '未访问',
  knightTourCell: '第 {row} 行，第 {col} 列：{content}',
  knightTourPaused: '已暂停，准备好后继续。',
  knightTourStuck: '无路可走，撤销后尝试其他路线。',
  knightTourInstruction: '以 L 形移动到有圆点的格子。',
  knightTourNewBoard: '新棋盘',
  knightTourWon: '巡游完成！',
  knightTourWins: '已完成',
  knightTourStep1Title: '以 L 形移动',
  knightTourStep1Body: '骑士先沿一个方向移动两格，再垂直移动一格；圆点标出可达的格子。',
  knightTourStep2Title: '每格只访问一次',
  knightTourStep2Body: '每次落点都会标上序号，访问过的格子不能再进入。',
  knightTourStep3Title: '按自己的节奏探索',
  knightTourStep3Body: '访问所有格子即可完成。走不通时，撤销后可以尝试其他路线。',
};
