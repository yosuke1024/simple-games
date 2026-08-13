import type { LudoMessages } from './en';

export const zhHans: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: '选择对手',
  ludoDifficulty_easy: '简单',
  ludoDifficulty_normal: '普通',
  ludoDifficulty_hard: '困难',
  ludoRecordNote: '{wins} 胜 · {losses} 负',
  ludoConfirmSwitchTitle: '替换进行中的对局？',
  ludoConfirmSwitchBody: '进行中的"{current}"对局会被新的"{next}"对局替换。',

  // ---- the board ----
  ludoBoardLabel: 'Ludo 棋盘',
  ludoYou: '你',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '4 颗中 {home} 颗到达终点',
  ludoSafeSquare: '安全格',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: '在基地',
  ludoWhereSquare: '在第 {n} 格',
  ludoWhereSafe: '在第 {n} 个安全格',
  ludoWhereColumn: '在终点通道的第 {n} 格',
  ludoWhereHome: '已到终点',
  ludoPawnAt: '{seat}，{where}',
  ludoMovePawn: '移动你{where}的棋子',

  // ---- the die and the turn ----
  ludoRollAction: '掷',
  ludoRollLabel: '掷骰子',
  ludoDieLabel: '骰子显示 {die}',
  ludoDieUnrolled: '骰子还没有掷出',
  ludoTurnRoll: '轮到你了 —— 掷骰子。',
  ludoTurnMove: '你掷出了 {die}。点击一颗棋子来移动它。',
  ludoTurnCpu: 'CPU {n} 正在行动……',
  ludoAutoPass: '这个点数没有棋子能走 —— 自动跳过。',
  ludoThirdSix: '连续三次掷出 6 —— 轮到下一位。',
  ludoRollAgain: '掷出 6 —— 再掷一次。',

  // ---- the end of a match ----
  ludoWinTitle: '你赢了！',
  ludoWinBody: '你的四颗棋子都到达终点了。',
  ludoLoseTitle: 'CPU {n} 获胜',
  ludoLoseBody: '对方的四颗棋子都到达终点了。下一场对局免费。',
  ludoNoContestTitle: '不计胜负',
  ludoNoContestBody:
    '这场对局达到了掷骰次数上限，还没有人到达终点。它算作已进行的对局，但既不算赢也不算输。',
  ludoWins: '胜',
  ludoLosses: '负',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: '掷出 6 才能出子',
  ludoStep1Body:
    '先掷骰子，再点击一颗棋子来移动它。只有规则允许的棋子才能点击 —— 其余棋子原地不动。',
  ludoStep2Title: '掷出 6 可以再掷一次',
  ludoStep2Body: '掷出 6，你可以再掷一次。但连续三次掷出 6，这一轮就直接过，不移动任何棋子。',
  ludoStep3Title: '走到对手的格子上会把它送回去',
  ludoStep3Body:
    '那个格子上所有对手的棋子会立刻送回它们的基地。安全格不受影响。吃子并不会给你额外的一掷 —— 只有掷出 6 才会。',
  ludoStep4Title: '把自己的棋子叠在一起没有任何保护作用',
  ludoStep4Body:
    '你的两颗棋子在同一格上，既不会挡住谁，也不会保护谁。对手一旦走到这里，整摞棋子会一起送回基地 —— 一堆棋子是目标，不是堡垒。',
  ludoStep5Title: '必须掷出正好的点数才能到终点',
  ludoStep5Body:
    '如果点数超过了终点，这颗棋子就完全不能走。让四颗棋子都到达终点才能获胜。每个点数都来自这场对局的种子，六个点数出现的概率相同，任何座位都不会掷得不一样。',
};
