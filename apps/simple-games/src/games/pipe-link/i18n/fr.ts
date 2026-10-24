/**
 * French catalog for Pipe Link. Provenance (docs/PIPE_LINK_RULES.md §11):
 * machine-written by AI from the English source and **not read by any native
 * speaker** — not a reviewed translation. The title (`pipeLinkName`) is a
 * proper noun and stays as-is; placeholder names match the English source.
 */
import type { PipeLinkMessages } from './en';

export const fr: PipeLinkMessages = {
  pipeLinkName: 'Pipe Link',
  pipeLinkChooseBoard: 'Choisir une grille',
  pipeLinkDifficulty_easy: 'Facile',
  pipeLinkDifficulty_medium: 'Moyen',
  pipeLinkDifficulty_hard: 'Difficile',
  pipeLinkBoardNote: '{width}×{height}',
  pipeLinkConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  pipeLinkConfirmSwitchBody:
    'Votre grille {current} sera remplacée par une nouvelle grille {next}.',
  pipeLinkBoardLabel: 'Grille Pipe Link, {width} sur {height}',
  pipeLinkTile: 'Ligne {row}, colonne {col} : {pipes}, {light}',
  pipeLinkTileSource: 'Ligne {row}, colonne {col}, la source : {pipes}, {light}',
  pipeLinkTileHinted: '{tile}. Indice : à tourner en {pipes}',
  pipeLinkLit: 'en eau',
  pipeLinkUnlit: 'à sec',
  pipeLinkPipes_end_0: 'bout, ouvert en haut',
  pipeLinkPipes_end_1: 'bout, ouvert à droite',
  pipeLinkPipes_end_2: 'bout, ouvert en bas',
  pipeLinkPipes_end_3: 'bout, ouvert à gauche',
  pipeLinkPipes_straight_0: 'droit, haut et bas',
  pipeLinkPipes_straight_1: 'droit, gauche et droite',
  pipeLinkPipes_elbow_0: 'coude, haut et droite',
  pipeLinkPipes_elbow_1: 'coude, droite et bas',
  pipeLinkPipes_elbow_2: 'coude, bas et gauche',
  pipeLinkPipes_elbow_3: 'coude, gauche et haut',
  pipeLinkPipes_tee_0: 'T, haut, droite et bas',
  pipeLinkPipes_tee_1: 'T, droite, bas et gauche',
  pipeLinkPipes_tee_2: 'T, bas, gauche et haut',
  pipeLinkPipes_tee_3: 'T, gauche, haut et droite',
  pipeLinkAnnounce: 'Ligne {row}, colonne {col} : {pipes}. {lit} tuiles sur {total} en eau.',
  pipeLinkHintNote:
    'Tournez la tuile dans l’anneau pointillé jusqu’à ce que ses tuyaux suivent les tuyaux pâles.',
  pipeLinkHintWhere: 'Marquée : ligne {row}, colonne {col}. À tourner en {pipes}.',
  pipeLinkSolvedTitle: 'Toutes les tuiles en eau',
  pipeLinkSolvedBody: 'L’eau atteint les {tiles} tuiles.',
  pipeLinkBoardSize: 'Grille',
  pipeLinkHintsUsed: 'Indices utilisés',
  pipeLinkNewBestTime: 'Votre meilleur temps.',
  pipeLinkNewBoard: 'Nouvelle grille',
  pipeLinkSolvedCount: 'Grilles résolues',
  pipeLinkDailySection: 'Quotidien',
  pipeLinkDailiesCleared: 'Jours réussis',
  pipeLinkAllModes: 'Tous les modes',
  pipeLinkStep1Title: 'Touchez pour tourner',
  pipeLinkStep1Body: 'Touchez une tuile pour la tourner d’un quart de tour dans le sens horaire.',
  pipeLinkStep2Title: 'L’eau circule',
  pipeLinkStep2Body:
    'Les tuyaux reliés à la source se remplissent d’eau ; les autres restent vides.',
  pipeLinkStep3Title: 'Remplissez tout',
  pipeLinkStep3Body: 'Quand tous les tuyaux sont pleins, la grille est terminée.',
};
