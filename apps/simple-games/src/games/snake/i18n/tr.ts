/**
 * Turkish catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The informal `sen` of the shell, `Puan` for the score (shell `score`),
 * `kare` for a square (Nonogram), `tahta` for the board and `yem` for the
 * food. Statistics labels follow the shell pattern (`Oynanan oyun`).
 */
import type { SnakeMessages } from './en';

export const tr: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Hız',
  snakeSpeed_slow: 'Yavaş',
  snakeSpeed_normal: 'Normal',
  snakeSpeed_fast: 'Hızlı',
  snakeResumeNote: 'Puan {score} · {speed}',
  snakeBestNote: 'Rekor {score}',

  // Game screen
  snakeTopBest: 'Rekor {score} · {speed}',
  snakeBoardLabel: 'Snake tahtası, {size} çarpı {size}: {state}',
  snakeStateReady: 'başlamaya hazır',
  snakeStateRunning: 'hareket ediyor',
  snakeStatePaused: 'duraklatıldı',
  snakeStateOver: 'oyun bitti',
  snakeStateCleared: 'tahta doldu',
  snakeControls: 'Kontroller',
  snakeDir_up: 'Yukarı',
  snakeDir_down: 'Aşağı',
  snakeDir_left: 'Sol',
  snakeDir_right: 'Sağ',
  snakeStart: 'Başla',
  snakePause: 'Duraklat',
  snakePaused: 'Duraklatıldı',
  snakeNextTurn: 'Sonraki yön: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'Başladı',
  snakeLivePaused: 'Duraklatıldı. Puan: {score}',
  snakeLiveResumed: 'Devam ediyor',
  snakeLiveScore: 'Puan: {score}',
  snakeLiveWall: 'Oyun bitti: yılan duvara çarptı. Puan: {score}',
  snakeLiveSelf: 'Oyun bitti: yılan kendi gövdesine çarptı. Puan: {score}',
  snakeLiveCleared: 'Tahta doldu. Puan: {score}',
  snakeLiveNextCleared: 'Sonraki yön iptal edildi',

  // Result
  snakeOverTitle: 'Oyun bitti',
  snakeClearedTitle: 'Tahta doldu',
  snakeOverWall: 'Yılan duvara çarptı.',
  snakeOverSelf: 'Yılan kendi gövdesine çarptı.',
  snakeClearedBody: 'Yılan bütün kareleri kaplıyor.',
  snakeLength: 'Uzunluk',
  snakeNewBest: 'Yeni rekor ({speed})',
  snakeBestAt: 'Rekor ({speed}): {score}',

  // Statistics
  snakeBestScore: 'En yüksek puan',
  snakeClears: 'Doldurulan tahta',

  // Quick Rules
  snakeStep1Title: 'Dön',
  snakeStep1Body:
    'Dönmek için kaydır, bir oka dokun ya da bir ok tuşuna bas; yılan durmadan kare kare ilerler.',
  snakeStep2Title: 'Ye',
  snakeStep2Body: 'Her yem yılanı bir kare uzatır ve bir puan kazandırır.',
  snakeStep3Title: 'Çarpma',
  snakeStep3Body:
    'Duvara ya da kendi gövdesine çarpınca oyun biter; kazanmak için tahtanın tamamını doldur.',
  snakeFigureTurn: 'Yeme doğru yukarı dönmek üzere olan bir yılan',
  snakeFigureEat: 'Yemden bir kare uzakta bir yılan',
  snakeFigureCrash: 'Duvara çarpmış bir yılan',
};
