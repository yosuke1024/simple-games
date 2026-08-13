import type { LudoMessages } from './en';

export const de: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: 'Gegner wählen',
  ludoDifficulty_easy: 'Leicht',
  ludoDifficulty_normal: 'Normal',
  ludoDifficulty_hard: 'Schwer',
  ludoRecordNote: '{wins} Siege · {losses} Niederlagen',
  ludoConfirmSwitchTitle: 'Laufende Partie ersetzen?',
  ludoConfirmSwitchBody: 'Deine {current}-Partie wird durch eine neue {next}-Partie ersetzt.',

  // ---- the board ----
  ludoBoardLabel: 'Ludo-Brett',
  ludoYou: 'Du',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '{home} von 4 im Ziel',
  ludoSafeSquare: 'Sicheres Feld',
  // Where a pawn is, in words. Composed into the two labels below so a seat, a
  // square and a state are each translated once.
  ludoWhereYard: 'im Haus',
  ludoWhereSquare: 'auf Feld {n}',
  ludoWhereSafe: 'auf sicherem Feld {n}',
  ludoWhereColumn: 'auf Feld {n} der Zielgeraden',
  ludoWhereHome: 'im Ziel',
  ludoPawnAt: '{seat}, {where}',
  ludoMovePawn: 'Figur {where} ziehen',

  // ---- the die and the turn ----
  ludoRollAction: 'Würfeln',
  ludoRollLabel: 'Würfel werfen',
  ludoDieLabel: 'Würfel zeigt {die}',
  ludoDieUnrolled: 'Der Würfel wurde noch nicht geworfen',
  ludoTurnRoll: 'Du bist dran — wirf den Würfel.',
  ludoTurnMove: 'Du hast eine {die} gewürfelt. Tippe eine Figur an, um sie zu ziehen.',
  ludoTurnCpu: 'CPU {n} spielt…',
  ludoAutoPass: 'Mit dieser Zahl kann nichts ziehen — du setzt aus.',
  ludoThirdSix: 'Drei Sechsen in Folge — der Zug geht weiter.',
  ludoRollAgain: 'Eine Sechs — wirf noch einmal.',

  // ---- the end of a match ----
  ludoWinTitle: 'Du gewinnst!',
  ludoWinBody: 'Alle vier deiner Figuren sind im Ziel.',
  ludoLoseTitle: 'CPU {n} gewinnt',
  ludoLoseBody: 'Alle vier ihrer Figuren sind im Ziel. Die nächste Partie ist kostenlos.',
  ludoNoContestTitle: 'Ohne Ergebnis',
  ludoNoContestBody:
    'Die Partie hat die Wurf-Obergrenze erreicht, ohne dass jemand im Ziel war. Sie zählt als gespielt, aber weder als Sieg noch als Niederlage.',
  ludoWins: 'Siege',
  ludoLosses: 'Niederlagen',

  // ---- Quick Rules (docs/LUDO_RULES.md §11) ----
  ludoStep1Title: 'Eine Sechs lässt eine Figur raus',
  ludoStep1Body:
    'Wirf den Würfel und tippe dann eine Figur an, um sie zu ziehen. Antippen lassen sich nur Figuren, die die Regeln erlauben — alle anderen bleiben stehen.',
  ludoStep2Title: 'Eine Sechs wirft erneut',
  ludoStep2Body:
    'Würfelst du eine Sechs, darfst du noch einmal werfen. Bei drei Sechsen in Folge geht der Zug jedoch weiter, ohne dass etwas gezogen wird.',
  ludoStep3Title: 'Landest du auf einem Gegner, geht er zurück',
  ludoStep3Body:
    'Jede gegnerische Figur auf diesem Feld geht sofort zurück ins Haus. Sichere Felder sind davon ausgenommen. Ein Schlag bringt dir keinen weiteren Wurf — nur eine Sechs tut das.',
  ludoStep4Title: 'Eigene Figuren stapeln schützt nicht',
  ludoStep4Body:
    'Zwei deiner Figuren auf demselben Feld blockieren niemanden und schützen nichts. Landet ein Gegner dort, gehen alle Figuren des Stapels auf einmal zurück ins Haus — ein Haufen ist ein Ziel, keine Festung.',
  ludoStep5Title: 'Nur mit genauer Zahl ins Ziel',
  ludoStep5Body:
    'Ein Wurf, der über das Ziel hinausschießen würde, bewegt diese Figur gar nicht. Bring alle vier ins Ziel, um zu gewinnen. Jede Zahl kommt aus dem Seed der Partie, alle sechs sind gleich wahrscheinlich, und kein Platz wird anders gewürfelt.',
};
