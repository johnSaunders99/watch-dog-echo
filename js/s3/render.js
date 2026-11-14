// 第三季的畫面：把 js/s3/sim.js 的房間狀態畫到 canvas 上。人、機器和道具用圖集（請圖像模型畫的俯視圖，
// content-s3/atlas.js），圖還沒載入或沒有那一張時退回用程式畫；主角的頭髮和帽子一律用程式畫，才對得上頭像。
// 畫風跟第二季的戰術地圖一致：平塗、深色描邊。邏輯座標是 1600×900，依視窗大小等比例縮放。
// 牆和地板先畫到一張暫存的圖上（地形變了才重畫），其他東西每一幀重畫。
// 粒子、震動、傷害數字這些演出只影響畫面，用 Math.random 沒關係（不影響模擬的結果）。
(function (E) {
  const S3 = E.s3, sim = S3.sim, A = sim.api;
  const { T, W, H, GW, GH } = sim, TAU = Math.PI * 2, hyp = Math.hypot;
  const C = { out: '#0b0f1c', pink: '#ff2e88', cyan: '#6cd6e2', green: '#72e6a4', warn: '#ffb547', bad: '#ff5d6c', white: '#ece8e1', echo: '#c2b3ff' };
  const SMASH_GLOW = '#94ff74';
  const THEME = {
    docks: { floor: '#141a22', floor2: '#171e28', line: '#1f2835', wall: '#2a3242', top: '#3e4a5e', face: '#1a202b', accent: '#ffb547' },
    offices: { floor: '#151726', floor2: '#191b2d', line: '#23263f', wall: '#2d3050', top: '#474c76', face: '#1b1d33', accent: '#6cd6e2' },
    vault: { floor: '#0e151a', floor2: '#111b21', line: '#17323c', wall: '#1d3644', top: '#2f5a6c', face: '#11222b', accent: '#72e6a4' },
  };
  const KIND = {
    guard: { body: '#3b4a6b', head: '#aab4c8' }, rusher: { body: '#c8642a', head: '#2a2f3a' }, shield: { body: '#4a5870', head: '#cfd6e4' },
    sniper: { body: '#5a3f7a', head: '#d9c8f0' }, bomber: { body: '#4f6b3a', head: '#2a2f3a' }, jammer: { body: '#2f6b5e', head: '#9af0d0' },
    heavy: { body: '#7a2f38', head: '#1c2028' }, boss: { body: '#8a2f3a', head: '#1c2028' },
  };
  const rnd = (a, b) => a + Math.random() * (b - a);

  let cv = null, ctx = null, scale = 1, bake = null, bakeKey = '';
  let parts = [], texts = [], beams = [], rings = [];
  let swings = [], flyers = []; // 鐵鎚揮過去的那一下、謝爾蓋丟完貨箱飛走
  let shake = 0, hurtFlash = 0, whiteFlash = 0, clock = 0;
  const flashOf = new Map(); // 敵人被打到時閃一下白

  // ===== 圖集：請圖像模型畫的俯視圖（清單在 content-s3/atlas.js）。圖還沒載入、或沒有這張小圖時，退回用程式畫。 =====
  const sheets = {};
  // 圖由 js/s3/main.js 先載（S3.assets，網址帶這一版的編號）；單獨用畫面的時候自己載。
  function loadAtlas() {
    for (const [id, a] of Object.entries(S3.atlas || {})) {
      const img = S3.assets ? S3.assets.img(a.src) : Object.assign(new Image(), { src: a.src });
      const done = () => { sheets[id] = { img, items: a.items }; };
      if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
    }
  }
  const gearItem = (name) => sheets.gear && sheets.gear.items[name];
  // 劫持不換機體。粉紅底乘上原圖的明暗，再用原圖裁回輪廓；陰影另畫，不會被染色。
  const hijacked = new WeakMap();
  function hijackedSprite(img, it) {
    if (hijacked.has(it)) return hijacked.get(it);
    const cv = Object.assign(document.createElement('canvas'), { width: it.w, height: it.h });
    const g = cv.getContext('2d');
    const stamp = () => g.drawImage(img, it.x, it.y, it.w, it.h, 0, 0, it.w, it.h);
    g.fillStyle = '#ff67af'; g.fillRect(0, 0, it.w, it.h);
    g.globalCompositeOperation = 'multiply'; stamp();
    g.globalCompositeOperation = 'destination-in'; stamp();
    hijacked.set(it, cv);
    return cv;
  }
  // 畫一張小圖：轉到 ang，縮放到圖上的身體半徑等於 r。回傳有沒有畫出來。
  function sprite(sheet, name, x, y, ang, r, alpha = 1, shadow = true, controlled = false) {
    const sh = sheets[sheet], it = sh && sh.items[name];
    if (!it) return false;
    const k = r / it.r;
    ctx.save();
    ctx.translate(x, y);
    if (shadow) { ctx.globalAlpha = alpha * 0.32; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(3, 6, r * 1.05, r * 0.9, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = alpha;
    ctx.rotate(ang);
    const img = controlled ? hijackedSprite(sh.img, it) : sh.img;
    ctx.drawImage(img, controlled ? 0 : it.x, controlled ? 0 : it.y, it.w, it.h, -it.ax * k, -it.ay * k, it.w * k, it.h * k);
    ctx.restore();
    return true;
  }
  // 圖上的身體要畫得比判定的圓大多少。
  const BODY = { drone: 1.75, hound: 1.15, turret: 1.3, heavy: 1.2, bulldog: 1.2, carrier: 1.25 };

  // ===== 主角的紙娃娃：身體是圖（doll 圖集，光頭），衣服和皮膚照這個人的頭像上色，頭髮和帽子用程式畫，手上拿著自己的武器 =====
  // 頭像的上衣款式對到八種身體（tools/art-slice.py 的 DOLLS）。
  const DOLL_OF = {
    hoodie: 'hoodie', polo: 'tee', tee: 'tee', scrubs: 'tee', jacket: 'jacket', denim: 'jacket', sport: 'jacket', cardigan: 'jacket',
    sweater: 'jacket', workshirt: 'jacket', tactical: 'jacket', hivis: 'hivis', turnout: 'hivis', overalls: 'overalls',
    suit: 'suit', blazer: 'suit', waistcoat: 'waistcoat', coat: 'coat',
  };
  const dolls = new Map(); // 每個人上好色的身體（離屏的 canvas），第一次上場時做一次
  function dollOf(person) {
    const sh = sheets.doll;
    if (!sh || !person || !E.faces || !E.faces.look) return null;
    const key = person.id + '|' + person.occupation;
    if (dolls.has(key)) return dolls.get(key);
    const L = person.elite ? S3.ops.profiles[person.elite].look : E.faces.look(person), body = DOLL_OF[L.o.top] || 'jacket';
    const it = sh.items[body], ic = sh.items[body + '.c'], is = sh.items[body + '.s'];
    if (!it || !ic || !is) return null;
    const make = () => Object.assign(document.createElement('canvas'), { width: it.w, height: it.h });
    const cvs = make(), g = cvs.getContext('2d'), tmp = make(), tg = tmp.getContext('2d');
    g.drawImage(sh.img, it.x, it.y, it.w, it.h, 0, 0, it.w, it.h);
    // 底圖在衣服和皮膚的地方是灰階的明暗，乘上這個人的顏色：明暗不變，顏色換掉。
    for (const [m, col] of [[ic, L.o.col], [is, L.skin]]) {
      tg.globalCompositeOperation = 'source-over';
      tg.clearRect(0, 0, it.w, it.h);
      tg.fillStyle = col;
      tg.fillRect(0, 0, it.w, it.h);
      tg.globalCompositeOperation = 'destination-in';
      tg.drawImage(sh.img, m.x, m.y, m.w, m.h, 0, 0, it.w, it.h);
      g.globalCompositeOperation = 'multiply';
      g.drawImage(tmp, 0, 0);
    }
    g.globalCompositeOperation = 'source-over';
    const d = { cv: cvs, it, L };
    dolls.set(key, d);
    return d;
  }

  // 手上的東西：圖集有就用圖（held-*），沒有就用程式畫個大概。len：多長（頭的半徑的幾倍）；grip：手握的地方（從尾端算的比例）。
  // 握得靠後一點：手和袖子會蓋住握的地方，整把槍要露在手前面才認得出來。
  const HELD = {
    pistol: { len: 1.9, grip: 0.1 }, taser: { len: 1.9, grip: 0.1 }, silenced: { len: 2.7, grip: 0.08 },
    shotgun: { len: 3.6, grip: 0.26 }, nailgun: { len: 2.1, grip: 0.12 }, sledge: { len: 3.6, grip: 0.12 },
    hammer: { len: 4.5, grip: 0.16 },
  };
  function heldItem(id, x, y, R) {
    if (id === 'match') id = 'silenced';
    const h = HELD[id] || HELD.pistol, len = h.len * R;
    const sh = id === 'hammer' ? sheets.gear : sheets.doll, it = sh && sh.items[id === 'hammer' ? 'smash' : 'held-' + id];
    if (it) {
      const k = len / it.w;
      ctx.drawImage(sh.img, it.x, it.y, it.w, it.h, x - h.grip * len, y - (it.h * k) / 2, len, it.h * k);
      return;
    }
    const w = R * 0.42, x0 = x - h.grip * len;
    const bar = (fill, a, b, ww) => {
      ctx.beginPath(); ctx.rect(x0 + a * len, y - ww / 2, (b - a) * len, ww);
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = C.out; ctx.lineWidth = Math.max(1, R * 0.1); ctx.stroke();
    };
    if (id === 'shotgun') { bar('#6b4a2e', 0, 0.38, w * 1.1); bar('#2a2d36', 0.3, 1, w * 0.8); bar('#4a3a2a', 0.55, 0.75, w * 1.25); }
    else if (id === 'nailgun') { bar('#ff8a1e', 0, 0.7, w * 1.3); bar('#5a606e', 0.68, 1, w * 0.6); }
    else if (id === 'taser') { bar('#ffd23f', 0, 0.85, w); bar('#1c2028', 0.82, 1, w * 0.8); }
    else if (id === 'silenced') { bar('#2a2d36', 0, 0.55, w); bar('#1c2028', 0.5, 1, w * 0.7); }
    else if (id === 'sledge') { bar('#8a5a2e', 0, 0.84, w * 0.5); bar('#8a93a3', 0.78, 1, w * 1.9); }
    else if (id === 'hammer') { bar('#444a54', 0, 0.85, w * 0.65); bar('#353940', 0.72, 1, w * 3); }
    else bar('#2a2d36', 0, 1, w);
  }

  // 頭髮和帽子（俯視，臉朝 +x）：一般人沿用頭像外觀，特工使用固定設定。R：光頭那一圈的半徑。
  function headTop(L, R) {
    const tone = E.faces.tone, o = L.o, st = L.style, lw = Math.max(0.8, R * 0.12);
    const hc = L.hairC, hd = tone(hc, -0.32), hl = tone(hc, 0.22);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 一塊有黑邊的形狀；給好幾塊就拼成一塊（先描全部的邊、再填全部的色，接縫就不會有線）。
    const shape = (fill, ...paths) => {
      ctx.strokeStyle = C.out; ctx.lineWidth = lw * 2;
      for (const p of paths) { ctx.beginPath(); p(); ctx.stroke(); }
      ctx.fillStyle = fill;
      for (const p of paths) { ctx.beginPath(); p(); ctx.fill(); }
    };
    const disc = (x, y, r) => () => ctx.arc(x * R, y * R, r * R, 0, TAU);
    const oval = (x, y, rx, ry) => () => ctx.ellipse(x * R, y * R, rx * R, ry * R, 0, 0, TAU);
    const line = (col, w, pts) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)));
      ctx.strokeStyle = col; ctx.lineWidth = w * R; ctx.stroke();
    };
    const strand = (col, w, pts) => { line(C.out, w + (lw * 2) / R, pts); line(col, w, pts); }; // 有黑邊的粗線
    const ring = (col, r, w, a0 = 0, a1 = TAU) => {
      for (const [c, ww] of [[C.out, w * R + lw * 2], [col, w * R]]) {
        ctx.beginPath(); ctx.arc(-0.05 * R, 0, r * R, a0, a1); ctx.strokeStyle = c; ctx.lineWidth = ww; ctx.stroke();
      }
    };
    const bumps = (cx, ring, r, n) => Array.from({ length: n }, (_, i) => disc(cx + Math.cos((i / n) * TAU) * ring, Math.sin((i / n) * TAU) * ring, r));

    // 頭髮。垂在後面的（長髮、馬尾、辮子、髮束）先畫，再畫頭頂那一片。
    if (st === 'long') {
      // 長髮：從頭的兩邊往後披到背上，越往後越窄。
      shape(hc, () => {
        ctx.moveTo(-0.1 * R, -0.98 * R);
        ctx.quadraticCurveTo(-1.0 * R, -1.02 * R, -1.5 * R, -0.5 * R);
        ctx.quadraticCurveTo(-1.72 * R, 0, -1.5 * R, 0.5 * R);
        ctx.quadraticCurveTo(-1.0 * R, 1.02 * R, -0.1 * R, 0.98 * R);
        ctx.closePath();
      });
      for (const y of [-0.42, 0, 0.42]) line(hd, 0.07, [[-0.95, y * 1.2], [-1.45, y * 0.8]]);
    }
    if (st === 'ponytail') shape(hc, oval(-1.55, 0, 0.6, 0.27));
    if (st === 'locs' || st === 'braids') {
      const n = st === 'locs' ? 7 : 2;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (n === 2 ? (i ? 0.38 : -0.38) : (i - (n - 1) / 2) * 0.3);
        strand(hc, st === 'locs' ? 0.27 : 0.22, [[Math.cos(a) * 0.6, Math.sin(a) * 0.6], [Math.cos(a) * 1.75, Math.sin(a) * 1.5]]);
      }
    }
    if (st === 'afro') shape(hc, ...bumps(-0.15, 1.0, 0.42, 10), disc(-0.15, 0, 1.05));
    else if (st === 'curly') shape(hc, ...bumps(-0.12, 0.72, 0.34, 8), disc(-0.12, 0, 0.8));
    else if (st === 'bob') shape(hc, oval(-0.14, 0, 1.06, 1.2));
    else if (st === 'mohawk') {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * 0.3; ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(0, 0, R * 0.96, 0, TAU); ctx.fill(); // 兩邊剃短
      ctx.globalAlpha = a;
      shape(hc, oval(-0.12, 0, 1.08, 0.24));
      for (let i = 0; i < 4; i++) line(hd, 0.06, [[0.6 - i * 0.45, -0.12], [0.4 - i * 0.45, 0.12]]);
    } else if (st !== 'bald') shape(hc, oval(-0.12, 0, 0.98, 1.03)); // 一般的頭髮：蓋住頭頂，前面露出一點額頭
    // 細節：分線、辮子的紋路、髮圈、髮髻、光頭的反光
    if (st === 'side') line(hd, 0.09, [[0.72, -0.38], [-0.85, -0.3]]);
    if (st === 'bob' || st === 'long') line(hd, 0.08, [[0.8, 0], [-0.6, 0]]);
    if (st === 'braids') for (const y of [-0.42, 0, 0.42]) line(hd, 0.08, [[0.7, y * 0.8], [-0.88, y]]);
    if (st === 'locs') for (const y of [-0.4, 0.05, 0.45]) line(hd, 0.07, [[0.55, y], [-0.6, y * 1.1]]);
    if (st === 'ponytail') shape(hd, disc(-1.0, 0, 0.17));
    if (st === 'bun') { shape(hc, disc(-0.45, 0, 0.42)); line(hd, 0.07, [[-0.6, -0.15], [-0.4, 0.05], [-0.55, 0.22]]); }
    if (['crop', 'side', 'long', 'ponytail', 'bun', 'bob'].includes(st)) line(hl, 0.12, [[0.3, -0.52], [-0.3, -0.64]]);
    if (st === 'bald') { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(0.12 * R, -0.32 * R, 0.36 * R, 0.2 * R, -0.3, 0, TAU); ctx.fill(); }

    // 帽子：跟頭像同一頂、同一個顏色。
    const hat = o.hat;
    if (!hat) return;
    const col = o.hatCol || '#3a3a42', dk = tone(col, -0.25), lt = tone(col, 0.25);
    if (hat === 'beekeeper') {
      shape('#344047', oval(0.34, 0, 1.26, 1.14));
      for (const y of [-0.65, -0.3, 0.05, 0.4, 0.72]) line('#8c9290', 0.06, [[0.67, y], [1.42 - Math.abs(y) * 0.2, y]]);
      for (const x of [1.04, 1.23, 1.4]) line('#9caaa8', 0.05, [[x, -0.45], [x, 0.45]]);
      shape(col, oval(-0.22, 0, 1.25, 1.34)); shape(lt, oval(-0.28, 0, 0.78, 0.87));
    } else if (hat === 'hardhat') { shape(dk, oval(0.05, 0, 1.3, 1.22)); shape(col, disc(-0.05, 0, 0.98)); line(lt, 0.2, [[-0.85, 0], [0.85, 0]]); }
    else if (hat === 'firehelmet') { shape(dk, oval(-0.45, 0, 1.55, 1.25)); shape(col, disc(0, 0, 0.98)); line(lt, 0.18, [[-0.85, 0], [0.85, 0]]); shape('#ffd23f', disc(0.95, 0, 0.22)); }
    else if (hat === 'bikehelmet') { shape(col, oval(-0.12, 0, 1.25, 1.04)); for (const y of [-0.42, 0, 0.42]) line('#1c2028', 0.13, [[-0.65, y * 0.9], [0.45, y]]); }
    else if (hat === 'cap') { shape(dk, oval(0.95, 0, 0.62, 0.72)); shape(col, disc(-0.08, 0, 1.0)); shape(dk, disc(-0.08, 0, 0.1)); }
    else if (hat === 'flatcap') { shape(dk, oval(0.82, 0, 0.42, 0.66)); shape(col, oval(-0.1, 0, 1.06, 1.0)); line(dk, 0.07, [[0.55, -0.6], [0.7, 0], [0.55, 0.6]]); }
    else if (hat === 'beanie') { shape(col, disc(-0.05, 0, 1.08)); ring(dk, 0.9, 0.2); line(lt, 0.12, [[0.25, -0.45], [-0.3, -0.55]]); } // 反摺的帽緣
    else if (hat === 'hood') { shape(o.col, disc(-0.2, 0, 1.24)); shape(tone(o.col, -0.45), oval(0.62, 0, 0.42, 0.72)); }
    else if (hat === 'headband') { ring(col, 0.95, 0.2); strand(col, 0.14, [[-1.0, 0], [-1.45, -0.22]]); strand(col, 0.14, [[-1.0, 0], [-1.4, 0.2]]); }
    else if (hat === 'headset') {
      strand(col, 0.2, [[-0.02, -1.0], [-0.02, 1.0]]);
      shape('#1c2028', oval(0, -1.0, 0.3, 0.2), oval(0, 1.0, 0.3, 0.2));
      line('#1c2028', 0.08, [[0.15, 1.02], [0.6, 0.85], [0.85, 0.5]]);
      shape(col, disc(0.85, 0.5, 0.12));
    } else if (hat === 'visor') {
      ring(col, 0.96, 0.22, -1.25, 1.25);
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * 0.6; shape(col, oval(1.02, 0, 0.26, 0.78)); ctx.globalAlpha = a;
    }
  }

  // 主角：影子、手上的武器、上好色的身體、頭髮和帽子。回傳有沒有畫出來（圖還沒載入時退回分類的圖）。
  function drawDoll(s, p, alpha, subject = s.build) {
    const d = dollOf(subject && subject.person);
    if (!d) return false;
    const it = d.it, size = p.r * 1.3, k = size / it.r, R = it.hr * k;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = alpha * 0.32; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(3, 6, size * 1.05, size * 0.9, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.rotate(p.ang);
    if (subject.weapon) heldItem(subject.weapon, (it.gx - it.ax) * k, (it.gy - it.ay) * k, R);
    ctx.drawImage(d.cv, -it.ax * k, -it.ay * k, it.w * k, it.h * k);
    headTop(d.L, R);
    ctx.restore();
    return true;
  }

  function init(canvas) { cv = canvas; ctx = cv.getContext('2d'); resize(); loadAtlas(); }
  function resize() {
    if (!cv) return;
    const box = (cv.closest('[data-fit]') || cv.parentElement).getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.min(box.width / W, box.height / H);
    cv.style.width = Math.floor(W * k) + 'px';
    cv.style.height = Math.floor(H * k) + 'px';
    cv.width = Math.floor(W * k * dpr);
    cv.height = Math.floor(H * k * dpr);
    scale = cv.width / W;
    bakeKey = '';
  }
  // 滑鼠在畫面上的位置 → 邏輯座標
  function toWorld(clientX, clientY) {
    const b = cv.getBoundingClientRect();
    return { x: ((clientX - b.left) / b.width) * W, y: ((clientY - b.top) / b.height) * H };
  }
  function reset() { parts = []; texts = []; beams = []; rings = []; swings = []; flyers = []; shake = hurtFlash = whiteFlash = 0; flashOf.clear(); bakeKey = ''; }

  // ===== 地板和牆 =====
  function bakeRoom(s) {
    const th = THEME[s.spec.theme] || THEME.docks, tiles = s.spec.tiles;
    bake = document.createElement('canvas');
    bake.width = cv.width; bake.height = cv.height;
    const g = bake.getContext('2d');
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.fillStyle = th.floor;
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (tiles[y * GW + x]) continue;
      if ((x + y) % 2) { g.fillStyle = th.floor2; g.fillRect(x * T, y * T, T, T); }
    }
    // 地上的標線：每個房間不一樣，但同一個房間每次都一樣。
    const r = E.rng.create(s.spec.seed ^ 0x5a5a);
    g.globalAlpha = 0.5;
    for (let i = 0; i < 14; i++) {
      const x = r.int(2, GW - 3), y = r.int(2, GH - 3);
      if (tiles[y * GW + x]) continue;
      g.strokeStyle = th.line; g.lineWidth = 3;
      if (s.spec.theme === 'docks') {
        g.strokeStyle = i % 3 ? th.line : 'rgba(255,181,71,0.25)';
        g.setLineDash([14, 10]);
        g.beginPath(); g.moveTo(x * T, y * T + T / 2); g.lineTo((x + r.int(2, 5)) * T, y * T + T / 2); g.stroke();
        g.setLineDash([]);
      } else if (s.spec.theme === 'offices') g.strokeRect(x * T + 6, y * T + 6, r.int(1, 3) * T - 12, r.int(1, 2) * T - 12);
      else { g.strokeStyle = 'rgba(114,230,164,0.14)'; g.beginPath(); g.moveTo(x * T, y * T); g.lineTo(x * T, (y + r.int(1, 4)) * T); g.lineTo((x + r.int(1, 3)) * T, (y + 2) * T); g.stroke(); }
    }
    g.globalAlpha = 1;
    g.strokeStyle = th.line; g.lineWidth = 1; g.globalAlpha = 0.5;
    for (let x = 1; x < GW; x++) { g.beginPath(); g.moveTo(x * T, 0); g.lineTo(x * T, H); g.stroke(); }
    for (let y = 1; y < GH; y++) { g.beginPath(); g.moveTo(0, y * T); g.lineTo(W, y * T); g.stroke(); }
    g.globalAlpha = 1;
    // 牆：上面亮、朝下的那一面暗，看起來有一點高度。
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (!tiles[y * GW + x]) continue;
      g.fillStyle = th.wall;
      g.fillRect(x * T, y * T, T, T);
      g.fillStyle = th.top;
      g.fillRect(x * T, y * T, T, T - 10);
      const below = y + 1 < GH && !tiles[(y + 1) * GW + x];
      if (below) { g.fillStyle = th.face; g.fillRect(x * T, y * T + T - 10, T, 10); }
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(x * T, y * T, T, 3);
    }
    // 牆和地板的交界描一圈深色
    g.strokeStyle = C.out; g.lineWidth = 3;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (!tiles[y * GW + x]) continue;
      const f = (dx, dy) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < GW && ny < GH && !tiles[ny * GW + nx]; };
      g.beginPath();
      if (f(1, 0)) { g.moveTo((x + 1) * T, y * T); g.lineTo((x + 1) * T, (y + 1) * T); }
      if (f(-1, 0)) { g.moveTo(x * T, y * T); g.lineTo(x * T, (y + 1) * T); }
      if (f(0, 1)) { g.moveTo(x * T, (y + 1) * T); g.lineTo((x + 1) * T, (y + 1) * T); }
      if (f(0, -1)) { g.moveTo(x * T, y * T); g.lineTo((x + 1) * T, y * T); }
      g.stroke();
    }
    // 入口
    g.fillStyle = 'rgba(255,46,136,0.16)';
    g.fillRect(s.spec.entry.x - 60, H - T - 6, 120, 6);
    bakeKey = s.spec.seed + ':' + cv.width;
  }

  // ===== 小工具 =====
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); };
  function outline(fill, lw = 2.5) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.out; ctx.stroke(); }
  function label(text, x, y, color, size = 15, align = 'center') {
    ctx.font = `700 ${size}px "Noto Sans TC","Microsoft JhengHei","PingFang TC",system-ui,sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(11,15,28,0.9)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  // 人畫得比判定的圓大一點，在大場地裡才看得清楚。
  function person(x, y, r0, ang, col, gun, alpha = 1) {
    const r = r0 * 1.22;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(3, 6, r * 1.05, r * 0.9, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.rotate(ang);
    if (gun) { ctx.fillStyle = '#0d1118'; ctx.fillRect(r * 0.2, r * 0.3, gun, 5); }
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.72, r * 1.05, 0, 0, TAU); outline(col.body);
    circle(r * 0.12, 0, r * 0.52); outline(col.head, 2);
    ctx.restore();
  }
  function jagged(x1, y1, x2, y2, amp, seg) {
    const n = Math.max(2, Math.floor(hyp(x2 - x1, y2 - y1) / seg));
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(x1 + (x2 - x1) * t + rnd(-amp, amp), y1 + (y2 - y1) * t + rnd(-amp, amp)); }
    ctx.lineTo(x2, y2);
  }

  // ===== 設施 =====
  function drawProp(s, pr, ui) {
    if (pr.gone) return;
    const x = pr.x, y = pr.y, hot = ui.hack && ui.hack.prop === pr;
    // 有圖集就用圖（r 是圖比較短的那一邊的一半），沒有就用程式畫。
    const art = (name, ang, r, alpha = 1) => sprite('props', name, x, y, ang, r, alpha, false);
    ctx.save();
    if (pr.kind === 'crate') {
      if (art('crate', 0, 25)) { ctx.restore(); return; }
      ctx.beginPath(); ctx.rect(x - 22, y - 22, 44, 44); outline(pr.temp !== undefined ? '#8a5a2c' : '#5b4630');
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 22, y - 22); ctx.lineTo(x + 22, y + 22); ctx.moveTo(x + 22, y - 22); ctx.lineTo(x - 22, y + 22); ctx.stroke();
    } else if (pr.kind === 'junction') {
      const live = !pr.used;
      if (!art('junction', 0, 21, live ? 1 : 0.4)) {
        ctx.beginPath(); ctx.rect(x - 20, y - 22, 40, 44); outline(live ? '#c9a227' : '#4a4a3a');
        ctx.fillStyle = C.out;
        ctx.beginPath(); ctx.moveTo(x + 3, y - 14); ctx.lineTo(x - 8, y + 2); ctx.lineTo(x - 1, y + 2); ctx.lineTo(x - 4, y + 14); ctx.lineTo(x + 8, y - 3); ctx.lineTo(x + 1, y - 3); ctx.closePath(); ctx.fill();
      }
      if (pr.fuse > 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; circle(x, y, 30 + Math.sin(clock * 60) * 6); ctx.stroke(); }
      if (pr.used && pr.cool > 0) { ctx.strokeStyle = C.warn; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 28, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - pr.cool / 10)); ctx.stroke(); }
    } else if (pr.kind === 'vent') {
      if (!art('vent', 0, 21, pr.cool > 0 ? 0.5 : 1)) {
        circle(x, y, 20); outline(pr.cool > 0 ? '#2a3038' : '#44505e');
        ctx.strokeStyle = C.out; ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - 13, y + i * 8); ctx.lineTo(x + 13, y + i * 8); ctx.stroke(); }
      }
    } else if (pr.kind === 'barrel') {
      if (art('barrel', 0, 21)) {
        // 快炸的時候閃白
        if (pr.fuse > 0 && Math.sin(clock * 50) > 0) { ctx.globalAlpha = 0.7; circle(x, y, 21); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
      } else {
        circle(x, y, 19); outline(pr.fuse > 0 && Math.sin(clock * 50) > 0 ? '#fff' : '#b8332a');
        circle(x, y, 11); ctx.strokeStyle = '#f2c84b'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#f2c84b'; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 6, y + 5); ctx.lineTo(x - 6, y + 5); ctx.closePath(); ctx.fill();
      }
    } else if (pr.kind === 'car') {
      const turn = [0, Math.PI / 2, Math.PI, -Math.PI / 2][pr.dir];
      // 碼頭是叉車，其他地方是無人車（同一種設施，只是長相不同）。
      if (!art(s.spec.theme === 'docks' && pr.id % 2 ? 'forklift' : 'car', turn, 25, pr.used ? 0.5 : 1)) {
        ctx.translate(x, y);
        ctx.rotate(turn);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-46, -16, 96, 40);
        ctx.beginPath(); ctx.roundRect(-48, -21, 96, 42, 9); outline(pr.used ? '#3a3f4a' : '#2f6fb0', 3);
        ctx.fillStyle = pr.used ? '#22262e' : '#9fd4f5';
        ctx.fillRect(12, -15, 16, 30);
        ctx.fillStyle = 'rgba(11,15,28,0.6)'; ctx.fillRect(-30, -15, 30, 30);
        if (!pr.used) { ctx.fillStyle = '#fff3b0'; ctx.fillRect(44, -17, 4, 8); ctx.fillRect(44, 9, 4, 8); }
      }
    } else if (pr.kind === 'bollard') {
      const up = pr.up > 0;
      for (let i = 0; i < 3; i++) {
        const bx = pr.horiz ? pr.tx * T + T / 2 + i * T : x, by = pr.horiz ? y : pr.ty * T + T / 2 + i * T;
        if (up) { if (!sprite('props', 'bollard', bx, by, 0, 21, 1, true)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; circle(bx + 3, by + 6, 18); ctx.fill(); circle(bx, by, 17); outline('#d8b13a', 3); circle(bx, by, 8); ctx.fillStyle = '#2a2f3a'; ctx.fill(); } }
        else { circle(bx, by, 13); ctx.fillStyle = '#20262f'; ctx.fill(); ctx.strokeStyle = pr.cool > 0 ? '#3a3f4a' : '#8a7a3a'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    } else if (pr.kind === 'camera' || pr.kind === 'speaker') {
      ctx.translate(x, y);
      if (pr.kind === 'camera') {
        const on = !pr.looped && pr.down <= 0 && !s.alert && !s.cleared;
        if (on) {
          const sight = pr.def.sight * A.sightMul(s);
          const col = pr.aware > 0 ? '255,93,108' : '255,181,71';
          ctx.save();
          ctx.translate(-x, -y);
          const g = ctx.createRadialGradient(x, y, 10, x, y, sight);
          g.addColorStop(0, `rgba(${col},${0.22 + pr.aware * 0.3})`); g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g;
          conePath(s, x, y, pr.look, pr.def.fov, sight);
          ctx.fill();
          ctx.restore();
          ctx.rotate(pr.look);
        } else ctx.rotate(pr.ang);
        if (!sprite('props', 'camera', 6, 0, 0, 12, 1, false)) { ctx.beginPath(); ctx.roundRect(-9, -8, 22, 16, 3); outline(pr.looped ? '#3a5a4a' : '#59606e'); }
        circle(sheets.props ? 22 : 11, 0, 4); ctx.fillStyle = pr.looped ? C.green : on ? C.bad : '#333'; ctx.fill();
      } else {
        ctx.rotate(pr.ang);
        if (!sprite('props', 'speaker', 8, 0, 0, 14, pr.cool > 0 ? 0.5 : 1, false)) { ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(8, -13); ctx.lineTo(8, 13); ctx.lineTo(-6, 7); ctx.closePath(); outline(pr.cool > 0 ? '#3a3f4a' : '#6a5a8a'); }
      }
    } else if (pr.kind === 'pylon') {
      const up = pr.down <= 0;
      if (!art('pylon', 0, 26, up ? 1 : 0.4)) {
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.52; ctx.lineTo(x + Math.cos(a) * 23, y + Math.sin(a) * 23); } ctx.closePath(); outline(up ? '#2b6f5a' : '#33383f', 3);
        circle(x, y, 9); ctx.fillStyle = up ? C.green : '#55402a'; ctx.fill();
      }
      if (up) { ctx.strokeStyle = 'rgba(114,230,164,0.5)'; ctx.lineWidth = 2; circle(x, y, 30 + Math.sin(clock * 4) * 3); ctx.stroke(); }
      else { ctx.strokeStyle = C.warn; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - pr.down / 14)); ctx.stroke(); }
    }
    ctx.restore();
    // 游標指著車：畫出它會往哪一頭衝、衝到哪裡。
    if (hot && pr.kind === 'car' && !pr.moving && !pr.used) {
      const path = sim.carPath(s, pr), dx = [1, 0, -1, 0][path.dir], dy = [0, 1, 0, -1][path.dir];
      const x1 = pr.x + dx * T, y1 = pr.y + dy * T, x2 = pr.x + dx * (T + path.reach), y2 = pr.y + dy * (T + path.reach);
      ctx.save();
      ctx.fillStyle = 'rgba(108,214,226,0.10)';
      ctx.fillRect(Math.min(x1, x2) - (dy ? T / 2 : 0), Math.min(y1, y2) - (dx ? T / 2 : 0), Math.abs(x2 - x1) + (dy ? T : 0), Math.abs(y2 - y1) + (dx ? T : 0));
      ctx.strokeStyle = 'rgba(108,214,226,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -clock * 80;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(108,214,226,0.9)';
      ctx.beginPath(); ctx.moveTo(x2 + dx * 14, y2 + dy * 14); ctx.lineTo(x2 - dx * 8 - dy * 12, y2 - dy * 8 + dx * 12); ctx.lineTo(x2 - dx * 8 + dy * 12, y2 - dy * 8 - dx * 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (hot) bracket(pr.x, pr.y, pr.kind === 'car' ? 54 : pr.kind === 'bollard' ? 40 : 30, ui.hack.ok);
  }
  // 駭入的準星：四個角。
  function bracket(x, y, r, ok) {
    ctx.strokeStyle = ok ? C.cyan : C.bad; ctx.lineWidth = 3;
    const k = r * 0.45, pulse = r + Math.sin(clock * 8) * 2;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath(); ctx.moveTo(x + sx * pulse, y + sy * (pulse - k)); ctx.lineTo(x + sx * pulse, y + sy * pulse); ctx.lineTo(x + sx * (pulse - k), y + sy * pulse); ctx.stroke();
    }
  }

  // ===== 敵人 =====
  function drawCone(s, e) {
    if (e.state === 'combat' || e.ally > 0 || e.confused > 0 || e.stun > 0 || e.trance > 0 || e.spawnT > 0 || e.distract > 0 || s.blackout > 0) return;
    const sight = e.def.sight * A.sightMul(s, e);
    const col = e.state === 'suspect' ? '255,181,71' : e.aware > 0.02 ? '255,140,90' : '236,232,225';
    const g = ctx.createRadialGradient(e.x, e.y, e.r, e.x, e.y, sight);
    g.addColorStop(0, `rgba(${col},${0.16 + e.aware * 0.3})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    conePath(s, e.x, e.y, e.ang, e.def.fov, sight);
    ctx.fill();
  }
  // 視線的扇形：一條一條射出去，碰到牆和高的設施就停（矮掩體看得過去），所以畫出來的範圍就是實際看得到的範圍。
  // 規則和 js/s3/sim.js 的 clear() 一樣：起點那一格不算。
  function conePath(s, x, y, ang, fov, sight) {
    const n = Math.max(8, Math.ceil((fov * 2) / 0.06));
    const tx0 = Math.floor(x / T), ty0 = Math.floor(y / T);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i <= n; i++) {
      const a = ang - fov + (2 * fov * i) / n, cx = Math.cos(a), cy = Math.sin(a);
      let d = 0;
      while (d < sight) {
        d = Math.min(sight, d + 8);
        const px = x + cx * d, py = y + cy * d;
        if (Math.floor(px / T) === tx0 && Math.floor(py / T) === ty0) continue;
        const v = A.solidAt(s, px, py);
        if (v === 1 || v === 2) break;
      }
      ctx.lineTo(x + cx * d, y + cy * d);
    }
    ctx.closePath();
  }
  function drawTelegraph(s, e) {
    const a = e.atk;
    if (!a || e.ally > 0 || e.confused > 0) return;
    ctx.save();
    if (a.k === 'burst' && a.n === undefined) {
      ctx.strokeStyle = 'rgba(255,181,71,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 300, e.y + Math.sin(e.ang) * 300); ctx.stroke();
    } else if (a.k === 'snipe') {
      const end = A.rayEnd(s, e.x, e.y, a.ang, 1500, true), lock = a.t < 0.28;
      ctx.strokeStyle = lock ? '#fff' : 'rgba(255,93,108,0.85)'; ctx.lineWidth = lock ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    } else if (a.k === 'swing' || a.k === 'slam') {
      const r = a.k === 'slam' ? 125 : 84, k = 1 - a.t / (a.k === 'slam' ? 0.55 : 0.36);
      ctx.fillStyle = `rgba(255,93,108,${0.12 + k * 0.25})`;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      if (a.k === 'slam') ctx.arc(e.x, e.y, r, 0, TAU); else ctx.arc(e.x, e.y, r, e.ang - 1.1, e.ang + 1.1);
      ctx.closePath(); ctx.fill();
    } else if (a.k === 'leap' && !a.go) {
      ctx.strokeStyle = 'rgba(255,93,108,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 220, e.y + Math.sin(e.ang) * 220); ctx.stroke();
    } else if (a.k === 'charge' && !a.go) {
      const end = A.rayEnd(s, e.x, e.y, a.ang, 1700, true);
      ctx.strokeStyle = `rgba(255,93,108,${0.35 + 0.4 * Math.abs(Math.sin(clock * 14))})`; ctx.lineWidth = e.r * 2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    } else if (a.k === 'spray' && !a.go) {
      ctx.fillStyle = 'rgba(255,93,108,0.16)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, 420, e.ang - 0.3, e.ang + 0.3); ctx.closePath(); ctx.fill();
    } else if (a.k === 'shotgun') {
      ctx.fillStyle = 'rgba(255,93,108,0.18)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, 460, e.ang - 0.3, e.ang + 0.3); ctx.closePath(); ctx.fill();
    } else if (a.k === 'laser') {
      const beam = (ang, x2, y2) => {
        if (!a.go) { const end = A.rayEnd(s, e.x, e.y, ang, 2000, false); ctx.strokeStyle = 'rgba(255,93,108,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]); return; }
        if (x2 === undefined) return;
        ctx.strokeStyle = 'rgba(255,93,108,0.35)'; ctx.lineWidth = 22; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
      };
      beam(a.ang, a.x2, a.y2);
      if (e.boss === 'keystone') beam(a.ang + Math.PI, a.x3, a.y3);
    }
    ctx.restore();
  }
  function drawEnemy(s, e, ui) {
    const x = e.x, y = e.y, r = e.r;
    if (e.spawnT > 0) {
      // 進場預告：一圈縮小的環
      ctx.strokeStyle = C.bad; ctx.lineWidth = 3;
      circle(x, y, r + e.spawnT * 34); ctx.stroke();
      ctx.globalAlpha = 0.35; circle(x, y, r); ctx.fillStyle = C.bad; ctx.fill(); ctx.globalAlpha = 1;
      return;
    }
    const ally = e.ally > 0, fl = flashOf.get(e.id) || 0;
    ctx.save();
    if (e.def.jam && !ally && e.stun <= 0 && e.jamOff <= 0 && e.confused <= 0) { ctx.strokeStyle = 'rgba(154,240,208,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 10]); ctx.lineDashOffset = -clock * 30; circle(x, y, e.def.jam); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(154,240,208,0.04)'; ctx.fill(); }
    if (e.elite) { ctx.strokeStyle = { armored: '#cfd6e4', firewall: C.green, volatile: C.warn, swift: C.echo }[e.elite]; ctx.lineWidth = 3; circle(x, y, r + 7); ctx.stroke(); }
    if (e.mark > 0) { ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); circle(x, y, r + 12); ctx.stroke(); ctx.setLineDash([]); }
    const art = e.boss === 'keystone' ? null : e.boss || e.kind;
    const size = r * (BODY[art] || 1.3);
    if (art && e.def.fly && sheets.actors && sheets.actors.items[art]) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(x + 8, y + 22, r * 1.2); ctx.fill(); }
    if (art && sprite('actors', art, x, y, e.ang, size, 1, !e.def.fly, ally)) {
      ctx.translate(x, y); ctx.rotate(e.ang);
      if (e.kind === 'shield' || e.boss === 'bulldog') {
        // 盾牌有效是亮的弧線，被癱瘓是紅色虛線。
        const up = A.shielded(e, x + Math.cos(e.ang) * 50, y + Math.sin(e.ang) * 50);
        ctx.strokeStyle = up ? 'rgba(190,225,255,0.55)' : 'rgba(255,93,108,0.8)'; ctx.lineWidth = up ? 5 : 3;
        if (!up) ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.arc(0, 0, r * 1.75, -1.05, 1.05); ctx.stroke(); ctx.setLineDash([]);
      }
    } else if (e.kind === 'drone') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; circle(x + 6, y + 16, r); ctx.fill();
      ctx.translate(x, y); ctx.rotate(e.ang);
      ctx.strokeStyle = C.out; ctx.lineWidth = 4;
      for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(dx * r, dy * r); ctx.stroke(); circle(dx * r, dy * r, 6); ctx.fillStyle = 'rgba(200,220,255,0.35)'; ctx.fill(); }
      circle(0, 0, r * 0.62); outline(ally ? C.pink : '#56627a');
      circle(r * 0.4, 0, 3); ctx.fillStyle = ally ? '#fff' : C.bad; ctx.fill();
    } else if (e.kind === 'turret') {
      circle(x, y, r + 2); outline('#2a2f3a', 3);
      ctx.translate(x, y); ctx.rotate(e.ang);
      ctx.fillStyle = '#0d1118'; ctx.fillRect(0, -4, r + 12, 8);
      circle(0, 0, r * 0.7); outline(ally ? C.pink : '#6a7388');
    } else if (e.kind === 'hound') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 5, r * 1.3, r * 0.8, e.ang, 0, TAU); ctx.fill();
      ctx.translate(x, y); ctx.rotate(e.ang);
      ctx.beginPath(); ctx.ellipse(-3, 0, r * 1.25, r * 0.7, 0, 0, TAU); outline('#6b7280');
      circle(r * 0.95, 0, r * 0.5); outline('#8a93a5', 2);
      circle(r * 1.1, 0, 2.5); ctx.fillStyle = e.stun > 0 ? '#555' : C.bad; ctx.fill();
    } else if (e.boss === 'carrier') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; circle(x + 10, y + 30, r); ctx.fill();
      ctx.translate(x, y);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.78; ctx.strokeStyle = C.out; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12)); ctx.stroke(); circle(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12), 13); ctx.fillStyle = 'rgba(200,220,255,0.3)'; ctx.fill(); }
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); outline('#3a4660', 4);
      ctx.rotate(e.ang); circle(r * 0.45, 0, 9); ctx.fillStyle = C.bad; ctx.fill();
    } else if (e.boss === 'keystone') {
      ctx.translate(x, y);
      const open = e.open > 0 || e.stun > 0;
      ctx.rotate(e.ang);
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.lineTo(Math.cos(a) * (r + (open ? 10 : 0)), Math.sin(a) * (r + (open ? 10 : 0))); } ctx.closePath(); outline(open ? '#3a2a36' : '#24414e', 4);
      ctx.rotate(-e.ang * 2.2);
      ctx.strokeStyle = open ? C.pink : C.green; ctx.lineWidth = 4; ctx.setLineDash([16, 10]); circle(0, 0, r * 0.7); ctx.stroke(); ctx.setLineDash([]);
      circle(0, 0, r * 0.38); ctx.fillStyle = open ? '#fff' : C.green; ctx.fill();
    } else {
      const col = KIND[e.boss ? 'boss' : e.kind] || KIND.guard;
      person(x, y, r, e.ang, col, e.kind === 'rusher' ? 0 : e.kind === 'sniper' ? r + 16 : e.kind === 'heavy' || e.boss ? r + 10 : r + 4);
      ctx.translate(x, y); ctx.rotate(e.ang);
      if (e.kind === 'rusher') { ctx.strokeStyle = C.warn; ctx.lineWidth = 4; const sw = e.atk ? -1.2 + (1 - e.atk.t / 0.36) * 1.8 : 0.5; ctx.beginPath(); ctx.moveTo(r * 0.4, r * 0.7); ctx.lineTo(r * 0.4 + Math.cos(sw) * 24, r * 0.7 + Math.sin(sw) * 24); ctx.stroke(); }
      if ((e.kind === 'shield' || e.boss === 'bulldog') && A.shielded(e, x + Math.cos(e.ang) * 50, y + Math.sin(e.ang) * 50)) {
        ctx.strokeStyle = 'rgba(190,225,255,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r + 8, -1.05, 1.05); ctx.stroke();
        ctx.strokeStyle = 'rgba(190,225,255,0.25)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, r + 8, -1.05, 1.05); ctx.stroke();
      }
      if (e.kind === 'jammer') { ctx.strokeStyle = '#9af0d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.5); ctx.lineTo(-r * 1.3, -r * 1.2); ctx.stroke(); }
      if (e.kind === 'heavy' && e.grenade) { circle(-r * 0.3, r * 0.75, 4); ctx.fillStyle = '#9fbf4a'; ctx.fill(); }
    }
    ctx.restore();
    if (fl > 0) { ctx.globalAlpha = Math.min(1, fl * 6); circle(x, y, r + 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
    // 狀態：電暈、起火、被引開、發現中、正在叫人
    if (e.stun > 0) { ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = clock * 7 + (i * TAU) / 3; jagged(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), x + Math.cos(a + 0.9) * (r + 9), y + Math.sin(a + 0.9) * (r + 9), 3, 6); ctx.stroke(); } }
    if (e.burn > 0 && Math.random() < 0.5) parts.push({ x: x + rnd(-r, r), y: y + rnd(-r, r), vx: rnd(-10, 10), vy: rnd(-60, -20), life: 0.4, max: 0.4, col: '#ff8a3d', size: rnd(3, 6) });
    if (e.distract > 0 && e.confused <= 0) label('…', x, y - r - 16, C.white, 20);
    if (e.confused > 0) label('?', x, y - r - 18, C.green, 26);
    else if (!ally && e.state !== 'combat' && e.aware > 0.02) { ctx.strokeStyle = e.aware > 0.6 ? C.bad : C.warn; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y - r - 14, 8, -Math.PI / 2, -Math.PI / 2 + TAU * e.aware); ctx.stroke(); }
    if (e.confused <= 0 && e.state === 'suspect' && e.aware <= 0.02) label('?', x, y - r - 16, C.warn, 20);
    if (e.call > 0) {
      label('!', x, y - r - 18, C.bad, 24);
      ctx.strokeStyle = C.bad; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 14, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - e.call / sim.CALL)); ctx.stroke();
    }
    // 控制時間另放在機體下方，不用圈圈蓋住旋翼和槍管。
    if (ally) {
      const y0 = y + size + 8;
      ctx.fillStyle = C.out; ctx.fillRect(x - 13, y0 - 1, 26, 4);
      ctx.fillStyle = C.pink; ctx.fillRect(x - 12, y0, 24 * Math.min(1, e.ally / 10), 2);
    }
    if (!e.boss && e.hp < e.maxHp) {
      const w = Math.max(30, r * 2.4);
      ctx.fillStyle = 'rgba(11,15,28,0.8)'; ctx.fillRect(x - w / 2 - 1, y + r + 7, w + 2, 6);
      ctx.fillStyle = ally ? C.pink : e.elite ? C.warn : C.bad; ctx.fillRect(x - w / 2, y + r + 8, w * Math.max(0, e.hp / e.maxHp), 4);
    }
    if (ui.hack && ui.hack.enemy === e) bracket(x, y, r + 14, ui.hack.ok);
    if (ui.takedown === e) { ctx.strokeStyle = C.pink; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); circle(x, y, r + 18); ctx.stroke(); ctx.setLineDash([]); }
  }

  function drawPlayer(s) {
    const p = s.p;
    if (s.over === 'dead') return;
    const alpha = p.cloak > 0 ? 0.35 : p.inv > 0 && p.hurtT <= 0 && Math.sin(clock * 50) > 0 && p.dashT <= 0 && s.rt > 1 ? 0.6 : 1;
    if (p.guard > 0) { ctx.strokeStyle = 'rgba(236,232,225,0.6)'; ctx.lineWidth = 2; circle(p.x, p.y, p.r + 9); ctx.stroke(); }
    // 腳下一圈粉紅色：在一堆人裡一眼找得到自己。
    ctx.strokeStyle = 'rgba(255,46,136,0.75)'; ctx.lineWidth = 2.5; circle(p.x, p.y, p.r * 1.75); ctx.stroke();
    if (drawDoll(s, p, alpha) || sprite('actors', s.build.cat, p.x, p.y, p.ang, p.r * 1.3, alpha)) {
      if (p.hurtT > 0) { ctx.globalAlpha = 0.6; circle(p.x, p.y, p.r * 1.4); ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
    } else {
      person(p.x, p.y, p.r, p.ang, { body: p.hurtT > 0 ? '#fff' : C.pink, head: '#1c2028' }, p.r + 6, alpha);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.globalAlpha = alpha;
      ctx.fillStyle = C.cyan; ctx.fillRect(p.r * 0.25, -4, 4, 8);
      ctx.restore();
    }
    if (p.reload > 0) { ctx.strokeStyle = C.white; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.reload / (s.weapon.reload * s.st.reloadMul))); ctx.stroke(); }
  }

  // ===== 範圍效果、掉落物 =====
  function drawZone(s, z) {
    if (z.k === 'steam') {
      for (let i = 0; i < 7; i++) {
        const a = clock * 0.6 + i * 0.9, rr = z.r * (0.45 + 0.12 * Math.sin(clock * 2 + i));
        ctx.fillStyle = `rgba(215,225,235,${0.11 * Math.min(1, z.t)})`;
        circle(z.x + Math.cos(a) * z.r * 0.4, z.y + Math.sin(a * 1.3) * z.r * 0.4, rr); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(215,225,235,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); circle(z.x, z.y, z.r); ctx.stroke(); ctx.setLineDash([]);
    } else if (z.k === 'fire') {
      ctx.fillStyle = `rgba(255,120,40,${0.18 * Math.min(1, z.t)})`; circle(z.x, z.y, z.r); ctx.fill();
      if (Math.random() < 0.7) parts.push({ x: z.x + rnd(-z.r, z.r) * 0.7, y: z.y + rnd(-z.r, z.r) * 0.7, vx: rnd(-12, 12), vy: rnd(-90, -30), life: 0.5, max: 0.5, col: Math.random() < 0.5 ? '#ffb547' : '#ff5d3a', size: rnd(4, 9) });
    } else if (z.k === 'tele') {
      const k = 1 - z.t / (z.t0 || 1), mine = z.side === 'p';
      const col = z.side === 'crossfire' ? '114,230,164' : mine ? '108,214,226' : '255,93,108';
      ctx.fillStyle = `rgba(${col},${0.1 + 0.15 * k})`; circle(z.x, z.y, z.r); ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 3; circle(z.x, z.y, z.r); ctx.stroke();
      ctx.lineWidth = 2; circle(z.x, z.y, z.r * Math.max(0, 1 - k)); ctx.stroke();
      if (z.fx !== undefined && !z.quiet && z.t0 && !z.cargo) { const px = z.fx + (z.x - z.fx) * k, py = z.fy + (z.y - z.fy) * k - Math.sin(k * Math.PI) * 90; circle(px, py, 6); ctx.fillStyle = mine ? '#8a5a2c' : '#3a4a2a'; ctx.fill(); ctx.strokeStyle = C.out; ctx.stroke(); }
    } else if (z.k === 'strike') {
      const k = Math.min(1, z.t / S3.data.gadgets.strike.flight);
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 2; ctx.setLineDash([12, 7]); circle(z.x, z.y, z.r); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < z.left; i++) { ctx.fillStyle = C.cyan; ctx.fillRect(z.x - 12 + i * 9, z.y + 8, 5, 4); }
      if (z.t <= S3.data.gadgets.strike.flight) inAir(z.x - 125 * k, z.y - 165 * k, 'missile', 0.92, 21, 1, 8);
    } else if (z.k === 'swarm') {
      ctx.fillStyle = 'rgba(246,179,50,.07)'; ctx.strokeStyle = 'rgba(255,195,62,.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 8]); circle(z.x, z.y, z.r); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 28; i++) {
        const a = i * 2.4 + clock * (i % 2 ? 1.8 : -1.2), rad = z.r * (0.2 + 0.75 * (i % 9) / 9);
        const x = z.x + Math.cos(a) * rad, y = z.y + Math.sin(a) * rad + 3 * Math.sin(clock * 11 + i);
        ctx.fillStyle = '#d2e8e1'; ctx.fillRect(x + 1, y - 2, 3, 2); ctx.fillRect(x + 1, y + 2, 3, 2);
        ctx.fillStyle = '#ffcc53'; ctx.fillRect(x, y, 6, 2.5); ctx.fillStyle = '#36271b'; ctx.fillRect(x + 2, y, 1.5, 2.5);
      }
    } else if (z.k === 'kamikaze') {
      const k = 1 - z.t / z.t0, px = z.fx + (z.x - z.fx) * k, py = z.fy + (z.y - z.fy) * k;
      ctx.strokeStyle = 'rgba(108,214,226,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); circle(z.x, z.y, z.r); ctx.stroke(); ctx.setLineDash([]);
      inAir(px, py, 'kamikaze', Math.atan2(z.y - z.fy, z.x - z.fx), 19);
    }
  }
  function drawRecon(z) {
    const def = S3.data.gadgets.eagle, a = Math.atan2(z.y - z.fy, z.x - z.fx), age = z.dur - z.t;
    let px, py, ang;
    if (z.orbit) {
      const phase = a + age * 2.5;
      px = z.x + Math.cos(phase) * 22; py = z.y + Math.sin(phase) * 15; ang = phase + Math.PI / 2;
      ctx.save(); ctx.strokeStyle = 'rgba(108,214,226,0.72)'; ctx.lineWidth = 2; ctx.setLineDash([7, 9]);
      circle(z.x, z.y, def.scan); ctx.stroke(); ctx.setLineDash([]);
      // 以模擬的噪音節拍畫波紋，即使已交戰仍看得出它在偵查。
      const beat = 1 - z.beat / def.beat;
      ctx.strokeStyle = `rgba(194,179,255,${0.52 * (1 - beat)})`;
      circle(z.x, z.y, 12 + beat * (def.noise - 12)); ctx.stroke(); ctx.restore();
    } else {
      const k = 1 - z.t / def.flight;
      px = z.fx + (z.x - z.fx) * k; py = z.fy + (z.y - z.fy) * k; ang = a;
    }
    const frame = gearItem('eagle2') && Math.floor(clock * 12) % 2 ? 'eagle2' : 'eagle';
    inAir(px, py, frame, ang, 24);
  }
  // 先畫地面上的影子，再畫吊著的箱子（若有），最後把機身往上提 alt。
  function inAir(x, y, name, ang, r, alpha = 1, alt = 26, carrying = false) {
    ctx.save();
    ctx.globalAlpha = 0.28 * alpha; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.9, r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (carrying && !sprite('props', 'crate', x, y - 8, 0, 14, alpha, false)) {
      ctx.save(); ctx.fillStyle = '#93663e'; ctx.fillRect(x - 11, y - 18, 22, 20); ctx.restore();
    }
    const small = ['escort', 'kamikaze', 'expert', 'missile'].includes(name);
    if (sprite(small ? 'drones' : 'gear', name, x, y - alt, ang, r, alpha, false)) return;
    // 原圖還沒到或載入失敗，機身仍清楚朝著飛行或射擊方向。
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y - alt); ctx.rotate(ang);
    if (name === 'missile') {
      ctx.beginPath(); ctx.moveTo(r,0); ctx.lineTo(-r, -r * 0.4); ctx.lineTo(-r * 0.75, 0); ctx.lineTo(-r,r * 0.4); ctx.closePath(); outline('#e8c189');
    } else if (name.startsWith('eagle')) {
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-4, -r); ctx.lineTo(-1, -4); ctx.lineTo(-r / 2, 0); ctx.lineTo(-1, 4); ctx.lineTo(-4, r); ctx.closePath(); outline('#e8e6e0');
    } else {
      ctx.beginPath(); ctx.roundRect(-r * 0.72, -r * 0.45, r * 1.5, r * 0.9, 4);
      outline(name === 'cargo' || name === 'kamikaze' ? '#eea23b' : name === 'escort' ? '#ae789e' : '#5b6469');
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) { circle(dx * r * 0.57, dy * r * 0.55, r * 0.23); outline('#929fa6', 2); }
      ctx.fillStyle = C.white; ctx.fillRect(r * 0.65, -2, 5, 4);
    }
    ctx.restore();
  }
  // 扳手的裝備：箱子只在去程掛著；「粉碎女士」的光尾跟著鎚頭從一邊掃到另一邊。
  function drawGear(s) {
    for (const z of s.zones) {
      if (z.k !== 'tele' || !z.cargo || z.fx === undefined) continue;
      const k = Math.min(1, 1 - z.t / (z.t0 || 1)), ease = 1 - (1 - k) * (1 - k);
      const x = z.fx + (z.x - z.fx) * ease, y = z.fy + (z.y - z.fy) * ease, ang = Math.atan2(z.y - z.fy, z.x - z.fx);
      inAir(x, y, z.cargo, ang, 32, 1, 38, true);
    }
    for (const f of flyers) inAir(f.x, f.y, f.id, f.ang, 32, f.life / f.max, 38 + (1 - f.life / f.max) * 50);
    for (const w of swings) {
      const k = 1 - w.life / w.max, a = w.ang - w.arc + 2 * w.arc * k;
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(a);
      if (w.id === 'eightball') {
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.quadraticCurveTo(74, -19, 128, 0); ctx.strokeStyle = C.white; ctx.lineWidth = 2.5; ctx.stroke();
        circle(128, 0, 10); outline('#232834'); circle(131, -2, 3); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore(); continue;
      }
      if (w.id === 'hammer') {
        const h = HELD.hammer, head = 24 + (0.86 - h.grip) * h.len * 17;
        ctx.lineCap = 'round'; ctx.strokeStyle = SMASH_GLOW; ctx.shadowColor = SMASH_GLOW; ctx.shadowBlur = 12;
        ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, head, -Math.min(0.9, 2 * w.arc * k), 0); ctx.stroke();
        ctx.shadowBlur = 0;
      }
      heldItem(w.id, 24, 0, 17);
      ctx.restore();
    }
  }
  function drawPick(k, s) {
    const bob = Math.sin(clock * 5 + k.x) * 2;
    if (k.k === 'data') { if (sprite('props', 'data', k.x, k.y + bob, 0, 10, 1, false)) return; ctx.save(); ctx.translate(k.x, k.y + bob); ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.rect(-5, -5, 10, 10); outline(C.cyan, 2); ctx.restore(); }
    else if (k.k === 'med') { if (sprite('props', 'med', k.x, k.y + bob, 0, 14, 1, true)) return; circle(k.x, k.y + bob, 12); outline('#e8e6e0'); ctx.fillStyle = '#2fae6a'; ctx.fillRect(k.x - 2.5, k.y + bob - 7, 5, 14); ctx.fillRect(k.x - 7, k.y + bob - 2.5, 14, 5); }
    else if (k.k === 'cache') {
      const glow = ctx.createRadialGradient(k.x, k.y, 6, k.x, k.y, 70);
      glow.addColorStop(0, 'rgba(255,46,136,0.35)'); glow.addColorStop(1, 'rgba(255,46,136,0)');
      ctx.fillStyle = glow; circle(k.x, k.y, 70); ctx.fill();
      // 拘留室：打完之後要開的是一間牢房，裡面有人。
      if (s && s.spec.cells) {
        ctx.beginPath(); ctx.roundRect(k.x - 34, k.y - 30, 68, 60, 6); outline('#141a26', 3);
        person(k.x, k.y + 2 + bob * 0.4, 13, Math.PI / 2, { body: '#cfd6e4', head: '#e8c9a8' }, 0, 1);
        ctx.strokeStyle = C.pink; ctx.lineWidth = 3;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(k.x + i * 13, k.y - 28); ctx.lineTo(k.x + i * 13, k.y + 28); ctx.stroke(); }
        return;
      }
      if (sprite('props', 'cache', k.x, k.y + bob, 0, 20, 1, true)) return;
      ctx.beginPath(); ctx.roundRect(k.x - 20, k.y - 15 + bob, 40, 30, 5); outline('#1a1f2c', 3);
      ctx.strokeStyle = C.pink; ctx.lineWidth = 2.5; ctx.strokeRect(k.x - 12, k.y - 8 + bob, 24, 16);
      ctx.fillStyle = C.pink; ctx.fillRect(k.x - 3, k.y - 3 + bob, 6, 6);
    }
  }

  // ===== 門 =====
  function drawDoors(s, ui) {
    s.spec.doors.forEach((d, i) => {
      const open = s.doorsOpen;
      ctx.fillStyle = open ? '#0b0d11' : '#1a1f2a';
      ctx.fillRect(d.x - T, 0, T * 2, T - 10);
      ctx.strokeStyle = open ? C.pink : '#39445e'; ctx.lineWidth = 4;
      ctx.strokeRect(d.x - T + 2, 2, T * 2 - 4, T - 14);
      if (!open) { ctx.strokeStyle = '#39445e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.x, 4); ctx.lineTo(d.x, T - 12); ctx.stroke(); return; }
      const g = ctx.createLinearGradient(0, T - 10, 0, T + 80);
      g.addColorStop(0, 'rgba(255,46,136,0.3)'); g.addColorStop(1, 'rgba(255,46,136,0)');
      ctx.fillStyle = g; ctx.fillRect(d.x - T, T - 10, T * 2, 90);
      const info = ui.doors && ui.doors[i];
      if (!info) return;
      label(info.title, d.x, T + 26, info.color || C.white, 19);
      if (info.sub) label(info.sub, d.x, T + 50, C.cyan, 15);
      if (info.mod) label(info.mod, d.x, T + 72, C.warn, 14);
    });
  }

  // ===== 演出：事件 → 粒子、震動、數字 =====
  function burst(x, y, n, col, speed, size, life) {
    for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(speed * 0.3, speed); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(life * 0.5, life), max: life, col, size: rnd(size * 0.5, size) }); }
  }
  const ring = (x, y, r, col, life = 0.35, w = 4) => rings.push({ x, y, r, col, life, max: life, w });
  function event(s, ev) {
    switch (ev.k) {
      case 'shot': { const mx = ev.x + Math.cos(ev.ang) * 26, my = ev.y + Math.sin(ev.ang) * 26; parts.push({ x: mx, y: my, vx: 0, vy: 0, life: 0.05, max: 0.05, col: '#fff3c4', size: 13 }); shake = Math.max(shake, ev.w === 'shotgun' ? 5 : 1.6); break; }
      case 'eshot': case 'pshot': parts.push({ x: ev.x + Math.cos(ev.ang) * 20, y: ev.y + Math.sin(ev.ang) * 20, vx: 0, vy: 0, life: 0.05, max: 0.05, col: ev.k === 'pshot' ? C.pink : '#ffb547', size: 10 }); break;
      case 'spark': burst(ev.x, ev.y, 3, '#cfd6e4', 120, 3, 0.18); break;
      case 'hit': flashOf.set(ev.id, 0.12); burst(ev.x, ev.y, ev.crit ? 7 : 3, ev.crit ? '#ffd23f' : '#fff', 160, 3.5, 0.22); if (ev.n >= 1) texts.push({ x: ev.x + rnd(-10, 10), y: ev.y - 18, vy: -55, life: 0.6, max: 0.6, str: String(Math.round(ev.n)), col: ev.crit ? '#ffd23f' : C.white, size: ev.crit ? 22 : 15 }); break;
      case 'kill': burst(ev.x, ev.y, ev.boss ? 60 : 14, ev.machine ? '#9fb4d8' : C.bad, ev.boss ? 420 : 240, ev.boss ? 9 : 5, ev.boss ? 1.1 : 0.45); ring(ev.x, ev.y, ev.r * 2.6, ev.machine ? C.cyan : C.white, 0.3); shake = Math.max(shake, ev.boss ? 22 : 4); if (ev.boss) whiteFlash = 0.5; break;
      case 'hurt': hurtFlash = 0.4; shake = Math.max(shake, 9); texts.push({ x: ev.x, y: ev.y - 26, vy: -50, life: 0.7, max: 0.7, str: '-' + Math.round(ev.n), col: C.bad, size: 20 }); break;
      case 'guard': ring(ev.x, ev.y, 34, C.white, 0.3); break;
      case 'dead': burst(ev.x, ev.y, 40, C.pink, 300, 6, 0.9); shake = 18; hurtFlash = 1; break;
      case 'revive': ring(ev.x, ev.y, 170, C.pink, 0.6, 8); whiteFlash = 0.4; break;
      // 小隊：換人、有人倒下被帶走、司機把人接走。
      case 'swap': ring(ev.x, ev.y, 56, C.pink, 0.3, 5); burst(ev.x, ev.y, 10, C.white, 220, 4, 0.3); break;
      case 'down': burst(ev.x, ev.y, 30, C.pink, 280, 6, 0.8); ring(ev.x, ev.y, 150, C.bad, 0.5, 8); shake = Math.max(shake, 14); hurtFlash = 1; break;
      case 'getaway': ring(ev.x, ev.y, 120, C.white, 0.5, 6); whiteFlash = Math.max(whiteFlash, 0.25); break;
      case 'dash': for (let i = 0; i < 6; i++) parts.push({ x: ev.x - Math.cos(ev.ang) * i * 8, y: ev.y - Math.sin(ev.ang) * i * 8, vx: 0, vy: 0, life: 0.22, max: 0.22, col: C.pink, size: 12 - i }); break;
      case 'hack': beams.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, life: 0.28, max: 0.28, col: C.cyan, amp: 9 }); ring(ev.x2, ev.y2, 36, C.cyan, 0.3); break;
      case 'arc': beams.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, life: 0.22, max: 0.22, col: '#bdf3ff', amp: 14 }); break;
      case 'scramble': beams.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, life: 0.28, max: 0.28, col: C.green, amp: 5 }); ring(ev.x2, ev.y2, 23, C.green, 0.35, 3); break;
      case 'snipe': beams.push({ x: ev.x, y: ev.y, x2: ev.x2, y2: ev.y2, life: 0.16, max: 0.16, col: '#fff', amp: 0, w: 5 }); shake = Math.max(shake, 4); break;
      case 'boom': ring(ev.x, ev.y, ev.r, '#ffb547', 0.4, 8); burst(ev.x, ev.y, 26, '#ff8a3d', 380, 8, 0.6); burst(ev.x, ev.y, 10, '#3a3f4a', 160, 12, 0.9); shake = Math.max(shake, 12); whiteFlash = Math.max(whiteFlash, 0.12); break;
      case 'shock': ring(ev.x, ev.y, ev.r, C.cyan, 0.4, 7); for (let i = 0; i < 7; i++) { const a = rnd(0, TAU); beams.push({ x: ev.x, y: ev.y, x2: ev.x + Math.cos(a) * ev.r, y2: ev.y + Math.sin(a) * ev.r, life: 0.2, max: 0.2, col: '#bdf3ff', amp: 16 }); } shake = Math.max(shake, 7); break;
      case 'zap': burst(ev.x, ev.y, 6, '#bdf3ff', 200, 3, 0.25); ring(ev.x, ev.y, 26, C.cyan, 0.25, 3); break;
      case 'steam': burst(ev.x, ev.y, 14, 'rgba(220,228,236,0.7)', 200, 12, 0.7); break;
      case 'noise': if (!s.alert && !s.cleared) ring(ev.x, ev.y, ev.r, 'rgba(255,181,71,0.5)', 0.5, 2); break;
      case 'shriek': ring(ev.x, ev.y, ev.r, C.echo, 0.6, 3); ring(ev.x, ev.y, ev.r * 0.5, C.echo, 0.5, 3); break;
      case 'mark': ring(ev.x, ev.y, ev.r, C.cyan, 0.6, 3); break;
      case 'spotted': texts.push({ x: ev.x, y: ev.y - 34, vy: -20, life: 0.7, max: 0.7, str: '!', col: C.bad, size: 30 }); break;
      case 'alarm': whiteFlash = 0.18; shake = Math.max(shake, 6); break;
      case 'clang': burst(ev.x, ev.y, 5, '#dfeaff', 200, 3, 0.2); break;
      case 'takedown': ring(ev.x, ev.y, 46, C.pink, 0.3, 6); shake = Math.max(shake, 6); break;
      case 'eightball': swings.push({ x: ev.x, y: ev.y, ang: ev.ang, arc: Math.PI, id: ev.k, life: 0.38, max: 0.38 }); break;
      case 'hypnosis': rings.push({ x: ev.x, y: ev.y, ang: ev.ang, arc: ev.ang, wide: 0.85, r: ev.r, col: '#eac86a', w: 4, life: 0.65, max: 0.65 }); break;
      case 'punch': rings.push({ x: ev.x, y: ev.y, arc: ev.ang, r: 35, col: C.green, w: 4, life: 0.18, max: 0.18 }); break;
      case 'melee': case 'swing': rings.push({ x: ev.x, y: ev.y, r: ev.k === 'melee' ? 62 : 84, col: ev.k === 'melee' ? C.white : C.warn, life: 0.16, max: 0.16, w: 6, arc: ev.ang }); break;
      case 'drop': flyers.push({ id: ev.id, x: ev.x, y: ev.y, ang: ev.ang, vx: Math.cos(ev.ang) * 170, vy: Math.sin(ev.ang) * 170, life: 0.7, max: 0.7 }); break;
      case 'smash': swings.push({ x: ev.x, y: ev.y, ang: ev.ang, arc: ev.arc || 1.25, id: ev.id, life: 0.24, max: 0.24 }); rings.push({ x: ev.x, y: ev.y, r: ev.r, col: ev.id === 'hammer' ? SMASH_GLOW : C.warn, life: 0.25, max: 0.25, w: 12, arc: ev.ang, wide: 1.25 }); shake = Math.max(shake, 10); break;
      case 'pickup': if (ev.what !== 'cache' && ev.n) texts.push({ x: ev.x, y: ev.y - 14, vy: -40, life: 0.5, max: 0.5, str: '+' + ev.n, col: ev.what === 'med' ? C.green : C.cyan, size: 14 }); break;
      case 'crash': ring(ev.x, ev.y, 100, C.white, 0.35, 8); burst(ev.x, ev.y, 18, '#cfd6e4', 300, 6, 0.5); shake = Math.max(shake, 14); break;
      case 'raise': case 'breach': case 'hijack': ring(ev.x, ev.y, 60, ev.k === 'hijack' ? C.pink : C.green, 0.35, 5); break;
      case 'phase': ring(ev.x, ev.y, 400, C.bad, 0.7, 10); whiteFlash = 0.3; shake = Math.max(shake, 12); break;
      case 'clear': whiteFlash = 0.15; break;
      case 'sneeze': texts.push({ x: ev.x, y: ev.y - 30, vy: -30, life: 0.8, max: 0.8, str: '…!', col: C.warn, size: 20 }); break;
    }
  }
  function update(dt) {
    clock += dt;
    shake = Math.max(0, shake - dt * 40);
    hurtFlash = Math.max(0, hurtFlash - dt);
    whiteFlash = Math.max(0, whiteFlash - dt);
    for (const [k, v] of flashOf) { if (v - dt <= 0) flashOf.delete(k); else flashOf.set(k, v - dt); }
    for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    for (const t of texts) { t.life -= dt; t.y += t.vy * dt; }
    for (const b of beams) b.life -= dt;
    for (const r of rings) r.life -= dt;
    for (const w of swings) w.life -= dt;
    for (const f of flyers) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    swings = swings.filter((w) => w.life > 0); flyers = flyers.filter((f) => f.life > 0);
    parts = parts.filter((p) => p.life > 0); texts = texts.filter((t) => t.life > 0); beams = beams.filter((b) => b.life > 0); rings = rings.filter((r) => r.life > 0);
    if (parts.length > 700) parts.splice(0, parts.length - 700);
  }

  // ===== 一幀 =====
  // ui：{ hack 目前指著的可駭目標, takedown 可以制伏的敵人, doors 門上的字, mouse 游標, hackText 準星旁的字, focus }
  function draw(s, ui) {
    if (!ctx) return;
    const key = s.spec.seed + ':' + cv.width;
    if (bakeKey !== key) bakeRoom(s);
    const p = s.p;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bake, 0, 0);
    ctx.setTransform(scale, 0, 0, scale, shake ? rnd(-shake, shake) * scale : 0, shake ? rnd(-shake, shake) * scale : 0);

    for (const pr of s.props) if (!pr.def.solid && pr.kind !== 'camera' && pr.kind !== 'speaker') drawProp(s, pr, ui);
    for (const z of s.zones) if (z.k === 'fire' || z.k === 'tele') drawZone(s, z);
    for (const m of s.mines) { if (!sprite('props', 'mine', m.x, m.y, 0, 12, m.arm > 0 ? 0.5 : 1, false)) { circle(m.x, m.y, 9); outline(m.arm > 0 ? '#3a4a5a' : C.cyan, 2); } if (m.arm <= 0) { ctx.strokeStyle = 'rgba(108,214,226,0.3)'; ctx.lineWidth = 1.5; circle(m.x, m.y, 42); ctx.stroke(); } }
    for (const e of s.en) drawCone(s, e);
    for (const k of s.picks) drawPick(k, s);
    for (const pr of s.props) if (pr.def.solid || pr.kind === 'camera' || pr.kind === 'speaker') drawProp(s, pr, ui);
    for (const d of s.decoys) { ctx.globalAlpha = 0.5 + 0.2 * Math.sin(clock * 12); if (d.ghost) person(d.x, d.y, 14, 0, { body: C.echo, head: '#fff' }, 0, 0.5); else { circle(d.x, d.y, 10); outline(C.echo, 2); } ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(194,179,255,0.4)'; ctx.lineWidth = 2; circle(d.x, d.y, 18 + ((clock * 60) % 30)); ctx.stroke(); }
    for (const pet of s.pets) {
      if (pet.kind === 'brawler') {
        ctx.strokeStyle = C.green; ctx.lineWidth = 2; circle(pet.x, pet.y, 16); ctx.stroke();
        if (!drawDoll(s, pet, 1, { person: pet.person })) person(pet.x, pet.y, pet.r, pet.ang, { body: C.green, head: '#dfbd91' }, false);
      } else if (pet.kind === 'spider' && !sprite('gear', 'spider', pet.x, pet.y, pet.ang, 17) && !sprite('props', 'spider', pet.x, pet.y, pet.ang, 16)) {
        ctx.save(); ctx.translate(pet.x, pet.y); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ctx.strokeStyle = C.out; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.stroke(); }
        ctx.rotate(pet.ang); ctx.fillStyle = '#0d1118'; ctx.fillRect(0, -3, 20, 6); circle(0, 0, 9); outline(C.pink, 2); ctx.restore();
      }
    }
    for (const e of s.en) drawTelegraph(s, e);
    for (const e of s.en) if (!e.def.fly) drawEnemy(s, e, ui);
    drawPlayer(s);
    for (const e of s.en) if (e.def.fly) drawEnemy(s, e, ui);
    for (const pet of s.pets) if (pet.kind === 'escort' || pet.kind === 'expert') inAir(pet.x, pet.y, pet.kind, pet.ang, pet.kind === 'expert' ? 26 : 18, 1, 16);
    for (const z of s.zones) if (['steam', 'kamikaze', 'strike', 'swarm'].includes(z.k)) drawZone(s, z);
    for (const e of s.en) if (e.trance > 0) { ctx.strokeStyle = '#fadc86'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y - e.r - 7, 10 + 2 * Math.sin(clock * 4), 3, 0, 0, TAU); ctx.stroke(); }
    if (s.recon) drawRecon(s.recon);
    drawGear(s);

    // 子彈
    for (const b of s.bul) {
      const mine = b.side === 'p', l = hyp(b.vx, b.vy) || 1, tail = mine ? 22 : 12;
      ctx.strokeStyle = mine ? (b.tracer ? C.cyan : b.by === 'ally' ? C.pink : '#fff3c4') : '#ff7a4a'; ctx.lineWidth = mine ? 3.5 : 0.1;
      if (mine) { ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - (b.vx / l) * tail, b.y - (b.vy / l) * tail); ctx.stroke(); }
      else { circle(b.x, b.y, b.r + 3); ctx.fillStyle = 'rgba(255,122,74,0.35)'; ctx.fill(); circle(b.x, b.y, b.r); ctx.fillStyle = '#ffd9b0'; ctx.fill(); ctx.strokeStyle = '#ff5d3a'; ctx.lineWidth = 2; ctx.stroke(); }
    }
    // 光束、圈、粒子、數字
    for (const b of beams) { ctx.globalAlpha = b.life / b.max; ctx.strokeStyle = b.col; ctx.lineWidth = b.w || 3; if (b.amp) jagged(b.x, b.y, b.x2, b.y2, b.amp, 26); else { ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x2, b.y2); } ctx.stroke(); }
    for (const r of rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = r.col; ctx.lineWidth = r.w;
      ctx.beginPath();
      if (r.arc !== undefined) ctx.arc(r.x, r.y, r.r * (0.6 + 0.4 * k), r.arc - (r.wide || 1.1), r.arc + (r.wide || 1.1)); else ctx.arc(r.x, r.y, r.r * (0.25 + 0.75 * k), 0, TAU);
      ctx.stroke();
    }
    for (const q of parts) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.col; circle(q.x, q.y, q.size * (0.4 + 0.6 * (q.life / q.max))); ctx.fill(); }
    ctx.globalAlpha = 1;

    drawDoors(s, ui);

    // 專注：把所有連得到的設備連起來。
    if (p.focusing) {
      ctx.strokeStyle = 'rgba(108,214,226,0.28)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 8]); ctx.lineDashOffset = -clock * 40;
      for (const pr of s.props) if (!pr.gone && pr.def.hack && hyp(pr.x - p.x, pr.y - p.y) < s.st.hackRange) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(pr.x, pr.y); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // 駭入範圍（指著東西的時候才畫）
    if (ui.hack) {
      ctx.strokeStyle = ui.hack.why === 'range' ? 'rgba(255,93,108,0.5)' : 'rgba(108,214,226,0.18)'; ctx.lineWidth = 2; ctx.setLineDash([3, 9]);
      circle(p.x, p.y, s.st.hackRange); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = ui.hack.ok ? 'rgba(108,214,226,0.6)' : 'rgba(255,93,108,0.4)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -clock * 50;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ui.hack.x, ui.hack.y); ctx.stroke(); ctx.setLineDash([]);
      if (ui.hackText) label(ui.hackText, ui.hack.x, ui.hack.y - 48, ui.hack.ok ? C.cyan : C.bad, 15);
    }
    if (ui.takedown && ui.takedownText) label(ui.takedownText, ui.takedown.x, ui.takedown.y + ui.takedown.r + 26, C.pink, 15);
    for (const t of texts) { ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2); label(t.str, t.x, t.y, t.col, t.size); }
    ctx.globalAlpha = 1;

    // 黑暗：停電的房間、大停電。玩家周圍留一圈亮的。
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const dark = s.blackout > 0 ? 0.62 : s.spec.mod === 'dark' ? 0.5 : s.spec.mod === 'fog' ? 0.22 : 0;
    if (dark) {
      const g = ctx.createRadialGradient(p.x, p.y, 90, p.x, p.y, s.spec.mod === 'fog' && s.blackout <= 0 ? 520 : 380);
      const tint = s.spec.mod === 'fog' && s.blackout <= 0 ? '170,180,195' : '4,6,12';
      g.addColorStop(0, `rgba(${tint},0)`); g.addColorStop(1, `rgba(${tint},${dark})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (s.spec.mod === 'rain') {
      ctx.strokeStyle = 'rgba(160,190,230,0.22)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) { const x = (i * 97 + clock * 500) % (W + 100) - 50, y = (i * 53 + clock * 1300) % (H + 60) - 30; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 20); ctx.stroke(); }
    }
    if (p.focusing) { const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 950); g.addColorStop(0, 'rgba(20,60,90,0)'); g.addColorStop(1, 'rgba(20,60,90,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (p.hp / p.maxHp < 0.3 && !s.over) { const g = ctx.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 950); g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, `rgba(255,40,60,${0.22 + 0.1 * Math.sin(clock * 6)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (hurtFlash > 0) { ctx.fillStyle = `rgba(255,40,60,${Math.min(0.4, hurtFlash * 0.7)})`; ctx.fillRect(0, 0, W, H); }
    if (whiteFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, whiteFlash)})`; ctx.fillRect(0, 0, W, H); }

    // 準星
    if (ui.mouse && !s.over) {
      const m = ui.mouse;
      ctx.strokeStyle = ui.hack ? (ui.hack.ok ? C.cyan : C.bad) : C.white; ctx.lineWidth = 2;
      circle(m.x, m.y, 9); ctx.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(m.x + dx * 13, m.y + dy * 13); ctx.lineTo(m.x + dx * 19, m.y + dy * 19); ctx.stroke(); }
      circle(m.x, m.y, 1.5); ctx.fillStyle = C.pink; ctx.fill();
    }
  }

  S3.render = { init, resize, reset, toWorld, event, update, draw, C };
})(window.ECHO = window.ECHO || {});
