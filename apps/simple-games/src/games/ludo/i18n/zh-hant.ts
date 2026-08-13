import type { LudoMessages } from './en';

export const zhHant: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: '選擇對手',
  ludoDifficulty_easy: '簡單',
  ludoDifficulty_normal: '普通',
  ludoDifficulty_hard: '困難',
  ludoRecordNote: '{wins} 勝 · {losses} 負',
  ludoConfirmSwitchTitle: '要替換進行中的對局嗎？',
  ludoConfirmSwitchBody: '進行中的「{current}」對局會被新的「{next}」對局取代。',

  // ---- the board ----
  ludoBoardLabel: 'Ludo 棋盤',
  ludoYou: '你',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '4 顆中 {home} 顆抵達終點',
  ludoSafeSquare: '安全格',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: '在基地',
  ludoWhereSquare: '在第 {n} 格',
  ludoWhereSafe: '在第 {n} 個安全格',
  ludoWhereColumn: '在終點通道的第 {n} 格',
  ludoWhereHome: '已抵達終點',
  ludoPawnAt: '{seat}，{where}',
  ludoMovePawn: '移動你{where}的棋子',

  // ---- the die and the turn ----
  ludoRollAction: '擲',
  ludoRollLabel: '擲骰子',
  ludoDieLabel: '骰子顯示 {die}',
  ludoDieUnrolled: '骰子還沒有擲出',
  ludoTurnRoll: '輪到你了 —— 擲骰子。',
  ludoTurnMove: '你擲出了 {die}。點擊一顆棋子來移動它。',
  ludoTurnCpu: 'CPU {n} 正在行動……',
  ludoAutoPass: '這個點數沒有棋子能走 —— 自動跳過。',
  ludoThirdSix: '連續三次擲出 6 —— 輪到下一位。',
  ludoRollAgain: '擲出 6 —— 再擲一次。',

  // ---- the end of a match ----
  ludoWinTitle: '你贏了！',
  ludoWinBody: '你的四顆棋子都抵達終點了。',
  ludoLoseTitle: 'CPU {n} 獲勝',
  ludoLoseBody: '對方的四顆棋子都抵達終點了。下一場對局免費。',
  ludoNoContestTitle: '不計勝負',
  ludoNoContestBody:
    '這場對局達到了擲骰次數上限，還沒有人抵達終點。它算作已進行的對局，但既不算贏也不算輸。',
  ludoWins: '勝',
  ludoLosses: '負',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: '擲出 6 才能出子',
  ludoStep1Body:
    '先擲骰子，再點擊一顆棋子來移動它。只有規則允許的棋子才能點擊 —— 其餘棋子原地不動。',
  ludoStep2Title: '擲出 6 可以再擲一次',
  ludoStep2Body: '擲出 6，你可以再擲一次。但連續三次擲出 6，這一輪就直接過，不移動任何棋子。',
  ludoStep3Title: '走到對手的格子上會把它送回去',
  ludoStep3Body:
    '那個格子上所有對手的棋子會立刻送回它們的基地。安全格不受影響。吃子並不會給你額外的一擲 —— 只有擲出 6 才會。',
  ludoStep4Title: '把自己的棋子疊在一起沒有任何保護作用',
  ludoStep4Body:
    '你的兩顆棋子在同一格上，既不會擋住誰，也不會保護誰。對手一旦走到這裡，整疊棋子會一起送回基地 —— 一堆棋子是目標，不是堡壘。',
  ludoStep5Title: '必須擲出正好的點數才能到終點',
  ludoStep5Body:
    '如果點數超過了終點，這顆棋子就完全不能走。讓四顆棋子都抵達終點才能獲勝。每個點數都來自這場對局的種子，六個點數出現的機率相同，任何座位都不會擲得不一樣。',
};
