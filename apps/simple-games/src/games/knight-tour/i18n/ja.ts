/** AI-authored translation draft; no human review claimed. See docs/KNIGHT_TOUR_RULES.md. */
import type { KnightTourMessages } from './en';
export const ja: KnightTourMessages = {
  knightTourName: 'Knight’s Tour',
  knightTourVisited: '訪問済み：{count} / {total}',
  knightTourBoard: '盤面',
  knightTourCurrent: 'ナイト、現在のマス',
  knightTourVisitNumber: '{count} 番目に訪問',
  knightTourLegal: '移動できるマス',
  knightTourEmpty: '未訪問',
  knightTourCell: '{row} 行 {col} 列：{content}',
  knightTourPaused: '一時停止中。準備ができたら再開。',
  knightTourStuck: '移動先がありません。「戻す」で別の道を試せます。',
  knightTourInstruction: '点のあるマスへ L 字に進みます。',
  knightTourNewBoard: '新しい盤面',
  knightTourWon: 'すべてのマスを訪問！',
  knightTourWins: 'クリア',
  knightTourStep1Title: 'L 字に進む',
  knightTourStep1Body:
    'ナイトは縦か横に 2 マス、直角に 1 マス進みます。移動先には点が表示されます。',
  knightTourStep2Title: '各マスを 1 度ずつ',
  knightTourStep2Body: '訪れたマスに順番の数字が付きます。同じマスには戻れません。',
  knightTourStep3Title: '自分のペースで探索',
  knightTourStep3Body: 'すべてのマスを訪れるとクリア。行き詰まったら「戻す」で別の道を試せます。',
};
