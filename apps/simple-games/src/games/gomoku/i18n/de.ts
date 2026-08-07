import type { GomokuMessages } from './en';

export const de: GomokuMessages = {
  gomokuName: 'Gomoku',
  gomokuChooseOpponent: 'Wähle deinen Gegner',
  gomokuDifficulty_easy: 'Leicht',
  gomokuDifficulty_normal: 'Normal',
  gomokuDifficulty_hard: 'Schwer',
  gomokuRecordNote: '{wins} Siege · {losses} Niederlagen',
  gomokuBoardLabel: 'Gomoku-Brett, 15 mal 15',
  gomokuChooseSideLabel: 'Welche Farbe du spielst',
  gomokuPlayBlack: 'Schwarz · zuerst',
  gomokuPlayWhite: 'Weiß · danach',
  gomokuPointEmpty: 'Reihe {row}, Spalte {col}: leer',
  gomokuPointMine: 'Reihe {row}, Spalte {col}: dein Stein',
  gomokuPointTheirs: 'Reihe {row}, Spalte {col}: Stein der CPU',
  gomokuPointPending: 'Reihe {row}, Spalte {col}: noch einmal tippen zum Setzen',
  gomokuYou: 'Du',
  gomokuCpu: 'CPU',
  gomokuYourTurn: 'Du bist dran – einmal tippen zum Zielen, noch einmal zum Setzen',
  gomokuConfirmPrompt: 'Tippe denselben Punkt noch einmal an, um deinen Stein zu setzen.',
  gomokuCpuTurn: 'Die CPU denkt nach…',
  gomokuWinTitle: 'Du gewinnst!',
  gomokuWinBody: 'Fünf in einer Reihe.',
  gomokuLoseTitle: 'Die CPU gewinnt',
  gomokuLoseBody: 'Die CPU hat fünf in einer Reihe. Die nächste Partie ist kostenlos.',
  gomokuDrawTitle: 'Unentschieden',
  gomokuDrawBody: 'Das Brett ist voll, und niemand hat fünf geschafft.',
  gomokuWins: 'Siege',
  gomokuLosses: 'Niederlagen',
  gomokuDraws: 'Remis',
  gomokuStep1Title: 'Tippen zum Zielen, noch einmal zum Setzen',
  gomokuStep1Body:
    'Der erste Tipp markiert den Punkt, der zweite bestätigt ihn. Tippe woanders hin, um die Markierung zu versetzen.',
  gomokuStep2Title: 'Fünf in einer Reihe gewinnt',
  gomokuStep2Body:
    'Bringe fünf deiner Steine waagerecht, senkrecht oder diagonal in eine Reihe. Sechs zählen auch.',
  gomokuStep3Title: 'Blockiere die offene Drei',
  gomokuStep3Body:
    'Drei Steine der CPU mit beiden Enden frei werden zu einer Vier, die nicht mehr zu stoppen ist. Rückgängig ist kostenlos.',
  gomokuConfirmSwitchTitle: 'Laufende Partie ersetzen?',
  gomokuConfirmSwitchBody:
    'Deine Partie auf {current} wird durch eine neue Partie auf {next} ersetzt.',
};
