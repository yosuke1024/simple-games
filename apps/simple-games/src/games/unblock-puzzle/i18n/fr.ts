/**
 * French catalog for Unblock Puzzle. Provenance: `machine` — written with
 * AI assistance from the English source; no native speaker has read it
 * (docs/UNBLOCK_PUZZLE_RULES.md §15, docs/I18N_POLICY.md「翻訳の状態は来歴と
 * 検証できた事実で書く」). The title (`unblockPuzzleName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 * Shared words (Undo, Hint, Moves, Daily Challenge, …) follow the shell's
 * src/i18n/locales/fr.ts.
 */
import type { UnblockPuzzleMessages } from './en';

export const fr: UnblockPuzzleMessages = {
  unblockPuzzleName: 'Unblock Puzzle',
  unblockPuzzleChooseBoard: 'Choisir une grille',
  unblockPuzzleDifficulty_easy: 'Facile',
  unblockPuzzleDifficulty_medium: 'Moyen',
  unblockPuzzleDifficulty_hard: 'Difficile',
  unblockPuzzleRange: '{min}–{max} coups',
  unblockPuzzleRangeOpen: '{min} coups ou plus',
  unblockPuzzleConfirmSwitchTitle: 'Remplacer la grille en cours ?',
  unblockPuzzleConfirmSwitchBody:
    'Votre grille {current} sera remplacée par une nouvelle grille {next}.',
  unblockPuzzleBoardLabel:
    'Grille de {cols} sur {rows}. La sortie est au bout droit de la ligne {row}.',
  unblockPuzzleBlockTarget:
    'Bloc cible, ligne {row}, colonnes {from} à {to}. Cases libres : {left} à gauche, {right} à droite.',
  unblockPuzzleBlockH:
    'Bloc horizontal, ligne {row}, colonnes {from} à {to}. Cases libres : {left} à gauche, {right} à droite.',
  unblockPuzzleBlockV:
    'Bloc vertical, colonne {col}, lignes {from} à {to}. Cases libres : {up} en haut, {down} en bas.',
  unblockPuzzleMovesStatus: 'Coups {moves} · minimum {min}',
  unblockPuzzleMoveLeft: 'Déplacer vers la gauche',
  unblockPuzzleMoveRight: 'Déplacer vers la droite',
  unblockPuzzleMoveUp: 'Déplacer vers le haut',
  unblockPuzzleMoveDown: 'Déplacer vers le bas',
  unblockPuzzleSelectPrompt: 'Touchez un bloc pour le déplacer',
  unblockPuzzleHintTarget: 'Indice : glissez le bloc cible jusqu’aux colonnes {toFrom}–{toTo}.',
  unblockPuzzleHintH:
    'Indice : glissez le bloc de la ligne {row}, colonnes {from}–{to}, jusqu’aux colonnes {toFrom}–{toTo}.',
  unblockPuzzleHintV:
    'Indice : glissez le bloc de la colonne {col}, lignes {from}–{to}, jusqu’aux lignes {toFrom}–{toTo}.',
  unblockPuzzleHintShown: 'Glissez le bloc marqué dans le cadre pointillé.',
  unblockPuzzleHintNone: 'Aucun coup trouvé à partir d’ici.',
  unblockPuzzleSolvedTitle: 'Terminé !',
  unblockPuzzleSolvedBody: 'Le bloc cible est sorti.',
  unblockPuzzleSolvedOptimal: 'Sorti en un minimum de coups.',
  unblockPuzzleFewestLabel: 'Minimum possible',
  unblockPuzzleNetCellsLabel: 'Déplacement net',
  unblockPuzzleHintsUsed: 'Indices utilisés',
  unblockPuzzleNewBestTime: 'Meilleur temps en {difficulty}.',
  unblockPuzzleNewBestDailyMoves: 'Votre minimum de coups du jour.',
  unblockPuzzleNewBoard: 'Nouvelle grille',
  unblockPuzzleSolvedCount: 'Grilles terminées',
  unblockPuzzleOptimalCount: 'Terminées en un minimum de coups',
  unblockPuzzleOverallSection: 'Global',
  unblockPuzzleDailiesCleared: 'Défis du jour terminés',
  unblockPuzzleStep1Title: 'Glisser dans son axe',
  unblockPuzzleStep1Body:
    'Chaque bloc ne glisse que dans son propre axe : de gauche à droite, ou de haut en bas.',
  unblockPuzzleStep2Title: 'Libérer la cible',
  unblockPuzzleStep2Body:
    'Faites sortir le bloc cible par la sortie à droite pour terminer la grille.',
  unblockPuzzleStep3Title: 'Un glissement, un coup',
  unblockPuzzleStep3Body:
    'Un glissement compte pour un coup, quelle que soit la distance, et Annuler et Indice sont toujours là.',
};
