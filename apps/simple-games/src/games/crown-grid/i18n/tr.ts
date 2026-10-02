import type { CrownGridMessages } from './en';

export const tr: CrownGridMessages = {
  crownGridName: 'Crown Grid',
  crownGridChooseBoard: 'Tahta seç',
  crownGridDifficulty_easy: 'Kolay',
  crownGridDifficulty_medium: 'Orta',
  crownGridDifficulty_hard: 'Zor',
  crownGridBoardNote: '{size}×{size}',
  crownGridConfirmSwitchTitle: 'Devam eden tahta değişsin mi?',
  crownGridConfirmSwitchBody: '{current} oyununun yerine yeni bir {next} tahtası gelecek.',
  crownGridBoardLabel: 'Crown Grid tahtası, {size}×{size}',
  crownGridCellEmpty: 'Boş, satır {row}, sütun {col}, bölge {region}',
  crownGridCellCross: 'Çarpı, satır {row}, sütun {col}, bölge {region}',
  crownGridCellCrown: 'Taç, satır {row}, sütun {col}, bölge {region}',
  crownGridRuleBroken: 'bir kuralı bozuyor',
  crownGridHintViolation: 'Vurgulanan taçlar bir kuralı bozuyor.',
  crownGridHintWrong: 'İşaretli taç doğru olamaz.',
  crownGridHintSingle_row: 'Vurgulanan satırda tacı için sadece bir kare kaldı: çerçeveli olan.',
  crownGridHintSingle_col: 'Vurgulanan sütunda tacı için sadece bir kare kaldı: çerçeveli olan.',
  crownGridHintSingle_region: 'Vurgulanan bölgede tacı için sadece bir kare kaldı: çerçeveli olan.',
  crownGridHintConfine_regionRow:
    'Vurgulanan bölge, tacını yalnızca renkli karelere koyabilir; bunların hepsi tek bir satırda — bu yüzden o satırdaki diğer kareler (çerçeveli) elenir.',
  crownGridHintConfine_regionCol:
    'Vurgulanan bölge, tacını yalnızca renkli karelere koyabilir; bunların hepsi tek bir sütunda — bu yüzden o sütundaki diğer kareler (çerçeveli) elenir.',
  crownGridHintConfine_rowRegion:
    'Vurgulanan satır, tacını yalnızca renkli karelere koyabilir; bunların hepsi tek bir bölgede — bu yüzden o bölgedeki diğer kareler (çerçeveli) elenir.',
  crownGridHintConfine_colRegion:
    'Vurgulanan sütun, tacını yalnızca renkli karelere koyabilir; bunların hepsi tek bir bölgede — bu yüzden o bölgedeki diğer kareler (çerçeveli) elenir.',
  crownGridHintAttack_row:
    'Çerçeveli karedeki bir taç, renkli karelerin tümünü elerdi ve vurgulanan satırın tacı için hiçbir yer kalmazdı.',
  crownGridHintAttack_col:
    'Çerçeveli karedeki bir taç, renkli karelerin tümünü elerdi ve vurgulanan sütunun tacı için hiçbir yer kalmazdı.',
  crownGridHintAttack_region:
    'Çerçeveli karedeki bir taç, renkli karelerin tümünü elerdi ve vurgulanan bölgenin tacı için hiçbir yer kalmazdı.',
  crownGridHintPair_regionsRows:
    'Vurgulanan iki bölge, taçlarını yalnızca renkli karelere koyabilir; bunlar tam olarak iki satıra sığıyor — bu yüzden o satırlardaki diğer kareler (çerçeveli) elenir.',
  crownGridHintPair_regionsCols:
    'Vurgulanan iki bölge, taçlarını yalnızca renkli karelere koyabilir; bunlar tam olarak iki sütuna sığıyor — bu yüzden o sütunlardaki diğer kareler (çerçeveli) elenir.',
  crownGridHintPair_rowsRegions:
    'Vurgulanan iki satır, taçlarını yalnızca renkli karelere koyabilir; bunlar tam olarak iki bölgeye sığıyor — bu yüzden o bölgelerdeki diğer kareler (çerçeveli) elenir.',
  crownGridHintPair_colsRegions:
    'Vurgulanan iki sütun, taçlarını yalnızca renkli karelere koyabilir; bunlar tam olarak iki bölgeye sığıyor — bu yüzden o bölgelerdeki diğer kareler (çerçeveli) elenir.',
  crownGridHintHypothesis_row:
    'Çerçeveli kareye bir taç dene: bunun zorladığı hamleler, vurgulanan satırın tacı için hiçbir yer bırakmaz, yani orası olamaz.',
  crownGridHintHypothesis_col:
    'Çerçeveli kareye bir taç dene: bunun zorladığı hamleler, vurgulanan sütunun tacı için hiçbir yer bırakmaz, yani orası olamaz.',
  crownGridHintHypothesis_region:
    'Çerçeveli kareye bir taç dene: bunun zorladığı hamleler, vurgulanan bölgenin tacı için hiçbir yer bırakmaz, yani orası olamaz.',
  crownGridHintNone: 'Şu an kesin bir hamle bulunamadı.',
  crownGridSolvedTitle: 'Çözüldü!',
  crownGridSolvedBody: 'Her satır, her sütun ve her bölgede bir taç var.',
  crownGridHintsUsed: 'Kullanılan ipuçları',
  crownGridNewBestTime: 'En hızlı zamanın.',
  crownGridNewBoard: 'Yeni tahta',
  crownGridDailySection: 'Günlük',
  crownGridDailiesSolved: 'Çözülen gün',
  crownGridStep1Title: 'Her birine bir taç',
  crownGridStep1Body: 'Her satırda, her sütunda ve her renkte tam olarak bir taç bulunur.',
  crownGridStep2Title: 'Taçlar birbirine değmez',
  crownGridStep2Body: 'İki taç yan yana duramaz, çapraz bile olsa.',
  crownGridStep3Title: 'Dokun ve sürükle',
  crownGridStep3Body:
    'Bir kareye dokun: ×, taç, boş sırayla değişir; birden çok × için sürükle. Takıldın mı? İpucu iste.',
};
