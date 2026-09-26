import type { HitAndBlowMessages } from './en';

export const ptBR: HitAndBlowMessages = {
  hitAndBlowName: 'Hit & Blow',
  hitAndBlowChooseDifficulty: 'Escolha uma dificuldade',
  hitAndBlowDifficulty_easy: 'Fácil',
  hitAndBlowDifficulty_normal: 'Normal',
  hitAndBlowDifficulty_hard: 'Difícil',
  hitAndBlowCodeNote: '{slots} de {pool} símbolos',
  hitAndBlowBestNote: 'Melhor {count}',
  hitAndBlowConfirmSwitchTitle: 'Substituir o jogo em andamento?',
  hitAndBlowConfirmSwitchBody: 'Seu jogo de {current} será substituído por um novo jogo de {next}.',

  hitAndBlowSymbol_circle: 'Círculo',
  hitAndBlowSymbol_triangle: 'Triângulo',
  hitAndBlowSymbol_square: 'Quadrado',
  hitAndBlowSymbol_diamond: 'Losango',
  hitAndBlowSymbol_star: 'Estrela',
  hitAndBlowSymbol_cross: 'Cruz',
  hitAndBlowSymbol_hexagon: 'Hexágono',
  hitAndBlowSymbol_heart: 'Coração',

  hitAndBlowGuessCounter: 'Tentativa {n}',
  hitAndBlowHistoryLabel: 'Tentativas até agora',
  hitAndBlowHistoryEmpty: 'Suas tentativas vão aparecer aqui.',
  hitAndBlowRowLabel: 'Tentativa {n}: {symbols}. Acerto {hits}, Presente {blows}.',
  hitAndBlowDraftLabel: 'Sua tentativa',
  hitAndBlowSlotEmpty: 'Espaço {n}: vazio',
  hitAndBlowSlotFilled: 'Espaço {n}: {symbol}',
  hitAndBlowPaletteLabel: 'Símbolos',
  hitAndBlowCheck: 'Verificar',
  hitAndBlowHit: 'Acerto',
  hitAndBlowBlow: 'Presente',

  hitAndBlowWinTitle: 'Código decifrado',
  hitAndBlowWinBody: 'Você encontrou a fileira escondida.',
  hitAndBlowGuessesLabel: 'Tentativas',
  hitAndBlowNewBest: 'Seu menor número de tentativas.',
  hitAndBlowSolved: 'Resolvidos',
  hitAndBlowFewestGuesses: 'Menos tentativas',
  hitAndBlowAverageGuesses: 'Média de tentativas',

  hitAndBlowStep1Title: 'Encontre a fileira escondida',
  hitAndBlowStep1Body:
    'Uma fileira de símbolos diferentes está escondida. Descubra quais são e em que ordem.',
  hitAndBlowStep2Title: 'Monte uma tentativa',
  hitAndBlowStep2Body: 'Toque nos símbolos para preencher a fileira e depois toque em Verificar.',
  hitAndBlowStep3Title: 'Leia as marcas',
  hitAndBlowStep3Body:
    '● Acerto: símbolo e posição certos. ○ Presente: símbolo certo, posição errada. Tente quantas vezes quiser.',
};
