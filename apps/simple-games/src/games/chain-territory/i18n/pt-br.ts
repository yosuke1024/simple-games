// AI translation; not reviewed by a native speaker.
import type { ChainTerritoryMessages } from './en';
export const ptBR: ChainTerritoryMessages = {
  chainTerritoryName: 'Chain Territory',
  chainTerritoryBest: 'Menos jogadas para vencer',
  chainTerritoryWins: 'Vitórias',
  chainTerritoryWon: 'Você venceu!',
  chainTerritoryLost: 'A CPU venceu',
  chainTerritoryYou: 'Você',
  chainTerritoryCpu: 'CPU',
  chainTerritoryEmpty: 'Vazia',
  chainTerritoryField: 'Tabuleiro de reação em cadeia',
  chainTerritoryCell: 'Linha {row}, coluna {col}: {owner}, {n} de {max}',
  chainTerritoryTurn: 'Coloque uma esfera em uma casa vazia ou sua.',
  chainTerritoryThinking: 'A CPU está pensando…',
  chainTerritoryChain: 'A reação está se espalhando…',
  chainTerritoryCapacity: 'Cantos: 2 · Bordas: 3 · Centro: 4',
  chainTerritoryStep1Title: 'Coloque uma esfera',
  chainTerritoryStep1Body:
    'Alterne turnos com a CPU. Acrescente uma esfera em uma casa vazia ou sua.',
  chainTerritoryStep2Title: 'Inicie uma reação',
  chainTerritoryStep2Body:
    'Com 2 no canto, 3 na borda ou 4 no centro, as esferas se espalham para as casas vizinhas e as capturam.',
  chainTerritoryStep3Title: 'Capture todas as esferas rivais',
  chainTerritoryStep3Body:
    'Após a primeira jogada de ambos, capture todas as esferas da CPU para vencer. Desfazer volta sua jogada e a resposta.',
  chainTerritoryMode_easy: 'Fácil',
  chainTerritoryMode_normal: 'Normal',
  chainTerritoryMode_hard: 'Difícil',
};
