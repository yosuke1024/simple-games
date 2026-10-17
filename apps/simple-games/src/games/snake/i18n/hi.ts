/**
 * Hindi catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The polite `आप` of the shell, `स्कोर` for the score (shell `score`), `खाना`
 * for a square (Nonogram) and `बोर्ड` for the board. The food is `दाना`, not
 * `खाना`, so that the food and the square never share a word. `खत्म` without
 * the nukta, as in the other Hindi catalogs. The speed names agree with `गति`.
 * A no-break space keeps each dash off the start of a line.
 */
import type { SnakeMessages } from './en';

export const hi: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'गति',
  snakeSpeed_slow: 'धीमी',
  snakeSpeed_normal: 'सामान्य',
  snakeSpeed_fast: 'तेज़',
  snakeResumeNote: 'स्कोर {score} · {speed}',
  snakeBestNote: 'सर्वश्रेष्ठ {score}',

  // Game screen
  snakeTopBest: 'सर्वश्रेष्ठ {score} · {speed}',
  snakeBoardLabel: 'Snake बोर्ड, {size} गुणा {size}: {state}',
  snakeStateReady: 'शुरू होने के लिए तैयार',
  snakeStateRunning: 'चल रहा है',
  snakeStatePaused: 'रुका हुआ',
  snakeStateOver: 'गेम खत्म',
  snakeStateCleared: 'बोर्ड भर गया',
  snakeControls: 'नियंत्रण',
  snakeDir_up: 'ऊपर',
  snakeDir_down: 'नीचे',
  snakeDir_left: 'बाएँ',
  snakeDir_right: 'दाएँ',
  snakeStart: 'शुरू करें',
  snakePause: 'रोकें',
  snakePaused: 'रुका हुआ',
  snakeNextTurn: 'अगली दिशा: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'शुरू हुआ',
  snakeLivePaused: 'रुका हुआ। स्कोर {score}',
  snakeLiveResumed: 'फिर से चालू',
  snakeLiveScore: 'स्कोर {score}',
  snakeLiveWall: 'गेम खत्म: साँप दीवार से टकरा गया। स्कोर {score}',
  snakeLiveSelf: 'गेम खत्म: साँप अपने ही शरीर से टकरा गया। स्कोर {score}',
  snakeLiveCleared: 'बोर्ड भर गया। स्कोर {score}',
  snakeLiveNextCleared: 'अगली दिशा हटा दी गई',

  // Result
  snakeOverTitle: 'गेम खत्म',
  snakeClearedTitle: 'बोर्ड भर गया',
  snakeOverWall: 'साँप दीवार से टकरा गया।',
  snakeOverSelf: 'साँप अपने ही शरीर से टकरा गया।',
  snakeClearedBody: 'साँप ने हर खाना भर दिया।',
  snakeLength: 'लंबाई',
  snakeNewBest: 'नया रिकॉर्ड ({speed})',
  snakeBestAt: 'सर्वश्रेष्ठ ({speed}): {score}',

  // Statistics
  snakeBestScore: 'सर्वश्रेष्ठ स्कोर',
  snakeClears: 'भरे गए बोर्ड',

  // Quick Rules
  snakeStep1Title: 'मुड़ें',
  snakeStep1Body:
    'मुड़ने के लिए स्वाइप करें, तीर पर टैप करें या तीर कुंजी दबाएँ\u00a0— साँप एक-एक खाना करके आगे बढ़ता रहता है।',
  snakeStep2Title: 'दाना खाएँ',
  snakeStep2Body: 'हर दाना साँप को एक खाना लंबा करता है और एक अंक देता है।',
  snakeStep3Title: 'टकराएँ नहीं',
  snakeStep3Body:
    'दीवार या अपने ही शरीर से टकराते ही गेम खत्म हो जाता है\u00a0— पूरा बोर्ड भरने पर जीत होती है।',
  snakeFigureTurn: 'दाने की ओर ऊपर मुड़ने वाला साँप',
  snakeFigureEat: 'दाने से एक खाना दूर साँप',
  snakeFigureCrash: 'दीवार से टकराया हुआ साँप',
};
