import type { HeartsMessages } from './en';

export const ja: HeartsMessages = {
  heartsName: 'Hearts',

  heartsChooseOpponent: '対戦相手を選ぶ',
  heartsDifficulty_easy: 'やさしい',
  heartsDifficulty_normal: 'ふつう',
  heartsDifficulty_hard: 'つよい',
  heartsRecordNote: '{wins}勝 · {losses}敗 · {draws}引き分け',
  heartsConfirmSwitchTitle: '進行中の対局を置き換えますか?',
  heartsConfirmSwitchBody: '{current}の対局は破棄され、{next}の対局が始まります。',

  heartsTableLabel: 'ハーツの場',
  heartsHandLabel: '自分の手札',
  heartsTrickLabel: '場のトリック',
  heartsTrayLabel: 'パスする札',
  heartsYou: 'あなた',
  heartsCpuSeat: 'CPU {n}',
  heartsYouLabel: 'あなた: このハンド{hand}点、通算{total}点',
  heartsSeatLabel: 'CPU {n}: 手札{cards}枚、このハンド{hand}点、通算{total}点',
  heartsTookLastTrick: '直前のトリックを取りました',
  heartsCardLabel: '{suit}の{rank}',
  heartsSuit_spades: 'スペード',
  heartsSuit_hearts: 'ハート',
  heartsSuit_diamonds: 'ダイヤ',
  heartsSuit_clubs: 'クラブ',
  heartsCardBlocked: '{card}、いまは出せません',
  heartsCardChosen: '{card}、パスに選択中',
  heartsTrickCard: '{card}、{seat}',

  heartsPassPrompt: 'パスする札を3枚選びます',
  heartsPassLeft: '左へパス',
  heartsPassAcross: '対面へパス',
  heartsPassRight: '右へパス',
  heartsPassConfirm: 'この3枚をパス',
  heartsPassWaiting: 'ほかの席を待っています…',

  heartsPlayPrompt: '札をタップし、もう一度タップで出します',
  heartsCpuTurn: 'CPU {n}が考えています…',
  heartsTrickYou: 'あなたがトリックを取りました',
  heartsTrickCpu: 'CPU {n}がトリックを取りました',

  heartsHandTitle: 'ハンドの清算',
  heartsMoonTitle: 'ムーンシュート',
  heartsMoonYou: 'あなたが26点すべてを取ったので、ほかの3席に26点ずつ入ります。',
  heartsMoonCpu: 'CPU {n}が26点すべてを取ったので、ほかの全員に26点ずつ入ります。',
  heartsThisHand: 'このハンド',
  heartsMatchTotal: '通算',
  heartsNextHand: '次のハンドへ',

  heartsWinTitle: 'あなたの勝ち!',
  heartsWinBody: '誰かが100点に届いた時点で、最も少ない点でした。',
  heartsLoseTitle: 'CPUの勝ち',
  heartsLoseBody: 'ほかの席のほうが少ない点で終わりました。次の対局は無料です。',
  heartsDrawTitle: '引き分け',
  heartsDrawBody: 'ほかの席と並んで最少点で終わりました。',
  heartsFinalScores: '最終スコア',

  heartsWins: '勝ち',
  heartsLosses: '負け',
  heartsDraws: '引き分け',

  heartsStep1Title: '3枚をパス',
  heartsStep1Body:
    'ほとんどのハンドでは、最初に3枚を選んで渡します — 左、右、対面、そして誰も渡さないハンドの順です。',
  heartsStep2Title: 'スートを追う',
  heartsStep2Body:
    '最初に出た札のスートが基準で、そのスートを持っている限り合わせて出し、いちばん強い札がトリックを取ります。',
  heartsStep3Title: '最少点が勝ち',
  heartsStep3Body:
    '取ったハートは1枚1点、スペードのQは13点なので、誰かが100点を超えた時点で最も少ない点の勝ちです。',
};
