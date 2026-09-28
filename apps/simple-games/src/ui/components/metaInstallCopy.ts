/**
 * Every word the Meta install measurement puts on screen (issue #204,
 * docs/META_ANDROID_ACQUISITION.md), in the two languages a native reader has
 * checked — and nowhere else.
 *
 * Why not the fourteen catalogs. This is a request for consent to send data to
 * a third party, which docs/I18N_POLICY.md counts among the strings where a
 * mistranslation is a broken promise, and twelve of the fourteen languages are
 * unreviewed machine translation. A yes given to a sentence nobody has checked
 * is not a yes we can show we were given. So the question is asked only in
 * English and Japanese (services/acquisition/metaInstall.ts,
 * `META_ASK_LOCALES`), and the other twelve languages get no question and send
 * nothing — the WebBetaNotice precedent, for the same reason.
 *
 * Settings is the one place another language can meet this text: a player who
 * said yes in English or Japanese and then switched language must still be
 * able to say no. There the row falls back to English rather than disappear.
 *
 * What these sentences claim is checked against the native side, not the
 * other way round: "once", "basic app and device details", "a random ID for
 * this install", "on older Android … the Facebook app's ad-measurement ID",
 * "never your advertising ID" are each true of
 * android/app/src/metaOn and are listed in the runbook's data inventory. Change
 * a sentence here and that list in the same commit, or neither.
 */

export interface MetaInstallCopy {
  askTitle: string;
  askBody: string;
  askNever: string;
  askSettings: string;
  allow: string;
  deny: string;
  privacyPolicy: string;
  settingLabel: string;
  settingOff: string;
  settingPending: string;
  settingReported: string;
}

const en: MetaInstallCopy = {
  askTitle: 'Tell Meta about this install?',
  askBody:
    "We run ads for Simple Games on Meta (Facebook and Instagram). If you allow it, the app tells Meta once that it has been installed, so we can see whether those ads work. The report includes basic app and device details (such as version, model, language, time zone and mobile carrier), a random ID for this install, your IP address, and — on older Android versions with the Facebook app installed — that app's ad-measurement ID.",
  askNever: 'It never includes game data, scores, purchases or your advertising ID.',
  askSettings: 'You can change this at any time in Settings.',
  allow: 'Allow',
  deny: "Don't allow",
  privacyPolicy: 'Privacy policy',
  settingLabel: 'Ad measurement (Meta)',
  settingOff: 'Off. Nothing is sent to Meta.',
  settingPending:
    'On. When the app is online, it tells Meta once that it has been installed. Turning this off before then cancels it.',
  settingReported: 'On. Meta has been told once that the app was installed. Nothing more is sent.',
};

const ja: MetaInstallCopy = {
  askTitle: 'このインストールを Meta に知らせますか?',
  askBody:
    'Simple Games は Meta(Facebook・Instagram)に広告を出しています。許可すると、アプリはインストールされたことを一度だけ Meta に知らせ、その広告に効果があったかを確かめられるようにします。知らせる内容は、アプリと端末の基本情報(バージョン・機種・言語・タイムゾーン・通信事業者など)、このインストール用のランダムな ID、IP アドレスと、古い Android で Facebook アプリが入っている場合はそのアプリの広告計測用 ID です。',
  askNever: 'ゲームのデータ・記録・購入・広告 ID は含みません。',
  askSettings: '設定からいつでも変更できます。',
  allow: '許可する',
  deny: '許可しない',
  privacyPolicy: 'プライバシーポリシー',
  settingLabel: '広告の効果測定(Meta)',
  settingOff: 'オフ。Meta には何も送りません。',
  settingPending:
    'オン。オンラインのとき、インストールされたことを一度だけ Meta に知らせます。それより前にオフにすれば取りやめます。',
  settingReported:
    'オン。インストールされたことを Meta に一度知らせました。これ以上は何も送りません。',
};

/**
 * The copy for `locale`: Japanese for `ja`, English for everything else. The
 * question never reaches this with another language (`META_ASK_LOCALES`);
 * Settings may, and English is its fallback (see the header).
 */
export function metaInstallCopy(locale: string): MetaInstallCopy {
  return locale === 'ja' ? ja : en;
}
