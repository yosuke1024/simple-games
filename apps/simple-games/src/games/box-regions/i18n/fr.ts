/**
 * French catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const fr: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Choisir une grille',
  boxRegionsDifficulty_easy: 'Facile',
  boxRegionsDifficulty_medium: 'Moyen',
  boxRegionsDifficulty_hard: 'Difficile',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  boxRegionsConfirmSwitchBody:
    'Votre partie {current} sera remplacée par une nouvelle grille {next}.',
  boxRegionsBoardLabel: 'Grille Box Regions, {width} sur {height}',
  boxRegionsCellAssigned: 'Ligne {row}, colonne {col}, boîte {region}',
  boxRegionsCellEmpty: 'Ligne {row}, colonne {col}, non attribuée',
  boxRegionsClueCount: '{count} cases sur {size}',
  boxRegionsRuleBroken: 'enfreint une règle',
  boxRegionsKind_square: 'Carrée',
  boxRegionsKind_tall: 'Haute',
  boxRegionsKind_wide: 'Large',
  boxRegionsKind_free: 'Boîte libre',
  boxRegionsHintWrong: 'La boîte mise en évidence ne correspond pas à la solution.',
  boxRegionsHintForced:
    'La case marquée ne peut appartenir qu’à la boîte de l’indice mis en évidence.',
  boxRegionsHintSole: 'Cette boîte ne peut être tracée que d’une seule façon.',
  boxRegionsHintCommon:
    'Quelle que soit la façon de tracer la boîte de cet indice, elle couvre les cases marquées.',
  boxRegionsHintNone: 'Aucun coup certain trouvé pour l’instant.',
  boxRegionsSolvedTitle: 'Résolu !',
  boxRegionsSolvedBody: 'Chaque case est dans sa boîte.',
  boxRegionsHintsUsed: 'Aides utilisées',
  boxRegionsNewBestTime: 'Votre meilleur temps.',
  boxRegionsNewBoard: 'Nouvelle grille',
  boxRegionsSolvedCount: 'Grilles résolues',
  boxRegionsDailySection: 'Quotidien',
  boxRegionsDailiesCleared: 'Jours réussis',
  boxRegionsStep1Title: 'Découpez en boîtes',
  boxRegionsStep1Body: 'Découpez la grille en rectangles, chacun contenant exactement un indice.',
  boxRegionsStep2Title: 'Lisez les indices',
  boxRegionsStep2Body:
    'Le nombre est le nombre de cases de la boîte ; le symbole indique carrée, haute, large ou libre.',
  boxRegionsStep3Title: 'Tracez d’un coin à l’autre',
  boxRegionsStep3Body:
    'Faites glisser d’un coin à l’autre pour tracer une boîte. Touchez une boîte pour la supprimer. Bloqué ? Essayez une aide.',
};
