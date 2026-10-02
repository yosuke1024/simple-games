/**
 * Turkish catalog for Shape Regions (docs/I18N_POLICY.md: provenance
 * `machine`). The title (`shapeRegionsName`) is a proper noun and stays
 * as-is in every locale; placeholder names match the English source.
 */
import type { ShapeRegionsMessages } from './en';

export const tr: ShapeRegionsMessages = {
  shapeRegionsName: 'Shape Regions',
  shapeRegionsChooseBoard: 'Bir tahta seç',
  shapeRegionsDifficulty_easy: 'Kolay',
  shapeRegionsDifficulty_medium: 'Orta',
  shapeRegionsDifficulty_hard: 'Zor',
  shapeRegionsBoardNote: '{width}×{height}',
  shapeRegionsConfirmSwitchTitle: 'Devam eden tahta değiştirilsin mi?',
  shapeRegionsConfirmSwitchBody: '{current} oyununun yerine yeni bir {next} tahta gelecek.',
  shapeRegionsBoardLabel: 'Shape Regions tahtası, {width} x {height}',
  shapeRegionsCellAssigned: 'Satır {row}, sütun {col}, şekil {region}',
  shapeRegionsCellEmpty: 'Satır {row}, sütun {col}, atanmamış',
  shapeRegionsClueCount: '{size} hücreden {count}',
  shapeRegionsRuleBroken: 'bir kuralı bozuyor',
  shapeRegionsShape_line: 'Çizgi',
  shapeRegionsShape_block: 'Dikdörtgen',
  shapeRegionsShape_corner: 'Köşe',
  shapeRegionsShape_tee: 'T şekli',
  shapeRegionsShape_step: 'Basamak',
  shapeRegionsHintWrong: 'Vurgulanan şekil çözümle uyuşmuyor.',
  shapeRegionsHintForced: 'İşaretli hücre yalnızca vurgulanan şekle ait olabilir.',
  shapeRegionsHintSole: 'Vurgulanan şeklin yalnızca tek bir yerleşimi var.',
  shapeRegionsHintCommon: 'Vurgulanan şekil nasıl yerleşirse yerleşsin, işaretli hücreleri içerir.',
  shapeRegionsHintNone: 'Şu anda kesin bir hamle bulunamadı.',
  shapeRegionsSolvedTitle: 'Çözüldü!',
  shapeRegionsSolvedBody: 'Her hücre kendi şekline ait.',
  shapeRegionsHintsUsed: 'Kullanılan ipucu',
  shapeRegionsNewBestTime: 'En hızlı zamanın.',
  shapeRegionsNewBoard: 'Yeni tahta',
  shapeRegionsSolvedCount: 'Çözülen bulmacalar',
  shapeRegionsDailySection: 'Günlük',
  shapeRegionsDailiesCleared: 'Tamamlanan günler',
  shapeRegionsStep1Title: 'Sayı ve simge',
  shapeRegionsStep1Body: 'Sayı şeklin kaç hücreli olduğunu, simge ise biçimini söyler.',
  shapeRegionsStep2Title: 'İpucundan büyüt',
  shapeRegionsStep2Body: 'Şekli büyütmek için ipucundan komşu hücrelere doğru sürükle.',
  shapeRegionsStep3Title: 'Tahtayı doldur',
  shapeRegionsStep3Body: 'Bittiğinde her hücre bir şekle aittir. Çıkarmak için hücreye dokun.',
};
