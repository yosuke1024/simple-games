import type { MahjongMessages } from './en';

export const ptBR: MahjongMessages = {
  mahjongName: 'Mahjong Solitaire',
  mahjongBoardLabel: 'Tabuleiro de mahjong, restam {n} peças',
  mahjongTilesLeft: 'Restam {n} peças',

  mahjongFaceCharacters: 'Caracteres {n}',
  mahjongFaceDots: 'Círculos {n}',
  mahjongFaceBamboo: 'Bambu {n}',
  mahjongFaceEast: 'Vento Leste',
  mahjongFaceSouth: 'Vento Sul',
  mahjongFaceWest: 'Vento Oeste',
  mahjongFaceNorth: 'Vento Norte',
  mahjongFaceDragonRed: 'Dragão Vermelho',
  mahjongFaceDragonGreen: 'Dragão Verde',
  mahjongFaceDragonWhite: 'Dragão Branco',
  mahjongFaceFlower: 'Flor {n}',
  mahjongFaceSeason: 'Estação {n}',

  mahjongTileFree: '{tile}, pode ser pega',
  mahjongTileBlocked: '{tile}, bloqueada',
  mahjongTileSelected: '{tile}, selecionada',

  mahjongStuckTitle: 'Nenhum par livre',
  mahjongStuckBody:
    'Desfaça algumas jogadas ou tente este tabuleiro de novo: os dois são grátis e sem limite.',

  mahjongHintNone: 'Nenhum par está livre agora.',

  mahjongClearTitle: 'Concluído!',
  mahjongClearBody: 'Todas as peças saíram do tabuleiro.',
  mahjongHintsUsed: 'Dicas usadas',
  mahjongNewBestTime: 'Seu melhor tempo.',

  mahjongLevelsCleared: 'Níveis concluídos',
  mahjongDailiesCleared: 'Diários concluídos',
  mahjongDailyBacklogHint: 'Os dias anteriores continuam abertos.',

  mahjongStep1Title: 'Pegue pares iguais',
  mahjongStep1Body:
    'Toque em duas peças com a mesma face para removê-las. Uma peça pode ser pega quando nada está sobre ela e o lado esquerdo ou direito está livre.',
  mahjongStep2Title: 'Flores e estações formam grupos',
  mahjongStep2Body:
    'Qualquer flor combina com qualquer flor, e qualquer estação com qualquer estação.',
  mahjongStep3Title: 'Limpe o tabuleiro',
  mahjongStep3Body:
    'Todo tabuleiro pode ser concluído. Se não houver pares, desfaça ou tente de novo: os dois são grátis e sem limite.',
};
