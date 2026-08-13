import type { LudoMessages } from './en';

export const ptBR: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Escolha seu adversário',
  ludoDifficulty_easy: 'Fácil',
  ludoDifficulty_normal: 'Normal',
  ludoDifficulty_hard: 'Difícil',
  ludoRecordNote: '{wins} vitórias · {losses} derrotas',
  ludoConfirmSwitchTitle: 'Substituir a partida em andamento?',
  ludoConfirmSwitchBody: 'Sua partida {current} será substituída por uma nova partida {next}.',

  // ---- the board ----
  ludoBoardLabel: 'Tabuleiro de Ludo',
  ludoYou: 'Você',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '{home} de 4 na meta',
  ludoSafeSquare: 'Casa segura',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'na base',
  ludoWhereSquare: 'na casa {n}',
  ludoWhereSafe: 'na casa segura {n}',
  ludoWhereColumn: 'na casa {n} do corredor final',
  ludoWhereHome: 'na meta',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'Mover sua peça {where}',

  // ---- the die and the turn ----
  ludoRollAction: 'Jogar',
  ludoRollLabel: 'Jogar o dado',
  ludoDieLabel: 'O dado mostra {die}',
  ludoDieUnrolled: 'O dado ainda não foi lançado',
  ludoTurnRoll: 'Sua vez — jogue o dado.',
  ludoTurnMove: 'Você tirou {die}. Toque numa peça para movê-la.',
  ludoTurnCpu: 'A CPU {n} está jogando…',
  ludoAutoPass: 'Nada pode se mover com esse número — a vez passa.',
  ludoThirdSix: 'Três seis seguidos — a vez passa adiante.',
  ludoRollAgain: 'Um seis — jogue de novo.',

  // ---- the end of a match ----
  ludoWinTitle: 'Você venceu!',
  ludoWinBody: 'Suas quatro peças chegaram à meta.',
  ludoLoseTitle: 'A CPU {n} venceu',
  ludoLoseBody: 'As quatro peças dela chegaram à meta. A próxima partida é grátis.',
  ludoNoContestTitle: 'Sem resultado',
  ludoNoContestBody:
    'A partida atingiu o limite de jogadas sem que ninguém chegasse à meta. Ela conta como jogada, mas não como vitória nem como derrota.',
  ludoWins: 'Vitórias',
  ludoLosses: 'Derrotas',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'Um seis solta uma peça',
  ludoStep1Body:
    'Jogue o dado e depois toque numa peça para movê-la. Só dá para tocar nas peças que as regras permitem mover — as outras ficam paradas.',
  ludoStep2Title: 'Um seis joga de novo',
  ludoStep2Body:
    'Tire um seis e você joga mais uma vez. Mas três seis seguidos fazem a vez passar adiante sem mover nada.',
  ludoStep3Title: 'Cair sobre um adversário manda ele de volta',
  ludoStep3Body:
    'Toda peça adversária naquela casa volta de uma vez para a base. Casas seguras ficam livres disso. Capturar não te dá outra jogada — só um seis dá.',
  ludoStep4Title: 'Empilhar suas peças não protege nada',
  ludoStep4Body:
    'Duas peças suas na mesma casa não bloqueiam ninguém nem se protegem. Se um adversário cair ali, a pilha inteira volta de uma vez para a base — um monte de peças é um alvo, não uma fortaleza.',
  ludoStep5Title: 'Só chega à meta com o número exato',
  ludoStep5Body:
    'Uma jogada que passaria da meta não move essa peça. Leve suas quatro peças até a meta para vencer. Cada número vem da semente da partida, os seis valores têm a mesma chance, e nenhuma posição joga diferente.',
};
