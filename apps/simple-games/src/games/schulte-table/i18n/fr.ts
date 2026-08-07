import type { SchulteMessages } from './en';

export const fr: SchulteMessages = {
  schulteName: 'Schulte Table',

  schulteBoardLabel: 'Grille de nombres',
  schulteCell: '{value}, ligne {row}, colonne {col}',
  schulteCellDone: '{value}, ligne {row}, colonne {col}, déjà touché',
  schulteFind: 'Cherchez',

  schulteDoneTitle: 'Tous trouvés',
  schulteDoneBody: "Vous avez touché tous les nombres dans l'ordre.",
  schulteMisses: 'Mauvais appuis',
  schulteNewBestTime: 'Votre meilleur temps.',
  schulteConfirmRestartBody: 'Cette manche recommence au premier nombre.',

  schulteDailyBacklogHint: 'Les jours précédents restent toujours accessibles.',
  schulteSizeLabel: '{n}x{n}',
  schulteLevelsDone: 'Niveaux terminés',
  schulteDailiesDone: 'Défis terminés',
  schulteTotalMisses: 'Mauvais appuis au total',

  schulteStep1Title: 'Touchez 1, puis 2, puis 3',
  schulteStep1Body: "Les nombres sont éparpillés. Touchez-les dans l'ordre.",
  schulteStep2Title: 'Le nombre à trouver est au-dessus de la grille',
  schulteStep2Body: 'Un appui erroné ne coûte rien. La grille attend, tout simplement.',
  schulteStep3Title: 'Terminez la grille',
  schulteStep3Body: "Votre temps est enregistré. Il n'y a pas de limite de temps.",
};
