import type { LudoMessages } from './en';

export const es: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Elige tu rival',
  ludoDifficulty_easy: 'Fácil',
  ludoDifficulty_normal: 'Normal',
  ludoDifficulty_hard: 'Difícil',
  ludoRecordNote: '{wins} victorias · {losses} derrotas',
  ludoConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  ludoConfirmSwitchBody: 'Tu partida {current} se reemplazará por una nueva partida {next}.',

  // ---- the board ----
  ludoBoardLabel: 'Tablero de Ludo',
  ludoYou: 'Tú',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '{home} de 4 en la meta',
  ludoSafeSquare: 'Casilla segura',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'en la salida',
  ludoWhereSquare: 'en la casilla {n}',
  ludoWhereSafe: 'en la casilla segura {n}',
  ludoWhereColumn: 'en la casilla {n} de la columna final',
  ludoWhereHome: 'en la meta',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'Mover tu ficha {where}',

  // ---- the die and the turn ----
  ludoRollAction: 'Tirar',
  ludoRollLabel: 'Tirar el dado',
  ludoDieLabel: 'El dado muestra {die}',
  ludoDieUnrolled: 'Todavía no se ha tirado el dado',
  ludoTurnRoll: 'Tu turno — tira el dado.',
  ludoTurnMove: 'Sacaste {die}. Toca una ficha para moverla.',
  ludoTurnCpu: 'La CPU {n} está jugando…',
  ludoAutoPass: 'Con ese número no se puede mover nada — se pasa el turno.',
  ludoThirdSix: 'Tres seis seguidos — el turno pasa.',
  ludoRollAgain: 'Sacaste un seis — tira otra vez.',

  // ---- the end of a match ----
  ludoWinTitle: '¡Ganaste!',
  ludoWinBody: 'Tus cuatro fichas llegaron a la meta.',
  ludoLoseTitle: 'Gana la CPU {n}',
  ludoLoseBody: 'Sus cuatro fichas llegaron a la meta. La próxima partida es gratis.',
  ludoNoContestTitle: 'Sin resultado',
  ludoNoContestBody:
    'La partida llegó al límite de tiradas sin que nadie llegara a la meta. Cuenta como jugada, pero no como victoria ni como derrota.',
  ludoWins: 'Victorias',
  ludoLosses: 'Derrotas',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'Un seis saca una ficha',
  ludoStep1Body:
    'Tira el dado y luego toca una ficha para moverla. Solo se pueden tocar las fichas que las reglas permiten mover — las demás se quedan donde están.',
  ludoStep2Title: 'Un seis vuelve a tirar',
  ludoStep2Body:
    'Si sacas un seis, tiras otra vez. Pero si salen tres seis seguidos, el turno pasa sin mover nada.',
  ludoStep3Title: 'Caer sobre un rival lo manda de vuelta',
  ludoStep3Body:
    'Toda ficha rival que esté en esa casilla vuelve a la salida de inmediato. Las casillas seguras están a salvo de esto. Capturar no te da otra tirada — solo un seis la da.',
  ludoStep4Title: 'Amontonar tus fichas no protege nada',
  ludoStep4Body:
    'Dos fichas tuyas en la misma casilla no bloquean a nadie ni las protegen. Si un rival cae ahí, todo el montón vuelve de golpe a la salida — un montón es un blanco, no una fortaleza.',
  ludoStep5Title: 'A la meta con el número exacto',
  ludoStep5Body:
    'Una tirada que se pase de la meta no mueve esa ficha. Lleva tus cuatro fichas a la meta para ganar. Cada número sale de la semilla de la partida, los seis valores son igual de probables, y a ningún jugador se le tira distinto.',
};
