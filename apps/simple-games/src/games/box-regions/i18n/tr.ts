/**
 * Turkish catalog for Box Regions — machine translation of the English
 * source, unreviewed (docs/I18N_POLICY.md: provenance `machine`). The title
 * (`boxRegionsName`) is a proper noun and stays as-is in every locale;
 * placeholder names match the English source.
 */
import type { BoxRegionsMessages } from './en';

export const tr: BoxRegionsMessages = {
  boxRegionsName: 'Box Regions',
  boxRegionsChooseBoard: 'Bir tahta seç',
  boxRegionsDifficulty_easy: 'Kolay',
  boxRegionsDifficulty_medium: 'Orta',
  boxRegionsDifficulty_hard: 'Zor',
  boxRegionsBoardNote: '{width}×{height}',
  boxRegionsConfirmSwitchTitle: 'Devam eden tahta değiştirilsin mi?',
  boxRegionsConfirmSwitchBody: '{current} oyununuz yeni bir {next} tahtayla değiştirilecek.',
  boxRegionsBoardLabel: 'Box Regions tahtası, {width} çarpı {height}',
  boxRegionsCellAssigned: 'Satır {row}, sütun {col}, kutu {region}',
  boxRegionsCellEmpty: 'Satır {row}, sütun {col}, atanmamış',
  boxRegionsClueCount: '{size} hücreden {count} tanesi',
  boxRegionsRuleBroken: 'kuralı bozuyor',
  boxRegionsKind_square: 'Kare',
  boxRegionsKind_tall: 'Dikey',
  boxRegionsKind_wide: 'Yatay',
  boxRegionsKind_free: 'Herhangi bir kutu',
  boxRegionsHintWrong: 'Vurgulanan kutu cevapla uyuşmuyor.',
  boxRegionsHintForced: 'İşaretli hücre yalnızca vurgulanan yönergenin kutusuna ait olabilir.',
  boxRegionsHintSole: 'Bu kutu yalnızca tek bir şekilde çizilebilir.',
  boxRegionsHintCommon: 'Bu yönergenin kutusu nasıl çizilirse çizilsin işaretli hücreleri kapsar.',
  boxRegionsHintNone: 'Şu anda kesin bir hamle bulunamadı.',
  boxRegionsSolvedTitle: 'Çözüldü!',
  boxRegionsSolvedBody: 'Her hücre kendi kutusunda.',
  boxRegionsHintsUsed: 'Kullanılan ipuçları',
  boxRegionsNewBestTime: 'Şimdiye kadarki en hızlı sürün.',
  boxRegionsNewBoard: 'Yeni tahta',
  boxRegionsSolvedCount: 'Çözülen bulmacalar',
  boxRegionsDailySection: 'Günlük',
  boxRegionsDailiesCleared: 'Tamamlanan günler',
  boxRegionsDailyBacklogHint: 'Önceki tüm günler açık kalır.',
  boxRegionsStep1Title: 'Kutulara böl',
  boxRegionsStep1Body: 'Tahtayı dikdörtgenlere böl; her birinde tam olarak bir yönerge olsun.',
  boxRegionsStep2Title: 'Yönergeleri oku',
  boxRegionsStep2Body:
    'Sayı kutudaki hücre sayısıdır; simge kare, dikey, yatay veya herhangi biri olduğunu söyler.',
  boxRegionsStep3Title: 'Köşeden köşeye çiz',
  boxRegionsStep3Body:
    'Kutu çizmek için bir köşeden diğerine sürükle. Kutuyu kaldırmak için ona dokun. Takıldın mı? Bir ipucu dene.',
};
