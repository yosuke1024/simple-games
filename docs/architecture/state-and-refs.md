# 状態と ref

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

どの `games/*/state/GameContext.tsx` も、状態は `useState` に持ち、それを render
本体で ref へ写している(`const xRef = useRef(x); xRef.current = x;`)。コール
バックが「今の値」を読むためで、こうしておくと状態が変わるたびにコールバックを
作り直さずに済み、context の値も安定する。

**落とし穴は、ref が進むのが render のときだけだという点にある。** React は 1 つの
タスクで起きた更新をまとめ、その render はまだ走っていない。つまり **同じタスクの
中で 2 回ミューテーションが起きると、2 回目は 1 回目が置き換える前の値を読み、
1 回目が消える**。

実際に踏んだのは 2 通り:

- **連続イベント**(pointermove など)。React は discrete イベントと違ってこれらを
  同期 flush しないので、遅い端末では 2 つの move が 1 フレームに入る。Nonogram の
  ドラッグが塗ったマスを落としていたのがこれ(issue #108、
  `nonogram/ui/NonogramRoot.test.tsx` の「two moves land in one render」)。
- **1 つのハンドラが同じ状態を 2 回書く**。ラン終了の記帳と次のランの開始が 1 タップに
  入る形(2048 / Block Puzzle の `startNewGame`、アーケード 4 本の `settle` =
  `bookPlaySeconds` + `reportRunEnd`)。

逆に**危険でないもの**も憶えておく価値がある。タップ・クリック・keydown は 1 つずつ
別タスクなので、キーリピートを含めて間に必ず render が入る。CPU 対戦 7 本の思考も
安全で、1 手 = `session` を deps に持つ effect が張った setTimeout 1 本であり、
次の一手は render を経ないと arm されない(だから checkers の連続ジャンプも
hearts の 3 人分の応手も 1 タスク 1 手に割れている)。

規約:

- **セッション・統計・進捗は、各コンテキストにつき 1 か所からしか書かない** ——
  `putSession` / `persistStats` / `persistProgress`。散らばっていると ref を進める
  場所も散らばる。
- **その 1 か所で、setState より先に ref を進める**。render が同じ値をもう一度
  代入するので、ref と state が食い違うことはない。
- 両方を `src/test/refLeading.test.ts` が機械的に見る(`importBoundaries.test.ts`
  や `shareWiring.test.ts` と同じ立て付けで、新しいゲームが増えた日に落ちる)。

`elapsedRef` / `bookedRef`(再生時間の時計)は state の写しではなく**独立した ref**
で、render では追随しない。だから**マウント時の種**が要る:セッションを復元する
ゲームは、**そのマウントが指しているスロット**の `elapsedSeconds` を両方に入れて
起動する。`syncActiveGame` は表示中の画面に関係なく visibilitychange / pause で走り、
`withElapsed` がこの ref をそのままセッションへ書き込むので、0 のままバックグラウンド
に入ると**中断した盤の時計だけが 0 で上書きされる**(issue #109)。盤そのものは無傷で、
`unbooked` も 0 になるので統計にも傷が出ない —— 消えるのはプレイヤーが積んだ分数だけ
で、どこにも音が鳴らない。`bookedRef` を同じ値にしないと今度は復元済みの秒が統計へ
二重計上されるので、**2 つで 1 つの不変条件**であり片方だけ直してはいけない。
`src/test/playClockSeed.test.ts` が機械的に見る。

**「指しているスロット」は扉によって変わる**、というのが #109 と #113 の合流点で
ある。ショートカットが中断局へ直接入った launch ではその局のスロット、それ以外では
ホームが最初に指すスロット。だから名前は 1 つで、`activeMode` の初期値と時計の種の
両方がそれを読む:

```ts
const mountedMode = resumeMode ?? INITIAL_MODE;      // スロットが複数のゲーム
const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
```

スロットが 1 つのゲームは `initialSession` がそのままマウント中のセッションなので、
扉に関係なくそこから読む。**種を「再開したときだけ」に gate してはいけない**:
コレクションから開いてホームに居るだけの launch も `syncActiveGame` に届くので、
gate すると #109 がそこに残る。逆に `INITIAL_MODE` 固定にすると、デイリーやフリーだけ
中断中のときショートカット再開が空スロットから 0 を読む。**どちらの片側も穴が残る。**

- 実測(2026-09-05):セッションを持つ 24 本のうち 21 本が `useRef(0)` のままだった
  (futoshiki / kakuro / takuzu だけが先に種を持っていた)。形は単一スロット 9 本と
  複数スロット 12 本の 2 つだけで、
  `scripts/codemods/2026-09-05-seed-play-clock-refs.mjs` で揃えた。回帰テストは
  各ゲームの Root テストに 1 本ずつ、
  `scripts/codemods/2026-09-05-suspended-clock-tests.mjs` で入れた。
- #113 との合流(2026-09-05):main 側は同じ概念に 3 つの名前(`mountedMode` /
  `initialMode` / インライン式の `restoredSeconds`)を持ち、残り 21 本は種を
  再開に gate していた。`scripts/codemods/2026-09-05-merge-mounted-slot-clock.mjs`
  で 24 本を上の 1 形に正規化した。

`flagsRef` / `prefsRef` / `activeModeRef` は同じように写しているが**対象外**。1 タスクに
2 回書く経路が無く、書き込みも単発トグルの全置換だからである(CPU 対戦 7 本の
`prefsRef` だけは「先後を選んでから始める」が本当に 1 タップなので先行させている ——
許すが、必須ではない)。

アーケード 4 本(Brick Breaker / Sky Fighter / Bubble Pop / Bunny Hop)にセッションの
口が無いのは、盤面が React state ではなく **board コンポーネント側の権威ある
`useRef`** に載っていて、rAF が毎フレーム直接書き換えているからである。state に
写していない以上、遅れようがない。守るのは統計と進捗だけでよい。
