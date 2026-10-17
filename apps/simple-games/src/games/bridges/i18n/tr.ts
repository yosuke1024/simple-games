/**
 * Turkish catalog for Bridges. Provenance (docs/BRIDGES_RULES.md §14,
 * docs/I18N_POLICY.md): `machine` — written with AI assistance and **not read
 * by a native speaker**. The title (`bridgesName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { BridgesMessages } from './en';

export const tr: BridgesMessages = {
  bridgesName: 'Bridges',
  bridgesChooseBoard: 'Tahta seç',
  bridgesDifficulty_easy: 'Kolay',
  bridgesDifficulty_medium: 'Orta',
  bridgesDifficulty_hard: 'Zor',
  bridgesBoardNote: '{width}×{height}',
  bridgesConfirmSwitchTitle: 'Devam eden tahta değiştirilsin mi?',
  bridgesConfirmSwitchBody: '{current} tahtanın yerine yeni bir {next} tahtası gelecek.',
  bridgesBoardLabel: 'Bridges tahtası, {width} çarpı {height}, {islands} ada',
  bridgesIslandOpen: 'Ada {value}, satır {row}, sütun {col}: {value} köprüden {count} tanesi',
  bridgesIslandComplete: 'Ada {value}, satır {row}, sütun {col}: tamam',
  bridgesIslandOver: 'Ada {value}, satır {row}, sütun {col}: {count} köprü, fazla',
  bridgesIslandSelected: '{island}. Seçili',
  bridgesIslandPartner: '{island}. Seçili adaya bağlanabilir: 2 köprüden {bridges} tanesi',
  bridgesIslandHinted: '{island}. İpucuyla vurgulandı',
  bridgesIslandHintRing: '{island}. İpucuyla vurgulandı, noktalı halkada',
  bridgesAnnounceNone:
    'Satır {row1}, sütun {col1} ile satır {row2}, sütun {col2} arasında köprü yok',
  bridgesAnnounceOne:
    'Satır {row1}, sütun {col1} ile satır {row2}, sütun {col2} arasında bir köprü',
  bridgesAnnounceTwo:
    'Satır {row1}, sütun {col1} ile satır {row2}, sütun {col2} arasında iki köprü',
  bridgesSplitNote:
    'Tüm sayılar tamam, ama adalar {groups} gruba ayrılmış. Hepsini tek grupta birleştir.',
  bridgesHintWrong: 'Vurgulanan adalar arasında fazla köprü var.',
  bridgesHintOne: 'Vurgulanan çiftin en az bir köprüye ihtiyacı var.',
  bridgesHintTwo: 'Vurgulanan çiftin iki köprüye ihtiyacı var.',
  bridgesHintOneAt:
    'Noktalı halkadaki adanın sayısına bak: vurgulanan çiftin en az bir köprüye ihtiyacı var.',
  bridgesHintTwoAt:
    'Noktalı halkadaki adanın sayısına bak: vurgulanan çiftin iki köprüye ihtiyacı var.',
  bridgesHintNone: 'Buradan kesin bir hamle bulunamadı.',
  bridgesHintWhere: 'Vurgulanan: satır {row1}, sütun {col1} ve satır {row2}, sütun {col2}.',
  bridgesHintWhereRing:
    'Vurgulanan: satır {row1}, sütun {col1} ve satır {row2}, sütun {col2}. Noktalı halka: satır {row}, sütun {col}.',
  bridgesSolvedTitle: 'Hepsi bağlandı!',
  bridgesSolvedBody: 'Bütün adalar tek bir ağda birleşti.',
  bridgesHintsUsed: 'Kullanılan ipuçları',
  bridgesNewBestTime: 'En hızlı zamanın.',
  bridgesNewBoard: 'Yeni tahta',
  bridgesSolvedCount: 'Çözülen tahtalar',
  bridgesDailySection: 'Günlük',
  bridgesDailiesCleared: 'Tamamlanan günler',
  bridgesAllModes: 'Tüm modlar',
  bridgesStep1Title: 'Sayılar köprüdür',
  bridgesStep1Body: 'Her adaya, sayısı kadar köprü bağlanır.',
  bridgesStep2Title: 'Düz, en fazla iki',
  bridgesStep2Body:
    'Köprüler yatay ya da dikey düz gider, asla kesişmez ve aynı iki ada arasında en fazla iki tane olur.',
  bridgesStep3Title: 'Hepsini bağla',
  bridgesStep3Body:
    'Bir adaya, sonra halkalı bir eşine dokunarak köprü ekle (tekrar dokununca iki, bir daha dokununca sıfır), bütün adalar bağlanana kadar.',
};
