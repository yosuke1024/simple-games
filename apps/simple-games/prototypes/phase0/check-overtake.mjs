// check-overtake.mjs — Phase 0 の使い捨て検査(overtake-input.html をヘッドレス Chromium で駆動する)
//
// 実行(リポジトリのルートで。Playwright 1.56 以降と Chromium が要る):
//   PW_MODULE=/path/to/node_modules/playwright node apps/simple-games/prototypes/phase0/check-overtake.mjs
//   (開発環境では PW_MODULE=/opt/node-tools/node_modules/playwright)
// PW_MODULE を省くと `import('playwright')` を試す。ブラウザが見つからなければ
// PW_CHROMIUM=/path/to/chrome で実行ファイルを指定できる(既定の予備は /opt/pw-browsers/chromium)。
//
// 何を確かめるか: 試作が仕様どおりに動くこと(入力マッパーの数・ラチェット・第 2 指・cancel・▼・
// モード B・キー・30 秒の計測・ドラッグの click)。**Phase 0 の通過条件そのものは実機でしか判定
// できない**(手触り・親指のずれは合成イベントでは出ない)。
// タッチは CDP の Input.dispatchTouchEvent(本物のタッチ入力 → ブラウザが PointerEvent を作る。
// 指ごとに別の pointerId)、マウスは page.mouse、キーは page.keyboard、時間は __p0.manual(true) +
// __p0.step(ms) で決定的に進める。CDP のタッチは 1 回が約 50 ms かかるので、何百フレームも指を
// 動かす長い列(ラチェットのゆっくりした引き・30 秒の計測)は、本物のタッチで押した指の pointerId を
// 使って page 内で合成した pointermove を投げる(押す・離すは本物のタッチのまま)。
// 60 秒以内に終わらなければ失敗として終える。

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
// PW_MODULE はディレクトリなので ESM の import() では解決できない(ERR_UNSUPPORTED_DIR_IMPORT)。CJS で読む。
const pw = process.env.PW_MODULE ? require(process.env.PW_MODULE) : await import('playwright');
const { chromium } = pw;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL_ = pathToFileURL(path.join(HERE, 'overtake-input.html')).href;
const T_START = Date.now();
const HARD_LIMIT_MS = 58000;

const results = [];
function record(id, name, ok, detail) {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} (${id}) ${name} — ${detail}`);
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const f2 = (v) => (v === null || v === undefined ? String(v) : Number(v).toFixed(2));

const watchdog = setTimeout(() => {
  console.log(`FAIL (timeout) 検査が ${HARD_LIMIT_MS} ms を超えた`);
  process.exit(1);
}, HARD_LIMIT_MS);

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium',
  });
}
const context = await browser.newContext({
  viewport: { width: 360, height: 640 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

let exitCode = 0;
try {
  await page.goto(URL_);
  await page.waitForFunction(() => window.__p0 && typeof window.__p0.state === 'function');
  const cdp = await context.newCDPSession(page);

  // ---------------------------------------------------------------- 道具
  const st = () => page.evaluate(() => window.__p0.state());
  const step = (ms, n = 1) => page.evaluate(([a, b]) => window.__p0.step(a, b), [ms, n]);
  const knobs = (o) => page.evaluate((x) => window.__p0.setKnobs(x), o);
  const reset = () => page.evaluate(() => window.__p0.reset());
  const rectOf = (sel) =>
    page.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      };
    }, sel);

  // CDP のタッチ: 送る点の集合は「いま触れている指の全部」。消えた指は離したことになる。
  const active = new Map();
  const pts = () =>
    [...active.entries()].map(([id, p]) => ({
      x: p.x,
      y: p.y,
      id,
      radiusX: 1,
      radiusY: 1,
      force: 1,
    }));
  const touch = {
    async down(id, x, y) {
      active.set(id, { x, y });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts() });
    },
    async move(id, x, y) {
      active.set(id, { x, y });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts() });
    },
    async up(id) {
      // 実測(Chromium 141 / CDP): touchEnd は「並べた点」を離す。他の指は触れたまま残る。
      const p = active.get(id);
      active.delete(id);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [{ x: p.x, y: p.y, id, radiusX: 1, radiusY: 1, force: 1 }],
      });
    },
    async cancelAll() {
      active.clear();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    },
    async tap(x, y, id = 99) {
      await this.down(id, x, y);
      await this.up(id);
    },
  };

  // 長い列のための page 内の道具: 押している本物の指(__p0.state().steerId)の pointermove を合成し、
  // フレームごとに __p0.step する。frames 回ぶん fn(i) → {x, y} を回し、各フレームの throttle を集計する。
  await page.evaluate(() => {
    window.__drv = {
      move(id, x, y) {
        document.getElementById('cv').dispatchEvent(
          new PointerEvent('pointermove', {
            pointerId: id,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            buttons: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      run(src, frames, dtMs) {
        const fn = new Function('i', 'return (' + src + ')(i);');
        const id = window.__p0.state().steerId;
        let min = 1,
          below = 0,
          last = null;
        for (let i = 1; i <= frames; i++) {
          const p = fn(i);
          this.move(id, p.x, p.y);
          last = window.__p0.step(dtMs);
          if (last.throttle < min) min = last.throttle;
          if (last.throttle < 1) below++;
        }
        return { min, below, last, id };
      },
    };
  });
  const drive = (fnSrc, frames, dtMs) =>
    page.evaluate(([a, b, c]) => window.__drv.run(a, b, c), [fnSrc, frames, dtMs]);

  // ---------------------------------------------------------------- (1) 読み込み
  {
    await page.waitForTimeout(500); // RAF で実時間を少し回す(描画・ループの例外を拾う)
    const s = await st();
    const lay = await page.evaluate(() => {
      const b = document.getElementById('btnBrake');
      const strip = document.getElementById('strip').getBoundingClientRect();
      return {
        sh: document.documentElement.scrollHeight,
        sw: document.documentElement.scrollWidth,
        ih: innerHeight,
        iw: innerWidth,
        stripBottom: strip.bottom,
        brakeTag: b.tagName,
        brakeLabel: b.getAttribute('aria-label'),
        ext: [...document.querySelectorAll('script[src],link[href],img[src]')].length,
      };
    });
    const ok =
      consoleErrors.length === 0 &&
      s.simTime > 200 &&
      lay.sh <= lay.ih &&
      lay.sw <= lay.iw &&
      lay.stripBottom <= 640 &&
      lay.brakeTag === 'BUTTON' &&
      !!lay.brakeLabel &&
      lay.ext === 0;
    record(
      1,
      '読み込み・コンソールエラーなし・スクロールなし',
      ok,
      `errors=${consoleErrors.length} simTime(実時間0.5s)=${Math.round(s.simTime)}ms scroll=${lay.sw}x${lay.sh} viewport=${lay.iw}x${lay.ih} strip.bottom=${Math.round(lay.stripBottom)} ▼=<${lay.brakeTag.toLowerCase()} aria-label="${lay.brakeLabel}"> 外部リソース=${lay.ext} road=${Math.round(s.road.left)}..${Math.round(s.road.right)} canvas=${Math.round(s.road.W)}x${Math.round(s.road.H)}`,
    );
  }

  await page.evaluate(() => window.__p0.manual(true));
  const cv = await rectOf('#cv');
  const cx = cv.cx,
    cy = cv.top + 300;

  // ---------------------------------------------------------------- (2) 横 +100px × gain 1.2
  {
    await knobs({ mode: 'A', gain: 1.2, deadZone: 18, maxBrake: 90, ratchet: 20, cones: false });
    const s0 = await reset();
    await touch.down(1, cx - 60, cy);
    for (let i = 1; i <= 10; i++) {
      await touch.move(1, cx - 60 + 10 * i, cy);
      await step(16);
    }
    const s1 = await step(16, 60);
    await touch.up(1);
    const s2 = await step(16, 30);
    const dx = s1.carX - s0.carX;
    const ok =
      near(dx, 120, 1.5) &&
      near(s2.carX, s1.carX, 0.01) &&
      s2.throttle === 1 &&
      s1.throttle === 1 &&
      s2.steerId === null &&
      s1.steerType === 'touch';
    record(
      2,
      '横ドラッグ +100px (gain 1.2) で車が約 +120px',
      ok,
      `carX ${f2(s0.carX)}→${f2(s1.carX)} (Δ=${f2(dx)}, 期待 120±1.5) 離した後 ${f2(s2.carX)} throttle=${s1.throttle}/${s2.throttle} pointerType=${s1.steerType}`,
    );
  }

  // ---------------------------------------------------------------- (3) 縦の引き: 18 / 54 / 100 px
  {
    await reset();
    const y0 = cv.top + 150;
    await touch.down(1, cx, y0);
    await touch.move(1, cx, y0 + 18);
    const a = await step(16);
    await touch.move(1, cx, y0 + 54);
    const b = await step(16);
    await touch.move(1, cx, y0 + 100);
    const c = await step(16);
    await touch.up(1);
    const d = await step(16);
    // 上へ動かしても全開を超えない
    await touch.down(1, cx, y0 + 200);
    await touch.move(1, cx, y0 + 50);
    const e = await step(16);
    await touch.up(1);
    await step(16);
    const ok =
      a.throttle === 1 &&
      near(b.throttle, 0.5, 0.02) &&
      c.throttle === 0 &&
      d.throttle === 1 &&
      e.throttle === 1 &&
      near(e.baselineY, y0 + 50 - cv.top, 0.5);
    record(
      3,
      '縦の引き 18px=1.0 / 54px≈0.5 / 100px=0',
      ok,
      `18px→${f2(a.throttle)} 54px→${b.throttle.toFixed(3)} 100px→${f2(c.throttle)} 離す→${f2(d.throttle)} 上へ150px→${f2(e.throttle)} (基準も上へ: ${f2(e.baselineY)})`,
    );
  }

  // ---------------------------------------------------------------- (4) ラチェット
  {
    await knobs({ ratchet: 20 });
    await reset();
    const y0 = cv.top + 150;
    // 4a: 40px を 4 秒かけてゆっくり
    await touch.down(1, cx, y0);
    const slow = await drive(`(i) => ({ x: ${cx}, y: ${y0} + 40 * i / 240 })`, 240, 1000 / 60);
    const slowMin = slow.min,
      slowBelow = slow.below;
    await touch.up(1);
    await step(16);
    // 4b: 同じ 40px を 0.2 秒で
    await touch.down(1, cx, y0);
    let fastMin = 1;
    for (let i = 1; i <= 12; i++) {
      // 0.2 秒 = 12 フレーム。ここは本物のタッチで
      await touch.move(1, cx, y0 + (40 * i) / 12);
      const s = await step(1000 / 60);
      if (s.throttle < fastMin) fastMin = s.throttle;
    }
    // そのまま止めておくと基準が追いついて全開へ戻る
    const settled = await step(1000 / 60, 150);
    // 4c: 上へ動かすと基準が付け直される
    const yUp = y0 + 40 - 70;
    await touch.move(1, cx, yUp);
    const up = await step(16);
    await touch.move(1, cx, yUp + 54);
    const re = await page.evaluate(() => window.__p0.state());
    await touch.up(1);
    await step(16);
    // 4d: 戻り速度 0 なら同じゆっくりした 40px で減速が積み上がる
    await knobs({ ratchet: 0 });
    await touch.down(1, cx, y0);
    const noRet = (await drive(`(i) => ({ x: ${cx}, y: ${y0} + 40 * i / 240 })`, 240, 1000 / 60))
      .last;
    await touch.up(1);
    await step(16);
    await knobs({ ratchet: 20 });
    const ok =
      slowMin >= 0.97 &&
      fastMin <= 0.85 &&
      settled.throttle === 1 &&
      near(up.baselineY, yUp - cv.top, 0.5) &&
      near(re.throttle, 0.5, 0.02) &&
      noRet.throttle < 0.8;
    record(
      4,
      'ラチェット(戻り 20px/s)',
      ok,
      `ゆっくり40px/4s: 最低=${slowMin.toFixed(3)} 全開未満=${slowBelow}/240フレーム | 速く40px/0.2s: 最低=${fastMin.toFixed(3)} → 2.5s 保持で ${f2(settled.throttle)} | 上へ70px: 基準=${f2(up.baselineY)} (期待 ${f2(yUp - cv.top)}) → そこから54px で ${re.throttle.toFixed(3)} | 戻り0 でゆっくり40px/4s: ${noRet.throttle.toFixed(3)}`,
    );
  }

  // ---------------------------------------------------------------- (5) 第 2 指
  {
    await reset();
    await touch.down(1, cx - 50, cy);
    await touch.move(1, cx - 30, cy);
    await step(16);
    const s0 = await st();
    await touch.down(2, cx + 80, cv.top + 200);
    const s1 = await step(16);
    await touch.move(1, cx + 20, cy);
    const s2 = await step(16);
    await touch.move(2, cx + 140, cv.top + 260);
    const s3 = await step(16);
    await touch.up(2);
    const s4 = await step(16);
    const s5 = await step(16, 60);
    await touch.up(1);
    await step(16);
    const expectTarget = s0.targetX + 50 * 1.2; // carX0 + (20 + 50px) × 1.2
    const ok =
      s1.throttle === 0 &&
      s1.brakeFingers === 1 &&
      s1.steerId === s0.steerId &&
      near(s2.targetX, expectTarget, 0.5) &&
      near(s3.targetX, s2.targetX, 0.01) &&
      s3.throttle === 0 &&
      s4.throttle === 1 &&
      s4.steerId === s0.steerId &&
      s4.brakeFingers === 0 &&
      near(s5.carX, s2.targetX, 0.5);
    record(
      5,
      '第 2 指 = 最大減速・操舵の指を奪わない',
      ok,
      `第2指: throttle=${s1.throttle} 指の数=${s1.brakeFingers} steerId ${s0.steerId}→${s1.steerId} | 第1指 +50px: targetX ${f2(s2.targetX)} (期待 ${f2(expectTarget)}) | 第2指を動かす: targetX ${f2(s3.targetX)} | 離す: throttle=${s4.throttle} steerId=${s4.steerId} | 1s後 carX=${f2(s5.carX)}`,
    );
  }

  // ---------------------------------------------------------------- (6) pointercancel
  {
    await reset();
    const c0 = (await st()).cancelCount;
    await touch.down(1, cx, cy);
    await touch.move(1, cx + 50, cy);
    const mid = await step(16, 30);
    await touch.cancelAll();
    const s1 = await step(16);
    await step(16, 30);
    const s2 = await st();
    const nx = cx - 100,
      ny = cv.top + 250;
    await touch.down(3, nx, ny);
    const s3 = await step(16);
    await touch.move(3, nx - 30, ny);
    const s4 = await step(16);
    await touch.up(3);
    await step(16);
    const logTxt = await page.evaluate(() => window.__p0.log());
    const ok =
      s1.steerId === null &&
      s1.throttle === 1 &&
      s1.cancelCount === c0 + 1 &&
      near(s2.carX, mid.targetX, 0.5) &&
      near(s3.baselineX, nx - cv.left, 0.5) &&
      near(s3.baselineY, ny - cv.top, 0.5) &&
      near(s3.targetX, s2.carX, 0.01) &&
      near(s4.targetX, s2.carX - 36, 0.5) &&
      /pointercancel 操舵の指/.test(logTxt);
    record(
      6,
      'pointercancel でドラッグを終え、次の押下で基準を取り直す',
      ok,
      `cancel後: steerId=${s1.steerId} throttle=${s1.throttle} cancelCount ${c0}→${s1.cancelCount} carX=${f2(s2.carX)} | 新しい押下: 基準=(${f2(s3.baselineX)},${f2(s3.baselineY)}) 期待=(${f2(nx - cv.left)},${f2(ny - cv.top)}) targetX=${f2(s3.targetX)} | -30px → targetX ${f2(s4.targetX)} (期待 ${f2(s2.carX - 36)}) | ログに cancel 行=${/pointercancel 操舵の指/.test(logTxt)}`,
    );
  }

  // ---------------------------------------------------------------- (7) ▼ の長押し
  {
    await reset();
    const b = await rectOf('#btnBrake');
    await touch.down(5, b.cx, b.cy);
    const s1 = await step(16, 20);
    await touch.up(5);
    const s2 = await step(16);
    const s2b = await step(16, 30);
    // ▼ の押下を OS に取り上げられた(pointercancel)ら減速を解く
    const c0 = s2b.cancelCount;
    await touch.down(5, b.cx, b.cy);
    const k1 = await step(16);
    await touch.cancelAll();
    const k2 = await step(16);
    const k3 = await step(16, 30);
    const cancelLog = /pointercancel 減速/.test(await page.evaluate(() => window.__p0.log()));
    await page.mouse.move(b.cx, b.cy);
    await page.mouse.down();
    const s3 = await step(16);
    await page.mouse.up();
    const s4 = await step(16);
    // キーボードでの活性化(detail 0)は短い減速の一押し
    await page.focus('#btnBrake');
    await page.keyboard.press('Space');
    const s5 = await step(16);
    const s6 = await step(100, 5);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const ok =
      s1.throttle === 0 &&
      s1.holdBrake !== null &&
      s2.throttle === 1 &&
      s2.holdBrake === null &&
      s2b.throttle === 1 &&
      k1.throttle === 0 &&
      k1.holdBrake !== null &&
      k2.throttle === 1 &&
      k2.holdBrake === null &&
      k2.cancelCount === c0 + 1 &&
      k3.throttle === 1 &&
      cancelLog &&
      s3.throttle === 0 &&
      s4.throttle === 1 &&
      s5.throttle === 0 &&
      s6.throttle === 1 &&
      s5.runState === s4.runState;
    record(
      7,
      '▼ を押している間だけ最大減速・pointercancel で解く',
      ok,
      `タッチ: 押す→${s1.throttle} 離す→${s2.throttle} (残る click で減速しない: 0.5s後 ${s2b.throttle}) | タッチ→cancel: ${k1.throttle}→${k2.throttle} holdBrake=${k2.holdBrake} cancelCount ${c0}→${k2.cancelCount} 0.5s後 ${k3.throttle} ログに cancel 行=${cancelLog} | マウス: ${s3.throttle}→${s4.throttle} | キーボード Space: ${s5.throttle}→0.5s後 ${s6.throttle}`,
    );
  }

  // ---------------------------------------------------------------- (8) モード B
  {
    await knobs({ mode: 'B' });
    await reset();
    const y0 = cv.top + 150;
    await touch.down(1, cx, y0);
    await touch.move(1, cx, y0 + 100);
    const s1 = await step(16);
    await touch.move(1, cx + 50, y0 + 100);
    const s2 = await step(16);
    await touch.down(2, cx + 100, cv.top + 300);
    const s3 = await step(16);
    await touch.up(2);
    const s4 = await step(16);
    await touch.up(1);
    await step(16);
    const b = await rectOf('#btnBrake');
    await touch.down(5, b.cx, b.cy);
    const s5 = await step(16);
    await touch.up(5);
    const s6 = await step(16);
    await knobs({ mode: 'A' });
    const ok =
      s1.throttle === 1 &&
      near(s2.targetX - s1.targetX, 60, 0.5) &&
      s3.throttle === 0 &&
      s4.throttle === 1 &&
      s5.throttle === 0 &&
      s6.throttle === 1;
    record(
      8,
      'モード B は縦の引きを無視',
      ok,
      `100px 下へ→${s1.throttle} 横 +50px→targetX Δ${f2(s2.targetX - s1.targetX)} 第2指→${s3.throttle}→${s4.throttle} ▼→${s5.throttle}→${s6.throttle}`,
    );
  }

  // ---------------------------------------------------------------- (9) キー
  {
    await reset();
    await page.evaluate(
      () => document.activeElement && document.activeElement.blur && document.activeElement.blur(),
    );
    await page.keyboard.down('ArrowDown');
    const s1 = await step(16);
    await page.keyboard.up('ArrowDown');
    const s2 = await step(16);
    await page.keyboard.down('s');
    const s3 = await step(16); // KeyS
    await page.keyboard.up('s');
    const s4 = await step(16);
    const x0 = s4.carX;
    await page.keyboard.down('ArrowRight');
    const s5 = await step(25, 10); // 0.25 s
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('a');
    await step(25, 4);
    await page.keyboard.up('a'); // KeyA
    const s6 = await step(16, 30);
    await page.keyboard.press('KeyP');
    const p1 = await st();
    await page.keyboard.press('KeyP');
    const p2 = await st();
    const ok =
      s1.throttle === 0 &&
      s1.keys.brake &&
      s2.throttle === 1 &&
      s3.throttle === 0 &&
      s4.throttle === 1 &&
      near(s5.targetX - x0, 110, 1) &&
      near(s6.targetX, s5.targetX - 44, 1) &&
      p1.paused &&
      !p2.paused;
    record(
      9,
      'キー ↓ / S で減速・→ / A で操舵・P で一時停止',
      ok,
      `↓→${s1.throttle}→${s2.throttle} S→${s3.throttle}→${s4.throttle} →0.25s: targetX Δ${f2(s5.targetX - x0)} (期待 110) A 0.1s: Δ${f2(s6.targetX - s5.targetX)} (期待 -44) P: paused ${p1.paused}→${p2.paused}`,
    );
  }

  // ---------------------------------------------------------------- (10) 30 秒のゲート
  {
    await knobs({ mode: 'A', gain: 1.2, deadZone: 18, maxBrake: 90, ratchet: 20, cones: true });
    await reset();
    const sb = await rectOf('#startGate');
    await touch.tap(sb.cx, sb.cy);
    const armed = await st();
    await touch.down(1, cx, cy);
    const began = await st();
    const t = Date.now();
    // 純粋な横ドラッグ: ±80px を 3 秒周期で。60 fps 相当で 1800 フレーム
    const d = await drive(
      `(i) => ({ x: ${cx} + 80 * Math.sin(2 * Math.PI * i / 180), y: ${cy} })`,
      1800,
      1000 / 60,
    );
    await touch.up(1);
    await step(16);
    const s = await page.evaluate(() => window.__p0.lastSummary());
    const end = await st();
    const logTxt = await page.evaluate(() => window.__p0.log());
    const ok =
      armed.runState === 'armed' &&
      began.runState === 'running' &&
      end.runState === 'done' &&
      s &&
      s.kind === 'gate' &&
      s.complete &&
      near(s.durationMs, 30000, 1) &&
      s.decelPct === 0 &&
      s.dips === 0 &&
      s.pass === true &&
      s.trace.length === 300 &&
      /^F+$/.test(s.trace) &&
      s.valid === true &&
      near(s.touchMs, 30000, 1) &&
      s.grips === 1 &&
      s.regrips === 0 &&
      s.decelPctTouched === 0 &&
      /結果 ゲート 合格/.test(logTxt) &&
      /指 30\.0s\/30\.0s \(100%\)・握り直し 0/.test(logTxt) &&
      /trace\(100ms/.test(logTxt);
    record(
      '10a',
      '30 秒のゲート(純粋な横ドラッグ)= 意図しない減速 0%',
      ok,
      `armed→${armed.runState} 触れる→${began.runState} (pointerId ${d.id}) 終了→${end.runState} | ${s ? `${s.durationMs}ms decel=${s.decelPct.toFixed(2)}% dips=${s.dips} pass=${s.pass} 指=${s.touchMs}ms 握り=${s.grips} 握り直し=${s.regrips} cones=${s.conesPassed}/${s.conesPassed + s.conesMissed} trace=${s.trace.length}文字` : 'summary なし'} (壁時計 ${Date.now() - t}ms)`,
    );
  }
  {
    // 10b: 縦の揺れ ±8px(不感帯の内側)でも 0%
    await reset();
    await page.evaluate(() => window.__p0.startRun('gate'));
    await touch.down(1, cx, cy);
    await drive(
      `(i) => ({ x: ${cx} + 60 * Math.sin(i / 40), y: ${cy} + 8 * Math.sin(i / 7) })`,
      900,
      1000 / 30,
    );
    await touch.up(1);
    await step(16);
    const s = await page.evaluate(() => window.__p0.lastSummary());
    const ok = s.complete && s.decelPct === 0 && s.pass === true;
    record(
      '10b',
      '30 秒のゲート(縦の揺れ ±8px)= 0%',
      ok,
      `decel=${s.decelPct.toFixed(2)}% dips=${s.dips} min=${f2(s.minThrottle)} pass=${s.pass}`,
    );
  }
  {
    // 10c: 途中で 1.2 秒 100px 引く → 不合格として検出される
    await reset();
    await page.evaluate(() => window.__p0.startRun('gate'));
    await touch.down(1, cx, cy);
    await drive(
      `(i) => ({ x: ${cx} + 60 * Math.sin(i / 40), y: ${cy} + ((i / 30 >= 10 && i / 30 < 11.2) ? 100 : 0) })`,
      900,
      1000 / 30,
    );
    await touch.up(1);
    await step(16);
    const s = await page.evaluate(() => window.__p0.lastSummary());
    const firstDip = s.trace.indexOf(s.trace.match(/[0-9]/) ? s.trace.match(/[0-9]/)[0] : 'x');
    const ok =
      s.complete &&
      s.pass === false &&
      s.decelPct > 3 &&
      s.dips === 1 &&
      s.dipsByCause.drag === 1 &&
      s.zeroMs > 0 &&
      near(firstDip, 100, 1);
    record(
      '10c',
      '30 秒のゲート(10s で 1.2s 引く)= 不合格を検出',
      ok,
      `decel=${s.decelPct.toFixed(2)}% (${s.decelMs}ms) dips=${s.dips} 最長=${s.longestDipMs}ms ゼロ=${s.zeroMs}ms 原因=指の引き${s.dipsByCause.drag} pass=${s.pass} trace の最初の減速=${firstDip}×100ms`,
    );
  }
  {
    // 10d: 減速の確認(15 秒・判定なし)— 第 2 指と ▼ で
    await reset();
    const bb = await rectOf('#startBrake');
    await touch.tap(bb.cx, bb.cy);
    await touch.down(1, cx, cy);
    const b = await rectOf('#btnBrake');
    for (let i = 1; i <= 300; i++) {
      if (i === 60) await touch.down(2, cx + 60, cv.top + 120);
      if (i === 90) await touch.up(2);
      if (i === 150) await touch.down(5, b.cx, b.cy);
      if (i === 180) await touch.up(5);
      await step(50);
    }
    await touch.up(1);
    await step(16);
    const s = await page.evaluate(() => window.__p0.lastSummary());
    const ok =
      s.kind === 'brake' &&
      s.complete &&
      s.pass === null &&
      s.durationMs === 15000 &&
      s.dips === 2 &&
      s.dipsByCause.finger2 === 1 &&
      s.dipsByCause.button === 1 &&
      near(s.zeroMs, 3000, 60);
    record(
      '10d',
      '減速の確認(15 秒・判定なし)',
      ok,
      `kind=${s.kind} ${s.durationMs}ms pass=${s.pass} dips=${s.dips} 第2指=${s.dipsByCause.finger2} ▼=${s.dipsByCause.button} ゼロ=${s.zeroMs}ms (期待 3000)`,
    );
  }

  {
    // 10e: 指が触れていた時間。触れないゲート・3 秒で離したゲートは「無効」、握り直しは数える
    await page.click('#resultClose').catch(() => {});
    const sum = () => page.evaluate(() => window.__p0.lastSummary());
    // 触れない 30 秒(Space で開始)
    await reset();
    await page.evaluate(
      () => document.activeElement && document.activeElement.blur && document.activeElement.blur(),
    );
    await page.keyboard.press('Space');
    const sp = await st();
    await step(1000 / 60, 1830);
    const a = await sum();
    const logA = await page.evaluate(() => window.__p0.log());
    // 3 秒だけドラッグして離す
    await reset();
    await page.evaluate(() => window.__p0.startRun('gate'));
    await touch.down(1, cx, cy);
    await drive(`(i) => ({ x: ${cx} + 60 * Math.sin(i / 20), y: ${cy} })`, 180, 1000 / 60);
    await touch.up(1);
    await step(1000 / 60, 1650);
    const b = await sum();
    // 10 秒ごとに握り直す(離している間は 0.1 秒)
    await reset();
    await page.evaluate(() => window.__p0.startRun('gate'));
    for (let k = 0; k < 3; k++) {
      await touch.down(1, cx, cy);
      await drive(
        `(i) => ({ x: ${cx} + 60 * Math.sin(i / 20), y: ${cy} })`,
        k < 2 ? 594 : 640,
        1000 / 60,
      );
      if (k < 2) {
        await touch.up(1);
        await step(1000 / 60, 6);
      }
    }
    await touch.up(1);
    await step(16);
    const c = await sum();
    const ok =
      sp.runState === 'running' &&
      a.complete &&
      a.valid === false &&
      a.pass === null &&
      a.touchMs === 0 &&
      a.grips === 0 &&
      a.decelPctTouched === null &&
      /結果 ゲート 無効/.test(logA) &&
      b.complete &&
      b.valid === false &&
      b.pass === null &&
      near(b.touchMs, 3000, 20) &&
      b.grips === 1 &&
      c.complete &&
      c.valid === true &&
      c.pass === true &&
      c.grips === 3 &&
      c.regrips === 2 &&
      near(c.touchMs, 29800, 40);
    record(
      '10e',
      '指が触れていた時間と握り直し(触れない / 3 秒で離す = 無効)',
      ok,
      `触れない: 指=${a.touchMs}ms (${f2(a.touchPct)}%) 握り=${a.grips} valid=${a.valid} pass=${a.pass} ログ「無効」=${/結果 ゲート 無効/.test(logA)} | 3 秒で離す: 指=${b.touchMs}ms (${f2(b.touchPct)}%) valid=${b.valid} pass=${b.pass} | 握り直し 2 回: 指=${c.touchMs}ms (${f2(c.touchPct)}%) 握り=${c.grips} 握り直し=${c.regrips} valid=${c.valid} pass=${c.pass}`,
    );
  }

  // ---------------------------------------------------------------- (11) ドラッグが残す click
  {
    await page.click('#resultClose').catch(() => {});
    await reset();
    // 盤に届いた click をそのまま数える(試作の使い切りとは別に)
    await page.evaluate(() => {
      window.__rawClicks = 0;
      document.getElementById('cv').addEventListener(
        'click',
        () => {
          window.__rawClicks++;
        },
        true,
      );
    });
    const raw = () => page.evaluate(() => window.__rawClicks);
    const s0 = await st();
    await page.mouse.move(cx - 50, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy, { steps: 5 });
    await page.mouse.up();
    const s1 = await step(16);
    const r1 = await raw(); // マウスのドラッグは click を残す — それを使い切ったことを確かめる
    await page.mouse.click(cx, cy);
    const s2 = await step(16);
    // 一時停止中のドラッグは再開しない(click を使い切る)。タップなら再開する
    await page.keyboard.press('KeyP');
    await page.mouse.move(cx - 50, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 50, cy, { steps: 5 });
    await page.mouse.up();
    const s3 = await st();
    await touch.tap(cx, cy);
    const s4 = await st();
    // タッチのドラッグ(CDP)は click をそもそも生まない — 使い切りの検査ではなく、その事実の記録
    const r4 = await raw();
    await touch.down(1, cx - 40, cy);
    await touch.move(1, cx, cy);
    await touch.move(1, cx + 40, cy);
    await touch.up(1);
    const s5 = await step(16);
    const r5 = await raw();
    const ok =
      r1 === 1 &&
      s1.consumedClicks === s0.consumedClicks + 1 &&
      s1.tapCount === s0.tapCount &&
      s2.tapCount === s0.tapCount + 1 &&
      s3.paused === true &&
      s3.tapCount === s2.tapCount &&
      s4.paused === false &&
      s4.tapCount === s3.tapCount + 1 &&
      r5 === r4 &&
      s5.tapCount === s4.tapCount &&
      s1.steerType === null;
    record(
      11,
      'ドラッグが残す click は使い切る(タップとして働かない)',
      ok,
      `マウスのドラッグ: 届いた click=${r1} 使い切り ${s0.consumedClicks}→${s1.consumedClicks} タップ ${s0.tapCount}→${s1.tapCount} | クリック: タップ→${s2.tapCount} | 一時停止中のドラッグ: paused=${s3.paused} タップ=${s3.tapCount} | タップ: paused=${s4.paused} タップ=${s4.tapCount} | タッチのドラッグは click を生まない: 届いた click ${r4}→${r5} タップ=${s5.tapCount}`,
    );
  }

  // ---------------------------------------------------------------- 最後にもう一度コンソール
  record(
    12,
    '検査中にコンソールエラーなし',
    consoleErrors.length === 0,
    `errors=${consoleErrors.length}${consoleErrors.length ? ' ' + consoleErrors.slice(0, 3).join(' | ') : ''}`,
  );
} catch (e) {
  record('x', '例外', false, String((e && e.stack) || e));
} finally {
  await browser.close().catch(() => {});
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? 'PASS' : 'FAIL'}: ${results.length - failed.length}/${results.length} (${((Date.now() - T_START) / 1000).toFixed(1)}s)`,
);
if (failed.length) exitCode = 1;
clearTimeout(watchdog);
process.exit(exitCode);
