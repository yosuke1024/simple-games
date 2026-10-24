// check-tangram.mjs — Phase 0 THROWAWAY headless check for tangram-board.html.
//
// Drives the prototype in headless Chromium (360x640, touch, isMobile, DPR 2) with real
// synthetic touch input (CDP Input.dispatchTouchEvent -> real hit-testing, pointer events,
// pointer capture and the tap -> click path), a mouse drag, and a few dispatched
// PointerEvents. Prints PASS/FAIL per check with numbers; exits 1 on any failure.
//
// This only shows that the prototype behaves as specified. The Phase 0 gate itself
// (no mis-operations on two real phones) can only be judged on the devices.
//
// Run from the repository root (one line):
//   PW_MODULE=/path/to/node_modules/playwright node apps/simple-games/prototypes/phase0/check-tangram.mjs
// (in the Claude Code cloud container: PW_MODULE=/opt/node-tools/node_modules/playwright)
//
// The page's default snap rule is the plan's (silhouette + placed pieces; ?guide=0), so (2)
// and the snap-tolerance checks (3c)/(3d) run under that rule.
// (PW_MODULE may be omitted when `playwright` resolves from here. Browsers come from
//  PLAYWRIGHT_BROWSERS_PATH as usual; if launch fails, CHROMIUM_PATH or
//  /opt/pw-browsers/chromium is tried as executablePath.)

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

async function loadPlaywright(spec) {
  try {
    const m = await import(spec);
    return m.chromium ? m : m.default;
  } catch (e) {
    // A directory path (e.g. .../node_modules/playwright) cannot be import()ed in ESM; require can.
    try {
      return createRequire(import.meta.url)(spec);
    } catch {
      throw e;
    }
  }
}
const { chromium } = await loadPlaywright(process.env.PW_MODULE || 'playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_URL = pathToFileURL(path.join(HERE, 'tangram-board.html')).href;
const T_START = Date.now();
const HARD_LIMIT_MS = 58000;
const killer = setTimeout(() => {
  console.log('FAIL  timeout: exceeded ' + HARD_LIMIT_MS + ' ms');
  process.exit(1);
}, HARD_LIMIT_MS);

// ---------------------------------------------------------------- results
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  — ' + detail : ''));
}

// ---------------------------------------------------------------- independent geometry (Node side)
// Same frame as the page: big square [0,4]^2, y down, rot k = k*45deg, mirror x before rotating.
const R2 = Math.SQRT1_2;
const ROT = [
  [1, 0],
  [R2, R2],
  [0, 1],
  [-R2, R2],
  [-1, 0],
  [-R2, -R2],
  [0, -1],
  [R2, -R2],
];
const SILS = {
  E1: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
  E2: [
    [0, 4],
    [8, 4],
    [4, 0],
  ],
  E3: [
    [0, 4],
    [4, 4],
    [8, 0],
    [4, 0],
  ],
};
function world(local, pose, canFlip) {
  const [c, s] = ROT[pose.rot];
  const f = canFlip && pose.flip ? -1 : 1;
  return local.map(([x, y]) => [c * f * x - s * y + pose.x, s * f * x + c * y + pose.y]);
}
function areaOf(p) {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return Math.abs(a) / 2;
}
function satOverlap(A, B) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i],
        q = P[(i + 1) % P.length];
      let nx = q[1] - p[1],
        ny = p[0] - q[0];
      const l = Math.hypot(nx, ny);
      nx /= l;
      ny /= l;
      const pa = A.map((v) => v[0] * nx + v[1] * ny),
        pb = B.map((v) => v[0] * nx + v[1] * ny);
      if (
        Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <=
        1e-6
      )
        return false;
    }
  }
  return true;
}
function insideConvex(piece, sil) {
  // sil is convex; orientation-agnostic half-plane test.
  let sign = 0;
  for (let i = 0; i < sil.length; i++) {
    const a = sil[i],
      b = sil[(i + 1) % sil.length];
    for (const v of piece) {
      const o = (b[0] - a[0]) * (v[1] - a[1]) - (b[1] - a[1]) * (v[0] - a[0]);
      if (Math.abs(o) <= 1e-6) continue;
      const sg = Math.sign(o);
      if (sign === 0) sign = sg;
      else if (sg !== sign) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------- browser
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
  });
}
const context = await browser.newContext({
  viewport: { width: 360, height: 640 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const consoleProblems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'assert')
    consoleProblems.push(m.type() + ': ' + m.text());
});
page.on('pageerror', (e) => consoleProblems.push('pageerror: ' + e.message));
await page.goto(PAGE_URL);
const cdp = await context.newCDPSession(page);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const st = () => page.evaluate(() => window.__p0.state());
const br = () => page.evaluate(() => window.__p0.boardRect());
async function touch(type, points) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map((p) => ({
      x: p.x,
      y: p.y,
      id: p.id || 0,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    })),
  });
}
async function settle(ms = 20) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  await sleep(ms);
}
async function center(selector) {
  const r = await page.evaluate((s) => {
    const b = document.querySelector(s).getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
  }, selector);
  return r;
}
let realTaps = 0,
  realDrags = 0,
  lastDragEnd = 0;
// Chromium drops the click of a tap that comes within ~0.3 s after a touch drag (observed
// headless; the page logs such taps as "lost"). Wait that out before tapping — except in (6d),
// which taps 50 ms after a drag on purpose to verify that the page's lostTaps instrumentation works.
const TAP_AFTER_DRAG_MS = 450;
const EXPECT_SNAP_PX = 14; // the plan's recommendation (吸着 14px); (3c)/(3d) use it, not the page's value
async function tapAt(x, y) {
  const wait = lastDragEnd + TAP_AFTER_DRAG_MS - Date.now();
  if (wait > 0) await sleep(wait);
  await touch('touchStart', [{ x, y }]);
  await touch('touchEnd', []);
  realTaps++;
  await settle(25);
}
async function tapSel(selector) {
  const c = await center(selector);
  await tapAt(c.x, c.y);
}
async function dragTouch(x0, y0, x1, y1, opts = {}) {
  const steps = opts.steps || 10;
  await touch('touchStart', [{ x: x0, y: y0 }]);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch('touchMove', [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t }]);
  }
  await settle(5);
  if (opts.beforeEnd) await opts.beforeEnd();
  if (opts.cancel) await touch('touchCancel', []);
  else await touch('touchEnd', []);
  lastDragEnd = Date.now();
  realDrags++;
  await settle(10);
}
const traySel = (id) => `#tray [data-piece="${id}"]`;
async function targetScreen(pose, lift) {
  const b = await br();
  return { x: b.ox + pose.x * b.ppu, y: b.oy + pose.y * b.ppu + (lift ? b.lift : 0) };
}
// 'carry ok' = drawn filled at a valid snapped pose; 'carry ng' = outline only at the raw finger pose.
async function overlayClass() {
  return page.evaluate(() => {
    const p = document.querySelector('#overlay polygon');
    if (p.style.display === 'none') return 'hidden';
    const c = p.getAttribute('class');
    return /\bok\b/.test(c) ? 'carry ok' : /\bng\b/.test(c) ? 'carry ng' : c;
  });
}
function near(a, b) {
  return Math.abs(a - b) < 1e-6;
}
function poseEq(p, q) {
  return (
    p &&
    q &&
    near(p.x, q.x) &&
    near(p.y, q.y) &&
    p.rot % 8 === q.rot % 8 &&
    (p.flip || 0) === (q.flip || 0)
  );
}
async function restart(sil) {
  await tapSel(`[data-sil="${sil}"]`);
}
// Same button, activated without a touch (saves the post-drag tap wait in the long loops of (3c)/(3d)).
async function restartFast(sil) {
  await page.evaluate((x) => document.querySelector(`[data-sil="${x}"]`).click(), sil);
  await settle(5);
}

// Rotate / flip a tray piece with real taps until it matches `sol`; then drag it into place.
async function placeByTouch(sol) {
  let s = await st();
  let tp = s.trayPose[sol.id];
  if (sol.id === 'P' && (tp.flip || 0) !== (sol.flip || 0)) {
    await tapSel(traySel('P')); // selects (and rotates 45deg)
    await tapSel('#btnFlip');
    s = await st();
    tp = s.trayPose.P;
  }
  const n = (sol.rot - tp.rot + 8) % 8;
  for (let i = 0; i < n; i++) await tapSel(traySel(sol.id));
  const from = await center(traySel(sol.id));
  const to = await targetScreen(sol, true);
  await dragTouch(from.x, from.y, to.x, to.y);
  s = await st();
  return s.placed.find((p) => p.id === sol.id);
}

try {
  // ======================================================== (1) load + geometry
  const self = await page.evaluate(() => window.__p0.selfCheck());
  check(
    '(1a) page self-check: 3 solutions ok (area 16, no overlap, inside, complete)',
    self.length === 3 && self.every((r) => r.ok),
    self.map((r) => `${r.id}:area=${r.pieceArea.toFixed(6)},ok=${r.ok}`).join(' '),
  );
  const local = await page.evaluate(() => window.__p0.pieces());
  for (const sid of ['E1', 'E2', 'E3']) {
    const sol = await page.evaluate((x) => window.__p0.solution(x), sid);
    const polys = sol.map((p) => world(local[p.id], p, p.id === 'P'));
    const total = polys.reduce((a, p) => a + areaOf(p), 0);
    let overl = 0;
    for (let i = 0; i < 7; i++)
      for (let j = i + 1; j < 7; j++) if (satOverlap(polys[i], polys[j])) overl++;
    const outside = polys.filter((p) => !insideConvex(p, SILS[sid])).length;
    const silA = areaOf(SILS[sid]);
    const pFlip = sol.find((p) => p.id === 'P').flip;
    check(
      `(1b) ${sid} solution verified in Node`,
      near(total, 16) && near(silA, 16) && overl === 0 && outside === 0,
      `area=${total.toFixed(6)} silArea=${silA} overlaps=${overl} outside=${outside} P.flip=${pFlip}`,
    );
  }

  // ======================================================== (12) layout at 360x640
  const lay = await page.evaluate(() => {
    const b = (id) => document.getElementById(id).getBoundingClientRect();
    return {
      board: b('board'),
      tray: b('tray'),
      actions: b('actions'),
      sw: document.documentElement.scrollWidth,
      info: Array.prototype.map
        .call(document.querySelectorAll('#info div'), (d) => d.textContent)
        .join(' | '),
    };
  });
  check(
    '(12) board + tray + 3 action buttons visible without scrolling; no horizontal scroll',
    lay.board.width === 328 && lay.actions.bottom <= 640 && lay.tray.bottom <= 640 && lay.sw <= 360,
    `board=${lay.board.width}px actionsBottom=${Math.round(lay.actions.bottom)} scrollWidth=${lay.sw} info="${lay.info}"`,
  );

  {
    // (12b) no label is clipped: tallies, controls (incl. both copy status strings), info lines.
    const over = await page.evaluate(() => {
      const bad = [];
      const fits = (el, what) => {
        if (el.scrollWidth > el.clientWidth + 0.5)
          bad.push(`${what}:"${el.textContent}" ${el.scrollWidth}>${el.clientWidth}`);
      };
      document
        .querySelectorAll('#tallies > button, #controls > button')
        .forEach((el) => fits(el, el.id || el.textContent));
      const cp = document.getElementById('btnCopy'),
        t0 = cp.textContent;
      for (const t of ['コピー済み', '手でコピー']) {
        cp.textContent = t;
        fits(cp, 'btnCopy');
      }
      cp.textContent = t0;
      // two-digit tallies
      const tl = document.getElementById('tallySnap'),
        t1 = tl.textContent;
      tl.textContent = t1.replace(/\d+$/, '88');
      fits(tl, 'tallySnap@88');
      tl.textContent = t1;
      const tr = document.getElementById('tallyRep'),
        t2 = tr.textContent;
      tr.textContent = t2.replace(/\d+$/, '88');
      fits(tr, 'tallyRep@88');
      tr.textContent = t2;
      document.querySelectorAll('#info div').forEach((el, i) => fits(el, 'info' + (i + 1)));
      return { bad, copyW: Math.round(cp.getBoundingClientRect().width) };
    });
    check(
      '(12b) labels fit without wrapping/clipping (tallies @2 digits, controls, copy status, info lines)',
      over.bad.length === 0,
      over.bad.length ? over.bad.join('; ') : `ok (copy button ${over.copyW}px)`,
    );
  }
  {
    // (1d) the measured rule is the plan's by default and is printed in START + info; ?guide=1 is labelled.
    const s = await st();
    const b = await br();
    const lg = await page.evaluate(() => window.__p0.log());
    const p2 = await context.newPage();
    await p2.goto(PAGE_URL + '?guide=1');
    const v = await p2.evaluate(() => ({
      rule: window.__p0.state().rule,
      log: window.__p0.log(),
      info: document.getElementById('info').textContent,
    }));
    await p2.close();
    check(
      '(1d) default rule = plan (guide0, snap 14px) in START + info; ?guide=1 variant is labelled',
      s.rule === 'snap14/edge1/guide0/slop6' &&
        b.snapPx === EXPECT_SNAP_PX &&
        /START E1 easy rule=snap14\/edge1\/guide0\/slop6/.test(lg) &&
        lay.info.includes('rule=snap14/edge1/guide0/slop6') &&
        /guide1/.test(v.rule) &&
        /START E1 easy rule=\S*guide1/.test(v.log) &&
        /比較用/.test(v.info),
      `default rule=${s.rule} snapPx=${b.snapPx}; variant rule=${v.rule}`,
    );
  }

  // ======================================================== (2) complete E1/E2/E3 with real touch drags
  const scaleInfo = [];
  for (const sid of ['E1', 'E2', 'E3']) {
    await restart(sid);
    const sol = await page.evaluate((x) => window.__p0.solution(x), sid);
    const t0 = realTaps,
      d0 = realDrags;
    let okPieces = 0;
    let previewSeen = '';
    for (const p of sol) {
      if (!previewSeen) {
        // Check the drawn preview once: filled ("ok") while hovering the valid target.
        let s = await st();
        const tp = s.trayPose[p.id];
        if (p.id === 'P' && (tp.flip || 0) !== (p.flip || 0)) {
          await tapSel(traySel('P'));
          await tapSel('#btnFlip');
        }
        s = await st();
        const n = (p.rot - s.trayPose[p.id].rot + 8) % 8;
        for (let i = 0; i < n; i++) await tapSel(traySel(p.id));
        const from = await center(traySel(p.id));
        const to = await targetScreen(p, true);
        await dragTouch(from.x, from.y, to.x, to.y, {
          beforeEnd: async () => {
            previewSeen = await overlayClass();
          },
        });
        s = await st();
        if (
          poseEq(
            s.placed.find((q) => q.id === p.id),
            p,
          )
        )
          okPieces++;
        continue;
      }
      const got = await placeByTouch(p);
      if (poseEq(got, p)) okPieces++;
    }
    const s = await st();
    const b = await br();
    const lg = await page.evaluate(() => window.__p0.log());
    scaleInfo.push(`${sid}: ${b.ppu.toFixed(1)}px/u smallLeg=${Math.round(b.ppu * Math.SQRT2)}px`);
    check(
      `(2) ${sid} completed by real touch drags + taps (rule guide0)`,
      okPieces === 7 &&
        s.complete === true &&
        /DONE E\d easy rule=snap14\/edge1\/guide0/.test(lg) &&
        previewSeen === 'carry ok',
      `pieces=${okPieces}/7 complete=${s.complete} taps=${realTaps - t0} drags=${realDrags - d0} counters.drags=${s.counters.drags} counters.taps=${s.counters.taps} preview="${previewSeen}" ppu=${b.ppu.toFixed(1)}`,
    );
  }

  // ======================================================== (3) invalid release
  await restart('E1');
  {
    const sol = await page.evaluate(() => window.__p0.solution('E1'));
    const L1 = sol.find((p) => p.id === 'L1');
    // (3a) release over the tray / controls area (far from the silhouette)
    const from = await center(traySel('S1'));
    let mid = '';
    await dragTouch(from.x, from.y, from.x + 10, 600, {
      beforeEnd: async () => {
        mid = await overlayClass();
      },
    });
    let s = await st();
    const lg1 = await page.evaluate(() => window.__p0.log());
    check(
      '(3a) release off the silhouette: piece back in tray, outline while carried, logged',
      s.tray.includes('S1') &&
        s.counters.returnedToTray === 1 &&
        mid === 'carry ng' &&
        /invalid release S1 -> tray/.test(lg1),
      `tray has S1=${s.tray.includes('S1')} returnedToTray=${s.counters.returnedToTray} preview="${mid}"`,
    );
    // (3b) release overlapping a placed piece
    await placeByTouch(L1);
    const f2 = await center(traySel('L2'));
    const to = await targetScreen(L1, true); // L2 at rot 0 on top of L1 -> overlap
    mid = '';
    await dragTouch(f2.x, f2.y, to.x, to.y, {
      beforeEnd: async () => {
        mid = await overlayClass();
      },
    });
    s = await st();
    check(
      '(3b) release overlapping a placed piece: returned to tray, board unchanged',
      s.tray.includes('L2') &&
        s.placed.length === 1 &&
        s.counters.returnedToTray === 2 &&
        mid === 'carry ng',
      `placed=${s.placed.map((p) => p.id)} returnedToTray=${s.counters.returnedToTray} preview="${mid}"`,
    );
  }

  // ======================================================== (3c)/(3d) snap tolerance boundary (real touch drags)
  {
    const sol = await page.evaluate(() => window.__p0.solution('E1'));
    const L1 = sol.find((p) => p.id === 'L1'),
      L2 = sol.find((p) => p.id === 'L2');
    const inside = EXPECT_SNAP_PX - 3,
      outside = EXPECT_SNAP_PX + 6;
    const dirs8 = [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
    ].map(([x, y]) => {
      const l = Math.hypot(x, y);
      return [x / l, y / l];
    });
    // Drags here use 10 small steps like (2): a few big, fast steps make Chromium start a fling, and
    // a tap during the fling is swallowed (the following restart tap was lost — see (6d)).
    // (3c) release at target + (SNAP-3) px: exact solution pose. L1 on an empty board (snaps to the
    // silhouette corners); then L2 next to a placed L1 (snaps to the silhouette and to L1).
    let okN = 0,
      total = 0,
      previews = new Set();
    const fails = [];
    for (const [piece, pre] of [
      [L1, []],
      [L2, [L1]],
    ]) {
      for (const [dx, dy] of dirs8) {
        await restartFast('E1');
        for (const q of pre)
          await page.evaluate((p) => window.__p0.place(p.id, p.x, p.y, p.rot, p.flip), q);
        const from = await center(traySel(piece.id));
        const to = await targetScreen(piece, true);
        let mid = '';
        await dragTouch(from.x, from.y, to.x + dx * inside, to.y + dy * inside, {
          beforeEnd: async () => {
            mid = await overlayClass();
          },
        });
        const s = await st();
        total++;
        previews.add(mid);
        if (
          poseEq(
            s.placed.find((p) => p.id === piece.id),
            piece,
          ) &&
          mid === 'carry ok'
        )
          okN++;
        else fails.push(`${piece.id}@(${dx.toFixed(1)},${dy.toFixed(1)}):${mid}`);
      }
    }
    check(
      `(3c) release ${inside}px from the target (8 directions, L1 alone + L2 beside L1): exact solution pose, drawn filled`,
      okN === total,
      `${okN}/${total} exact; previews=${[...previews]}${fails.length ? ' fails=' + fails.join(',') : ''}`,
    );
    // (3d) release (SNAP+6) px away, in outward directions where no other target is near: outline, back to tray.
    let ngN = 0;
    const outDirs = [
        [0, -1],
        [0.6, -0.8],
        [-0.8, -0.6],
      ],
      fails2 = [];
    for (const [dx, dy] of outDirs) {
      await restartFast('E1');
      const from = await center(traySel('L1'));
      const to = await targetScreen(L1, true);
      let mid = '';
      await dragTouch(from.x, from.y, to.x + dx * outside, to.y + dy * outside, {
        beforeEnd: async () => {
          mid = await overlayClass();
        },
      });
      const s = await st();
      const lg = await page.evaluate(() => window.__p0.log());
      if (
        mid === 'carry ng' &&
        s.tray.includes('L1') &&
        s.placed.length === 0 &&
        s.counters.returnedToTray === 1 &&
        /invalid release L1 -> tray/.test(lg)
      )
        ngN++;
      else
        fails2.push(
          `(${dx},${dy}):${mid} placed=${s.placed.map((p) => p.id)} returned=${s.counters.returnedToTray}`,
        );
    }
    check(
      `(3d) release ${outside}px from the target (3 outward directions): outline while carried, returned to tray`,
      ngN === outDirs.length,
      `${ngN}/${outDirs.length}${fails2.length ? ' fails=' + fails2.join(',') : ''}`,
    );
  }

  // ======================================================== (4) tap = 45deg, 8 taps = identity
  await restart('E1');
  {
    const seq = [];
    for (let i = 0; i < 8; i++) {
      await tapSel(traySel('S2'));
      seq.push((await st()).trayPose.S2.rot);
    }
    const s = await st();
    check(
      '(4a) 8 real taps on a tray piece: +45deg each, back to start',
      seq.join(',') === '1,2,3,4,5,6,7,0' && s.counters.taps === 8,
      `rots=[${seq}] taps=${s.counters.taps}`,
    );
    // Blocked rotation on the board: place all but S2, tap L1 on the board.
    await page.evaluate(() => {
      for (const p of window.__p0.solution('E1'))
        if (p.id !== 'S2') window.__p0.place(p.id, p.x, p.y, p.rot, p.flip);
    });
    const before = (await st()).placed.find((p) => p.id === 'L1');
    const at = await targetScreen(before, false);
    await tapAt(at.x, at.y);
    const s2 = await st();
    const after = s2.placed.find((p) => p.id === 'L1');
    check(
      '(4b) tap on a board piece whose rotation cannot be placed: nothing happens, counted as blocked',
      poseEq(before, after) && s2.counters.blockedRotations === 1 && s2.counters.taps === 9,
      `blockedRotations=${s2.counters.blockedRotations} L1 rot ${before.rot}->${after.rot}`,
    );
  }
  await restart('E1');
  {
    // (4c) a piece that can turn on the board (E1 SQ alone): 8 real taps turn it about a fixed pivot
    // (no translation, logged shift 0.0px) and bring it back to its exact start pose.
    const SQ = (await page.evaluate(() => window.__p0.solution('E1'))).find((p) => p.id === 'SQ');
    await page.evaluate((p) => window.__p0.place(p.id, p.x, p.y, p.rot, p.flip), SQ);
    const piv0 = await page.evaluate(() => window.__p0.pivot('SQ'));
    const rots = [],
      pivOk = [];
    for (let i = 0; i < 8; i++) {
      const cur = (await st()).placed.find((p) => p.id === 'SQ');
      const at = await targetScreen(cur, false);
      await tapAt(at.x, at.y);
      const nx = (await st()).placed.find((p) => p.id === 'SQ');
      rots.push(nx.rot);
      const piv = await page.evaluate(() => window.__p0.pivot('SQ'));
      pivOk.push(near(piv[0], piv0[0]) && near(piv[1], piv0[1]));
    }
    const s = await st();
    const end = s.placed.find((p) => p.id === 'SQ');
    const lg = await page.evaluate(() => window.__p0.log());
    const shifts = (lg.match(/tap rotate SQ \(board\) about [^\n]*shift=([\d.]+)px/g) || []).map(
      (l) => l.match(/shift=([\d.]+)px/)[1],
    );
    check(
      '(4c) 8 real taps on a board piece that can turn: about a fixed pivot, no shift, back to the exact start pose',
      poseEq(end, SQ) &&
        rots.join(',') === '1,2,3,4,5,6,7,0' &&
        pivOk.every(Boolean) &&
        s.counters.blockedRotations === 0 &&
        shifts.length === 8 &&
        shifts.every((x) => x === '0.0'),
      `rots=[${rots}] pivot=(${piv0.map((v) => v.toFixed(2))}) fixed=${pivOk.every(Boolean)} shifts=[${shifts}] end=(${end.x.toFixed(6)},${end.y.toFixed(6)}) start=(${SQ.x},${SQ.y})`,
    );
  }

  // ======================================================== (5) flip: parallelogram only
  await restart('E1');
  {
    await tapSel(traySel('L1'));
    const dis1 = await page.evaluate(() => document.getElementById('btnFlip').disabled);
    const l1Before = (await st()).trayPose.L1;
    const apiFlipL1 = await page.evaluate(() => window.__p0.flip('L1'));
    const l1After = (await st()).trayPose.L1;
    await tapSel(traySel('P'));
    const dis2 = await page.evaluate(() => document.getElementById('btnFlip').disabled);
    const pBefore = (await st()).trayPose.P;
    await tapSel('#btnFlip');
    const pAfter = (await st()).trayPose.P;
    check(
      '(5) 裏返し disabled for non-parallelogram, enabled for P; flip toggles P only',
      dis1 === true &&
        apiFlipL1 === false &&
        l1Before.flip === l1After.flip &&
        dis2 === false &&
        pAfter.flip === 1 - pBefore.flip &&
        pAfter.rot === pBefore.rot,
      `disabled(L1)=${dis1} disabled(P)=${dis2} P.flip ${pBefore.flip}->${pAfter.flip} api.flip(L1)=${apiFlipL1}`,
    );
  }

  // ======================================================== (6) a drag leaves no click rotation behind
  await restart('E1');
  {
    const sol = await page.evaluate(() => window.__p0.solution('E1'));
    const S1 = sol.find((p) => p.id === 'S1'); // rot 0 in the solution, rot 0 in the tray
    // (6a) mouse drag (Chromium fires a click on the captured element after a mouse drag)
    const from = await center(traySel('S1'));
    const to = await targetScreen(S1, true);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++)
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
    await page.mouse.up();
    await settle(30);
    let s = await st();
    const s1 = s.placed.find((p) => p.id === 'S1');
    check(
      '(6a) mouse drag: placed with orientation unchanged; trailing click eaten',
      poseEq(s1, S1) && s.counters.taps === 0 && s.counters.consumedClicks >= 1,
      `S1 rot=${s1 && s1.rot} taps=${s.counters.taps} consumedClicks=${s.counters.consumedClicks}`,
    );
    // (6b) dispatched PointerEvents + click(detail=1) on the same tray element
    const res = await page.evaluate(() => {
      const el = document.querySelector('#tray [data-piece="S2"]');
      const r = el.getBoundingClientRect(),
        x = r.left + r.width / 2,
        y = r.top + r.height / 2;
      const ev = (type, cx, cy) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 41,
            pointerType: 'touch',
            isPrimary: true,
            clientX: cx,
            clientY: cy,
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
          }),
        );
      const rot = () => {
        const s = window.__p0.state();
        return s.trayPose.S2 ? s.trayPose.S2.rot : s.placed.find((p) => p.id === 'S2').rot;
      };
      const r0 = rot();
      // released below the tray (off the silhouette) -> back to the tray, no rotation
      ev('pointerdown', x, y);
      ev('pointermove', x, y + 40);
      ev('pointermove', x, y + 100);
      ev('pointerup', x, y + 100);
      el.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true }));
      const r1 = rot();
      ev('pointerdown', x, y);
      ev('pointerup', x, y);
      el.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true }));
      const r2 = rot();
      return { r0, r1, r2 };
    });
    s = await st();
    check(
      '(6b) dispatched drag + click: no rotation; press -> click on same element: rotates once',
      res.r1 === res.r0 && res.r2 === (res.r0 + 1) % 8,
      `rot ${res.r0} -> after drag+click ${res.r1} -> after tap ${res.r2}; returnedToTray=${s.counters.returnedToTray}`,
    );
    // (6c) touch drag: orientation unchanged
    const SQ = sol.find((p) => p.id === 'SQ');
    const got = await placeByTouch(SQ);
    s = await st();
    check(
      '(6c) touch drag: placed with orientation unchanged (no extra rotation)',
      poseEq(got, SQ),
      `SQ rot=${got && got.rot}`,
    );
  }
  await restart('E1');
  {
    // (6d) a tap 50 ms after a drag: either it rotates, or the page counts it as a lost tap and logs it
    // (headless Chromium drops that click; on real phones this is a measured outcome, not a bug here).
    const from = await center(traySel('S1'));
    await dragTouch(from.x, from.y, from.x + 10, 600); // invalid release -> tray
    await sleep(50);
    const s0 = await st();
    const c = await center(traySel('S2'));
    await touch('touchStart', [{ x: c.x, y: c.y }]);
    await touch('touchEnd', []);
    realTaps++;
    await sleep(750); // the page waits 600 ms for the click before calling the tap lost
    const s1 = await st();
    const lg = await page.evaluate(() => window.__p0.log());
    const rotated = s1.trayPose.S2.rot !== s0.trayPose.S2.rot;
    const lost = s1.counters.lostTaps - s0.counters.lostTaps;
    check(
      '(6d) tap 50 ms after a drag: rotates, or is counted + logged as a lost tap (never both, never neither)',
      (rotated && lost === 0) ||
        (!rotated && lost === 1 && /tap on S2 got no click \(lost tap\)/.test(lg)),
      `rotated=${rotated} lostTaps +${lost}`,
    );
  }

  // ======================================================== (7) pointercancel during a drag
  await restart('E1');
  {
    const sol = await page.evaluate(() => window.__p0.solution('E1'));
    const M = sol.find((p) => p.id === 'M');
    const from = await center(traySel('M'));
    const to = await targetScreen(M, true);
    let mid = '';
    await dragTouch(from.x, from.y, to.x, to.y, {
      cancel: true,
      beforeEnd: async () => {
        mid = (await st()).carrying;
      },
    });
    let s = await st();
    check(
      '(7a) touchcancel while carrying from the tray: piece back in tray, nothing placed',
      mid &&
        mid.id === 'M' &&
        s.tray.includes('M') &&
        s.placed.length === 0 &&
        s.counters.cancels === 1 &&
        s.carrying === null,
      `carrying mid-drag=${JSON.stringify(mid)} cancels=${s.counters.cancels} placed=${s.placed.length}`,
    );
    // from the board: carried board piece also goes to the tray (documented choice); Undo restores it
    await placeByTouch(M);
    const at = await targetScreen(M, false);
    await dragTouch(at.x, at.y, at.x - 60, at.y - 60, { cancel: true });
    s = await st();
    const inTray = s.tray.includes('M');
    await tapSel('#btnUndo');
    const s2 = await st();
    check(
      '(7b) touchcancel while carrying a board piece: goes to tray; Undo puts it back',
      inTray &&
        s.counters.cancels === 2 &&
        poseEq(
          s2.placed.find((p) => p.id === 'M'),
          M,
        ),
      `inTray=${inTray} cancels=${s.counters.cancels} afterUndo=${!!s2.placed.find((p) => p.id === 'M')}`,
    );
  }

  await restart('E1');
  {
    // (7c) the release does what was drawn last: carry L1 onto its target (drawn filled), then move
    // 18 px outward and lift within the same task (no frame in between) -> placed at the drawn pose.
    const L1 = (await page.evaluate(() => window.__p0.solution('E1'))).find((p) => p.id === 'L1');
    const to = await targetScreen(L1, true);
    await page.evaluate(
      ({ tx, ty }) => {
        const el = document.querySelector('#tray [data-piece="L1"]');
        const r = el.getBoundingClientRect(),
          x = r.left + r.width / 2,
          y = r.top + r.height / 2;
        window.__ev7 = (type, cx, cy) =>
          el.dispatchEvent(
            new PointerEvent(type, {
              pointerId: 77,
              pointerType: 'touch',
              isPrimary: true,
              clientX: cx,
              clientY: cy,
              bubbles: true,
              cancelable: true,
              button: 0,
              buttons: 1,
            }),
          );
        window.__ev7('pointerdown', x, y);
        window.__ev7('pointermove', x, y - 30);
        window.__ev7('pointermove', tx, ty);
      },
      { tx: to.x, ty: to.y },
    );
    await settle(10);
    await settle(10);
    const drawn = await overlayClass();
    await page.evaluate(
      ({ tx, ty }) => {
        window.__ev7('pointermove', tx, ty - 18);
        window.__ev7('pointerup', tx, ty - 18);
      },
      { tx: to.x, ty: to.y },
    );
    await settle(10);
    const s = await st();
    const lg = await page.evaluate(() => window.__p0.log());
    check(
      '(7c) move + lift within one frame: decided from the drawn pose (placed where it was drawn filled)',
      drawn === 'carry ok' &&
        poseEq(
          s.placed.find((p) => p.id === 'L1'),
          L1,
        ) &&
        s.counters.returnedToTray === 0 &&
        /decided from the drawn pose/.test(lg),
      `drawn="${drawn}" placed=${s.placed.map((p) => p.id)} returnedToTray=${s.counters.returnedToTray}`,
    );
  }

  // ======================================================== (8) second pointer ignored
  await restart('E1');
  {
    const sol = await page.evaluate(() => window.__p0.solution('E1'));
    const L1 = sol.find((p) => p.id === 'L1');
    const a = await center(traySel('L1'));
    const bpos = await center(traySel('S1'));
    const to = await targetScreen(L1, true);
    const s1rot0 = (await st()).trayPose.S1.rot;
    await touch('touchStart', [{ x: a.x, y: a.y, id: 0 }]);
    await touch('touchMove', [{ x: a.x, y: a.y - 40, id: 0 }]);
    await touch('touchMove', [{ x: (a.x + to.x) / 2, y: (a.y + to.y) / 2, id: 0 }]);
    await touch('touchStart', [
      { x: (a.x + to.x) / 2, y: (a.y + to.y) / 2, id: 0 },
      { x: bpos.x, y: bpos.y, id: 1 },
    ]);
    await touch('touchMove', [
      { x: (a.x + to.x) / 2, y: (a.y + to.y) / 2, id: 0 },
      { x: bpos.x + 30, y: bpos.y - 80, id: 1 },
    ]);
    // finger 1 lifts. (Chromium's CDP treats the points listed in a touchEnd as the ones
    // released — listing finger 0 here would release finger 0.)
    await touch('touchEnd', [{ x: bpos.x + 30, y: bpos.y - 80, id: 1 }]);
    await settle(10);
    const midState = await st();
    await touch('touchMove', [{ x: to.x, y: to.y, id: 0 }]);
    await touch('touchEnd', []);
    await settle(30);
    const s = await st();
    check(
      '(8) second finger during a drag is ignored; the first finger still places',
      midState.carrying &&
        midState.carrying.id === 'L1' &&
        poseEq(
          s.placed.find((p) => p.id === 'L1'),
          L1,
        ) &&
        s.tray.includes('S1') &&
        s.trayPose.S1.rot === s1rot0 &&
        s.counters.ignoredPointers >= 1 &&
        s.counters.drags === 1,
      `ignoredPointers=${s.counters.ignoredPointers} drags=${s.counters.drags} S1 rot ${s1rot0}->${s.trayPose.S1 && s.trayPose.S1.rot} carryingMid=${JSON.stringify(midState.carrying)} L1=${JSON.stringify(s.placed.find((p) => p.id === 'L1') || null)}`,
    );
  }

  await restart('E1');
  {
    // (8b) second finger on the carried piece's OWN (dimmed) tray slot: same element as the first
    // finger's capture, so only the pointerId guards keep it out. The carry continues; finger 1's
    // lift neither places nor returns L1; finger 0 then places it.
    const L1 = (await page.evaluate(() => window.__p0.solution('E1'))).find((p) => p.id === 'L1');
    const a = await center(traySel('L1'));
    const to = await targetScreen(L1, true);
    const mid = { x: (a.x + to.x) / 2, y: (a.y + to.y) / 2 };
    await touch('touchStart', [{ x: a.x, y: a.y, id: 0 }]);
    await touch('touchMove', [{ x: a.x, y: a.y - 40, id: 0 }]);
    await touch('touchMove', [{ ...mid, id: 0 }]);
    await settle(5);
    await touch('touchStart', [
      { ...mid, id: 0 },
      { x: a.x, y: a.y, id: 1 },
    ]);
    await touch('touchMove', [
      { ...mid, id: 0 },
      { x: a.x + 20, y: a.y - 60, id: 1 },
    ]);
    await touch('touchEnd', [{ x: a.x + 20, y: a.y - 60, id: 1 }]);
    await settle(10);
    const m = await st();
    await touch('touchMove', [{ x: to.x, y: to.y, id: 0 }]);
    await settle(10);
    await touch('touchEnd', []);
    await settle(30);
    const s = await st();
    check(
      "(8b) second finger on the carried piece's own tray slot: ignored; carry continues; finger 0 places",
      m.carrying &&
        m.carrying.id === 'L1' &&
        m.placed.length === 0 &&
        m.counters.returnedToTray === 0 &&
        m.counters.ignoredPointers === 1 &&
        poseEq(
          s.placed.find((p) => p.id === 'L1'),
          L1,
        ) &&
        s.counters.returnedToTray === 0 &&
        s.counters.drags === 1,
      `mid: carrying=${JSON.stringify(m.carrying)} placed=${m.placed.length} returned=${m.counters.returnedToTray} ignored=${m.counters.ignoredPointers}; end: L1 placed=${!!s.placed.find((p) => p.id === 'L1')} drags=${s.counters.drags}`,
    );
  }
  await restart('E1');
  {
    // (8c) second finger on the OLD board position of a piece being moved (its invisible hit area).
    const M = (await page.evaluate(() => window.__p0.solution('E1'))).find((p) => p.id === 'M');
    await page.evaluate((p) => window.__p0.place(p.id, p.x, p.y, p.rot, p.flip), M);
    const at = await targetScreen(M, false);
    const away = { x: at.x - 90, y: at.y - 90 };
    await touch('touchStart', [{ x: at.x, y: at.y, id: 0 }]);
    await touch('touchMove', [{ x: at.x - 30, y: at.y - 30, id: 0 }]);
    await touch('touchMove', [{ ...away, id: 0 }]);
    await settle(5);
    await touch('touchStart', [
      { ...away, id: 0 },
      { x: at.x, y: at.y, id: 1 },
    ]);
    await touch('touchMove', [
      { ...away, id: 0 },
      { x: at.x + 5, y: at.y - 40, id: 1 },
    ]);
    await touch('touchEnd', [{ x: at.x + 5, y: at.y - 40, id: 1 }]);
    await settle(10);
    const m = await st();
    await touch('touchMove', [{ x: at.x, y: at.y, id: 0 }]);
    await settle(10);
    await touch('touchEnd', []);
    await settle(30);
    const s = await st();
    check(
      '(8c) second finger on the old board spot of a piece being moved: ignored; finger 0 re-places it',
      m.carrying &&
        m.carrying.id === 'M' &&
        m.counters.returnedToTray === 0 &&
        m.counters.ignoredPointers === 1 &&
        poseEq(
          s.placed.find((p) => p.id === 'M'),
          M,
        ) &&
        s.counters.replaces === 1 &&
        s.counters.returnedToTray === 0,
      `mid: carrying=${JSON.stringify(m.carrying)} returned=${m.counters.returnedToTray} ignored=${m.counters.ignoredPointers}; end: replaces=${s.counters.replaces} M at start=${poseEq(
        s.placed.find((p) => p.id === 'M'),
        M,
      )}`,
    );
  }

  await restart('E1');
  {
    // (8d) two fingers press and lift on the same tray piece (finger 1 lifts first): the click that
    // follows is eaten (no rotation) and must not ALSO be reported as a lost tap 600 ms later.
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#tray [data-piece="S2"]');
      const b = el.getBoundingClientRect(),
        x = b.left + b.width / 2,
        y = b.top + b.height / 2;
      const ev = (type, id) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            pointerId: id,
            pointerType: 'touch',
            isPrimary: id === 51,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: 1,
          }),
        );
      const c0 = window.__p0.state().counters;
      ev('pointerdown', 51);
      ev('pointerdown', 52);
      ev('pointerup', 52);
      ev('pointerup', 51);
      el.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true }));
      await new Promise((res) => setTimeout(res, 750));
      const s = window.__p0.state();
      return {
        rot: s.trayPose.S2.rot,
        lost: s.counters.lostTaps - c0.lostTaps,
        eaten: s.counters.consumedClicks - c0.consumedClicks,
        ignored: s.counters.ignoredPointers - c0.ignoredPointers,
      };
    });
    check(
      '(8d) two fingers on one piece: click eaten, no rotation, and no false lost tap',
      r.rot === 0 && r.lost === 0 && r.eaten === 1 && r.ignored === 1,
      `rot=${r.rot} lostTaps +${r.lost} consumedClicks +${r.eaten} ignoredPointers +${r.ignored}`,
    );
  }

  // ======================================================== (9) undo = one step
  await restart('E1');
  {
    const sol = await page.evaluate(() => window.__p0.solution('E1'));
    await placeByTouch(sol.find((p) => p.id === 'L1'));
    await placeByTouch(sol.find((p) => p.id === 'L2'));
    await tapSel(traySel('S1'));
    const a = await st();
    await tapSel('#btnUndo');
    const b = await st();
    await page.keyboard.press('Control+z');
    const c = await st();
    await tapSel('#btnUndo');
    const d = await st();
    check(
      '(9) Undo reverts exactly one step (rotate, then place, then place)',
      a.trayPose.S1.rot === 1 &&
        b.trayPose.S1.rot === 0 &&
        b.placed.length === 2 &&
        c.placed.length === 1 &&
        c.placed[0].id === 'L1' &&
        d.placed.length === 0 &&
        a.undoDepth - b.undoDepth === 1 &&
        d.counters.undos === 3,
      `placed ${a.placed.length}->${b.placed.length}->${c.placed.length}->${d.placed.length} S1.rot ${a.trayPose.S1.rot}->${b.trayPose.S1.rot} undos=${d.counters.undos}`,
    );
  }

  await restart('E1');
  {
    // (9b) Undo after 完成: banner goes, state is incomplete, re-completing logs a second DONE.
    const startIdx = (await page.evaluate(() => window.__p0.log())).length;
    await page.evaluate(() => {
      for (const p of window.__p0.solution('E1')) window.__p0.place(p.id, p.x, p.y, p.rot, p.flip);
    });
    const a = await st();
    await tapSel('#btnUndo');
    const b = await st();
    const S2 = (await page.evaluate(() => window.__p0.solution('E1'))).find((p) => p.id === 'S2');
    await page.evaluate((p) => window.__p0.place(p.id, p.x, p.y, p.rot, p.flip), S2);
    const c = await st();
    const lg = (await page.evaluate(() => window.__p0.log())).slice(startIdx);
    const dones = (lg.match(/\] DONE E1 /g) || []).length;
    check(
      '(9b) Undo after 完成 hides the banner; completing again logs a second DONE line',
      a.done &&
        a.bannerVisible &&
        !b.done &&
        !b.bannerVisible &&
        !b.complete &&
        /UNDO after DONE/.test(lg) &&
        c.done &&
        c.bannerVisible &&
        dones === 2,
      `before: done=${a.done} banner=${a.bannerVisible}; after undo: done=${b.done} banner=${b.bannerVisible}; again: done=${c.done}; DONE lines=${dones}`,
    );
  }

  // ======================================================== (10) Medium: two fixed pieces
  await restart('E1');
  await tapSel('#btnMedium');
  {
    let s = await st();
    const fixed = s.placed
      .filter((p) => p.fixed)
      .map((p) => p.id)
      .sort()
      .join(',');
    const L1 = s.placed.find((p) => p.id === 'L1');
    const at = await targetScreen(L1, false);
    await dragTouch(at.x, at.y, at.x + 40, at.y + 120);
    await tapAt(at.x, at.y);
    const apiRet = await page.evaluate(() => window.__p0.returnToTray('L1'));
    const apiPlace = await page.evaluate(() => window.__p0.place('P', 2, 2, 0, 0));
    const undo = await page.evaluate(() => window.__p0.undo());
    const s2 = await st();
    const L1b = s2.placed.find((p) => p.id === 'L1');
    const guides = await page.evaluate(() => document.querySelectorAll('#board .guide').length);
    // the remaining 5 still complete the figure
    await page.evaluate(() => {
      for (const p of window.__p0.solution('E1'))
        if (p.id !== 'L1' && p.id !== 'P') window.__p0.place(p.id, p.x, p.y, p.rot, p.flip);
    });
    const s3 = await st();
    check(
      '(10) Medium: L1 + P fixed, cannot be dragged/tapped/returned/undone; no guide lines; still completable',
      s.medium &&
        fixed === 'L1,P' &&
        s.tray.length === 5 &&
        poseEq(L1, L1b) &&
        apiRet === false &&
        apiPlace === false &&
        undo === false &&
        guides === 0 &&
        s2.counters.fixedPresses >= 2 &&
        s3.complete,
      `fixed=${fixed} tray=${s.tray.length} fixedPresses=${s2.counters.fixedPresses} guides=${guides} complete=${s3.complete}`,
    );
    await tapSel('#btnMedium');
  }

  // ======================================================== (11) keyboard
  await restart('E1');
  {
    const sol = await page.evaluate(() => window.__p0.solution('E1'));
    const L1 = sol.find((p) => p.id === 'L1');
    await page.focus(traySel('L1'));
    await page.keyboard.press('Enter');
    const lifted = (await st()).carrying;
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    let s = await st();
    const placed = s.placed.find((p) => p.id === 'L1');
    const focusOnBoard = await page.evaluate(
      () =>
        document.activeElement &&
        document.activeElement.getAttribute('data-piece') === 'L1' &&
        document.activeElement.tagName.toLowerCase() === 'g',
    );
    await page.keyboard.press('Escape');
    const s2 = await st();
    await page.keyboard.press('Control+z');
    const s3 = await st();
    check(
      '(11) keyboard: Enter lifts, arrows move 0.707u, Enter places at nearest snap, Escape returns, Ctrl+Z undoes',
      lifted &&
        lifted.id === 'L1' &&
        poseEq(placed, L1) &&
        focusOnBoard &&
        s2.tray.includes('L1') &&
        poseEq(
          s3.placed.find((p) => p.id === 'L1'),
          L1,
        ),
      `placed=${placed ? `${placed.x.toFixed(3)},${placed.y.toFixed(3)}` : 'no'} focusOnBoard=${focusOnBoard}`,
    );
  }

  // ======================================================== (1c) console
  check(
    '(1c) no console errors / failed console.assert / page errors',
    consoleProblems.length === 0,
    consoleProblems.slice(0, 3).join(' | ') || 'none',
  );
  console.log('INFO  board scale at 360x640: ' + scaleInfo.join('; '));
} catch (e) {
  check(
    'unexpected exception',
    false,
    e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : String(e),
  );
} finally {
  await browser.close();
  clearTimeout(killer);
}

const failed = results.filter((r) => !r.ok).length;
console.log(
  `\nSUMMARY  ${results.length - failed}/${results.length} passed, ${failed} failed  (real taps=${realTaps}, real drags=${realDrags}, ${((Date.now() - T_START) / 1000).toFixed(1)} s)`,
);
process.exit(failed ? 1 : 0);
