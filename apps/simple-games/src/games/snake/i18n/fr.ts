import type { SnakeMessages } from './en';

export const fr: SnakeMessages = {
  snakeName: 'Snake',
  snakeBoardLabel: 'Plateau de Snake, longueur {n}',
  snakeLength: 'Longueur',
  snakeBestScore: 'Meilleur score',
  snakeBestLength: 'Serpent le plus long',
  snakeOverTitle: 'La partie est finie',
  snakeOverBody: 'Réessayer est gratuit — un nouveau plateau démarre aussitôt.',
  snakeFullTitle: 'Tout le plateau !',
  snakeFullBody: 'Il ne reste plus de place pour grandir.',
  snakeNewBestScore: 'Ton meilleur score à ce jour.',
  snakeStep1Title: 'Glisse pour tourner',
  snakeStep1Body: 'Le serpent ne s’arrête jamais ; glisser change seulement la direction.',
  snakeStep2Title: 'Mange pour grandir',
  snakeStep2Body: 'Chaque aliment ajoute un anneau et rend le serpent un peu plus rapide.',
  snakeStep3Title: 'Attention aux murs',
  snakeStep3Body:
    'Toucher un mur ou ton propre corps met fin à la partie, et recommencer est toujours gratuit.',
};
