# Trademark and brand policy

**Code is open. The Simple Games and PixApps brands remain official PixApps
identifiers.**

This document explains a boundary that the Apache License 2.0 already draws.
It is **not** a separate license and it adds **no** condition to
[LICENSE](LICENSE). If anything here appears to narrow the rights Apache-2.0
grants you, Apache-2.0 wins — read this as an explanation, not as terms.

日本語版は[このページの後半](#商標とブランドの方針)にあります。

## What the license gives you

Every file in this repository is licensed under the
[Apache License 2.0](LICENSE). You may use, study, modify, redistribute and
commercially exploit the source, including as part of a closed-source or paid
product, subject only to the conditions in §4 of the license itself. Forking is
expected and welcome.

The source is public because "Honest by design" is a claim that should be
checkable rather than trusted. Anyone can verify from this repository that the
app carries no analytics or tracking code, sends no game data anywhere, shows
one banner and no other ad format, locks no game feature behind a purchase,
runs its game logic entirely offline, and depends on no backend of ours. Making
that verifiable is the point of publishing it; discouraging forks is not.

## What the license does not give you

Apache-2.0 §6 is explicit:

> This License does not grant permission to use the trade names, trademarks,
> service marks, or product names of the Licensor, except as required for
> reasonable and customary use in describing the origin of the Work and
> reproducing the content of the NOTICE file.

So the copyright grant and the trademark position are two different things, and
it is worth being precise about which one applies to what:

- **Copyright** in the files — source code, and the brand asset files listed
  below — is licensed to you under Apache-2.0 like everything else in the tree.
  Copying an SVG out of this repository is not, by itself, an infringement.
- **Trademarks** are not licensed at all. `Simple Games` and `PixApps`, and the
  icon and wordmarks that identify them, work as source identifiers: they tell
  a user which app is the official PixApps release. Using them as source
  identifiers for something PixApps did not publish is a trademark matter, and
  Apache-2.0 leaves it exactly where it found it.

In practice the line falls between _possessing_ the files and _presenting_
yourself with them. You may hold a copy of `icon.svg`. You may not ship an app
that uses it as its launcher icon under the name Simple Games, because that
tells users something untrue about where the app came from.

## The names and assets this covers

Names and wordmarks:

- `Simple Games` — the collection name
- `Simple Games: Offline Games` — the store title
- `PixApps` — the publisher
- `by PixApps`, `Simple Games by PixApps`, `A Simple Game by PixApps` — the
  attribution lines, defined in `packages/brand/src/index.ts`

There is no PixApps logo file in this repository; `PixApps` appears as text
only. The Simple Games mark is the collection icon:

| Asset                  | Path                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| Icon sources           | `apps/simple-games/assets/icon.svg`, `icon-background.svg`, `icon-foreground.svg` |
| Splash sources         | `apps/simple-games/assets/splash.svg`, `splash-dark.svg`                          |
| Web favicon            | `apps/simple-games/public/favicon.svg`                                            |
| Android launcher icons | `apps/simple-games/android/app/src/main/res/mipmap-*/ic_launcher*.png`            |
| Android splash         | `apps/simple-games/android/app/src/main/res/drawable*/splash.png`                 |
| iOS app icon           | `apps/simple-games/ios/App/App/Assets.xcassets/AppIcon.appiconset/`               |
| iOS splash             | `apps/simple-games/ios/App/App/Assets.xcassets/Splash.imageset/`                  |
| Store listing copy     | `apps/simple-games/store/listing.md`                                              |

The Android and iOS files are generated from the sources in
`apps/simple-games/assets/` (see [docs/BRAND.md](docs/BRAND.md)「アイコン」), so
replacing the sources and regenerating replaces all of them.

## Redistributing a fork

Nothing here stops you from publishing a fork, including a paid one. Make it
yours, so that a user can tell the two apart:

- **App name.** Choose your own. Do not publish under `Simple Games`,
  `Simple Games: Offline Games`, or a name close enough to be confused with
  them.
- **Application ID.** Change `com.pixapps.simplegames` to your own identifier.
  The stores require this anyway, but the `com.pixapps.` prefix is ours
  regardless.
- **Icon and splash.** Replace the assets above with your own. The brand guide
  in [docs/BRAND.md](docs/BRAND.md) describes how the current icon was designed;
  you are welcome to use the reasoning, not the result.
- **Store listing.** Write your own title, description, screenshots and
  feature graphic. Do not reuse PixApps store material.
- **Attribution lines.** `by PixApps` and the other credit strings in
  `packages/brand/src/index.ts` must not survive into your build.
- **No implied relationship.** Do not describe your fork as official,
  endorsed by, sponsored by, affiliated with, or a new version of PixApps or
  Simple Games.

And keep what Apache-2.0 §4 requires of any redistribution:

- Keep [LICENSE](LICENSE) with the source and with binary distributions.
- Keep existing copyright, patent, trademark and attribution notices —
  `Copyright 2026 Yosuke Suzuki` in [README.md](README.md), and the license
  header of any file that carries one.
- State that you changed the files you changed (§4(b)) — a note in your README
  or changelog is enough; the license does not ask for per-line marking.
- This repository ships **no NOTICE file**, so §4(d) imposes nothing on you. If
  you add your own, it must carry the attribution notices from the work you
  derived from, and your own additions belong beside them rather than in place
  of them.

## Talking about Simple Games

Referring to this project by name, accurately, is fine and is not something
you need permission for. §6 preserves "reasonable and customary use in
describing the origin of the Work", and plain factual statements are exactly
that:

- "based on Simple Games by PixApps"
- "a fork of Simple Games"
- "originally derived from github.com/yosuke1024/simple-games"

What separates these from the uses above is grammatical position as much as
anything: they describe where your app came from. They do not name it.

## Contributions

Contributions are governed by [LICENSE](LICENSE) — Apache-2.0 §5, under which
anything you submit is licensed under the same terms unless you say otherwise.
See [CONTRIBUTING.md](CONTRIBUTING.md). Contributing does not give you rights
in the marks, and it does not give PixApps rights in yours.

## Questions

Open an issue: <https://github.com/yosuke1024/simple-games/issues>. Uses that
fall outside this document — anything that would put the marks on something
PixApps did not publish — need written permission, so ask first.

---

# 商標とブランドの方針

**コードはオープン。「Simple Games」と「PixApps」は PixApps 公式であることを
示す標識のまま。**

この文書は Apache License 2.0 がもともと引いている境界線を説明するもので、
独自のライセンス**ではなく**、[LICENSE](LICENSE) に条件を追加するものでも
**ありません**。もしここに Apache-2.0 が与える権利を狭めて読める箇所があれば、
Apache-2.0 が優先します。規約ではなく説明として読んでください。

## ライセンスが与えるもの

このリポジトリのすべてのファイルは [Apache License 2.0](LICENSE) の下にあります。
ソースの利用・研究・改変・再配布・商用利用ができ、クローズドソースの製品や有料
製品の一部にすることもできます。条件はライセンス §4 に書かれているものだけです。
fork は歓迎します。

ソースを公開しているのは、「Honest by design」を信じてもらうのではなく確かめて
もらうためです。Analytics・トラッキングコードを持たないこと、ゲームデータを
どこにも送らないこと、バナー 1 枠以外の広告フォーマットを持たないこと、ゲーム
機能を課金でロックしていないこと、ゲームロジックがオフラインで完結すること、
自前のバックエンドに依存していないこと — これらはすべてこのリポジトリから
確認できます。公開の目的はそれを検証可能にすることであり、fork を抑止する
ことではありません。

## ライセンスが与えないもの

Apache-2.0 §6 は次のように定めています(参考のための私訳。正文は英語の
[LICENSE](LICENSE) であり、解釈が分かれる場合は英語が優先します)。

> 本ライセンスは、Licensor の商号・商標・サービスマーク・製品名を使用する許諾を
> 与えない。ただし、本著作物の出所を説明するために合理的かつ慣習的に必要な場合、
> および NOTICE ファイルの内容を複製する場合を除く。

つまり著作権のライセンスと商標の扱いは別物です。どちらが何に及ぶのかを
正確に書き分けておきます。

- ファイルの**著作権**は、ソースコードも下記のブランド素材ファイルも、
  ツリー内の他のファイルと同じく Apache-2.0 であなたに許諾されています。
  このリポジトリから SVG をコピーすること自体は侵害ではありません。
- **商標**は一切許諾されていません。`Simple Games` と `PixApps`、およびそれらを
  示すアイコンとワードマークは出所表示として機能します — どのアプリが PixApps
  公式のリリースなのかを利用者に伝えるものです。PixApps が公開していないものの
  出所表示としてこれらを使うことは商標の問題であり、Apache-2.0 はそこに手を
  触れていません。

実務上の線引きは、ファイルを**持っていること**と、それを使って**名乗ること**の
あいだにあります。`icon.svg` のコピーを持つことはできます。しかしそれを
ランチャーアイコンにして `Simple Games` の名前でアプリを出すことはできません。
アプリの出所について、利用者に事実でないことを伝えることになるからです。

## 対象となる名称と素材

名称・ワードマーク:

- `Simple Games` — コレクション名
- `Simple Games: Offline Games` — ストア掲載名
- `PixApps` — 提供元
- `by PixApps` / `Simple Games by PixApps` / `A Simple Game by PixApps` —
  クレジット表記(`packages/brand/src/index.ts` で定義)

PixApps のロゴ画像はこのリポジトリにありません。`PixApps` は文字としてのみ
存在します。Simple Games のマークはコレクションアイコンです。

| 素材                       | パス                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------- |
| アイコンのソース           | `apps/simple-games/assets/icon.svg` / `icon-background.svg` / `icon-foreground.svg` |
| スプラッシュのソース       | `apps/simple-games/assets/splash.svg` / `splash-dark.svg`                           |
| Web の favicon             | `apps/simple-games/public/favicon.svg`                                              |
| Android ランチャーアイコン | `apps/simple-games/android/app/src/main/res/mipmap-*/ic_launcher*.png`              |
| Android スプラッシュ       | `apps/simple-games/android/app/src/main/res/drawable*/splash.png`                   |
| iOS アプリアイコン         | `apps/simple-games/ios/App/App/Assets.xcassets/AppIcon.appiconset/`                 |
| iOS スプラッシュ           | `apps/simple-games/ios/App/App/Assets.xcassets/Splash.imageset/`                    |
| ストア掲載文               | `apps/simple-games/store/listing.md`                                                |

Android と iOS のファイルは `apps/simple-games/assets/` のソースから生成されます
([docs/BRAND.md](docs/BRAND.md)「アイコン」)。ソースを差し替えて再生成すれば
すべて置き換わります。

## fork を再配布する場合

fork の公開を止めるものは何もありません。有料で出しても構いません。ただし
利用者が 2 つを区別できるよう、あなたのものにしてください。

- **アプリ名**: 独自の名前を付ける。`Simple Games` や
  `Simple Games: Offline Games`、およびそれらと混同するような名前で公開しない。
- **アプリケーション ID**: `com.pixapps.simplegames` を自分の識別子に変更する。
  ストアの要件でもありますが、`com.pixapps.` の接頭辞はそれとは無関係に
  PixApps のものです。
- **アイコンとスプラッシュ**: 上記の素材を自分のものに差し替える。現在の
  アイコンの設計意図は [docs/BRAND.md](docs/BRAND.md) にあります。考え方は
  自由に使ってください。結果物ではなく。
- **ストア掲載**: タイトル・説明文・スクリーンショット・フィーチャーグラフィックは
  自分で用意する。PixApps のストア素材を流用しない。
- **クレジット表記**: `packages/brand/src/index.ts` の `by PixApps` などの
  文字列をビルドに残さない。
- **関係の誤認を招かない**: 自分の fork を公式・公認・提携・PixApps や
  Simple Games の新バージョンであるかのように説明しない。

あわせて、Apache-2.0 §4 が再配布に求めるものを守ってください。

- [LICENSE](LICENSE) をソース配布にもバイナリ配布にも同梱する。
- 既存の著作権・特許・商標・帰属の表示を残す — [README.md](README.md) の
  `Copyright 2026 Yosuke Suzuki`、およびライセンスヘッダを持つファイルの
  そのヘッダ。
- 変更したファイルについて、変更した旨を示す(§4(b))。README や変更履歴への
  記載で足ります。行単位の印付けは求められていません。
- このリポジトリは **NOTICE ファイルを持ちません**。したがって §4(d) は
  あなたに何も課しません。独自に追加する場合は、派生元の帰属表示を含めた
  うえで、自分の追記はそれを置き換えるのではなく並べて書いてください。

## Simple Games に言及する

このプロジェクトの名前を正確に挙げること自体は問題なく、許諾も要りません。
§6 は「本著作物の出所を説明するために合理的かつ慣習的に必要な場合」を留保して
おり、事実の記述はまさにそれにあたります。

- "based on Simple Games by PixApps"
- "a fork of Simple Games"
- "originally derived from github.com/yosuke1024/simple-games"

前節の用法との違いは、文法上の位置にもあらわれます。これらはアプリが
**どこから来たか**を説明しています。アプリを**名指し**してはいません。

## コントリビューション

コントリビューションは [LICENSE](LICENSE) — Apache-2.0 §5 に従います。別段の
表明がない限り、提出したものは同じ条件で許諾されます。
[CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。コントリビュートしても
マークに関する権利は生じませんし、PixApps があなたのマークに権利を得ることも
ありません。

## 質問

Issue でどうぞ: <https://github.com/yosuke1024/simple-games/issues>。
この文書の範囲外の使い方 — PixApps が公開していないものにマークを付けることに
なる使い方 — には書面での許諾が必要です。先に聞いてください。
