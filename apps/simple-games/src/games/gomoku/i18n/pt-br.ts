import type { GomokuMessages } from './en';

export const ptBR: GomokuMessages = {
  gomokuName: 'Gomoku',
  gomokuChooseOpponent: 'Escolha seu adversário',
  gomokuDifficulty_easy: 'Fácil',
  gomokuDifficulty_normal: 'Normal',
  gomokuDifficulty_hard: 'Difícil',
  gomokuRecordNote: '{wins} vitórias · {losses} derrotas',
  gomokuBoardLabel: 'Tabuleiro de Gomoku, 15 por 15',
  gomokuChooseSideLabel: 'Com qual cor você joga',
  gomokuPlayBlack: 'Pretas · primeiro',
  gomokuPlayWhite: 'Brancas · depois',
  gomokuPointEmpty: 'Linha {row}, coluna {col}: vazia',
  gomokuPointMine: 'Linha {row}, coluna {col}: sua pedra',
  gomokuPointTheirs: 'Linha {row}, coluna {col}: pedra da CPU',
  gomokuPointPending: 'Linha {row}, coluna {col}: toque de novo para colocar',
  gomokuYou: 'Você',
  gomokuCpu: 'CPU',
  gomokuYourTurn: 'Sua vez: toque uma vez para mirar e outra para colocar',
  gomokuConfirmPrompt: 'Toque no mesmo ponto de novo para colocar sua pedra.',
  gomokuCpuTurn: 'A CPU está pensando…',
  gomokuWinTitle: 'Você venceu!',
  gomokuWinBody: 'Cinco em linha.',
  gomokuLoseTitle: 'A CPU venceu',
  gomokuLoseBody: 'A CPU fez cinco em linha. A próxima partida é gratuita.',
  gomokuDrawTitle: 'Empate',
  gomokuDrawBody: 'O tabuleiro encheu sem ninguém fazer cinco.',
  gomokuWins: 'Vitórias',
  gomokuLosses: 'Derrotas',
  gomokuDraws: 'Empates',
  gomokuStep1Title: 'Toque para mirar, de novo para colocar',
  gomokuStep1Body:
    'O primeiro toque marca o ponto; o segundo confirma. Toque em outro lugar para mover a marca.',
  gomokuStep2Title: 'Cinco em linha vence',
  gomokuStep2Body:
    'Alinhe cinco pedras suas na horizontal, vertical ou diagonal. Seis também valem.',
  gomokuStep3Title: 'Bloqueie o três aberto',
  gomokuStep3Body:
    'Três pedras da CPU com as duas pontas livres viram um quatro que não dá para parar. Desfazer é gratuito.',
  gomokuConfirmSwitchTitle: 'Substituir a partida em andamento?',
  gomokuConfirmSwitchBody:
    'Sua partida em {current} será substituída por uma nova partida em {next}.',
};
