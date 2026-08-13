import type { LudoMessages } from './en';

export const ja: LudoMessages = {
  ludoName: 'Ludo',
  ludoChooseOpponent: '対戦相手を選ぶ',
  ludoDifficulty_easy: 'やさしい',
  ludoDifficulty_normal: 'ふつう',
  ludoDifficulty_hard: 'むずかしい',
  ludoRecordNote: '{wins} 勝 · {losses} 敗',
  ludoConfirmSwitchTitle: '進行中の対局を置き換えますか?',
  ludoConfirmSwitchBody: '{current} の対局は、新しい {next} の対局に置き換わります。',

  ludoBoardLabel: 'Ludo の盤',
  ludoYou: 'あなた',
  ludoCpu: 'CPU {n}',
  ludoSeatHome: '4 個中 {home} 個が上がり',
  ludoSafeSquare: 'セーフマス',
  ludoWhereYard: 'ヤード',
  ludoWhereSquare: '{n} 番のマス',
  ludoWhereSafe: '{n} 番のセーフマス',
  ludoWhereColumn: 'ホーム列の {n} マス目',
  ludoWhereHome: '上がり',
  ludoPawnAt: '{seat}、{where}',
  ludoMovePawn: '{where} のコマを動かす',

  ludoRollAction: '振る',
  ludoRollLabel: 'ダイスを振る',
  ludoDieLabel: '出目は {die}',
  ludoDieUnrolled: 'まだ振っていません',
  ludoTurnRoll: 'あなたの番です。ダイスを振ってください。',
  ludoTurnMove: '出目は {die}。動かすコマをタップしてください。',
  ludoTurnCpu: 'CPU {n} の番です…',
  ludoAutoPass: 'その出目で動かせるコマがありません。パスします。',
  ludoThirdSix: '6 が 3 回続きました。この手番は終わりです。',
  ludoRollAgain: '6 が出ました。もう 1 回振れます。',

  ludoWinTitle: 'あなたの勝ち!',
  ludoWinBody: '4 個のコマがすべて上がりました。',
  ludoLoseTitle: 'CPU {n} の勝ち',
  ludoLoseBody: '相手のコマが 4 個とも上がりました。次の対局も無料です。',
  ludoNoContestTitle: '無勝負',
  ludoNoContestBody:
    '誰も上がらないまま投擲の上限に達しました。プレイ数には数えますが、勝ちにも負けにも数えません。',
  ludoWins: '勝ち',
  ludoLosses: '負け',

  ludoStep1Title: '6 が出るとコマが出走',
  ludoStep1Body:
    'ダイスを振ってから、動かすコマをタップします。タップできるのは規則が認めるコマだけで、ほかのコマは動きません。',
  ludoStep2Title: '6 が出たらもう 1 投',
  ludoStep2Body:
    '6 を出すともう一度振れます。ただし 6 が 3 回続くと、何も動かさずに手番が次へ移ります。',
  ludoStep3Title: '敵のコマに乗ると戻される',
  ludoStep3Body:
    'そのマスにいる敵のコマは、まとめて全部ヤードへ戻ります。セーフマスでは捕獲は起きません。捕獲してももう 1 投はもらえません — 追加の投擲を生むのは 6 の目だけです。',
  ludoStep4Title: '自分のコマを重ねても守りにならない',
  ludoStep4Body:
    '同じマスに自分のコマを 2 個置いても、通行止めにも守りにもなりません。敵に乗られるとそのマスのコマは全部まとめて戻されるので、重なりは砦ではなく的です。',
  ludoStep5Title: '上がりはちょうどの目で',
  ludoStep5Body:
    '上がりを超える出目では、そのコマは動かせません。4 個すべてを上がらせたら勝ちです。出目は対局のシードから決まり、1〜6 は同じ確率で出て、席によって変わることはありません。',
};
