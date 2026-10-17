/**
 * French catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const fr: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Choisir une grille',
  bridgesDifficulty_easy: 'Facile',
  bridgesDifficulty_medium: 'Moyen',
  bridgesDifficulty_hard: 'Difficile',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  bridgesConfirmSwitchBody: 'Votre grille {current} sera remplacée par une nouvelle grille {next}.',
  bridgesBoardLabel: 'Grille Bridges, {width} sur {height}, {islands} îles',
  bridgesIslandOpen: 'Île {value}, ligne {row}, colonne {col} : {count} sur {value} ponts',
  bridgesIslandComplete: 'Île {value}, ligne {row}, colonne {col} : complète',
  bridgesIslandOver: 'Île {value}, ligne {row}, colonne {col} : {count} ponts, c’est trop',
  bridgesIslandSelected: '{island}. Sélectionnée',
  bridgesIslandPartner: '{island}. Peut être reliée à l’île sélectionnée : {bridges} sur 2 ponts',
  bridgesIslandHinted: '{island}. Mise en évidence par l’indice',
  bridgesIslandHintRing: '{island}. Mise en évidence par l’indice, dans le cercle pointillé',
  bridgesAnnounceNone:
    'Aucun pont entre la ligne {row1}, colonne {col1} et la ligne {row2}, colonne {col2}',
  bridgesAnnounceOne:
    'Un pont entre la ligne {row1}, colonne {col1} et la ligne {row2}, colonne {col2}',
  bridgesAnnounceTwo:
    'Deux ponts entre la ligne {row1}, colonne {col1} et la ligne {row2}, colonne {col2}',
  bridgesSplitNote:
    'Tous les nombres sont atteints, mais les îles forment {groups} groupes. Reliez-les en un seul.',
  bridgesHintWrong: 'Trop de ponts entre les îles mises en évidence.',
  bridgesHintOne: 'La paire mise en évidence a besoin d’au moins un pont.',
  bridgesHintTwo: 'La paire mise en évidence a besoin de deux ponts.',
  bridgesHintOneAt:
    'D’après l’île au cercle pointillé, la paire mise en évidence a besoin d’au moins un pont.',
  bridgesHintTwoAt:
    'D’après l’île au cercle pointillé, la paire mise en évidence a besoin de deux ponts.',
  bridgesHintNone: 'Aucun coup certain trouvé à partir d’ici.',
  bridgesHintWhere:
    'Mises en évidence : ligne {row1}, colonne {col1} et ligne {row2}, colonne {col2}.',
  bridgesHintWhereRing:
    'Mises en évidence : ligne {row1}, colonne {col1} et ligne {row2}, colonne {col2}. Cercle pointillé : ligne {row}, colonne {col}.',
  bridgesSolvedTitle: 'Tout est relié !',
  bridgesSolvedBody: 'Toutes les îles forment un seul réseau.',
  bridgesHintsUsed: 'Indices utilisés',
  bridgesNewBestTime: 'Votre meilleur temps.',
  bridgesNewBoard: 'Nouvelle grille',
  bridgesSolvedCount: 'Grilles résolues',
  bridgesDailySection: 'Quotidien',
  bridgesDailiesCleared: 'Jours réussis',
  bridgesAllModes: 'Tous les modes',
  bridgesStep1Title: 'Les nombres comptent les ponts',
  bridgesStep1Body: 'Chaque île reçoit exactement autant de ponts que son nombre.',
  bridgesStep2Title: 'Tout droit, deux au plus',
  bridgesStep2Body:
    'Les ponts vont tout droit, à l’horizontale ou à la verticale, ne se croisent jamais, et deux au plus relient la même paire.',
  bridgesStep3Title: 'Tout relier',
  bridgesStep3Body:
    'Touchez une île, puis une partenaire cerclée pour ajouter un pont (encore pour deux, encore pour aucun), jusqu’à relier toutes les îles.',
};
