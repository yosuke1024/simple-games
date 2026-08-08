import type { HeartsMessages } from './en';

export const zhHant: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: '選擇對手',
  heartsDifficulty_easy: '簡單',
  heartsDifficulty_normal: '普通',
  heartsDifficulty_hard: '困難',
  heartsRecordNote: '{wins} 勝 · {losses} 敗 · {draws} 和',
  heartsConfirmSwitchTitle: '要替換進行中的對局嗎？',
  heartsConfirmSwitchBody: '進行中的「{current}」對局會被新的「{next}」對局取代。',

  heartsTableLabel: 'Hearts 牌桌',
  heartsHandLabel: '你的手牌',
  heartsTrickLabel: '這一墩',
  heartsTrayLabel: '你要傳出的牌',
  heartsYou: '你',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: '你：本局 {hand} 分，全場 {total} 分',
  heartsSeatLabel: 'CPU {n}：{cards} 張牌，本局 {hand} 分，全場 {total} 分',
  heartsTookLastTrick: '贏下了上一墩',
  heartsCardLabel: '{suit}{rank}',
  heartsSuit_spades: '黑桃',
  heartsSuit_hearts: '紅心',
  heartsSuit_diamonds: '方塊',
  heartsSuit_clubs: '梅花',
  heartsCardBlocked: '{card}，現在不能出',
  heartsCardChosen: '{card}，已選為傳出',
  heartsTrickCard: '{card}，{seat}',

  heartsPassPrompt: '選三張牌傳出去',
  heartsPassLeft: '向左傳牌',
  heartsPassAcross: '向對家傳牌',
  heartsPassRight: '向右傳牌',
  heartsPassConfirm: '傳出這三張',
  heartsPassWaiting: '等待其他座位…',

  heartsPlayPrompt: '點一下牌，再點一次打出去',
  heartsCpuTurn: 'CPU {n} 出牌中…',
  heartsTrickYou: '你贏下了這一墩',
  heartsTrickCpu: 'CPU {n} 贏下了這一墩',

  heartsHandTitle: '本局結算',
  heartsMoonTitle: '通吃',
  heartsMoonYou: '你把二十六分全收了，另外三家各得 26 分。',
  heartsMoonCpu: 'CPU {n} 把二十六分全收了，其餘各家都得 26 分。',
  heartsThisHand: '本局',
  heartsMatchTotal: '全場',
  heartsNextHand: '下一局',

  heartsWinTitle: '你贏了！',
  heartsWinBody: '有人超過一百分時，你的分數最少。',
  heartsLoseTitle: 'CPU 獲勝',
  heartsLoseBody: '別的座位以更少的分數結束。下一場對局免費。',
  heartsDrawTitle: '平手',
  heartsDrawBody: '你與另一個座位並列最少分。',
  heartsFinalScores: '最終得分',

  heartsWins: '勝',
  heartsLosses: '敗',
  heartsDraws: '和',

  heartsStep1Title: '傳出三張',
  heartsStep1Body:
    '多數牌局開始前都要挑三張牌傳給別人 — 先向左，再向右，然後對家，接著是誰都不傳的一局。',
  heartsStep2Title: '跟出同花色',
  heartsStep2Body: '首家出的牌定下花色，只要手裡還有就得跟出，該花色最大的一張贏下這一墩。',
  heartsStep3Title: '分最少者勝',
  heartsStep3Body:
    '收進來的每張紅心算一分，黑桃 Q 算十三分，所以有人超過一百分時，分數最少的一方獲勝。',
};
