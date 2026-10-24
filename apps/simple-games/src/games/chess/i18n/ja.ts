/**
 * Chess — the Japanese catalog. Provenance (docs/CHESS_RULES.md §10): an AI
 * draft written from the English source on 2026-10-22; the author has not read
 * it and no native speaker has either. The title (`chessName`) is a proper
 * noun and stays as-is.
 *
 * Glossary (§10.1): チェック · チェックメイト · ステイルメイト (never 詰み, which
 * is the checkmate side) · 引き分け · 駒不足 · 同形三回 · 50 手ルール; ポーン ·
 * ナイト · ビショップ · ルーク · クイーン · キング; 白 · 黒.
 */
import type { ChessMessages } from './en';

export const ja: ChessMessages = {
  chessName: 'Chess',
  chessChooseOpponent: '相手を選ぶ',
  chessDifficulty_easy: 'やさしい',
  chessDifficulty_normal: 'ふつう',
  chessDifficulty_hard: 'むずかしい',
  chessRecordNote: '勝ち {wins} · 引き分け {draws} · 負け {losses}',
  chessChooseSideLabel: '次の対局の手番',
  chessPlayWhite: '白(先手)',
  chessPlayBlack: '黒(後手)',
  chessConfirmSwitchTitle: '進行中の対局を置き換えますか?',
  chessConfirmSwitchBody: '{current} の対局は、新しい {next} の対局に置き換わります。',
  chessYouPlayWhite: 'あなたは白',
  chessYouPlayBlack: 'あなたは黒',
  chessBoardLabel: 'チェスの盤',
  chessPiece_white_pawn: '白のポーン',
  chessPiece_white_knight: '白のナイト',
  chessPiece_white_bishop: '白のビショップ',
  chessPiece_white_rook: '白のルーク',
  chessPiece_white_queen: '白のクイーン',
  chessPiece_white_king: '白のキング',
  chessPiece_black_pawn: '黒のポーン',
  chessPiece_black_knight: '黒のナイト',
  chessPiece_black_bishop: '黒のビショップ',
  chessPiece_black_rook: '黒のルーク',
  chessPiece_black_queen: '黒のクイーン',
  chessPiece_black_king: '黒のキング',
  chessSquareEmpty: '{square}、空き',
  chessSquarePiece: '{square}、{piece}',
  chessSquareSelected: '{square}、{piece}、選択中',
  chessSquareInCheck: '{square}、{piece}、チェックを受けている',
  chessSquareMoveHere: '{square}：ここへ動かす',
  chessSquareCaptureHere: '{square}、{piece}：ここで取る',
  chessSquareCaptureEnPassant: '{square}：ここへ動いて横のポーンを取る',
  chessYourTurn: 'あなたの番',
  chessYourTurnCheck: 'チェック — あなたのキングが狙われています',
  chessCpuTurn: 'CPU の番',
  chessCpuTurnCheck: 'チェック — CPU の番',
  chessPromoteTitle: 'ポーンを昇格させる駒',
  chessWinTitle: 'あなたの勝ち',
  chessLoseTitle: 'CPU の勝ち',
  chessDrawTitle: '引き分け',
  chessReason_checkmate: 'チェックメイト：キングがチェックを受け、合法手がありません。',
  chessReason_stalemate: 'ステイルメイト：合法手がなく、キングはチェックを受けていません。',
  chessReason_insufficient: '駒不足：どちらもチェックメイトできません。',
  chessReason_repetition: '同形三回：同じ局面が 3 回目になりました。',
  chessReason_fifty: '50 手ルール：取る手もポーンの手もないまま、双方 50 手が続きました。',
  chessResultSide: 'あなたの色',
  chessResultMoves: '手数',
  chessSideWhite: '白',
  chessSideBlack: '黒',
  chessWins: '勝ち',
  chessDraws: '引き分け',
  chessLosses: '負け',
  chessStep1Title: '駒ごとに動きが違う',
  chessStep1Body: '自分の駒をタップすると、動けるマスすべてに点が出ます。',
  chessStep2Title: '取れるが、キングは守る',
  chessStep2Body:
    '相手の駒のマスへ動けば取れます(ポーンは斜め前で取る)。ただし自分のキングが狙われたままになる手は指せません。',
  chessStep3Title: 'チェックメイトで勝ち',
  chessStep3Body:
    '逃げ場のないチェックをかければ勝ち。チェックでないのに合法手がなければ引き分けです。',
};
