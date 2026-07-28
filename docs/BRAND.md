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

## メッセージ

英語:

> Fully free. Fully offline. Simply playable.

補助:

> No account. No purchases. No internet required.

日本語:

> 完全無課金。完全オフライン。すぐ遊べる。

ストア表現では広告が存在することを考慮し、必要に応じて以下を優先する。

- No in-app purchases.
- All features available offline.
- No account required.

**使用禁止表現**(広告が存在するため誤認を招く): "Ad-free", "No ads",
"Completely free of ads", "No popup ads", "No forced ads"。

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
- ソースは `apps/<game>/assets/*.svg`。色を変えたら Android リソースを再生成する
  (`capacitor-assets generate --android`)。
