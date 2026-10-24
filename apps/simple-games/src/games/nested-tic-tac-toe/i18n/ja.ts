/**
 * Nested Tic-Tac-Toe — 日本語カタログ。
 *
 * 来歴(docs/NESTED_TIC_TAC_TOE_RULES.md §12): AI が英語の原文から書いた下書き
 * (2026-10-21)で、作者はまだ読んでいない。人が確認済みとは扱わない。
 *
 * 用語(§12 の用語集。各 1 語): 小盤 = 小さな盤 · マス · 送り = 送る · 取る =
 * 取る / 取った(「勝つ」と別の語)· 閉じた盤 = 閉じた(Quick Rules では「取ら
 * れているか埋まって」と開く)· 未決の小盤の読み上げ = 未決(§10「読み上げ」)·
 * 自由手 = 空いている盤のどこにでも · 先手 / 後手 · 印 = バツ / マル。
 * タイトル(`nestedTicTacToeName`)は固有名詞なので訳さない。ホームの戦績の
 * 一行は盤面の 4 本(Reversi など)と同じ形にした。
 */
import type { NestedTicTacToeMessages } from './en';

export const ja: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: '対戦相手を選ぶ',
  nestedTicTacToeDifficulty_easy: 'やさしい',
  nestedTicTacToeDifficulty_normal: 'ふつう',
  nestedTicTacToeDifficulty_hard: 'つよい',
  nestedTicTacToeRecordNote: '{wins}勝 · {losses}敗',
  nestedTicTacToeChooseSideLabel: 'どちらが先に打つか',
  nestedTicTacToePlayFirst: '先手',
  nestedTicTacToePlaySecond: '後手',
  nestedTicTacToePlayFirstLabel: '先手、バツで打つ',
  nestedTicTacToePlaySecondLabel: '後手、マルで打つ',
  nestedTicTacToeConfirmSwitchTitle: '対局中のゲームを置き換えますか?',
  nestedTicTacToeConfirmSwitchBody:
    '「{current}」の対局は、新しい「{next}」の対局に置き換わります。',
  nestedTicTacToeBoardLabel: 'Nested Tic-Tac-Toe の盤、小さな盤が 9 つ',
  nestedTicTacToeSmallOpen: '小さな盤 {board}: 未決',
  nestedTicTacToeSmallPlayable: '小さな盤 {board}: 未決、ここに打てる',
  nestedTicTacToeSmallMine: '小さな盤 {board}: あなたが取った',
  nestedTicTacToeSmallCpu: '小さな盤 {board}: CPU が取った',
  nestedTicTacToeSmallDrawn: '小さな盤 {board}: 引き分け(閉じている)',
  nestedTicTacToeCellEmpty: '小さな盤 {board}・マス {square}: 空',
  nestedTicTacToeCellPlayable: '小さな盤 {board}・マス {square}: ここに打てる',
  nestedTicTacToeCellYourCross: '小さな盤 {board}・マス {square}: あなたのバツ',
  nestedTicTacToeCellYourCircle: '小さな盤 {board}・マス {square}: あなたのマル',
  nestedTicTacToeCellCpuCross: '小さな盤 {board}・マス {square}: CPU のバツ',
  nestedTicTacToeCellCpuCircle: '小さな盤 {board}・マス {square}: CPU のマル',
  nestedTicTacToeYourTurnSent: 'あなたの番です — 枠のある盤に打ちます',
  nestedTicTacToeYourTurnFree: 'あなたの番です — 空いている盤のどこにでも打てます',
  nestedTicTacToeCpuTurn: 'CPU の番です',
  nestedTicTacToeWinTitle: 'あなたの勝ち',
  nestedTicTacToeWinBody: 'あなたが取った盤が 3 つ並びました。',
  nestedTicTacToeLoseTitle: 'CPU の勝ち',
  nestedTicTacToeLoseBody: 'CPU が取った盤が 3 つ並びました。',
  nestedTicTacToeDrawTitle: '引き分け',
  nestedTicTacToeDrawBody: 'すべての小さな盤が閉じ、どちらも盤を 3 つ並べていません。',
  nestedTicTacToeBoardsYou: 'あなたが取った盤',
  nestedTicTacToeBoardsCpu: 'CPU が取った盤',
  nestedTicTacToeWins: '勝ち',
  nestedTicTacToeLosses: '負け',
  nestedTicTacToeDraws: '引き分け',
  nestedTicTacToeStep1Title: '打った位置で相手を送る',
  nestedTicTacToeStep1Body: '小さな盤の中で打ったマスの位置が、相手が次に打つ小さな盤を決めます。',
  nestedTicTacToeStep2Title: '取られたか埋まっていれば、空いている盤へ',
  nestedTicTacToeStep2Body:
    'その盤が取られているか埋まっていれば、空いている盤のどこにでも打てます。',
  nestedTicTacToeStep3Title: '取った盤を 3 つ並べる',
  nestedTicTacToeStep3Body:
    '小さな盤で 3 つ並べればその盤を取り、取った盤を 3 つ並べれば勝ちです。',
};
