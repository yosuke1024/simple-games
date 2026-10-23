/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const zhHant: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: '已造訪：{count} / {total}',
  knightTourBoard: '棋盤',
  knightTourCurrent: '騎士，目前格',
  knightTourVisitNumber: '第 {count} 次造訪',
  knightTourLegal: '可移動的目標',
  knightTourEmpty: '未造訪',
  knightTourCell: '第 {row} 行，第 {col} 列：{content}',
  knightTourPaused: '已暫停，準備好後繼續。',
  knightTourStuck: '無路可走，復原後嘗試其他路線。',
  knightTourInstruction: '以 L 形移動到有圓點的格子。',
  knightTourNewBoard: '新棋盤',
  knightTourWon: '巡遊完成！',
  knightTourWins: '已完成',
  knightTourStep1Title: '以 L 形移動',
  knightTourStep1Body: '騎士先沿一個方向移動兩格，再垂直移動一格；圓點標出可達的格子。',
  knightTourStep2Title: '每格只造訪一次',
  knightTourStep2Body: '每次落點都會標上序號，造訪過的格子不能再進入。',
  knightTourStep3Title: '按自己的步調探索',
  knightTourStep3Body: '造訪所有格子即可完成。走不通時，復原後可以嘗試其他路線。',
};
