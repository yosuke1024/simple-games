/**
 * Brazilian Portuguese catalog for Bridges. Provenance (docs/BRIDGES_RULES.md
 * §14, docs/I18N_POLICY.md): `machine` — written with AI assistance and **not
 * read by a native speaker**. The title (`bridgesName`) is a proper noun and
 * stays as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const ptBR: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Escolha um tabuleiro',
  bridgesDifficulty_easy: 'Fácil',
  bridgesDifficulty_medium: 'Médio',
  bridgesDifficulty_hard: 'Difícil',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'Substituir o tabuleiro em andamento?',
  bridgesConfirmSwitchBody:
    'Seu tabuleiro {current} será substituído por um novo tabuleiro {next}.',
  bridgesBoardLabel: 'Tabuleiro de Bridges, {width} por {height}, {islands} ilhas',
  bridgesIslandOpen: 'Ilha {value}, linha {row}, coluna {col}: {count} de {value} pontes',
  bridgesIslandComplete: 'Ilha {value}, linha {row}, coluna {col}: completa',
  bridgesIslandOver: 'Ilha {value}, linha {row}, coluna {col}: {count} pontes, demais',
  bridgesIslandSelected: '{island}. Selecionada',
  bridgesIslandPartner: '{island}. Pode se ligar à ilha selecionada: {bridges} de 2 pontes',
  bridgesIslandHinted: '{island}. Destacada pela dica',
  bridgesIslandHintRing: '{island}. Destacada pela dica, no círculo pontilhado',
  bridgesAnnounceNone:
    'Nenhuma ponte entre a linha {row1}, coluna {col1} e a linha {row2}, coluna {col2}',
  bridgesAnnounceOne:
    'Uma ponte entre a linha {row1}, coluna {col1} e a linha {row2}, coluna {col2}',
  bridgesAnnounceTwo:
    'Duas pontes entre a linha {row1}, coluna {col1} e a linha {row2}, coluna {col2}',
  bridgesSplitNote:
    'Todos os números foram atingidos, mas as ilhas formam {groups} grupos. Junte-as em um só.',
  bridgesHintWrong: 'Há pontes demais entre as ilhas destacadas.',
  bridgesHintOne: 'O par destacado precisa de pelo menos uma ponte.',
  bridgesHintTwo: 'O par destacado precisa de duas pontes.',
  bridgesHintOneAt:
    'Faça as contas na ilha do círculo pontilhado: o par destacado precisa de pelo menos uma ponte.',
  bridgesHintTwoAt:
    'Faça as contas na ilha do círculo pontilhado: o par destacado precisa de duas pontes.',
  bridgesHintNone: 'Nenhuma jogada certa encontrada a partir daqui.',
  bridgesHintWhere: 'Destacadas: linha {row1}, coluna {col1} e linha {row2}, coluna {col2}.',
  bridgesHintWhereRing:
    'Destacadas: linha {row1}, coluna {col1} e linha {row2}, coluna {col2}. Círculo pontilhado: linha {row}, coluna {col}.',
  bridgesSolvedTitle: 'Tudo conectado!',
  bridgesSolvedBody: 'Todas as ilhas formam uma única rede.',
  bridgesHintsUsed: 'Dicas usadas',
  bridgesNewBestTime: 'Seu tempo mais rápido.',
  bridgesNewBoard: 'Novo tabuleiro',
  bridgesSolvedCount: 'Tabuleiros resolvidos',
  bridgesDailySection: 'Diário',
  bridgesDailiesCleared: 'Dias concluídos',
  bridgesAllModes: 'Todos os modos',
  bridgesStep1Title: 'Números são pontes',
  bridgesStep1Body: 'Cada ilha recebe exatamente tantas pontes quanto o seu número.',
  bridgesStep2Title: 'Retas, no máximo duas',
  bridgesStep2Body:
    'As pontes seguem retas na horizontal ou na vertical, nunca se cruzam, e no máximo duas ligam o mesmo par.',
  bridgesStep3Title: 'Ligue todas',
  bridgesStep3Body:
    'Toque em uma ilha e depois em uma parceira com anel para adicionar uma ponte (de novo para duas, mais uma vez para nenhuma), até ligar todas as ilhas.',
};
