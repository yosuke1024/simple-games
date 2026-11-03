// AI translation; not reviewed by a native speaker.
import type { ChainTerritoryMessages } from './en';
export const ja: ChainTerritoryMessages = {
  chainTerritoryName: 'Chain Territory',
  chainTerritoryMode_easy: 'やさしい',
  chainTerritoryMode_normal: 'ふつう',
  chainTerritoryMode_hard: 'むずかしい',
  chainTerritoryBest: '勝利時の最少手数',
  chainTerritoryWins: '勝利数',
  chainTerritoryWon: 'あなたの勝ち！',
  chainTerritoryLost: 'CPUの勝ち',
  chainTerritoryYou: 'あなた',
  chainTerritoryCpu: 'CPU',
  chainTerritoryEmpty: '空き',
  chainTerritoryField: '連鎖する陣取り盤',
  chainTerritoryCell: '{row}行{col}列：{owner}、{n} / {max} 個',
  chainTerritoryTurn: '空きマスか自分のマスに玉を置こう。',
  chainTerritoryThinking: 'CPUが考えています…',
  chainTerritoryChain: '連鎖が広がっています…',
  chainTerritoryCapacity: '角は2個・辺は3個・中央は4個で連鎖',
  chainTerritoryStep1Title: '玉を置く',
  chainTerritoryStep1Body: 'CPUと交互に、空きマスか自分のマスへ玉を1個置きます。',
  chainTerritoryStep2Title: '連鎖を起こす',
  chainTerritoryStep2Body:
    '角は2個、辺は3個、中央は4個で玉が隣へ広がり、そのマスを自分のものにします。',
  chainTerritoryStep3Title: '相手の玉をすべて取る',
  chainTerritoryStep3Body:
    '両者が1手ずつ置いた後、CPUの玉をすべて取れば勝ち。待ったは相手の応手も戻します。',
};
