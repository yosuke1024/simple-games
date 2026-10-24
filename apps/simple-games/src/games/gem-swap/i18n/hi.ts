/**
 * Hindi catalog for Gem Swap.
 *
 * Provenance (docs/GEM_SWAP_RULES.md §11, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI from the English source on 2026-10-22. **No native speaker
 * has read it, and neither has the author**; it is not to be treated as
 * reviewed. The title (`gemSwapName`) is a proper noun and stays as it is.
 *
 * Terms: `अदला-बदली` for a swap, `पंक्ति` for a line of three, `राउंड` for a round, `रत्न` for
 * a gem, `शृंखला` for the cascade, `रिकॉर्ड` / `सर्वश्रेष्ठ` for a best (Snake), `स्कोर` for
 * the score (shell `score`). The stuck ending is a fact about the board, never `हार` or `गेम
 * खत्म`.
 */
import type { GemSwapMessages } from './en';

export const hi: GemSwapMessages = {
  gemSwapName: 'Gem Swap',
  gemSwapKinds: 'रत्न',
  gemSwapKinds_5: '5 · आसान',
  gemSwapKinds_6: '6 · सामान्य',
  gemSwapKindsCount: '{count} तरह के रत्न',
  gemSwapResumeNote: 'स्कोर {score} · {kinds}',
  gemSwapBestNote: 'सर्वश्रेष्ठ {score}',
  gemSwapBestFor: 'सर्वश्रेष्ठ, {kinds}',
  gemSwapSwapsLeft: '{count} अदला-बदली बाकी',
  gemSwapBoardLabel: 'रत्नों का बोर्ड, {size} × {size}',
  gemSwapCell: 'पंक्ति {row}, स्तंभ {col}, {gem}',
  gemSwapCellSelected: 'पंक्ति {row}, स्तंभ {col}, {gem}, चुना हुआ',
  gemSwapGem_hexagon: 'षट्भुज',
  gemSwapGem_octagon: 'अष्टभुज',
  gemSwapGem_pear: 'बूँद',
  gemSwapGem_marquise: 'नाव-आकार',
  gemSwapGem_shield: 'ढाल',
  gemSwapGem_heart: 'दिल',
  gemSwapNewBoard: 'नया बोर्ड',
  gemSwapLiveMove: '{count} हटे · {left} अदला-बदली बाकी',
  gemSwapLiveInvalid: 'इन दोनों की अदला-बदली नहीं हो सकती',
  gemSwapLiveUndo: 'अदला-बदली वापस ली · {left} अदला-बदली बाकी',
  gemSwapResultTitle: 'राउंड पूरा',
  gemSwapEnd_swaps: 'सभी 30 अदला-बदली हो गईं।',
  gemSwapEnd_stuck: 'ऐसी कोई अदला-बदली नहीं बची जो तीन को एक पंक्ति में लाए।',
  gemSwapEnd_cap: 'शृंखला 64 चरणों की अपनी सीमा तक पहुँच गई।',
  gemSwapNotCounted: 'सीमा पर रुका राउंड सर्वश्रेष्ठ में नहीं गिना जाता।',
  gemSwapNewBest: 'नया रिकॉर्ड ({kinds})',
  gemSwapBestWith: 'सर्वश्रेष्ठ ({kinds}): {score}',
  gemSwapStep1Title: 'अदला-बदली',
  gemSwapStep1Body:
    'पास के दो रत्नों की अदला-बदली करें ताकि एक ही आकार के तीन या अधिक एक पंक्ति में आ जाएँ।',
  gemSwapStep2Title: 'हटना',
  gemSwapStep2Body:
    'पंक्ति हटती है, ऊपर से नए रत्न गिरते हैं, और उनसे बनी हर पंक्ति भी हट जाती है।',
  gemSwapStep3Title: 'स्कोर',
  gemSwapStep3Body: 'एक राउंड में 30 अदला-बदली होती हैं, और हटा हर रत्न एक अंक है।',
  gemSwapFigureSwap: 'पास के दो रत्न जिनकी अदला-बदली से तीन षट्भुज एक पंक्ति में आएँगे',
  gemSwapFigureClear: 'एक पंक्ति हट गई है और ऊपर के रत्न उसकी जगह गिर रहे हैं',
  gemSwapFigureRound: '42 का स्कोर और एक पट्टी जिसमें 30 में से 18 अदला-बदली बाकी हैं',
};
