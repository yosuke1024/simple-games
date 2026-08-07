import type { GomokuMessages } from './en';

export const fr: GomokuMessages = {
  gomokuName: 'Gomoku',
  gomokuChooseOpponent: 'Choisis ton adversaire',
  gomokuDifficulty_easy: 'Facile',
  gomokuDifficulty_normal: 'Normal',
  gomokuDifficulty_hard: 'Difficile',
  gomokuRecordNote: '{wins} victoires · {losses} défaites',
  gomokuBoardLabel: 'Plateau Gomoku, 15 sur 15',
  gomokuChooseSideLabel: 'Quelle couleur tu joues',
  gomokuPlayBlack: 'Noirs · en premier',
  gomokuPlayWhite: 'Blancs · en second',
  gomokuPointEmpty: 'Ligne {row}, colonne {col} : vide',
  gomokuPointMine: 'Ligne {row}, colonne {col} : ta pierre',
  gomokuPointTheirs: 'Ligne {row}, colonne {col} : pierre du CPU',
  gomokuPointPending: 'Ligne {row}, colonne {col} : touche à nouveau pour poser',
  gomokuYou: 'Toi',
  gomokuCpu: 'CPU',
  gomokuYourTurn: 'À toi : touche une fois pour viser, une seconde pour poser',
  gomokuConfirmPrompt: 'Touche à nouveau le même point pour poser ta pierre.',
  gomokuCpuTurn: 'Le CPU réfléchit…',
  gomokuWinTitle: 'Tu as gagné !',
  gomokuWinBody: 'Cinq alignées.',
  gomokuLoseTitle: 'Le CPU gagne',
  gomokuLoseBody: 'Le CPU a aligné cinq pierres. La partie suivante est gratuite.',
  gomokuDrawTitle: 'Match nul',
  gomokuDrawBody: 'Le plateau s’est rempli sans que personne n’aligne cinq pierres.',
  gomokuWins: 'Victoires',
  gomokuLosses: 'Défaites',
  gomokuDraws: 'Nuls',
  gomokuStep1Title: 'Touche pour viser, retouche pour poser',
  gomokuStep1Body:
    'Le premier appui marque le point ; le second le valide. Touche ailleurs pour déplacer la marque.',
  gomokuStep2Title: 'Cinq alignées gagnent',
  gomokuStep2Body:
    'Aligne cinq de tes pierres à l’horizontale, à la verticale ou en diagonale. Six comptent aussi.',
  gomokuStep3Title: 'Bloque le trois ouvert',
  gomokuStep3Body:
    'Trois pierres du CPU libres aux deux bouts deviennent un quatre imparable. Annuler est gratuit.',
  gomokuConfirmSwitchTitle: 'Remplacer la partie en cours ?',
  gomokuConfirmSwitchBody:
    'Ta partie en {current} sera remplacée par une nouvelle partie en {next}.',
};
