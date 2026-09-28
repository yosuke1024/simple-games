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
 * this install", "which ad" (the Google Play install referrer, only when it
 * came from a Meta ad), "if the Facebook app is on this phone, that app's
 * ad-measurement ID",
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
  settingOffReported: string;
  settingOffMaybeSent: string;
  settingPending: string;
  settingReported: string;
  settingStopped: string;
}

const en: MetaInstallCopy = {
  askTitle: 'Tell Meta about this install?',
  askBody:
    "We run ads for Simple Games on Meta (Facebook and Instagram). If you allow it, the app tells Meta once that it has been installed, so we can see whether those ads work. The report includes basic app and device details (such as version, model, language, time zone and mobile carrier), a random ID for this install, that it came from Google Play and — if you came from a Meta ad — which ad, your IP address, and, if the Facebook app is on this phone, that app's ad-measurement ID.",
  askNever: 'It never includes game data, scores, purchases or your advertising ID.',
  askSettings: 'You can change this at any time in Settings.',
  allow: 'Allow',
  deny: "Don't allow",
  privacyPolicy: 'Privacy policy',
  settingLabel: 'Ad measurement (Meta)',
  settingOff: 'Off. Nothing is sent to Meta.',
  settingOffReported:
    'Off. Meta was already told once that the app was installed; that cannot be recalled. Nothing more is sent.',
  settingOffMaybeSent:
    'Off. Nothing more is sent to Meta. A report the app had already started may have reached Meta once; that cannot be recalled.',
  settingPending:
    'On. When the app is online, it tells Meta once that it has been installed. Turning this off before then cancels it.',
  settingReported: 'On. Meta has been told once that the app was installed. Nothing more is sent.',
  settingStopped:
    'On, but Meta did not confirm this install’s report, and the app will not try again. Nothing more is sent.',
};

const ja: MetaInstallCopy = {
  askTitle: 'このインストールを Meta に知らせますか?',
  askBody:
    'Simple Games は Meta(Facebook・Instagram)に広告を出しています。許可すると、アプリはインストールされたことを一度だけ Meta に知らせ、その広告に効果があったかを確かめられるようにします。知らせる内容は、アプリと端末の基本情報(バージョン・機種・言語・タイムゾーン・通信事業者など)、このインストール用のランダムな ID、Google Play から入手したこと(Meta の広告から来た場合はどの広告か)、IP アドレスと、この端末に Facebook アプリが入っている場合はそのアプリの広告計測用 ID です。',
  askNever: 'ゲームのデータ・記録・購入・広告 ID は含みません。',
  askSettings: '設定からいつでも変更できます。',
  allow: '許可する',
  deny: '許可しない',
  privacyPolicy: 'プライバシーポリシー',
  settingLabel: '広告の効果測定(Meta)',
  settingOff: 'オフ。Meta には何も送りません。',
  settingOffReported:
    'オフ。インストールされたことは一度 Meta に知らせ済みで、取り消せません。これ以上は何も送りません。',
  settingOffMaybeSent:
    'オフ。これ以上 Meta には何も送りません。すでに始めた報告が一度 Meta に届いている可能性があり、それは取り消せません。',
  settingPending:
    'オン。オンラインのとき、インストールされたことを一度だけ Meta に知らせます。それより前にオフにすれば取りやめます。',
  settingReported:
    'オン。インストールされたことを Meta に一度知らせました。これ以上は何も送りません。',
  settingStopped:
    'オン。ただし Meta による報告の受理を確認できなかったため、これ以上は試さず、何も送りません。',
};

/**
 * The copy for `locale`: Japanese for `ja`, English for everything else. The
 * question never reaches this with another language (`META_ASK_LOCALES`);
 * Settings may, and English is its fallback (see the header).
 */
export function metaInstallCopy(locale: string): MetaInstallCopy {
  return locale === 'ja' ? ja : en;
}
