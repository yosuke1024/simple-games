// AI translation; not reviewed by a native speaker.
import type { MarbleWeaveMessages } from './en';
export const fr: MarbleWeaveMessages = {
  marbleWeaveName: 'Marble Weave',
  marbleWeaveBest: 'Meilleur score',
  marbleWeaveFinished: 'Parties terminées',
  marbleWeaveLost: 'Votre résultat',
  marbleWeaveField: 'Plateau de billes',
  marbleWeaveEmpty: 'Vide',
  marbleWeaveCell: 'Ligne {row}, colonne {col} : {color}',
  marbleWeaveNext: 'À venir',
  marbleWeaveTarget: 'Ligne de {n}',
  marbleWeaveSelect: 'Choisissez une bille.',
  marbleWeaveDestination: 'Choisissez une case marquée. Impossible de traverser les autres billes.',
  marbleWeaveBlocked: 'Aucun chemin libre. Choisissez une autre case ou bille.',
  marbleWeaveMoving: 'La bille suit le chemin libre…',
  marbleWeaveColor1: 'Cercle rouge',
  marbleWeaveColor2: 'Losange bleu',
  marbleWeaveColor3: 'Croix verte',
  marbleWeaveColor4: 'Triangle doré',
  marbleWeaveColor5: 'Étoile violette',
  marbleWeaveColor6: 'Carré turquoise',
  marbleWeaveColor7: 'Fleur rose',
  marbleWeaveStep1Title: 'Trouver un passage',
  marbleWeaveStep1Body:
    'Choisissez une bille puis une case marquée. Elle traverse les cases vides, jamais en diagonale.',
  marbleWeaveStep2Title: 'Former une ligne',
  marbleWeaveStep2Body:
    'Alignez 4 billes de même couleur en Facile, ou 5 en Normal et Difficile. Lignes, colonnes et diagonales comptent.',
  marbleWeaveStep3Title: 'Garder de la place',
  marbleWeaveStep3Body:
    'Sans ligne formée, les 3 billes annoncées arrivent. Annuler retire tout le coup, y compris les nouvelles billes.',
  marbleWeaveMode_easy: 'Facile',
  marbleWeaveMode_normal: 'Normal',
  marbleWeaveMode_hard: 'Difficile',
};
