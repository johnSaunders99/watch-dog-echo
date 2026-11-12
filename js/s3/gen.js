// 第三季的房間生成：同一個種子永遠生出同一個房間。
// 房間是 32×18 格的競技場：先畫牆的骨架（左右對稱），再放可以駭入的設施，最後依威脅額度放敵人和增援。
// 生成完會檢查：每一塊地板都走得到，設施不會把路堵死，敵人不會出現在入口旁邊。
// 回傳的 spec 是純資料，交給 js/s3/sim.js 的 createRoom。
(function (E) {
  const S3 = (E.s3 = E.s3 || {});
  const GW = 32, GH = 18, T = 50;
  const idx = (x, y) => y * GW + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;
  const ENTRY = { tx: 15, ty: 15 };
  const N4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // 門的位置（最上面那排牆，兩格寬）：依門的數量排開。
  // 左上和右上角是狀態列，所以門不排到太旁邊。
  const DOORS = { 1: [15], 2: [11, 19], 3: [9, 15, 21] };

  // 入口附近和門前的走道保持淨空。
  const keep = (x, y) => y <= 2 || (y >= 13 && x >= 11 && x <= 20);

  function fill(g, x0, y0, x1, y1, v) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) g[idx(x, y)] = v;
  }

  // ===== 牆的骨架：只畫左半邊，之後鏡射到右半邊 =====
  const LAYOUTS = {
    pillars(g, r) {
      for (const cx of [4, 8, 12]) for (const cy of [4, 8, 12]) {
        if (!r.chance(0.78)) continue;
        fill(g, cx, cy, cx + r.int(0, 1), cy + r.int(0, 1), 1);
      }
    },
    halls(g, r) {
      for (const y of [5, 11]) {
        fill(g, 1, y, 15, y, 1);
        for (let i = r.int(1, 2); i > 0; i--) { const gx = r.int(2, 11); fill(g, gx, y, gx + 2, y, 0); }
        if (r.chance(0.6)) fill(g, 14, y, 15, y, 0);
      }
    },
    lanes(g, r) {
      for (const x of [5, 10]) {
        fill(g, x, 3, x, 13, 1);
        for (let i = r.int(1, 2); i > 0; i--) { const gy = r.int(3, 10); fill(g, x, gy, x, gy + 2, 0); }
      }
      if (r.chance(0.5)) fill(g, 15, 7, 15, 9, 1);
    },
    cross(g, r) {
      fill(g, 4, 8, 12, 9, 1);
      const gx = r.int(5, 10);
      fill(g, gx, 8, gx + 1, 9, 0);
      fill(g, 15, 4, 15, 6, 1);
      fill(g, 15, 11, 15, 12, 1);
      for (const [x, y] of [[4, 4], [11, 4], [4, 12], [11, 12]]) if (r.chance(0.5)) g[idx(x, y)] = 1;
    },
    rooms(g, r) {
      const x0 = r.int(3, 5), x1 = r.int(10, 12), y0 = r.int(4, 5), y1 = r.int(11, 12);
      fill(g, x0, y0, x1, y0, 1); fill(g, x0, y1, x1, y1, 1); fill(g, x0, y0, x0, y1, 1); fill(g, x1, y0, x1, y1, 1);
      let gx = r.int(x0 + 1, x1 - 2); fill(g, gx, y0, gx + 1, y0, 0);
      gx = r.int(x0 + 1, x1 - 2); fill(g, gx, y1, gx + 1, y1, 0);
      let gy = r.int(y0 + 1, y1 - 2); fill(g, x0, gy, x0, gy + 1, 0);
      gy = r.int(y0 + 1, y1 - 2); fill(g, x1, gy, x1, gy + 1, 0);
    },
    yard(g, r) {
      for (let i = r.int(3, 5); i > 0; i--) {
        const x = r.int(3, 13), y = r.int(4, 12);
        fill(g, x, y, Math.min(14, x + r.int(1, 3)), y, 1);
        if (r.chance(0.7)) fill(g, x, y, x, Math.min(13, y + r.int(1, 2)), 1);
      }
    },
  };

  // 從入口出發的距離（4 方向）。blocked(i) 為 true 的格子過不去。走不到的格子是 -1。
  function flood(g, occ, from) {
    const dist = new Array(GW * GH).fill(-1);
    const start = from !== undefined ? from : idx(ENTRY.tx, ENTRY.ty);
    const q = [start];
    dist[start] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % GW, y = (i - x) / GW;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const j = idx(nx, ny);
        if (dist[j] >= 0 || g[j] === 1 || (occ && occ[j] === 1)) continue;
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
    return dist;
  }
  const reach = (dist) => dist.reduce((n, d) => n + (d >= 0 ? 1 : 0), 0);

  function walls(r, layout) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const g = new Array(GW * GH).fill(0);
      LAYOUTS[layout](g, r);
      for (let y = 1; y < GH - 1; y++) for (let x = 1; x <= 15; x++) g[idx(GW - 1 - x, y)] = g[idx(x, y)];
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
        if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) g[idx(x, y)] = 1;
        else if (keep(x, y)) g[idx(x, y)] = 0;
      }
      // 走不到的地板直接封起來。
      const dist = flood(g);
      for (let i = 0; i < g.length; i++) if (g[i] === 0 && dist[i] < 0) g[i] = 1;
      if (reach(dist) >= 300) return g;
    }
    // 連續失敗就給一個空場。
    const g = new Array(GW * GH).fill(0);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) g[idx(x, y)] = 1;
    return g;
  }

  // ===== 設施 =====
  // occ：1 是擋路的設施、2 是不擋路但已經有東西。
  function placer(g, r) {
    const occ = new Array(GW * GH).fill(0);
    const props = [];
    let open = reach(flood(g, occ));
    const free = (x, y) => inside(x, y) && g[idx(x, y)] === 0 && !occ[idx(x, y)] && !keep(x, y);
    const tiles = () => { const out = []; for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) if (free(x, y)) out.push([x, y]); return out; };
    // 放一個擋路的設施：放下去之後，其他地板都還走得到才算數。
    function solid(kind, cells, extra) {
      if (!cells.every(([x, y]) => free(x, y))) return false;
      for (const [x, y] of cells) occ[idx(x, y)] = 1;
      if (reach(flood(g, occ)) !== open - cells.length) { for (const [x, y] of cells) occ[idx(x, y)] = 0; return false; }
      open -= cells.length;
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      props.push(Object.assign({ kind, tx: Math.min(...xs), ty: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }, extra));
      return true;
    }
    function soft(kind, cells, extra) {
      if (!cells.every(([x, y]) => free(x, y))) return false;
      for (const [x, y] of cells) occ[idx(x, y)] = 2;
      const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
      props.push(Object.assign({ kind, tx: Math.min(...xs), ty: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 }, extra));
      return true;
    }
    const nearWall = (x, y) => N4.some(([dx, dy]) => g[idx(x + dx, y + dy)] === 1);
    const tries = (n, fn) => { for (let i = 0; i < n; i++) if (fn()) return true; return false; };
    const any = () => { const t = tiles(); return t.length ? r.pick(t) : null; };

    const put = {
      crate(last) {
        return tries(20, () => {
          let c = any();
          if (last && r.chance(0.5)) { const [dx, dy] = r.pick(N4); c = [last.tx + dx, last.ty + dy]; }
          return c && solid('crate', [c]);
        });
      },
      barrel() { return tries(20, () => { const c = any(); return c && Math.abs(c[0] - ENTRY.tx) + Math.abs(c[1] - ENTRY.ty) > 5 && solid('barrel', [c]); }); },
      junction() { return tries(40, () => { const c = any(); return c && nearWall(c[0], c[1]) && solid('junction', [c]); }) || tries(10, () => { const c = any(); return c && solid('junction', [c]); }); },
      vent() { return tries(30, () => { const c = any(); return c && !nearWall(c[0], c[1]) && soft('vent', [c]); }); },
      car() {
        return tries(60, () => {
          const c = any();
          if (!c) return false;
          const dir = r.int(0, 3), [dx, dy] = N4[dir];
          const body = [c, [c[0] + dx, c[1] + dy]];
          // 車頭前面要有一段空路，不然開不出去。
          for (let k = 2; k <= 5; k++) if (!free(c[0] + dx * k, c[1] + dy * k)) return false;
          return solid('car', body, { dir });
        });
      },
      bollard() {
        const row = (c, horiz) => [0, 1, 2].map((k) => (horiz ? [c[0] + k, c[1]] : [c[0], c[1] + k]));
        const choke = (c, horiz) => (horiz ? g[idx(c[0] - 1, c[1])] === 1 && g[idx(c[0] + 3, c[1])] === 1 : g[idx(c[0], c[1] - 1)] === 1 && g[idx(c[0], c[1] + 3)] === 1);
        const at = (needChoke) => () => {
          const c = any();
          if (!c) return false;
          const horiz = r.chance(0.5);
          if (needChoke && !choke(c, horiz)) return false;
          return soft('bollard', row(c, horiz), { horiz });
        };
        return tries(80, at(true)) || tries(20, at(false));
      },
      wallMount(kind) {
        return tries(60, () => {
          const x = r.int(0, GW - 1), y = r.int(0, GH - 1);
          if (g[idx(x, y)] !== 1 || occ[idx(x, y)]) return false;
          if (y === 0 || y === GH - 1) return false; // 上面那排留給門，下面是入口
          // 攝影機不能一進門就照到人。
          if (kind === 'camera' && Math.hypot(x - ENTRY.tx, y - ENTRY.ty) < 9) return false;
          const dirs = [0, 1, 2, 3].filter((d) => { const nx = x + N4[d][0], ny = y + N4[d][1]; return inside(nx, ny) && g[idx(nx, ny)] === 0 && occ[idx(nx, ny)] !== 1; });
          if (!dirs.length) return false;
          occ[idx(x, y)] = 2;
          props.push({ kind, tx: x, ty: y, w: 1, h: 1, dir: r.pick(dirs) });
          return true;
        });
      },
      camera() { return put.wallMount('camera'); },
      speaker() { return put.wallMount('speaker'); },
    };
    return { occ, props, put, free, tiles, solid, soft };
  }

  // ===== 敵人 =====
  const WEIGHT = { guard: 3, rusher: 3, drone: 2, hound: 2, shield: 1.5, turret: 1, sniper: 1.2, bomber: 1.2, jammer: 0.8, heavy: 0.7 };
  function compose(r, sectorIdx, depth, roomNo, node) {
    const D = S3.data, sector = D.sectors[sectorIdx];
    const t = sector.rooms > 1 ? Math.min(1, depth / (sector.rooms - 1)) : 0;
    let budget = sector.budget[0] + (sector.budget[1] - sector.budget[0]) * t;
    const mod = node.mod && D.mods[node.mod];
    if (mod && mod.threat) budget *= mod.threat;
    if (node.type === 'elite' || node.type === 'cells') budget *= 1.1;
    if (roomNo === 1) budget *= 0.7; // 整趟的第一間少一點人，讓人先熟悉操作
    const cap = { jammer: 1, heavy: sectorIdx >= 2 ? 2 : 1, sniper: 2, turret: 2, bomber: 2 };
    const picked = [], count = {};
    let left = Math.round(budget);
    while (left >= 2) {
      const pool = Object.keys(D.enemies).filter((k) => D.enemies[k].from <= roomNo && D.enemies[k].cost <= left && (count[k] || 0) < (cap[k] || 99));
      if (!pool.length) break;
      const k = r.weighted(pool, (id) => WEIGHT[id]);
      picked.push(k);
      count[k] = (count[k] || 0) + 1;
      left -= D.enemies[k].cost;
    }
    // 先到的一批佔一半左右，砲塔一定在第一批；剩下的是增援，每波的額度大約 8，最多三波。
    const total = picked.reduce((n, k) => n + D.enemies[k].cost, 0);
    const order = r.shuffle(picked).sort((a, b) => (b === 'turret') - (a === 'turret'));
    const first = [], rest = [];
    let spent = 0;
    for (const k of order) {
      if (k === 'turret' || first.length < 3 || spent < total * 0.5) { first.push(k); spent += D.enemies[k].cost; } else rest.push(k);
    }
    if (node.mod === 'kennel') first.push('hound', 'hound');
    const waves = [];
    if (rest.length) {
      const restCost = rest.reduce((n, k) => n + D.enemies[k].cost, 0);
      const n = Math.max(1, Math.min(3, Math.round(restCost / 8), rest.length));
      for (let i = 0; i < n; i++) waves.push(rest.filter((k, j) => j % n === i));
    }
    return { first, waves };
  }

  // 把一批敵人放到離入口夠遠的地板上。
  function placeEnemies(r, g, P, kinds, node, sectorIdx) {
    const dist = flood(g, P.occ);
    const out = [];
    const far = (min) => P.tiles().filter(([x, y]) => dist[idx(x, y)] >= min && Math.hypot(x - ENTRY.tx, y - ENTRY.ty) >= min * 0.7
      && !out.some((e) => Math.abs(e.tx - x) < 2 && Math.abs(e.ty - y) < 2));
    // 拘留室有人看守：比一般房間多幾個精英，但比精英房少一個。
    let elites = node.type === 'elite' ? 2 + sectorIdx : node.type === 'cells' ? 1 + sectorIdx : 0;
    for (const kind of kinds) {
      let spots = far(10);
      if (!spots.length) spots = far(7);
      if (!spots.length) spots = far(4);
      if (!spots.length) continue;
      const [tx, ty] = r.pick(spots);
      const e = { kind, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, ang: r.next() * Math.PI * 2 };
      const def = S3.data.enemies[kind];
      // 入口附近（9 格內）不安排巡邏，巡邏的另一頭也不會在那裡：不然一進門就撞見。
      const nearEntry = (x, y) => Math.hypot(x - ENTRY.tx, y - ENTRY.ty) < 9;
      if (!def.static && kind !== 'sniper' && !nearEntry(tx, ty) && r.chance(0.55)) {
        // 巡邏：走到 4～9 步外的另一格再走回來。
        const d2 = flood(g, P.occ, idx(tx, ty));
        const targets = P.tiles().filter(([x, y]) => d2[idx(x, y)] >= 4 && d2[idx(x, y)] <= 9 && !nearEntry(x, y));
        if (targets.length) { const [px, py] = r.pick(targets); e.patrol = [{ x: e.x, y: e.y }, { x: (px + 0.5) * T, y: (py + 0.5) * T }]; }
      }
      if (elites > 0 && kind !== 'turret') { e.elite = r.pick(S3.data.affixes); elites--; }
      out.push(e);
    }
    return out;
  }

  // 增援進場的位置：靠左右兩邊的牆。
  function gates(r, g, P) {
    const dist = flood(g, P.occ);
    const spots = P.tiles().filter(([x, y]) => (x <= 2 || x >= GW - 3) && y >= 3 && y <= 12 && dist[idx(x, y)] >= 0);
    const out = [];
    for (const [x, y] of r.shuffle(spots)) {
      if (out.length >= 3) break;
      if (out.some((o) => Math.abs(o.tx - x) + Math.abs(o.ty - y) < 6)) continue;
      out.push({ tx: x, ty: y, x: (x + 0.5) * T, y: (y + 0.5) * T });
    }
    if (!out.length) out.push({ tx: 2, ty: 3, x: 2.5 * T, y: 3.5 * T });
    return out;
  }

  // ===== 首領的場地：手排的。先畫牆，再放設施 =====
  const ARENAS = {
    bulldog(g, r) {
      for (const [x, y] of [[8, 5], [22, 5], [8, 11], [22, 11]]) fill(g, x, y, x + 1, y + 1, 1);
      const P = placer(g, r);
      for (const [x, y] of [[7, 6], [24, 6], [7, 10], [24, 10], [15, 4], [16, 12]]) P.solid('junction', [[x, y]]);
      for (const [x, y] of [[4, 4], [27, 4], [4, 13], [27, 13], [12, 8]]) P.solid('barrel', [[x, y]]);
      P.soft('bollard', [[14, 8], [15, 8], [16, 8]], { horiz: true });
      P.soft('bollard', [[10, 5], [10, 6], [10, 7]], { horiz: false });
      P.soft('bollard', [[21, 9], [21, 10], [21, 11]], { horiz: false });
      return { P, boss: { x: 16 * T, y: 4.5 * T } };
    },
    carrier(g, r) {
      for (const [x, y, w, h] of [[6, 6, 3, 1], [23, 6, 3, 1], [11, 10, 1, 3], [20, 10, 1, 3], [15, 7, 2, 1]]) fill(g, x, y, x + w - 1, y + h - 1, 1);
      const P = placer(g, r);
      P.solid('pylon', [[4, 10]]); P.solid('pylon', [[27, 10]]);
      for (const [x, y] of [[9, 4], [22, 4], [14, 11]]) P.solid('junction', [[x, y]]);
      for (const [x, y] of [[13, 5], [18, 12], [7, 12], [24, 12]]) P.soft('vent', [[x, y]]);
      for (const [x, y] of [[5, 12], [26, 12]]) P.solid('crate', [[x, y]]);
      return { P, boss: { x: 16 * T, y: 3.5 * T } };
    },
    keystone(g, r) {
      for (const [x, y] of [[7, 5], [24, 5], [7, 11], [24, 11], [11, 8], [20, 8]]) fill(g, x, y, x, y + 1, 1);
      const P = placer(g, r);
      P.solid('pylon', [[5, 8]]); P.solid('pylon', [[26, 8]]); P.solid('pylon', [[15, 12]]);
      for (const [x, y] of [[12, 4], [19, 4], [10, 12], [21, 12]]) P.solid('junction', [[x, y]]);
      for (const [x, y] of [[3, 12], [28, 12]]) P.solid('barrel', [[x, y]]);
      P.soft('bollard', [[14, 10], [15, 10], [16, 10]], { horiz: true });
      const turrets = [[3, 3], [28, 3], [3, 10], [28, 10]].map(([tx, ty]) => ({ kind: 'turret', tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, ang: Math.PI / 2 }));
      return { P, boss: { x: 16 * T, y: 6 * T }, adds: turrets };
    },
  };

  // 生成一個房間。node：{ type, mod, reward }；doors：打完之後有幾扇門。
  function room(seed, sectorIdx, depth, roomNo, node, doors) {
    const D = S3.data, sector = D.sectors[sectorIdx];
    const r = E.rng.derive(seed, 'room', roomNo, node.type, node.mod || '');
    const mod = node.mod ? D.mods[node.mod] : null;
    const spec = {
      seed: E.rng.hash([seed, roomNo, 'sim'].join(':')), sector: sectorIdx, depth, roomNo, theme: sector.id,
      type: node.type, mod: node.mod || null, scale: sector.scale, dataMul: (mod && mod.data) || 1,
      doors: (DOORS[doors] || DOORS[1]).map((tx) => ({ tx, x: (tx + 1) * T, y: T })),
      entry: { x: (ENTRY.tx + 1) * T, y: (ENTRY.ty + 0.5) * T },
      boss: null, waves: [], supply: node.mod === 'supply', cells: node.type === 'cells',
    };
    if (node.type === 'boss') {
      const g = new Array(GW * GH).fill(0);
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (x === 0 || y === 0 || x === GW - 1 || y === GH - 1) g[idx(x, y)] = 1;
      const a = ARENAS[sector.boss](g, r);
      const P = a.P;
      spec.tiles = g;
      spec.props = P.props;
      spec.boss = sector.boss;
      spec.enemies = [{ kind: 'boss', boss: sector.boss, x: a.boss.x, y: a.boss.y, ang: Math.PI / 2 }].concat(a.adds || []);
      spec.gates = gates(r, g, P);
      return spec;
    }
    const g = walls(r, r.pick(sector.layouts));
    const P = placer(g, r);
    let lastCrate = null;
    for (const kind of ['car', 'bollard', 'junction', 'barrel', 'vent', 'camera', 'speaker', 'crate']) {
      const [lo, hi] = sector.props[kind];
      for (let n = r.int(lo, hi); n > 0; n--) {
        if (P.put[kind](lastCrate) && kind === 'crate') lastCrate = P.props[P.props.length - 1];
      }
    }
    const squad = compose(r, sectorIdx, depth, roomNo, node);
    spec.tiles = g;
    spec.props = P.props;
    spec.enemies = placeEnemies(r, g, P, squad.first, node, sectorIdx);
    spec.waves = squad.waves.map((w) => w.map((kind) => ({ kind })));
    spec.gates = gates(r, g, P);
    return spec;
  }

  S3.gen = { room, flood, GW, GH, T, DOORS };
})(window.ECHO = window.ECHO || {});
