import type { HeartsMessages } from './en';

export const zhHans: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: '选择对手',
  heartsDifficulty_easy: '简单',
  heartsDifficulty_normal: '普通',
  heartsDifficulty_hard: '困难',
  heartsRecordNote: '{wins} 胜 · {losses} 负 · {draws} 平',
  heartsConfirmSwitchTitle: '替换进行中的对局？',
  heartsConfirmSwitchBody: '进行中的“{current}”对局会被新的“{next}”对局替换。',

  heartsTableLabel: 'Hearts 牌桌',
  heartsHandLabel: '你的手牌',
  heartsTrickLabel: '这一墩',
  heartsTrayLabel: '你要传出的牌',
  heartsYou: '你',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: '你：本局 {hand} 分，全场 {total} 分',
  heartsSeatLabel: 'CPU {n}：{cards} 张牌，本局 {hand} 分，全场 {total} 分',
  heartsTookLastTrick: '赢下了上一墩',
  heartsCardLabel: '{suit}{rank}',
  heartsSuit_spades: '黑桃',
  heartsSuit_hearts: '红心',
  heartsSuit_diamonds: '方块',
  heartsSuit_clubs: '梅花',
  heartsCardBlocked: '{card}，现在不能出',
  heartsCardChosen: '{card}，已选为传出',
  heartsTrickCard: '{card}，{seat}',

  heartsPassPrompt: '选三张牌传出去',
  heartsPassLeft: '向左传牌',
  heartsPassAcross: '向对家传牌',
  heartsPassRight: '向右传牌',
  heartsPassConfirm: '传出这三张',
  heartsPassWaiting: '等待其他座位…',

  heartsPlayPrompt: '点按一张牌，再点一次打出去',
  heartsCpuTurn: 'CPU {n} 出牌中…',
  heartsTrickYou: '你赢下了这一墩',
  heartsTrickCpu: 'CPU {n} 赢下了这一墩',

  heartsHandTitle: '本局结算',
  heartsMoonTitle: '通吃',
  heartsMoonYou: '你把二十六分全收了，另外三家各得 26 分。',
  heartsMoonCpu: 'CPU {n} 把二十六分全收了，其余各家都得 26 分。',
  heartsThisHand: '本局',
  heartsMatchTotal: '全场',
  heartsNextHand: '下一局',

  heartsWinTitle: '你赢了！',
  heartsWinBody: '有人超过一百分时，你的分数最少。',
  heartsLoseTitle: 'CPU 获胜',
  heartsLoseBody: '别的座位以更少的分数结束。下一场对局免费。',
  heartsDrawTitle: '平局',
  heartsDrawBody: '你与另一个座位并列最少分。',
  heartsFinalScores: '最终得分',

  heartsWins: '胜',
  heartsLosses: '负',
  heartsDraws: '平',

  heartsStep1Title: '传出三张',
  heartsStep1Body:
    '多数牌局开始前都要挑三张牌传给别人 — 先向左，再向右，然后对家，接着是谁都不传的一局。',
  heartsStep2Title: '跟出同花色',
  heartsStep2Body: '首家出的牌定下花色，只要手里还有就得跟出，该花色最大的一张赢下这一墩。',
  heartsStep3Title: '分最少者胜',
  heartsStep3Body:
    '收进来的每张红心算一分，黑桃 Q 算十三分，所以有人超过一百分时，分数最少的一方获胜。',
};
