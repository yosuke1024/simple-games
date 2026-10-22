/**
 * Hindi catalog for Pipe Link. Provenance (docs/PIPE_LINK_RULES.md §11):
 * machine-written by AI from the English source and **not read by any native
 * speaker** — not a reviewed translation. The title (`pipeLinkName`) is a
 * proper noun and stays as-is; placeholder names match the English source.
 */
import type { PipeLinkMessages } from './en';

export const hi: PipeLinkMessages = {
  pipeLinkName: 'Pipe Link',
  pipeLinkChooseBoard: 'बोर्ड चुनें',
  pipeLinkDifficulty_easy: 'आसान',
  pipeLinkDifficulty_medium: 'मध्यम',
  pipeLinkDifficulty_hard: 'कठिन',
  pipeLinkBoardNote: '{width}×{height}',
  pipeLinkConfirmSwitchTitle: 'चालू बोर्ड बदलें?',
  pipeLinkConfirmSwitchBody: 'आपका {current} बोर्ड नए {next} बोर्ड से बदल दिया जाएगा।',
  pipeLinkBoardLabel: 'Pipe Link बोर्ड, {width} गुणा {height}',
  pipeLinkTile: 'पंक्ति {row}, स्तंभ {col}: {pipes}, {light}',
  pipeLinkTileSource: 'पंक्ति {row}, स्तंभ {col}, स्रोत: {pipes}, {light}',
  pipeLinkTileHinted: '{tile}। संकेत: {pipes} तक घुमाएँ',
  pipeLinkLit: 'पानी पहुँचा',
  pipeLinkUnlit: 'पानी नहीं पहुँचा',
  pipeLinkPipes_end_0: 'सिरा, ऊपर खुला',
  pipeLinkPipes_end_1: 'सिरा, दाएँ खुला',
  pipeLinkPipes_end_2: 'सिरा, नीचे खुला',
  pipeLinkPipes_end_3: 'सिरा, बाएँ खुला',
  pipeLinkPipes_straight_0: 'सीधा, ऊपर और नीचे',
  pipeLinkPipes_straight_1: 'सीधा, बाएँ और दाएँ',
  pipeLinkPipes_elbow_0: 'मोड़, ऊपर और दाएँ',
  pipeLinkPipes_elbow_1: 'मोड़, दाएँ और नीचे',
  pipeLinkPipes_elbow_2: 'मोड़, नीचे और बाएँ',
  pipeLinkPipes_elbow_3: 'मोड़, बाएँ और ऊपर',
  pipeLinkPipes_tee_0: 'T, ऊपर, दाएँ और नीचे',
  pipeLinkPipes_tee_1: 'T, दाएँ, नीचे और बाएँ',
  pipeLinkPipes_tee_2: 'T, नीचे, बाएँ और ऊपर',
  pipeLinkPipes_tee_3: 'T, बाएँ, ऊपर और दाएँ',
  pipeLinkAnnounce:
    'पंक्ति {row}, स्तंभ {col}: {pipes}। {total} में से {lit} टाइलों तक पानी पहुँचा।',
  pipeLinkHintNote:
    'बिंदीदार घेरे वाली टाइल को तब तक घुमाएँ जब तक उसके पाइप हल्के पाइपों से न मिल जाएँ।',
  pipeLinkHintWhere: 'चिह्नित: पंक्ति {row}, स्तंभ {col}। इसे {pipes} तक घुमाएँ।',
  pipeLinkSolvedTitle: 'हर टाइल तक पानी पहुँच गया',
  pipeLinkSolvedBody: 'पानी सभी {tiles} टाइलों तक पहुँचता है।',
  pipeLinkBoardSize: 'बोर्ड',
  pipeLinkHintsUsed: 'इस्तेमाल हुए संकेत',
  pipeLinkNewBestTime: 'आपका सबसे तेज़ समय।',
  pipeLinkNewBoard: 'नया बोर्ड',
  pipeLinkSolvedCount: 'हल किए बोर्ड',
  pipeLinkDailySection: 'दैनिक',
  pipeLinkDailiesCleared: 'पूरे किए दिन',
  pipeLinkAllModes: 'सभी मोड',
  pipeLinkStep1Title: 'घुमाने के लिए टैप करें',
  pipeLinkStep1Body: 'किसी टाइल पर टैप करें, वह घड़ी की दिशा में चौथाई चक्कर घूमेगी।',
  pipeLinkStep2Title: 'पानी बहता है',
  pipeLinkStep2Body: 'स्रोत से जुड़े पाइप पानी से भर जाते हैं; बाकी खाली रहते हैं।',
  pipeLinkStep3Title: 'हर पाइप भरें',
  pipeLinkStep3Body: 'जब हर पाइप भर जाए, बोर्ड पूरा हो जाता है।',
};
