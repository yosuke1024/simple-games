// AI translation; not reviewed by a native speaker.
import type { ChainTerritoryMessages } from './en';
export const zhHant: ChainTerritoryMessages = {
  chainTerritoryName: 'Chain Territory',
  chainTerritoryBest: '獲勝最少步數',
  chainTerritoryWins: '勝利次數',
  chainTerritoryWon: '你贏了！',
  chainTerritoryLost: 'CPU獲勝',
  chainTerritoryYou: '你',
  chainTerritoryCpu: 'CPU',
  chainTerritoryEmpty: '空格',
  chainTerritoryField: '連鎖反應棋盤',
  chainTerritoryCell: '第{row}列第{col}欄：{owner}，{n} / {max}個',
  chainTerritoryTurn: '在空格或自己的格子裡放一顆球。',
  chainTerritoryThinking: 'CPU正在思考…',
  chainTerritoryChain: '連鎖反應正在擴散…',
  chainTerritoryCapacity: '角落2個 · 邊緣3個 · 內部4個',
  chainTerritoryStep1Title: '放一顆球',
  chainTerritoryStep1Body: '與CPU輪流在空格或自己的格子裡添加一顆球。',
  chainTerritoryStep2Title: '引發連鎖',
  chainTerritoryStep2Body: '角落達到2個、邊緣3個或內部4個時，球會分散到相鄰格子並佔領它們。',
  chainTerritoryStep3Title: '佔領對手所有球',
  chainTerritoryStep3Body:
    '雙方各走一步後，佔領CPU的所有球即可獲勝。復原會一起退回你的走法和CPU的回應。',
  chainTerritoryMode_easy: '簡單',
  chainTerritoryMode_normal: '普通',
  chainTerritoryMode_hard: '困難',
};
