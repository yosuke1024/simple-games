/**
 * Echo Pads — the Japanese catalog. Provenance (docs/ECHO_PADS_RULES.md §14):
 * written by an AI from the English source on 2026-10-22; the author has NOT
 * read it yet (the collection's `ja` is the author's own elsewhere, not here),
 * and no native speaker has either. The title (`echoPadsName`) stays
 * "Echo Pads".
 *
 * Terms (§14's glossary): pad パッド, sequence 列 (only in 「新しい列」),
 * length 長さ, Play 再生, Listen again 聞き直す, Stop 停止, Pace ペース
 * (ゆっくり / ふつう / はやい). Quick Rules follow §10's Japanese wording.
 */
import type { EchoPadsMessages } from './en';

export const ja: EchoPadsMessages = {
  echoPadsName: 'Echo Pads',

  echoPadsTier_4: '4 パッド',
  echoPadsTier_6: '6 パッド',
  echoPadsLength: '長さ {n}',
  echoPadsLevelDetail: '{tier}・長さ {length}',

  echoPadsPace: 'ペース',
  echoPadsPace_calm: 'ゆっくり',
  echoPadsPace_normal: 'ふつう',
  echoPadsPace_quick: 'はやい',

  echoPadsPlay: '再生',
  echoPadsListenAgain: '聞き直す',
  echoPadsStop: '停止',

  echoPadsRound: '長さ {k} / {target}',
  echoPadsStatusIdle: '再生を押すと、{k} 個のパッドが光って鳴ります。',
  echoPadsStatusPlaying: '{k} 個を再生中…',
  echoPadsStatusYourTurn: 'あなたの番: {k} 個のパッドを同じ順番にタップ。',
  echoPadsStatusAgain: '{k} 個を最初のパッドからもう一度タップ。',
  echoPadsStatusReview: 'このラウンドの {k} 個をもう一度再生中…',

  echoPadsMark_circle: '円',
  echoPadsMark_triangle: '三角',
  echoPadsMark_square: '四角',
  echoPadsMark_star: '星',
  echoPadsMark_diamond: 'ひし形',
  echoPadsMark_cross: '十字',
  echoPadsPos_topLeft: '左上',
  echoPadsPos_topMiddle: '上の中央',
  echoPadsPos_topRight: '右上',
  echoPadsPos_bottomLeft: '左下',
  echoPadsPos_bottomMiddle: '下の中央',
  echoPadsPos_bottomRight: '右下',
  echoPadsPadLabel: '{mark}、{position}',
  echoPadsPadsLabel: 'パッド',
  echoPadsExpectedLabel: '{pad}(次に押すはずだったパッド)',

  echoPadsMissTitle: '長さ {k} で挑戦が終わりました',
  echoPadsMissBody: '{k} 個のうち {index} 個目は {pad} でした。',
  echoPadsResultTitle: '{n} 個を返し切りました',
  echoPadsLongest: '返し切った最長',
  echoPadsLongestNone: 'なし',
  echoPadsReplays: '聞き直し',
  echoPadsPacesHeard: 'ペース',
  echoPadsNewSequence: '新しい列',

  echoPadsLevelCell: '{level}、{detail}',
  echoPadsLevelCellCleared: '{level}、{detail}、クリア済み',
  echoPadsReplaceTitle: '途中の挑戦を置き換えますか?',
  echoPadsReplaceBody: '{current} の挑戦は、{next} の新しい挑戦に置き換わります。',

  echoPadsStatStarted: '始めた挑戦',
  echoPadsStatCleared: 'クリア',
  echoPadsStatMissed: '間違いで終わった挑戦',
  echoPadsStatLevels: 'クリアしたレベル',
  echoPadsStatDays: '達成した日',

  echoPadsStep1Title: '聞く',
  echoPadsStep1Body:
    '▶ を押すとパッドが 1 つずつ光って鳴る — その順番を覚える(押し始める前なら何度でも聞き直せる)。',
  echoPadsStep2Title: '返す',
  echoPadsStep2Body: '覚えたら、同じ順番にパッドをタップする。',
  echoPadsStep3Title: 'のびる',
  echoPadsStep3Body: '返すたびに順番が 1 つ長くなる — 時間制限はない。',
};
