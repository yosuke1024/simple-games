# Simple Games — ブランドガイド

## 名称

- シリーズ名: **Simple Games by PixApps**
- Simple Games は独立企業名ではなく、PixApps が提供するシンプルゲームシリーズのレーベル。

基本表記:

```text
Simple Games
by PixApps
```

補助表記:

```text
A Simple Game by PixApps
```

## コンセプト(Honest by design)

中心思想:

> Honest by design. Simple games, built in the open.
> You don't have to take our word for it. The source code is public.

> 無料ゲームを、誠実に。シンプルなゲームを、オープンに。
> 私たちの説明を信じる必要はありません。ソースコードを公開しています。

コンセプト語: シンプル / 完全オフライン / 低消費電力 / 広告は控えめ / 急かさない /
サブスクなし / 機能課金なし / ログインなし / ソースコード公開

**OSS は誠実さの証明である。** ソースコード公開は開発者向けの訴求ではなく、
「広告はバナーだけ」「トラッキングなし」「オフラインで全機能」という約束を
ユーザー自身(または誰か)が検証できる仕組みとして扱う。
ストア文面では OSS を最後の訴求に置く(下の「訴求の順序」)。

## メッセージ候補

ブランドメッセージ(候補):

> Free games, honestly made. Play everything for free with one small banner.
> Remove it forever for $3.99. No subscriptions, no paywalls—and the source
> code is public.

> 無料ゲームを、誠実に。すべてのゲームを、小さなバナー広告だけで無料提供。
> 広告は一度だけの購入で永久に削除できます。サブスクリプションも機能制限も
> ありません。ソースコードも公開しています。

シリーズメッセージ:

> One app. Many games. Many languages.

ストア短文(候補):

- "Classic games in one quiet, offline app. No subscriptions or paywalls."
- "Simple offline games with one small banner. Remove it forever with a single purchase."
- OSS 行: "Built in public. The source code is available on GitHub."

スクリーンショット短句(この 5 句を基本とする):

- "Many games. One app."
- "Fully offline."
- "No subscriptions."
- "Banner ads only."
- "Open source."

ストア文面では収録済みのゲーム名を具体的に挙げる(例: "Sudoku, Number Match,
2048…" — **実際に収録された時点で**)。ゲーム名は検索流入の中核だが、
不自然なキーワード詰め込みはしない。

## 訴求の順序(ストア文面)

1. 1 つのアプリで複数のクラシックゲーム
2. 完全オフライン
3. ログイン不要
4. サブスクリプションなし
5. 全ゲーム機能が無料
6. 広告は小さなバナー 1 つだけ
7. $3.99 の一度だけの購入で広告を永久に削除
8. ソースコード公開

OSS は常に最後段。第 1 訴求は「ゲーム集・オフライン」であり、
OSS を先頭に出さない。

## 表現ルール

- 広告・課金への言及は謝罪調・強制調にしない。静かに事実を述べる
  (説明文の正文は ADS_POLICY.md)。
- **使用禁止**(広告が存在するため誤認を招く): "Ad-free", "No ads",
  "Completely free of ads", "No popup ads", "No forced ads"。
- **使用禁止**(広告削除の買い切りが存在するため誤認を招く): "No purchases",
  "No in-app purchases", 「課金なし」の無条件表現。
  代わりに "No paywalls" / "No subscriptions" /「機能課金なし」
  「ゲーム機能の課金ロックなし」を使う。
- **使用禁止**: "Lifetime Access"(無期限なのは広告削除権であって、
  アプリのサービス存続期間ではない)。

## ストーリー

英語:

> I started Simple Games because I wanted something simple to play during long
> flights. Every game works offline, requires no account, and keeps your
> progress on your device.

日本語:

> 長時間のフライト中に、通信や課金を気にせず遊べるシンプルなゲームが欲しくて、
> このシリーズを作りました。

## ビジュアル

カラーパレットとブランド定数は [`packages/brand`](../packages/brand/src/index.ts) を
唯一の情報源とする。トーン: シンプル・静か・読みやすい・急かさない。
課金ゲーム的な煽り表現を使わない。

### 配色の設計: 共通の下地 + タイトルごとに1色

- **下地(`seriesColors`)は全タイトル共通。** 温かみのある紙色の背景に、
  一段明るいタイルを重ねる。機内や就寝前の暗所で長時間見ても疲れないことを優先し、
  青みがかった灰色は使わない。2つの別ゲームを「同じシリーズ」に見せているのはこの下地である。
- **アクセント(`titleAccents`)はタイトルごとに1色だけ。** 変わるのはここだけで、
  選択状態・主要ボタン・スコアなど「そのゲームの識別色」として実際に画面へ出す。
  アクセントが画面に出ていないと、スクリーンショットがただの白と灰色になる。
- Number Match は **藍 `#3f5b8f`**(ダーク時 `#7d9ccf`)。暗所で目が疲れにくく、
  パズルアプリで飽和していない。緑・朱などは後続タイトルへ回す。
- 新タイトルを追加するときは `titleAccents` に1エントリ足すだけにする。
  存在しないゲームのアクセントを先回りして定義しない。

### コントラスト

本文サイズの文字は背景に対して 4.5:1 以上、アクセント面は 3:1 以上を満たすこと
(ライト/ダーク両方)。配色を変えたら実測して確認する。

## アイコン

- 各ゲームのアイコンは「角丸タイル + シンボル(数字など)」の共通レイアウトを使い、
  ゲームごとにシンボルと**そのタイトルのアクセント色**を変える。
- シリーズ内で完全同一にはせず、同じシリーズと認識できる程度の統一感を持たせる。
- 小さく表示しても認識可能であること。長い文字を入れない。
- 既存ゲームのアイコン・色・盤面を模倣しない。
- ソースは `apps/simple-games/assets/*.svg`。色を変えたら Android リソースを再生成する
  (`capacitor-assets generate --android`)。
- 名称・ロゴ・アイコン・ストア掲載用ブランド素材は Apache-2.0 の対象外
  (ルート README のライセンス節を参照)。
