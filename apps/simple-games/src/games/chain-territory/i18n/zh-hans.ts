// AI translation; not reviewed by a native speaker.
import type { ChainTerritoryMessages } from './en';
export const zhHans: ChainTerritoryMessages = {
  chainTerritoryName: 'Chain Territory',
  chainTerritoryBest: '获胜最少步数',
  chainTerritoryWins: '胜利次数',
  chainTerritoryWon: '你赢了！',
  chainTerritoryLost: 'CPU获胜',
  chainTerritoryYou: '你',
  chainTerritoryCpu: 'CPU',
  chainTerritoryEmpty: '空格',
  chainTerritoryField: '连锁反应棋盘',
  chainTerritoryCell: '第{row}行第{col}列：{owner}，{n} / {max}个',
  chainTerritoryTurn: '在空格或自己的格子里放一颗球。',
  chainTerritoryThinking: 'CPU正在思考…',
  chainTerritoryChain: '连锁反应正在扩散…',
  chainTerritoryCapacity: '角落2个 · 边缘3个 · 内部4个',
  chainTerritoryStep1Title: '放一颗球',
  chainTerritoryStep1Body: '与CPU轮流在空格或自己的格子里添加一颗球。',
  chainTerritoryStep2Title: '引发连锁',
  chainTerritoryStep2Body: '角落达到2个、边缘3个或内部4个时，球会分散到相邻格子并占领它们。',
  chainTerritoryStep3Title: '占领对手所有球',
  chainTerritoryStep3Body:
    '双方各走一步后，占领CPU的所有球即可获胜。撤销会一起退回你的走法和CPU的回应。',
  chainTerritoryMode_easy: '简单',
  chainTerritoryMode_normal: '普通',
  chainTerritoryMode_hard: '困难',
};
