import type { BubblePopMessages } from './en';

export const fr: BubblePopMessages = {
  bubbleName: 'Bubble Pop',
  bubbleBoardLabel: 'Plateau de Bubble Pop',
  bubbleShotsLabel: '{n} tirs avant que le plafond descende',
  bubbleCurrentLabel: 'Bulle actuelle : {color}',
  bubbleNextLabel: 'Bulle suivante : {color}',
  bubbleSwapLabel: 'Échanger la bulle actuelle et la suivante',
  bubbleAimLabel: 'Visée — atterrissage ligne {row}, colonne {col}',
  bubbleClearedTitle: 'Plateau nettoyé !',
  bubbleClearedBody: 'Toutes les bulles sont tombées.',
  bubbleFailedTitle: 'Pas cette fois',
  bubbleFailedBody: 'Réessayer est gratuit — même plateau, mêmes bulles.',
  bubbleStep1Title: 'Fais glisser pour viser',
  bubbleStep1Body:
    'La ligne de guidage montre toujours exactement où la bulle va atterrir — gratuit, toujours actif.',
  bubbleStep2Title: '3 alignées éclatent',
  bubbleStep2Body:
    'Regroupe 3 bulles de la même couleur ou plus et elles éclatent. Les bulles qui restent en suspens tombent aussi.',
  bubbleStep3Title: 'Le plafond descend peu à peu',
  bubbleStep3Body:
    "Tous les quelques tirs, le plafond descend d'une ligne. Nettoie les bulles avant que l'une n'atteigne la ligne pointillée.",
  bubbleColor_blue: 'bleu',
  bubbleColor_green: 'vert',
  bubbleColor_yellow: 'jaune',
  bubbleColor_purple: 'violet',
  bubbleColor_orange: 'orange',
  bubbleColor_cyan: 'cyan',
};
