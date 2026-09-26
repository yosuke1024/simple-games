/**
 * Mancala's Japanese catalog. The title (`mancalaName`) is a proper noun and
 * stays as-is in every locale (docs/I18N_POLICY.md).
 */
import type { MancalaMessages } from './en';

export const ja: MancalaMessages = {
  mancalaName: 'Mancala',
  mancalaChooseOpponent: '対戦相手を選ぶ',
  mancalaDifficulty_easy: 'やさしい',
  mancalaDifficulty_normal: 'ふつう',
  mancalaDifficulty_hard: 'つよい',
  mancalaChooseSideLabel: 'どちらが先にまくか',
  mancalaGoFirst: '先攻',
  mancalaGoSecond: '後攻',
  mancalaRecordNote: '{wins}勝 · {losses}敗',
  mancalaBoardLabel: 'マンカラの盤面、片側6つの穴と両端の店',
  mancalaPitYou: '自分の穴{n}、石{count}個',
  mancalaPitCpu: 'CPUの穴{n}、石{count}個',
  mancalaStoreYou: '自分の店、石{count}個',
  mancalaStoreCpu: 'CPUの店、石{count}個',
  mancalaYou: 'あなた',
  mancalaCpu: 'CPU',
  mancalaYourTurn: 'あなたの番です',
  mancalaCpuTurn: 'CPUが考えています…',
  mancalaExtraTurn: 'もう1手!',
  mancalaCaptureYou: '{n}個取りました',
  mancalaCaptureCpu: 'CPUが{n}個取りました',
  mancalaWinTitle: 'あなたの勝ち!',
  mancalaWinBody: 'あなたの店のほうが、石が多くなりました。',
  mancalaLoseTitle: 'CPUの勝ち',
  mancalaLoseBody: 'CPUの店のほうが、石が多くなりました。',
  mancalaDrawTitle: '引き分け',
  mancalaDrawBody: 'どちらの店も24個ずつでした。',
  mancalaWins: '勝ち',
  mancalaLosses: '負け',
  mancalaDraws: '引き分け',
  mancalaStep1Title: '穴をタップしてまく',
  mancalaStep1Body: '石を1個ずつ反時計回りに入れていき、最後に自分の店の石が多ければ勝ちです。',
  mancalaStep2Title: '店で終わればもう1手',
  mancalaStep2Body: '最後の1個が自分の店に入ったら、続けてもう1手指せます。',
  mancalaStep3Title: '空の穴で終われば取れる',
  mancalaStep3Body:
    '最後の1個が自分側の空の穴に入ったら、その1個と向かいの石を自分の店へ入れます。',
  mancalaConfirmSwitchTitle: '対局中のゲームを置き換えますか?',
  mancalaConfirmSwitchBody: '「{current}」の対局は、新しい「{next}」の対局に置き換わります。',
};
