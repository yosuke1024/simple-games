/**
 * Peg Solitaire — the Turkish catalog. Provenance
 * (docs/PEG_SOLITAIRE_RULES.md §15): `machine` — written by an AI from the
 * English source; no native speaker has read it. The title
 * (`pegSolitaireName`) is a proper noun and stays as-is. The boards keep the
 * word "tahta" ("İngiliz tahtası"), so the button does not read as the name
 * of a language; the confirm line puts the names in brackets so no suffix
 * has to agree with them. Pieces are "taş", as in the Checkers catalog.
 */
import type { PegSolitaireMessages } from './en';

export const tr: PegSolitaireMessages = {
  pegSolitaireName: 'Peg Solitaire',

  pegSolitaireBoard_english: 'İngiliz tahtası',
  pegSolitaireBoard_triangle: 'Üçgen tahta',
  pegSolitaireBoardLabel_english: 'İngiliz tahtası, 33 delik',
  pegSolitaireBoardLabel_triangle: 'Üçgen tahta, 15 delik',
  pegSolitaireHoleCount: '{count} delik',

  pegSolitaireChooseBoard: 'Tahta seç',
  pegSolitaireBestNote: 'En az kalan: {count}',
  pegSolitaireConfirmSwitchTitle: 'Devam eden oyun değiştirilsin mi?',
  pegSolitaireConfirmSwitchBody:
    'Devam eden oyun ({current}), yeni bir oyunla ({next}) değiştirilecek.',

  pegSolitaireHoleGrid: 'Satır {row}, sütun {col}: {content}',
  pegSolitaireHoleRow: 'Satır {row}, delik {place}: {content}',
  pegSolitaireContentPeg: 'taş',
  pegSolitaireContentPegRing: 'halkalı delikte taş',
  pegSolitaireContentEmpty: 'boş',
  pegSolitaireContentEmptyRing: 'halkalı delik, boş',
  pegSolitaireContentLanding: 'boş, buraya atlanabilir',
  pegSolitaireContentLandingRing: 'halkalı delik, boş, buraya atlanabilir',

  pegSolitairePegsLeft: 'Kalan taş: {count}',
  pegSolitaireNoJump: 'Bu taş şu an atlayamaz.',

  pegSolitairePerfectTitle: 'Kusursuz bitiş!',
  pegSolitairePerfectBody: 'Son taş halkalı delikte duruyor.',
  pegSolitaireSingleTitle: 'Bir taş kaldı',
  pegSolitaireSingleBody: 'Son taş halkalı deliğin dışında.',
  pegSolitaireStuckTitle: 'Atlama kalmadı',
  pegSolitaireStuckBody: 'Hiçbir taş artık atlayamıyor.',
  pegSolitairePegsLeftLabel: 'Kalan taş',
  pegSolitaireFewestLabel: 'Bu tahtada en az',
  pegSolitaireNewFewest: 'Bu tahtada şimdiye kadarki en az.',
  pegSolitaireBoardFact: 'Tahta',
  pegSolitaireNewBoard: 'Yeni tahta',

  pegSolitaireStatFewest: 'En az kalan taş',
  pegSolitaireStatPerfect: 'Kusursuz bitiş',

  pegSolitaireStep1Title: 'Atla ve kaldır',
  pegSolitaireStep1Body:
    'Bir taşı komşusunun üzerinden boş bir deliğe atlat — üzerinden atlanan taş kaldırılır.',
  pegSolitaireStep2Title: 'Yalnızca düz çizgiler',
  pegSolitaireStep2Body:
    'Atlamalar düzdür: İngiliz tahtasında yukarı, aşağı ve yana, üçgen tahtada üç çizgi boyunca.',
  pegSolitaireStep3Title: 'Sonuncuyu bırak',
  pegSolitaireStep3Body:
    'Hiçbir taş atlayamadığında oyun biter — kusursuz bitiş için son taşı halkalı delikte bırak.',
};
