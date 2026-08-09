import type { MahjongMessages } from './en';

export const fr: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Plateau de mahjong, {n} tuiles restantes',
  mahjongTilesLeft: '{n} tuiles restantes',

  mahjongFaceCharacters: 'Caractères {n}',
  mahjongFaceDots: 'Cercles {n}',
  mahjongFaceBamboo: 'Bambou {n}',
  mahjongFaceEast: "Vent d'Est",
  mahjongFaceSouth: 'Vent du Sud',
  mahjongFaceWest: "Vent d'Ouest",
  mahjongFaceNorth: 'Vent du Nord',
  mahjongFaceDragonRed: 'Dragon Rouge',
  mahjongFaceDragonGreen: 'Dragon Vert',
  mahjongFaceDragonWhite: 'Dragon Blanc',
  mahjongFaceFlower: 'Fleur {n}',
  mahjongFaceSeason: 'Saison {n}',

  mahjongTileFree: '{tile}, peut être prise',
  mahjongTileBlocked: '{tile}, bloquée',
  mahjongTileSelected: '{tile}, sélectionnée',

  mahjongStuckTitle: 'Aucune paire libre',
  mahjongStuckBody:
    'Annulez quelques coups ou recommencez ce plateau : les deux sont gratuits et illimités.',

  mahjongHintNone: "Aucune paire n'est libre pour le moment.",

  mahjongClearTitle: 'Terminé !',
  mahjongClearBody: 'Toutes les tuiles ont quitté le plateau.',
  mahjongHintsUsed: 'Indices utilisés',
  mahjongNewBestTime: 'Votre meilleur temps.',

  mahjongLevelsCleared: 'Niveaux terminés',
  mahjongDailiesCleared: 'Défis quotidiens terminés',
  mahjongDailyBacklogHint: 'Les jours précédents restent ouverts.',

  mahjongStep1Title: 'Prenez des paires identiques',
  mahjongStep1Body:
    'Touchez deux tuiles à la même face pour les retirer. Une tuile peut être prise quand rien ne repose dessus et que son côté gauche ou droit est libre.',
  mahjongStep2Title: 'Fleurs et saisons forment des groupes',
  mahjongStep2Body:
    "N'importe quelle fleur s'associe à n'importe quelle fleur, et n'importe quelle saison à n'importe quelle saison.",
  mahjongStep3Title: 'Videz le plateau',
  mahjongStep3Body:
    "Chaque plateau peut être terminé. S'il ne reste aucune paire, annulez ou recommencez : les deux sont gratuits et illimités.",
};
