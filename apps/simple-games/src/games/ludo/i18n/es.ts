// TODO(ludo): 未翻訳。次の担当が置き換える。
import type { LudoMessages } from './en';

export const es: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Choose your opponent',
  ludoDifficulty_easy: 'Easy',
  ludoDifficulty_normal: 'Normal',
  ludoDifficulty_hard: 'Hard',
  ludoRecordNote: 'Won {wins} · Lost {losses}',
  ludoConfirmSwitchTitle: 'Replace the match in progress?',
  ludoConfirmSwitchBody: 'Your {current} match will be replaced by a new {next} match.',

  // ---- the board ----
  ludoBoardLabel: 'Ludo board',
  ludoYou: 'You',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '{home} of 4 home',
  ludoSafeSquare: 'Safe square',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'in the yard',
  ludoWhereSquare: 'on square {n}',
  ludoWhereSafe: 'on safe square {n}',
  ludoWhereColumn: 'on home column square {n}',
  ludoWhereHome: 'home',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'Move your pawn {where}',

  // ---- the die and the turn ----
  ludoRollAction: 'Roll',
  ludoRollLabel: 'Roll the die',
  ludoDieLabel: 'Die shows {die}',
  ludoDieUnrolled: 'The die has not been thrown yet',
  ludoTurnRoll: 'Your turn — throw the die.',
  ludoTurnMove: 'You rolled {die}. Tap a pawn to move it.',
  ludoTurnCpu: 'CPU {n} is playing…',
  ludoAutoPass: 'Nothing can move on that roll — it passes.',
  ludoThirdSix: 'Three sixes in a row — the turn passes on.',
  ludoRollAgain: 'A six — throw again.',

  // ---- the end of a match ----
  ludoWinTitle: 'You win!',
  ludoWinBody: 'All four of your pawns are home.',
  ludoLoseTitle: 'CPU {n} wins',
  ludoLoseBody: 'All four of their pawns are home. The next match is free.',
  ludoNoContestTitle: 'No contest',
  ludoNoContestBody:
    'The match reached its limit of throws with nobody home. It counts as played, and as neither a win nor a loss.',
  ludoWins: 'Wins',
  ludoLosses: 'Losses',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'A six lets a pawn out',
  ludoStep1Body:
    'Throw the die, then tap a pawn to move it. Only the pawns the rules allow can be tapped — everything else stays put.',
  ludoStep2Title: 'A six throws again',
  ludoStep2Body:
    'Roll a six and you throw once more. Three sixes in a row, though, and the turn passes on with nothing moved.',
  ludoStep3Title: 'Landing on an enemy sends it back',
  ludoStep3Body:
    'Every enemy pawn on that square goes back to its yard at once. Safe squares are immune. Capturing does not earn you another throw — only a six does.',
  ludoStep4Title: 'Stacking your own pawns protects nothing',
  ludoStep4Body:
    'Two of your pawns on one square block nobody and guard nothing. An enemy landing there sends the whole stack home, so a pile is a target, not a fort.',
  ludoStep5Title: 'Come home on an exact count',
  ludoStep5Body:
    'A throw that would overshoot home cannot move that pawn at all. Get all four home to win. Every face comes from the match seed, each of the six is equally likely, and no seat is thrown for differently.',
};
