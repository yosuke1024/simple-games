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

`flagsRef` / `prefsRef` / `activeModeRef` は同じように写しているが**対象外**。1 タスクに
2 回書く経路が無く、書き込みも単発トグルの全置換だからである(CPU 対戦 7 本の
`prefsRef` だけは「先後を選んでから始める」が本当に 1 タップなので先行させている ——
許すが、必須ではない)。

アーケード 4 本(Brick Breaker / Sky Fighter / Bubble Pop / Bunny Hop)にセッションの
口が無いのは、盤面が React state ではなく **board コンポーネント側の権威ある
`useRef`** に載っていて、rAF が毎フレーム直接書き換えているからである。state に
写していない以上、遅れようがない。守るのは統計と進捗だけでよい。
