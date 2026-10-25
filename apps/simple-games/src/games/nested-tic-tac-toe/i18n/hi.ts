/**
 * Nested Tic-Tac-Toe — the Hindi catalog. Provenance
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §12): `machine` — written by an AI from
 * the English source on 2026-10-21; no native speaker has read it. The title
 * (`nestedTicTacToeName`) is a proper noun and stays as-is.
 *
 * Glossary (§12), one word each: small board = छोटा बोर्ड · square = खाना ·
 * send = भेजना · take / taken = कब्ज़ा करना / कब्ज़ा (never "जीतना", which is
 * the match) · closed = बंद · open = खुला · first / second = पहले / बाद में ·
 * cross / circle = क्रॉस / गोला.
 */
import type { NestedTicTacToeMessages } from './en';

export const hi: NestedTicTacToeMessages = {
  nestedTicTacToeName: 'Nested Tic-Tac-Toe',
  nestedTicTacToeChooseOpponent: 'अपना प्रतिद्वंद्वी चुनें',
  nestedTicTacToeDifficulty_easy: 'आसान',
  nestedTicTacToeDifficulty_normal: 'सामान्य',
  nestedTicTacToeDifficulty_hard: 'कठिन',
  nestedTicTacToeRecordNote: '{wins} जीत · {losses} हार',
  nestedTicTacToeChooseSideLabel: 'पहले कौन चलेगा',
  nestedTicTacToePlayFirst: 'पहले',
  nestedTicTacToePlaySecond: 'बाद में',
  nestedTicTacToePlayFirstLabel: 'पहले, क्रॉस से',
  nestedTicTacToePlaySecondLabel: 'बाद में, गोले से',
  nestedTicTacToeConfirmSwitchTitle: 'चालू बाज़ी बदलें?',
  nestedTicTacToeConfirmSwitchBody: 'आपकी {current} बाज़ी नई {next} बाज़ी से बदल जाएगी।',
  nestedTicTacToeBoardLabel: 'Nested Tic-Tac-Toe बोर्ड, नौ छोटे बोर्ड',
  nestedTicTacToeSmallOpen: 'छोटा बोर्ड {board}: खुला',
  nestedTicTacToeSmallPlayable: 'छोटा बोर्ड {board}: खुला, यहाँ खेलें',
  nestedTicTacToeSmallMine: 'छोटा बोर्ड {board}: आपका कब्ज़ा',
  nestedTicTacToeSmallCpu: 'छोटा बोर्ड {board}: CPU का कब्ज़ा',
  nestedTicTacToeSmallOpponent: 'छोटा बोर्ड {board}: {player} का कब्ज़ा',
  nestedTicTacToeSmallDrawn: 'छोटा बोर्ड {board}: बराबरी (बंद)',
  nestedTicTacToeCellEmpty: 'छोटा बोर्ड {board}, खाना {square}: खाली',
  nestedTicTacToeCellPlayable: 'छोटा बोर्ड {board}, खाना {square}: यहाँ खेलें',
  nestedTicTacToeCellYourCross: 'छोटा बोर्ड {board}, खाना {square}: आपका क्रॉस',
  nestedTicTacToeCellYourCircle: 'छोटा बोर्ड {board}, खाना {square}: आपका गोला',
  nestedTicTacToeCellCpuCross: 'छोटा बोर्ड {board}, खाना {square}: CPU का क्रॉस',
  nestedTicTacToeCellOpponentCross: 'छोटा बोर्ड {board}, खाना {square}: {player} का क्रॉस',
  nestedTicTacToeCellCpuCircle: 'छोटा बोर्ड {board}, खाना {square}: CPU का गोला',
  nestedTicTacToeCellOpponentCircle: 'छोटा बोर्ड {board}, खाना {square}: {player} का गोला',
  nestedTicTacToeYourTurnSent: 'आपकी बारी — फ्रेम वाले बोर्ड में खेलें',
  nestedTicTacToeYourTurnFree: 'आपकी बारी — किसी भी खुले बोर्ड में खेलें',
  nestedTicTacToeCpuTurn: 'CPU की बारी',
  nestedTicTacToeWinTitle: 'आप जीते',
  nestedTicTacToeWinBody: 'आपके तीन बोर्ड एक पंक्ति में।',
  nestedTicTacToeLoseTitle: 'CPU जीता',
  nestedTicTacToeLoseBody: 'CPU ने एक पंक्ति में तीन बोर्डों पर कब्ज़ा किया।',
  nestedTicTacToeDrawTitle: 'बराबरी',
  nestedTicTacToeDrawBody:
    'सभी छोटे बोर्ड बंद हो गए, और किसी के भी तीन बोर्ड एक पंक्ति में नहीं हैं।',
  nestedTicTacToeBoardsYou: 'आपके बोर्ड',
  nestedTicTacToeBoardsCpu: 'CPU के बोर्ड',
  nestedTicTacToeWins: 'जीत',
  nestedTicTacToeLosses: 'हार',
  nestedTicTacToeDraws: 'बराबरी',
  nestedTicTacToeStep1Title: 'आपकी चाल प्रतिद्वंद्वी को भेजती है',
  nestedTicTacToeStep1Body:
    'छोटे बोर्ड में आप जिस खाने में खेलते हैं, उसी से तय होता है कि प्रतिद्वंद्वी अगली बार किस बोर्ड में खेलेगा।',
  nestedTicTacToeStep2Title: 'कब्ज़े में या भरा: कोई भी खुला बोर्ड',
  nestedTicTacToeStep2Body:
    'अगर वह बोर्ड कब्ज़े में है या भरा है, तो किसी भी खुले बोर्ड में खेलें।',
  nestedTicTacToeStep3Title: 'एक पंक्ति में तीन बोर्ड',
  nestedTicTacToeStep3Body:
    'एक पंक्ति में तीन बनाकर छोटे बोर्ड पर कब्ज़ा करें; कब्ज़े वाले तीन बोर्ड एक पंक्ति में हों तो जीत।',
};
