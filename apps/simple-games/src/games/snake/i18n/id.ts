/**
 * Indonesian catalog for Snake.
 *
 * Provenance (docs/SNAKE_RULES.md §14, docs/I18N_POLICY.md「来歴」): `machine`.
 * Written by AI (Claude) from the English source on 2026-10-17. **No native
 * speaker has read it**, and it is not to be treated as reviewed. The title
 * (`snakeName`) is a proper noun and stays as it is in every locale.
 *
 * The `Skor` of the shell (`score`), `Terbaik` for a best (Number Match),
 * `kotak` for a square (Nonogram), `papan` for the board and `Geser` for a
 * swipe (2048). Inside a sentence a speed goes in brackets.
 * A no-break space keeps each dash off the start of a line.
 */
import type { SnakeMessages } from './en';

export const id: SnakeMessages = {
  snakeName: 'Snake',

  // Home
  snakeSpeed: 'Kecepatan',
  snakeSpeed_slow: 'Lambat',
  snakeSpeed_normal: 'Normal',
  snakeSpeed_fast: 'Cepat',
  snakeResumeNote: 'Skor {score} · {speed}',
  snakeBestNote: 'Terbaik {score}',

  // Game screen
  snakeTopBest: 'Terbaik {score} · {speed}',
  snakeBoardLabel: 'Papan Snake, {size} kali {size}: {state}',
  snakeStateReady: 'siap dimulai',
  snakeStateRunning: 'bergerak',
  snakeStatePaused: 'dijeda',
  snakeStateOver: 'permainan selesai',
  snakeStateCleared: 'papan penuh',
  snakeControls: 'Kontrol',
  snakeDir_up: 'Atas',
  snakeDir_down: 'Bawah',
  snakeDir_left: 'Kiri',
  snakeDir_right: 'Kanan',
  snakeStart: 'Mulai',
  snakePause: 'Jeda',
  snakePaused: 'Dijeda',
  snakeNextTurn: 'Arah berikutnya: {direction}',

  // Screen reader announcements (polite; never one per tick)
  snakeLiveStarted: 'Dimulai',
  snakeLivePaused: 'Dijeda. Skor {score}',
  snakeLiveResumed: 'Dilanjutkan',
  snakeLiveScore: 'Skor {score}',
  snakeLiveWall: 'Permainan selesai: ular menabrak dinding. Skor {score}',
  snakeLiveSelf: 'Permainan selesai: ular menabrak tubuhnya sendiri. Skor {score}',
  snakeLiveCleared: 'Papan penuh. Skor {score}',
  snakeLiveNextCleared: 'Arah berikutnya dibatalkan',

  // Result
  snakeOverTitle: 'Permainan selesai',
  snakeClearedTitle: 'Papan penuh',
  snakeOverWall: 'Ular menabrak dinding.',
  snakeOverSelf: 'Ular menabrak tubuhnya sendiri.',
  snakeClearedBody: 'Ular memenuhi semua kotak.',
  snakeLength: 'Panjang',
  snakeNewBest: 'Rekor baru ({speed})',
  snakeBestAt: 'Terbaik ({speed}): {score}',

  // Statistics
  snakeBestScore: 'Skor terbaik',
  snakeClears: 'Papan dipenuhi',

  // Quick Rules
  snakeStep1Title: 'Belok',
  snakeStep1Body:
    'Geser, ketuk panah, atau tekan tombol panah untuk berbelok\u00a0— ular terus maju kotak demi kotak.',
  snakeStep2Title: 'Makan',
  snakeStep2Body: 'Setiap makanan memanjangkan ular satu kotak dan memberi satu poin.',
  snakeStep3Title: 'Jangan menabrak',
  snakeStep3Body:
    'Menabrak dinding atau tubuhnya sendiri mengakhiri permainan\u00a0— penuhi seluruh papan untuk menang.',
  snakeFigureTurn: 'Ular yang akan berbelok ke atas menuju makanan',
  snakeFigureEat: 'Ular yang tinggal satu kotak dari makanan',
  snakeFigureCrash: 'Ular yang menabrak dinding',
};
