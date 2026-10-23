/** AI-authored translation draft; no human review claimed. See docs/NIM_RULES.md. */
import type { NimMessages } from './en';
export const ja: NimMessages = {
  nimName: 'Nim',
  nimMode_easy: 'やさしい',
  nimMode_normal: 'ふつう',
  nimMode_hard: 'むずかしい',
  nimRow: '{row} 行目：石 {count} 個',
  nimTake: '{count} 個取る',
  nimYourTurn: 'あなたの番',
  nimCpuTurn: 'CPU の番',
  nimPaused: '一時停止中。準備ができたら再開。',
  nimLastMove: '直前の手：{row} 行目から {count} 個。',
  nimGoal: '最後の石を取ると勝ちです。',
  nimChooseRow: '行を 1 つ選びます。',
  nimChooseCount: '取る石の数を選びます。',
  nimWon: 'あなたの勝ち！',
  nimLost: 'CPU の勝ち',
  nimOpponent: '相手の強さ',
  nimWins: '勝ち',
  nimLosses: '負け',
  nimStep1Title: '行を 1 つ選ぶ',
  nimStep1Body: '石がある行を 1 つ選びます。先手はいつもあなたです。',
  nimStep2Title: '1 個以上取る',
  nimStep2Body: 'その行から取る石の数を選び、確定します。',
  nimStep3Title: '最後の石を取る',
  nimStep3Body:
    'CPU と交互に取り、最後の石を取った方が勝ちです。「戻す」で CPU の応手も取り消せます。',
};
