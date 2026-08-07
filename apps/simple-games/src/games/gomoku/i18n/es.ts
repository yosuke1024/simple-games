import type { GomokuMessages } from './en';

export const es: GomokuMessages = {
  gomokuName: 'Gomoku',
  gomokuChooseOpponent: 'Elige a tu rival',
  gomokuDifficulty_easy: 'Fácil',
  gomokuDifficulty_normal: 'Normal',
  gomokuDifficulty_hard: 'Difícil',
  gomokuRecordNote: '{wins} victorias · {losses} derrotas',
  gomokuBoardLabel: 'Tablero de Gomoku, 15 por 15',
  gomokuChooseSideLabel: 'Con qué color juegas',
  gomokuPlayBlack: 'Negras · primero',
  gomokuPlayWhite: 'Blancas · segundo',
  gomokuPointEmpty: 'Fila {row}, columna {col}: vacía',
  gomokuPointMine: 'Fila {row}, columna {col}: tu ficha',
  gomokuPointTheirs: 'Fila {row}, columna {col}: ficha de la CPU',
  gomokuPointPending: 'Fila {row}, columna {col}: toca otra vez para colocar',
  gomokuYou: 'Tú',
  gomokuCpu: 'CPU',
  gomokuYourTurn: 'Tu turno: toca una vez para apuntar y otra para colocar',
  gomokuConfirmPrompt: 'Toca el mismo punto otra vez para colocar tu ficha.',
  gomokuCpuTurn: 'La CPU está pensando…',
  gomokuWinTitle: '¡Ganaste!',
  gomokuWinBody: 'Cinco en línea.',
  gomokuLoseTitle: 'Gana la CPU',
  gomokuLoseBody: 'La CPU hizo cinco en línea. La siguiente partida es gratis.',
  gomokuDrawTitle: 'Empate',
  gomokuDrawBody: 'El tablero se llenó sin que nadie hiciera cinco.',
  gomokuWins: 'Victorias',
  gomokuLosses: 'Derrotas',
  gomokuDraws: 'Empates',
  gomokuStep1Title: 'Toca para apuntar, otra vez para colocar',
  gomokuStep1Body:
    'El primer toque marca el punto; el segundo lo confirma. Toca en otro sitio para mover la marca.',
  gomokuStep2Title: 'Cinco en línea gana',
  gomokuStep2Body:
    'Alinea cinco fichas tuyas en horizontal, vertical o diagonal. Seis también cuentan.',
  gomokuStep3Title: 'Bloquea el tres abierto',
  gomokuStep3Body:
    'Tres fichas de la CPU con los dos extremos libres se convierten en un cuatro imparable. Deshacer es gratis.',
  gomokuConfirmSwitchTitle: '¿Reemplazar la partida en curso?',
  gomokuConfirmSwitchBody:
    'Tu partida en {current} será reemplazada por una nueva partida en {next}.',
};
