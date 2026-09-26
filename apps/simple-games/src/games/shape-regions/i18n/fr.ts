/**
 * French catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const fr: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Choisir une grille',
  shapeRegionsDifficulty_easy: 'Facile',
  shapeRegionsDifficulty_medium: 'Moyen',
  shapeRegionsDifficulty_hard: 'Difficile',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  shapeRegionsConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle grille {next}.',
  shapeRegionsBoardLabel: 'Grille Shape Regions, {width} sur {height}',
  shapeRegionsCellAssigned: 'Ligne {row}, colonne {col}, forme {region}',
  shapeRegionsCellEmpty: 'Ligne {row}, colonne {col}, non attribuée',
  shapeRegionsClueCount: '{count} cases sur {size}',
  shapeRegionsRuleBroken: 'enfreint une règle',
  shapeRegionsShape_line: 'Ligne',
  shapeRegionsShape_block: 'Rectangle',
  shapeRegionsShape_corner: 'Angle',
  shapeRegionsShape_tee: 'Forme en T',
  shapeRegionsShape_step: 'Escalier',
  shapeRegionsHintWrong: 'La forme mise en évidence ne correspond pas à la solution.',
  shapeRegionsHintForced: 'La case marquée ne peut appartenir qu’à la forme mise en évidence.',
  shapeRegionsHintSole: 'La forme mise en évidence n’a qu’une seule position possible.',
  shapeRegionsHintCommon:
    'Quelle que soit sa position, la forme mise en évidence contient les cases marquées.',
  shapeRegionsHintNone: 'Aucun coup certain trouvé pour l’instant.',
  shapeRegionsSolvedTitle: 'Résolu !',
  shapeRegionsSolvedBody: 'Chaque case appartient à sa forme.',
  shapeRegionsHintsUsed: 'Indices utilisés',
  shapeRegionsNewBestTime: 'Votre meilleur temps.',
  shapeRegionsNewBoard: 'Nouvelle grille',
  shapeRegionsSolvedCount: 'Grilles résolues',
  shapeRegionsDailySection: 'Quotidien',
  shapeRegionsDailiesCleared: 'Jours réussis',
  shapeRegionsDailyBacklogHint: 'Chaque jour précédent reste ouvert.',
  shapeRegionsStep1Title: 'Nombre et symbole',
  shapeRegionsStep1Body: 'Le nombre indique combien de cases a la forme ; le symbole, son aspect.',
  shapeRegionsStep2Title: 'Étendre depuis l’indice',
  shapeRegionsStep2Body: 'Glissez depuis un indice sur les cases voisines pour agrandir sa forme.',
  shapeRegionsStep3Title: 'Remplir la grille',
  shapeRegionsStep3Body:
    'À la fin, chaque case appartient à une forme. Touchez une case pour la retirer.',
};
