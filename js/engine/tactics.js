// 第二季的戰術地圖：夜間行動的另一種玩法（俯視、回合制的潛入）。
// 一張 13×9 的格子地圖（content-s2/maps.js）：牆、地板、暗處、圍欄、上鎖的門、藏身處、目標、撤離點。
// 每個隊員一回合有兩個行動點：移動一次（三格左右）或用一個能力各花一點。按「結束回合」之後，守衛、攝影機、無人機才會動。
// 能力來自這個人的類別、專長、特質、弱點和小習慣：駭客遠端駭門、攝影機和無人機（目標還是要走到旁邊）；身體類翻圍欄、制伏守衛、撞門；
// 社交類搭話引開守衛、偽裝；專長各有一手（鎖匠撬鎖、護理師急救、司機叫車）。沒有對應的人也能硬來，只是更慢、更吵。
// 被看到會增加警戒（沿用夜間行動的警戒）：警戒 30 會來增援，60 以上無人機會開火，滿了就有人被捕；被守衛追上也會被捕。
// 狀態全部放在 s.op.tac，可以直接存檔。這裡不碰隊伍和結算，需要的時候都經由夜間引擎傳進來的 api。
(function (E) {
  const AP = 2;
  const MOVE = 3;
  const STAND = '.,dXSHE';   // 人可以站的格子
  const OPAQUE = '#D';        // 擋住視線的格子
  const OBJ = 'TPF';          // 目標（終端、控制箱、天線、被關的人、要燒的檔案）
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SPOT = { guard: 10, cam: 6, drone: 8 }; // 被看到時增加的警戒

  const tile = (t, x, y) => (x < 0 || y < 0 || x >= t.w || y >= t.h ? '#' : t.map[y][x]);
  const setTile = (t, x, y, c) => { t.map[y] = t.map[y].slice(0, x) + c + t.map[y].slice(x + 1); };
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  const manh = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  const key = (x, y) => x + ',' + y;
  const live = (t) => t.units.filter((u) => !u.out && !u.taken);
  const active = (f) => !f.down && !(f.off > 0) && !(f.loop > 0) && f.state !== 'distracted';

  // ===== 建立地圖 =====
  // o：{ map, obj（T 格的目標種類）, ids（出發的隊員）, rank（第幾區，越後面守衛越多）, limit（限時行動的回合數）, escort（被救的人）, intel }
  function build(o) {
    const tpl = E.s2.maps[o.map];
    const t = {
      map: tpl.rows.slice(), mapId: o.map, w: tpl.rows[0].length, h: tpl.rows.length, turn: 1, limit: o.limit || null,
      keys: tpl.keys !== false, units: [], foes: [], objs: [], used: {}, seen: {}, locks: {}, intel: !!o.intel, escort: o.escort || null, spawns: [],
    };
    const starts = [];
    for (let y = 0; y < t.h; y++) {
      for (let x = 0; x < t.w; x++) {
        const c = t.map[y][x];
        if (c === 'S') starts.push([x, y]);
        if (c === 'E') t.spawns.push([x, y]);
        if (c === 'T') t.objs.push({ x, y, kind: o.obj || tpl.obj || 'terminal', done: false });
        if (c === 'P') t.objs.push({ x, y, kind: 'prisoner', done: false });
        if (c === 'F') t.objs.push({ x, y, kind: 'files', done: false });
      }
    }
    o.ids.forEach((id, i) => {
      const [x, y] = starts[i % starts.length];
      t.units.push({ id, x, y, ap: AP, out: false, taken: false, disguise: 0 });
    });
    // 出發點不夠的時候，把多的人往旁邊挪。
    for (const u of t.units) {
      if (t.units.filter((v) => v.x === u.x && v.y === u.y).length > 1) {
        const free = near(t, u.x, u.y);
        if (free) { u.x = free[0]; u.y = free[1]; }
      }
    }
    let n = 0;
    for (const g of tpl.guards || []) {
      if ((g.minRank || 0) > o.rank) continue;
      const f = guard(t, 'g' + n++, g.route, g.state);
      if (g.chase) f.chase = true;
      t.foes.push(f);
    }
    for (const d of tpl.drones || []) if ((d.minRank || 0) <= o.rank) t.foes.push({ id: 'd' + n++, kind: 'drone', x: d.route[0][0], y: d.route[0][1], face: [1, 0], route: d.route, ri: 1, state: 'patrol', timer: 0, loop: 0, down: false });
    for (const c of tpl.cams || []) if ((c.minRank || 0) <= o.rank) t.foes.push({ id: 'c' + n++, kind: 'cam', x: c.x, y: c.y, face: c.faces[0], faces: c.faces, fi: 0, off: 0, down: false, state: 'patrol' });
    return t;
  }

  function guard(t, id, route, state) {
    return { id, kind: 'guard', x: route[0][0], y: route[0][1], face: [1, 0], route, ri: route.length > 1 ? 1 : 0, state: state || 'patrol', timer: 0, target: null, down: false };
  }

  // 一個空的鄰格（給多出來的人、被救出來的人用）。
  function near(t, x, y) {
    for (let r = 1; r < 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (STAND.includes(tile(t, nx, ny)) && !occupied(t, nx, ny)) return [nx, ny];
        }
      }
    }
    return null;
  }

  function occupied(t, x, y, ignore) {
    return live(t).some((u) => u !== ignore && u.x === x && u.y === y)
      || t.foes.some((f) => f !== ignore && f.kind === 'guard' && !f.down && f.x === x && f.y === y);
  }

  // ===== 視線 =====
  function los(t, ax, ay, bx, by) {
    let x = ax, y = ay;
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx + dy;
    while (x !== bx || y !== by) {
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
      if ((x !== bx || y !== by) && OPAQUE.includes(tile(t, x, y))) return false;
    }
    return true;
  }

  // 一個敵人看不看得到某一格（不管那一格上的人有沒有躲好）。range 由呼叫的人調整。
  function inView(t, f, x, y, bonus = 0) {
    if (f.kind === 'drone') return cheb(f.x, f.y, x, y) <= 2 + Math.max(0, bonus);
    const range = (f.kind === 'cam' ? 5 : f.state === 'alert' ? 5 : 4) + bonus;
    const dx = x - f.x, dy = y - f.y;
    if (dx === 0 && dy === 0) return false;
    // 守衛身邊一格：前面和兩側都看得到，正後方看不到（所以可以從背後摸上去）。
    if (f.kind === 'guard' && cheb(f.x, f.y, x, y) <= 1) return dx * f.face[0] + dy * f.face[1] >= 0;
    if (cheb(f.x, f.y, x, y) > range) return false;
    const along = dx * f.face[0] + dy * f.face[1];
    const perp = Math.abs(dx * f.face[1] - dy * f.face[0]);
    // 守衛的視野是 90 度；攝影機看得遠，但只看一條窄窄的扇形。
    const inCone = f.kind === 'cam' ? perp * 2 <= along : perp <= along;
    return along >= 1 && inCone && los(t, f.x, f.y, x, y);
  }

  // 畫面用：每個敵人看得到的格子。
  function vision(s) {
    const t = s.op.tac;
    const out = {};
    for (const f of t.foes) {
      if (!active(f)) continue;
      const cells = [];
      for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (tile(t, x, y) !== '#' && inView(t, f, x, y)) cells.push([x, y]);
      out[f.id] = cells;
    }
    return out;
  }

  // 敵人有沒有發現某個人：暗處、藏身處、偽裝都只在貼身時才會被看到。
  function spots(s, api, f, u) {
    const t = s.op.tac;
    if (!active(f) || u.out || u.taken) return false;
    const fl = api.flaw(s, u.id);
    const bonus = (api.traits(s, u.id).includes('unremarkable') ? -1 : 0) + (fl === 'record' && f.kind !== 'drone' ? 1 : 0);
    if (!inView(t, f, u.x, u.y, bonus)) return false;
    const adjacent = cheb(f.x, f.y, u.x, u.y) <= 1;
    const c = tile(t, u.x, u.y);
    if (c === 'H') return adjacent && f.kind === 'guard';
    if (c === ',' && f.kind !== 'drone' && (!adjacent || api.traits(s, u.id).includes('nightowl'))) return false;
    if (u.disguise > 0 && !adjacent) return false;
    return true;
  }

  // ===== 能力 =====
  // 一個人在戰術地圖上會什麼：由類別、專長、特質、弱點、小習慣決定。src 是給畫面顯示的「為什麼會」。
  function caps(s, api, id) {
    // 被救出來的人只能移動（被關了好幾天，走不快）。
    const unit = s.op.tac.units.find((x) => x.id === id);
    if (unit && unit.escort) return { move: MOVE - 1, escort: true, list: [] };
    const cat = api.category(s, id), perk = api.perk(s, id), tr = api.traits(s, id), fl = api.flaw(s, id), q = api.quirks(s, id);
    const skills = api.person(s, id).skills;
    const has = (x) => tr.includes(x);
    const c = { cat, perk, list: [] };
    c.move = MOVE + (has('fast') ? 1 : 0) + (q.includes('marathon') ? 1 : 0) + (perk === 'sprint' ? 1 : 0) - (fl === 'bad_knees' ? 1 : 0);
    c.hack = cat === 'hacker' || skills.hack >= 2 || ['take_over', 'legacy', 'backdoor', 'botnet', 'network_access', 'broadcast'].includes(perk);
    c.hackRange = 5 + (perk === 'botnet' ? 2 : 0) + (q.includes('gamer') ? 1 : 0);
    c.climb = (cat === 'physical' || has('nimble') || ['climb', 'rooftops'].includes(perk)) && fl !== 'acrophobia' && fl !== 'bad_knees';
    c.takedown = cat === 'physical' || has('strong') || q.includes('ex_army');
    c.anyAngle = has('strong') || q.includes('ex_army');
    c.talk = cat === 'social' || has('silver') || q.includes('choir') || perk === 'distraction';
    c.talkRange = 1 + (has('silver') ? 1 : 0) + (q.includes('choir') ? 1 : 0) + (perk === 'distraction' ? 3 : 0);
    c.talkTurns = Math.max(1, 2 + (has('silver') ? 1 : 0) - (fl === 'honest' ? 1 : 0));
    c.disguise = (cat === 'social' || perk === 'disguise') && fl !== 'honest';
    c.disguiseTurns = perk === 'disguise' ? 5 : 3;
    c.unlock = ['lockpick', 'master_keys', 'site_pass', 'building_access'].includes(perk);
    c.heal = perk === 'heal';
    c.cab = perk === 'getaway' || has('driver');
    c.strong = cat === 'physical' || has('strong');
    c.quiet = has('careful');
    c.loud = fl === 'loudmouth';
    c.clumsy = fl === 'clumsy';
    c.dark = fl === 'dark';
    c.lost = fl === 'no_sense';
    return c;
  }

  // 打開了（或被抓了）之後還有沒有剩下沒完成的目標；被救的人要帶出去才算完成。
  const objsLeft = (t) => t.objs.some((o) => !o.done);

  // 某個人現在能用的能力，每個附上可以選的目標格。ap 是需要的行動點。
  function abilities(s, api, id) {
    const t = s.op.tac;
    const u = t.units.find((x) => x.id === id);
    if (!u || u.out || u.taken || u.ap <= 0) return [];
    const c = caps(s, api, id);
    if (c.escort) return [];
    const out = [];
    const adj = DIRS.map(([dx, dy]) => [u.x + dx, u.y + dy]);
    const foesAt = (pred) => t.foes.filter((f) => !f.down && pred(f));
    const bw = api.bw(s);
    const hackCost = api.perk(s, id) === 'legacy' || (api.perk(s, id) === 'backdoor' && !t.used['backdoor:' + id]) ? 0 : 1;
    if (c.hack && bw >= hackCost) {
      const inRange = (x, y) => manh(u.x, u.y, x, y) <= c.hackRange && los(t, u.x, u.y, x, y);
      const targets = []
        .concat(foesAt((f) => f.kind === 'cam' && !(f.off > 0) && inRange(f.x, f.y)).map((f) => [f.x, f.y]))
        .concat(foesAt((f) => f.kind === 'drone' && !(f.loop > 0) && inRange(f.x, f.y)).map((f) => [f.x, f.y]));
      // 目標不能遠端駭：一定要有人走到旁邊（駭客一個行動點、安靜；其他人兩個行動點，還會發出聲音）。
      for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
        const ch = tile(t, x, y);
        if ((ch === 'D' || (ch === 'd' && !t.keys)) && inRange(x, y)) targets.push([x, y]);
      }
      if (targets.length) out.push({ id: 'hack', ap: 1, bw: hackCost, targets });
    }
    if (c.climb) {
      const targets = [];
      for (const [dx, dy] of DIRS) {
        const fx = u.x + dx, fy = u.y + dy, lx = u.x + 2 * dx, ly = u.y + 2 * dy;
        if (tile(t, fx, fy) === '=' && STAND.includes(tile(t, lx, ly)) && !occupied(t, lx, ly) && !(c.dark && tile(t, lx, ly) === ',')) targets.push([fx, fy]);
      }
      if (targets.length) out.push({ id: 'climb', ap: 1, targets });
    }
    if (c.takedown) {
      const targets = foesAt((f) => f.kind === 'guard' && manh(f.x, f.y, u.x, u.y) === 1 && (c.anyAngle || f.state === 'distracted' || !inFront(f, u))).map((f) => [f.x, f.y]);
      if (targets.length) out.push({ id: 'takedown', ap: 1, targets });
    }
    if (c.talk) {
      const targets = foesAt((f) => f.kind === 'guard' && f.state !== 'distracted' && (f.state !== 'alert' || api.traits(s, id).includes('silver'))
        && manh(f.x, f.y, u.x, u.y) <= c.talkRange && los(t, u.x, u.y, f.x, f.y)).map((f) => [f.x, f.y]);
      if (targets.length) out.push({ id: 'talk', ap: 1, targets });
    }
    if (c.disguise && !t.used['disguise:' + id]) out.push({ id: 'disguise', ap: 1, targets: [[u.x, u.y]] });
    const doors = adj.filter(([x, y]) => tile(t, x, y) === 'D');
    if (doors.length && c.unlock) out.push({ id: 'unlock', ap: 1, targets: doors });
    if (doors.length && (c.strong ? u.ap >= 1 : u.ap >= 2)) out.push({ id: 'force', ap: c.strong ? 1 : 2, targets: doors });
    if (c.heal) {
      const targets = live(t).filter((v) => api.hurt(s, v.id) && manh(v.x, v.y, u.x, u.y) <= 1).map((v) => [v.x, v.y]);
      if (targets.length) out.push({ id: 'heal', ap: 1, targets });
    }
    if (c.cab && !t.used.cab && tile(t, u.x, u.y) !== 'X') out.push({ id: 'cab', ap: 1, targets: [[u.x, u.y]] });
    // 目標：沒有對應的人也做得到，只是要兩個行動點，還會發出聲音。
    const objs = t.objs.filter((o) => !o.done && manh(o.x, o.y, u.x, u.y) === 1);
    for (const o of objs) {
      const ap = interactCost(s, api, id, o, c);
      if (u.ap >= ap) out.push({ id: 'use', ap, targets: [[o.x, o.y]], kind: o.kind });
    }
    return out;
  }

  // 敵人是不是正面對著這個人（制伏要從背後或側面）。
  function inFront(f, u) {
    const dx = u.x - f.x, dy = u.y - f.y;
    return dx * f.face[0] + dy * f.face[1] >= 1;
  }

  function interactCost(s, api, id, o, c) {
    if (o.kind === 'prisoner' || o.kind === 'files' || o.kind === 'person') return 1;
    if (o.kind === 'terminal') return c.hack ? 1 : 2;
    if (o.kind === 'box') return c.strong || c.hack ? 1 : 2;
    if (o.kind === 'antenna') return ['pirate_radio', 'broadcast', 'press'].includes(c.perk) || c.hack ? 1 : 2;
    return 1;
  }

  // ===== 移動 =====
  // 走路會一格一格走：路上只要被看到就停下來。所以每一格都先找「最少經過敵人視線」的路，一樣安全再找最短的。
  // 回傳 { best: { "x,y": { d 步數, e 經過幾格被看到的格子 } }, prev: { "步數|x,y": 上一格 } }。怕黑的人不進暗處。
  function plan(s, api, id) {
    const t = s.op.tac;
    const u = t.units.find((x) => x.id === id);
    const best = {};
    const prev = {};
    if (!u || u.out || u.taken || u.ap <= 0) return { best, prev };
    const c = caps(s, api, id);
    const max = Math.max(1, c.move - (api.hurt(s, id) ? 1 : 0));
    const exposed = {};
    const risk = (x, y) => {
      const k = key(x, y);
      if (exposed[k] === undefined) {
        const ghost = Object.assign({}, u, { x, y });
        exposed[k] = t.foes.some((f) => spots(s, api, f, ghost)) ? 1 : 0;
      }
      return exposed[k];
    };
    // 每一層（走了幾步）記下每一格最少被看到幾次。
    let layer = { [key(u.x, u.y)]: 0 };
    for (let d = 1; d <= max; d++) {
      const next = {};
      for (const k of Object.keys(layer)) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, nk = key(nx, ny);
          const ch = tile(t, nx, ny);
          if (!STAND.includes(ch) || occupied(t, nx, ny, u) || (c.dark && ch === ',') || (nx === u.x && ny === u.y)) continue;
          const e = layer[k] + risk(nx, ny);
          if (next[nk] === undefined || e < next[nk]) { next[nk] = e; prev[d + '|' + nk] = k; }
        }
      }
      for (const nk of Object.keys(next)) {
        const b = best[nk];
        if (!b || next[nk] < b.e) best[nk] = { d, e: next[nk] };
      }
      layer = next;
    }
    return { best, prev };
  }

  // 可以走到的格子：{ "x,y": 步數 }。
  function reach(s, api, id) {
    const out = {};
    const { best } = plan(s, api, id);
    for (const k of Object.keys(best)) out[k] = best[k].d;
    return out;
  }

  // 畫面用：走過去的路上會被看到的格子。
  function risky(s, api, id) {
    const { best } = plan(s, api, id);
    return Object.keys(best).filter((k) => best[k].e > 0);
  }

  function move(s, api, id, x, y) {
    const t = s.op.tac;
    if (s.phase !== 'tac') return false;
    const u = t.units.find((v) => v.id === id);
    const { best, prev } = plan(s, api, id);
    const b = best[key(x, y)];
    if (!u || !b) return false;
    const steps = [];
    for (let d = b.d, k = key(x, y); d > 0; k = prev[d + '|' + k], d--) steps.unshift(k.split(',').map(Number));
    // 路痴：走遠一點的時候，有時候會少走一格。
    if (caps(s, api, id).lost && steps.length >= 3 && api.rand(s).chance(0.25)) {
      steps.pop();
      api.say(s, 'warn', 'tac.log.lost', { name: api.name(s, id) });
    }
    u.ap--;
    // 一格一格走；被看到就停在那一格。
    for (const [sx, sy] of steps) {
      u.x = sx;
      u.y = sy;
      if (t.foes.some((f) => spots(s, api, f, u))) {
        if (sx !== x || sy !== y) api.say(s, 'warn', 'tac.log.stopped', { name: api.name(s, id) });
        break;
      }
    }
    return after(s, api, u);
  }

  // 每個動作之後：到了撤離點就離開、檢查有沒有被看到、檢查任務結束了沒有。
  function after(s, api, u) {
    if (s.phase !== 'tac') return true;
    const t = s.op.tac;
    if (tile(t, u.x, u.y) === 'X' && !objsLeft(t)) {
      u.out = true;
      api.say(s, 'ok', 'tac.log.out', { name: api.name(s, u.id) });
    } else detect(s, api, [u]);
    return check(s, api);
  }

  // 發出聲音：附近在巡邏的守衛會過來看看。
  function noise(s, api, x, y, r) {
    const t = s.op.tac;
    let heard = false;
    for (const f of t.foes) {
      if (f.kind !== 'guard' || f.down || f.state === 'distracted' || manh(f.x, f.y, x, y) > r) continue;
      f.state = 'alert';
      f.target = [x, y];
      f.timer = 0;
      heard = true;
    }
    if (heard) api.say(s, 'warn', 'tac.log.noise');
  }

  // 用能力。x、y 是目標格。
  function use(s, api, id, ab, x, y) {
    const t = s.op.tac;
    if (s.phase !== 'tac') return false;
    const u = t.units.find((v) => v.id === id);
    const a = abilities(s, api, id).find((v) => v.id === ab && v.targets.some(([tx, ty]) => tx === x && ty === y));
    if (!u || !a || u.ap < a.ap) return false;
    const c = caps(s, api, id);
    const v = { name: api.name(s, id) };
    const r = api.rand(s);
    const loud = (radius) => { if (!c.quiet) noise(s, api, u.x, u.y, radius + (c.loud ? 2 : 0)); };
    u.ap -= a.ap;
    const foe = t.foes.find((f) => f.x === x && f.y === y && !f.down);
    if (ab === 'hack') {
      api.spend(s, a.bw);
      if (a.bw === 0 && api.perk(s, id) === 'backdoor') t.used['backdoor:' + id] = true;
      const obj = t.objs.find((o) => o.x === x && o.y === y && !o.done);
      if (foe && foe.kind === 'cam') { foe.off = 3; api.say(s, 'card', 'tac.log.camOff', v); }
      else if (foe && foe.kind === 'drone') {
        if (api.perk(s, id) === 'take_over') { foe.down = true; api.say(s, 'card', 'tac.log.droneTaken', v); }
        else { foe.loop = 2; api.say(s, 'card', 'tac.log.droneLoop', v); }
      } else if (obj) { obj.done = true; api.say(s, 'gain', 'tac.log.obj.' + obj.kind, v); }
      else if (tile(t, x, y) === 'D') { setTile(t, x, y, 'd'); api.say(s, 'card', 'tac.log.doorHack', v); }
      else if (tile(t, x, y) === 'd') { setTile(t, x, y, 'D'); t.locks[key(x, y)] = t.turn + 2; api.say(s, 'card', 'tac.log.doorLock', v); }
      if (api.perk(s, id) !== 'legacy') api.addAlert(s, 2, id);
    } else if (ab === 'climb') {
      const dx = x - u.x, dy = y - u.y;
      if (c.clumsy && r.chance(0.25)) { api.say(s, 'bad', 'tac.log.climbFail', v); loud(3); }
      else { u.x = x + dx; u.y = y + dy; api.say(s, 'ok', 'tac.log.climb', v); }
    } else if (ab === 'takedown') {
      if (c.clumsy && r.chance(0.25)) {
        api.say(s, 'bad', 'tac.log.takedownFail', v);
        foe.state = 'alert';
        foe.target = [u.x, u.y];
        api.addAlert(s, 10, id);
      } else {
        foe.down = true;
        api.say(s, 'ok', 'tac.log.takedown', v);
        loud(2);
      }
    } else if (ab === 'talk') {
      foe.state = 'distracted';
      foe.timer = c.talkTurns;
      foe.face = [Math.sign(u.x - foe.x), Math.sign(u.y - foe.y)];
      if (foe.face[0] && foe.face[1]) foe.face[1] = 0;
      api.say(s, 'ok', 'tac.log.talk', Object.assign({ n: c.talkTurns }, v));
    } else if (ab === 'disguise') {
      t.used['disguise:' + id] = true;
      u.disguise = c.disguiseTurns;
      api.say(s, 'ok', 'tac.log.disguise', Object.assign({ n: c.disguiseTurns }, v));
    } else if (ab === 'unlock') {
      setTile(t, x, y, 'd');
      api.say(s, 'ok', 'tac.log.unlock.' + api.perk(s, id), v);
    } else if (ab === 'force') {
      setTile(t, x, y, 'd');
      api.say(s, 'warn', c.strong ? 'tac.log.force' : 'tac.log.forceHard', v);
      loud(c.strong ? 3 : 5);
      if (!c.strong) api.addAlert(s, 5, id);
    } else if (ab === 'heal') {
      const w = live(t).find((o) => o.x === x && o.y === y);
      api.heal(s, w.id);
      api.say(s, 'gain', 'tac.log.heal', { name: api.name(s, id), other: api.name(s, w.id) });
    } else if (ab === 'cab') {
      t.used.cab = true;
      setTile(t, u.x, u.y, 'X');
      api.say(s, 'card', 'tac.log.cab', v);
    } else if (ab === 'use') {
      const obj = t.objs.find((o) => o.x === x && o.y === y && !o.done);
      if (obj.kind === 'prisoner') {
        obj.done = true;
        setTile(t, x, y, '.');
        // 被救出來的人下一回合起由玩家帶著走（每回合兩個行動點，只能移動）。
        t.units.push({ id: t.escort || 'escort', x, y, ap: 0, out: false, taken: false, disguise: 0, escort: true });
        api.say(s, 'gain', 'tac.log.obj.prisoner', v);
      } else {
        obj.done = true;
        api.say(s, 'gain', 'tac.log.obj.' + obj.kind, v);
        if (a.ap >= 2) loud(4); // 沒有對應專長的人慢慢弄，會發出聲音
        else if (obj.kind === 'box' && !caps(s, api, id).hack) loud(3);
      }
    }
    if (s.phase !== 'tac') return true;
    return after(s, api, u);
  }

  // ===== 被發現 =====
  function detect(s, api, units) {
    const t = s.op.tac;
    for (const f of t.foes) {
      for (const u of units) {
        if (s.phase !== 'tac') return;
        if (!spots(s, api, f, u)) continue;
        const k = f.id + ':' + u.id;
        if (t.seen[k] === t.turn) continue;
        t.seen[k] = t.turn;
        const v = { name: api.name(s, u.id) };
        // 冷靜：第一次被看到時，站著不動，對方以為只是路人。
        if (!u.escort && api.traits(s, u.id).includes('calm') && !t.used['calm:' + u.id]) {
          t.used['calm:' + u.id] = true;
          api.say(s, 'card', 'tac.log.calm', v);
          continue;
        }
        api.say(s, 'warn', 'tac.log.spotted.' + f.kind, v);
        if (f.kind === 'guard') { f.state = 'alert'; f.target = [u.x, u.y]; f.timer = 0; }
        if (f.kind === 'cam') {
          const g = t.foes.filter((x) => x.kind === 'guard' && !x.down && x.state === 'patrol').sort((a, b) => manh(a.x, a.y, u.x, u.y) - manh(b.x, b.y, u.x, u.y))[0];
          if (g) { g.state = 'alert'; g.target = [u.x, u.y]; g.timer = 0; }
        }
        const extra = !u.escort && api.flaw(s, u.id) === 'hothead' && f.kind === 'guard' ? 5 : 0;
        if (extra) api.say(s, 'warn', 'tac.log.hothead', v);
        const blame = u.escort ? (live(t).find((x) => !x.escort) || u).id : u.id;
        api.addAlert(s, SPOT[f.kind] + extra, blame);
        if (s.phase !== 'tac') return;
        // 警戒 60 以上，武裝無人機會開火。
        if (f.kind === 'drone' && s.op.alert >= 60 && !u.escort && t.used['shot:' + f.id] !== t.turn) {
          t.used['shot:' + f.id] = t.turn;
          if (api.rand(s).chance(0.5)) api.wound(s, u.id);
          else api.say(s, 'warn', 'tac.log.miss', v);
        }
      }
    }
  }

  // ===== 敵人的回合 =====
  // 守衛找路：守衛有鑰匙，可以穿過上鎖的門（突襲的地圖除外）；不會走進有人的格子。
  function path(t, f, tx, ty) {
    const ok = (x, y) => STAND.includes(tile(t, x, y)) || (t.keys && tile(t, x, y) === 'D');
    const prev = { [key(f.x, f.y)]: null };
    const q = [[f.x, f.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev[k] !== undefined || !ok(nx, ny)) continue;
        prev[k] = [x, y];
        q.push([nx, ny]);
      }
    }
    if (prev[key(tx, ty)] === undefined) return [];
    const out = [];
    let cur = [tx, ty];
    while (cur && !(cur[0] === f.x && cur[1] === f.y)) { out.unshift(cur); cur = prev[key(cur[0], cur[1])]; }
    return out;
  }

  function step(t, f, steps) {
    for (const [x, y] of steps) {
      if (occupied(t, x, y, f)) break;
      f.face = [Math.sign(x - f.x), Math.sign(y - f.y)];
      f.x = x;
      f.y = y;
    }
  }

  function endTurn(s, api) {
    const t = s.op.tac;
    if (s.phase !== 'tac') return false;
    // 會出包的小習慣和弱點：手機響、咳嗽、打噴嚏。
    for (const u of live(t)) {
      if (u.escort) continue;
      const r = api.rand(s);
      const fl = api.flaw(s, u.id), q = api.quirks(s, u.id);
      const v = { name: api.name(s, u.id) };
      if (fl === 'phone' && r.chance(0.12)) { api.say(s, 'warn', 'tac.log.phone', v); noise(s, api, u.x, u.y, 4); }
      else if (q.includes('smoker') && r.chance(0.1)) { api.say(s, 'warn', 'tac.log.cough', v); noise(s, api, u.x, u.y, 2); }
      else if (fl === 'allergic' && r.chance(0.1)) { api.say(s, 'warn', 'tac.log.sneeze', v); noise(s, api, u.x, u.y, 2); }
    }
    for (const f of t.foes) {
      if (f.down) continue;
      if (f.kind === 'cam') {
        if (f.off > 0) f.off--;
        else if (f.faces.length > 1 && t.turn % 2 === 0) { f.fi = (f.fi + 1) % f.faces.length; f.face = f.faces[f.fi]; }
        continue;
      }
      if (f.loop > 0) { f.loop--; continue; }
      if (f.state === 'distracted') { if (--f.timer <= 0) f.state = 'patrol'; continue; }
      if (f.kind === 'drone') {
        // 無人機飛越牆和圍欄，一回合兩格。
        for (let i = 0; i < 2; i++) {
          const [tx, ty] = f.route[f.ri];
          if (f.x === tx && f.y === ty) f.ri = (f.ri + 1) % f.route.length;
          const [nx, ny] = f.route[f.ri];
          const dx = Math.sign(nx - f.x), dy = dx ? 0 : Math.sign(ny - f.y);
          f.face = [dx, dy];
          f.x += dx;
          f.y += dy;
        }
        continue;
      }
      if (f.state === 'alert') {
        // 追過去：一回合兩格。到了沒看到人，再找兩回合就回去巡邏。
        const target = f.chase ? nearestUnit(t, f) : f.target;
        if (target) step(t, f, path(t, f, target[0], target[1]).slice(0, 2));
        if (!f.chase && f.target && f.x === f.target[0] && f.y === f.target[1] && ++f.timer >= 2) { f.state = 'patrol'; f.target = null; }
      } else {
        let [tx, ty] = f.route[f.ri];
        if (f.x === tx && f.y === ty) { f.ri = (f.ri + 1) % f.route.length; [tx, ty] = f.route[f.ri]; }
        step(t, f, path(t, f, tx, ty).slice(0, 1));
      }
      if (catchUp(s, api, f)) return true;
    }
    // 駭客鎖上的門，兩回合後會被撞開。
    for (const k of Object.keys(t.locks)) {
      if (t.turn < t.locks[k]) continue;
      const [x, y] = k.split(',').map(Number);
      setTile(t, x, y, 'd');
      delete t.locks[k];
      api.say(s, 'warn', 'tac.log.doorBroken');
    }
    // 增援：警戒到 30 時，從增援點來一個守衛；突襲的地圖每兩回合來一個。
    const spawn = (why) => {
      const free = t.spawns.find(([x, y]) => !occupied(t, x, y));
      if (!free || t.foes.filter((f) => f.kind === 'guard' && f.reinforce).length >= 4) return;
      const g = guard(t, 'r' + t.turn + t.foes.length, [free], 'alert');
      g.chase = true;
      g.reinforce = true;
      t.foes.push(g);
      api.say(s, 'warn', why);
    };
    if (s.op.alert >= 30 && !t.used.reinforce) { t.used.reinforce = true; spawn('tac.log.reinforce'); }
    if (!t.keys && t.turn % 2 === 0) spawn('tac.log.raidMore');
    detect(s, api, live(t));
    if (s.phase !== 'tac') return true;
    t.turn++;
    for (const u of live(t)) {
      u.ap = AP;
      if (u.disguise > 0) u.disguise--;
      // 容易緊張：守衛走到兩格以內，這一回合少一個行動點。
      if (!u.escort && api.flaw(s, u.id) === 'nervous' && t.foes.some((f) => f.kind === 'guard' && !f.down && manh(f.x, f.y, u.x, u.y) <= 2)) {
        u.ap = AP - 1;
        api.say(s, 'warn', 'tac.log.nervous', { name: api.name(s, u.id) });
      }
    }
    if (t.limit && t.turn > t.limit) { api.timeUp(s); return true; }
    return check(s, api);
  }

  function nearestUnit(t, f) {
    const us = live(t).sort((a, b) => manh(a.x, a.y, f.x, f.y) - manh(b.x, b.y, f.x, f.y));
    return us.length ? [us[0].x, us[0].y] : null;
  }

  // 追捕中的守衛走到某人身邊：那個人被捕。跑得快的人可以甩開一次；躲在藏身處的人不會被發現。
  function catchUp(s, api, f) {
    const t = s.op.tac;
    if (f.state !== 'alert') return false;
    for (const u of live(t)) {
      if (manh(f.x, f.y, u.x, u.y) !== 1 || tile(t, u.x, u.y) === 'H' || (u.disguise > 0 && !f.chase)) continue;
      const v = { name: api.name(s, u.id) };
      if (!u.escort && api.traits(s, u.id).includes('fast') && !t.used['fast:' + u.id]) {
        t.used['fast:' + u.id] = true;
        f.state = 'distracted';
        f.timer = 1;
        api.say(s, 'card', 'tac.log.slip', v);
        continue;
      }
      u.taken = true;
      api.say(s, 'bad', 'tac.log.caught', v);
      if (!u.escort) api.arrest(s, u.id);
      if (s.phase !== 'tac') return true;
      if (check(s, api) && s.phase !== 'tac') return true;
    }
    return false;
  }

  // 任務結束了沒有：每個人都離開或被捕。有人帶著完成的目標離開就算成功；被救的人又被抓回去就算失敗。
  function check(s, api) {
    if (s.phase !== 'tac') return true;
    const t = s.op.tac;
    if (live(t).length) return true;
    const escortLost = t.units.some((u) => u.escort && u.taken);
    const anyOut = t.units.some((u) => u.out && !u.escort);
    api.finish(s, anyOut && !objsLeft(t) && !escortLost ? 'win' : 'fail');
    return true;
  }

  E.tactics = {
    AP, build, vision, caps, abilities, reach, risky, move, use, endTurn, tile, objsLeft, live,
    // 地圖檢查用：不管敵人，看每個目標和撤離點是不是都走得到（上鎖的門、圍欄當作可以通過）。
    reachable(t) {
      const ok = (x, y) => tile(t, x, y) !== '#' && !OBJ.includes(tile(t, x, y));
      const start = t.units[0];
      const seen = { [key(start.x, start.y)]: true };
      const q = [[start.x, start.y]];
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (seen[key(nx, ny)] || !ok(nx, ny)) continue;
          seen[key(nx, ny)] = true;
          q.push([nx, ny]);
        }
      }
      const objsOk = t.objs.every((o) => DIRS.some(([dx, dy]) => seen[key(o.x + dx, o.y + dy)]));
      let exit = false;
      for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (tile(t, x, y) === 'X' && seen[key(x, y)]) exit = true;
      return objsOk && exit;
    },
  };
})(window.ECHO = window.ECHO || {});
