// 第三季的戰鬥模擬：一個房間裡發生的所有事。不碰畫面、不碰聲音，也不用 Math.random，
// 所以同一個房間、同一串輸入，結果永遠一樣（自動測試和機器人都靠這一點）。
// 每一步是 1/60 秒：玩家 → 敵人（js/s3/foes.js）→ 子彈 → 設施 → 範圍效果 → 掉落物 → 增援和過關。
// 畫面和音效要知道發生了什麼事，就讀 s.ev（每一步的事件），讀完自己清掉。
// 座標是像素：一格 50，整個場地 1600×900。
(function (E) {
  const S3 = (E.s3 = E.s3 || {});
  const GW = 32, GH = 18, T = 50, W = GW * T, H = GH * T, DT = 1 / 60, TAU = Math.PI * 2;
  const DX = [1, 0, -1, 0, 1, 1, -1, -1], DY = [0, 1, 0, -1, 1, -1, 1, -1];
  const CALL = 1.3;      // 敵人發現你之後，用無線電叫人要幾秒：這段時間內放倒就不會響警報
  const WAVE_FIRST = 3.5, WAVE_NEXT = 6;
  const SWAP_CD = 2.5;     // 換人之後要等幾秒才能再換
  const idx = (x, y) => y * GW + x;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hyp = Math.hypot;
  function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; }
  function turn(cur, want, max) { const d = angDiff(want, cur); return Math.abs(d) <= max ? want : cur + Math.sign(d) * max; }
  // 點到線段的距離
  function segDist(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    const t = l2 ? clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1) : 0;
    return hyp(px - ax - vx * t, py - ay - vy * t);
  }

  // ===== 能力值：人、漏洞、永久強化加起來 =====
  function stats(build) {
    const D = S3.data, st = Object.assign({}, D.baseStats), fl = {};
    const apply = (fx, n) => {
      if (!fx) return;
      for (const [k, v] of Object.entries(fx.mods || {})) st[k] = D.addStats.includes(k) ? st[k] + v * n : st[k] * Math.pow(v, n);
      for (const [k, v] of Object.entries(fx.flags || {})) fl[k] = (fl[k] || 0) + v * n;
    };
    const sk = build.skills || { hack: 1, physical: 1, social: 1 };
    st.bwMax += sk.hack;
    st.hackRange *= 1 + 0.08 * sk.hack;
    st.maxHp += 12 * sk.physical;
    st.meleeDmg += 6 * sk.physical;
    st.detectMul *= 1 - 0.1 * sk.social;
    st.dataMul *= 1 + 0.08 * sk.social;
    apply(D.jobFx[build.job], 1);
    for (const t of build.traits || []) apply(D.traitFx[t], 1);
    apply(D.flawFx[build.flaw], 1);
    for (const q of build.quirks || []) apply(D.quirkFx[q], 1);
    for (const x of D.exploits) if (build.exploits && build.exploits[x.id]) apply(x, build.exploits[x.id]);
    const ex = build.extra || {};
    st.maxHp += ex.maxHp || 0;
    st.bwMax += ex.bwMax || 0;
    st.focusMax *= ex.focusMul || 1;
    st.maxHp = Math.max(30, Math.round(st.maxHp));
    return { st, fl };
  }

  // ===== 格子、視線、走路 =====
  function solidAt(s, x, y) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    return tx < 0 || ty < 0 || tx >= GW || ty >= GH ? 1 : s.solid[idx(tx, ty)];
  }
  // 兩點之間有沒有被擋住。low：矮掩體也算擋（子彈用）；不給就是視線（矮掩體看得過去）。終點那一格本身不算。
  function clear(s, ax, ay, bx, by, low) {
    let tx = Math.floor(ax / T), ty = Math.floor(ay / T);
    const ex = Math.floor(bx / T), ey = Math.floor(by / T);
    const dx = bx - ax, dy = by - ay, sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx ? Math.abs(T / dx) : Infinity, tdy = dy ? Math.abs(T / dy) : Infinity;
    let mx = dx ? (dx > 0 ? (tx + 1) * T - ax : ax - tx * T) / Math.abs(dx) : Infinity;
    let my = dy ? (dy > 0 ? (ty + 1) * T - ay : ay - ty * T) / Math.abs(dy) : Infinity;
    for (let n = 0; n < 80; n++) {
      if (tx === ex && ty === ey) return true;
      if (mx < my) { mx += tdx; tx += sx; } else { my += tdy; ty += sy; }
      if (tx === ex && ty === ey) return true;
      if (tx < 0 || ty < 0 || tx >= GW || ty >= GH) return false;
      const v = s.solid[idx(tx, ty)];
      if (v === 1 || v === 2 || (low && v === 3)) return false;
    }
    return true;
  }
  // 視線有沒有穿過蒸汽。
  function steamed(s, ax, ay, bx, by) {
    for (const z of s.zones) if (z.k === 'steam' && segDist(z.x, z.y, ax, ay, bx, by) < z.r * 0.85) return true;
    return false;
  }
  // 站在蒸汽裡的敵人：看不清楚、暈頭轉向，從哪個方向都可以制伏。
  const inSteam = (s, e) => s.zones.some((z) => z.k === 'steam' && hyp(e.x - z.x, e.y - z.y) < z.r);
  // 從一點往某個方向射出去，回傳碰到牆的位置。
  function rayEnd(s, x, y, ang, max, low) {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    let d = 0;
    while (d < max) {
      d += 10;
      const v = solidAt(s, x + cx * d, y + cy * d);
      if (v === 1 || v === 2 || (low && v === 3)) break;
    }
    return { x: x + cx * d, y: y + cy * d, d };
  }
  const blockedTile = (s, tx, ty) => tx < 0 || ty < 0 || tx >= GW || ty >= GH || s.solid[idx(tx, ty)] !== 0;

  // 移動一個圓，碰到牆和設施就滑開。fly：飛行的只會被場地邊界擋住。
  function moveCircle(s, o, dx, dy, fly) {
    o.x += dx;
    o.y += dy;
    if (fly) { o.x = clamp(o.x, T + o.r, W - T - o.r); o.y = clamp(o.y, T + o.r, H - T - o.r); return; }
    for (let pass = 0; pass < 2; pass++) {
      const x0 = Math.floor((o.x - o.r) / T), x1 = Math.floor((o.x + o.r) / T), y0 = Math.floor((o.y - o.r) / T), y1 = Math.floor((o.y + o.r) / T);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (!blockedTile(s, tx, ty)) continue;
        const rx = tx * T, ry = ty * T;
        const nx = o.x - clamp(o.x, rx, rx + T), ny = o.y - clamp(o.y, ry, ry + T);
        const d = hyp(nx, ny);
        if (d >= o.r) continue;
        if (d > 0.0001) { const push = (o.r - d) / d; o.x += nx * push; o.y += ny * push; continue; }
        // 圓心在格子裡（例如腳下的路樁升起來）：往最近、沒被擋住的那一邊推出去。
        const sides = [[o.x - rx, -1, 0], [rx + T - o.x, 1, 0], [o.y - ry, 0, -1], [ry + T - o.y, 0, 1]].sort((a, b) => a[0] - b[0]);
        for (const [pen, sx, sy] of sides) if (!blockedTile(s, tx + sx, ty + sy)) { o.x += sx * (pen + o.r); o.y += sy * (pen + o.r); break; }
      }
    }
  }

  // 走到某一格的距離場（8 方向，不能切牆角）。地形變了才重算。
  function field(s, gx, gy) {
    const key = idx(clamp(Math.floor(gx / T), 0, GW - 1), clamp(Math.floor(gy / T), 0, GH - 1));
    const hit = s.fields.get(key);
    if (hit && hit.v === s.navV) return hit.f;
    const f = new Int16Array(GW * GH).fill(-1);
    const q = [key];
    f[key] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % GW, y = (i - x) / GW, d = f[i] + 1;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = idx(nx, ny);
        if (f[j] >= 0 || s.solid[j]) continue;
        if (k >= 4 && (s.solid[idx(nx, y)] || s.solid[idx(x, ny)])) continue;
        f[j] = d;
        q.push(j);
      }
    }
    if (s.fields.size > 48) s.fields.clear();
    s.fields.set(key, { v: s.navV, f });
    return f;
  }
  // 往目標走一步：直線走得到就直走，不然照距離場繞路。回傳離目標還有多遠。
  function moveToward(s, e, gx, gy, speed, dt) {
    const d = hyp(gx - e.x, gy - e.y);
    if (d < 2) return d;
    let wx = gx, wy = gy;
    if (!e.def.fly && !clear(s, e.x, e.y, gx, gy, true)) {
      const f = field(s, gx, gy);
      const tx = clamp(Math.floor(e.x / T), 0, GW - 1), ty = clamp(Math.floor(e.y / T), 0, GH - 1);
      let best = f[idx(tx, ty)], bx = -1, by = -1;
      if (best < 0) best = 9999;
      for (let k = 0; k < 8; k++) {
        const nx = tx + DX[k], ny = ty + DY[k];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const v = f[idx(nx, ny)];
        if (v < 0 || v >= best) continue;
        if (k >= 4 && (s.solid[idx(nx, ty)] || s.solid[idx(tx, ny)])) continue;
        best = v; bx = nx; by = ny;
      }
      if (bx >= 0) { wx = (bx + 0.5) * T; wy = (by + 0.5) * T; }
    }
    const vx = wx - e.x, vy = wy - e.y, l = hyp(vx, vy) || 1, len = Math.min(speed * dt, d);
    moveCircle(s, e, (vx / l) * len, (vy / l) * len, e.def.fly);
    e.mvAng = Math.atan2(vy, vx);
    return d;
  }
  function stamp(s, pr, v) {
    for (let y = pr.ty; y < pr.ty + pr.h; y++) for (let x = pr.tx; x < pr.tx + pr.w; x++) s.solid[idx(x, y)] = v;
    s.navV++;
  }

  // ===== 建立房間 =====
  // build：一個人的配置；或 { squad: [每個隊員的配置], active }。小隊一次只有一個人在場上，其他人待命，隨時可以換。
  // carry：{ hp（一個數字，或每個隊員各一個）, data, revived }。
  // 一個隊員在房間裡的狀態。hp0 沒給就是滿血。
  function makeMember(b, hp0) {
    const made = stats(b), weapon = S3.data.weapons[b.weapon] || S3.data.weapons.pistol;
    const hp = Math.min(made.st.maxHp, hp0 === undefined ? made.st.maxHp : hp0);
    const mag = Math.round(weapon.mag * made.st.magMul);
    return {
      build: b, st: made.st, fl: made.fl, weapon, hp, maxHp: made.st.maxHp, ammo: mag, mag, down: hp <= 0,
      guard: made.fl.guard ? 1 : 0, escaped: !!b.escaped, fresh: true,
      gad: (b.gadgets || []).map((g) => ({ id: g.id, lv: g.lv || 1, cd: 0 })),
    };
  }
  // 房間裡換掉一個隊員（拘留室救出來的人補上倒下的人的位置），之後就可以換上場。場上那個人不能換。
  function setMember(s, i, b, hp) {
    if (i === s.active || !s.team[i]) return false;
    s.team[i] = makeMember(b, hp);
    return true;
  }
  function createRoom(spec, build, carry) {
    const D = S3.data, c = carry || {};
    const team = (build.squad || [build]).map((b, i) => makeMember(b, Array.isArray(c.hp) ? c.hp[i] : c.hp));
    let active = build.squad ? build.active || 0 : 0;
    if (team[active].down) active = Math.max(0, team.findIndex((m) => !m.down));
    const me = team[active], st = me.st, fl = me.fl, w = me.weapon;
    me.fresh = false;
    build = me.build;
    const s = {
      team, active, swapCd: 0, freeUsed: false,
      spec, build, st, fl, weapon: w, rng: E.rng.create(spec.seed),
      t: 0, rt: 0, tick: 0, navV: 1, fields: new Map(),
      solid: new Uint8Array(GW * GH), en: [], bul: [], props: [], zones: [], picks: [], decoys: [], pets: [], mines: [], ev: [],
      alert: !!spec.boss, alertT: 0, waves: spec.waves.map((x) => x.slice()), waveT: 0, cleared: false, silent: false, cache: null, doorsOpen: false, exit: -1, over: null,
      blackout: 0, hackN: 0, nextId: 1, gain: 0, gainAcc: 0, baseData: c.data || 0, revived: !!c.revived, usedRevive: false,
      stats: { kills: 0, hacks: 0, takedowns: 0, hurt: 0, envKills: 0 },
      dmgScale: (1 + (spec.scale - 1) * 0.9) * D.enemyDmg,
    };
    for (let i = 0; i < spec.tiles.length; i++) s.solid[i] = spec.tiles[i] ? 1 : 0;
    s.p = {
      x: spec.entry.x, y: spec.entry.y, r: 14, ang: -Math.PI / 2, hp: me.hp, maxHp: me.maxHp,
      bw: st.bwMax, focus: st.focusMax, focusing: false, focusLock: false, ammo: me.ammo, mag: me.mag, reload: 0, fireCd: 0, shots: 0, meleeCd: 0, hackCd: 0,
      dashT: 0, dvx: 0, dvy: 0, dashN: st.dashCharges, dashCd: st.dashCd, dashHit: null, inv: 0.6, cloak: 0, lock: 0, hurtT: 0, kx: 0, ky: 0, vx: 0, vy: 0,
      guard: me.guard, sneezeT: 18 + s.rng.next() * 17,
      gad: me.gad,
    };
    // 喬裝：還沒被發現的房間，一開始沒有人會注意這個人。
    if (fl.disguise && !spec.boss && spec.mod !== 'sweep') s.p.cloak = 6;
    for (const pr of spec.props) {
      const def = D.props[pr.kind];
      const o = Object.assign({ id: s.nextId++, def, x: (pr.tx + pr.w / 2) * T, y: (pr.ty + pr.h / 2) * T, fuse: 0, cool: 0, used: false, gone: false, up: 0, down: 0, aware: 0, looped: false, hp: def.hp || 0 }, pr);
      if (pr.kind === 'camera' || pr.kind === 'speaker') {
        o.ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][pr.dir];
        o.x += Math.cos(o.ang) * T * 0.42;
        o.y += Math.sin(o.ang) * T * 0.42;
        o.look = o.ang;
      }
      if (def.solid) stamp(s, o, def.solid);
      s.props.push(o);
    }
    spec.enemies.forEach((e, i) => {
      const en = spawn(s, e.kind, e.x, e.y, e);
      // 離入口太近的守衛一開始背對入口，不會一進門就被看到。
      if (!spec.boss && Math.hypot(e.x - spec.entry.x, e.y - spec.entry.y) < en.def.sight + 60) en.ang = en.base = Math.atan2(e.y - spec.entry.y, e.x - spec.entry.x);
      if (spec.mod === 'shift' && i % 2 === 0 && en.def.human) en.distract = 7;
    });
    if (spec.supply) s.picks.push({ k: 'med', x: W / 2 + (s.rng.next() - 0.5) * 300, y: 9 * T, v: 20, vx: 0, vy: 0, t: 0 });
    if (spec.mod === 'sweep') s.sweepT = 0.6;
    return s;
  }

  // 放一個敵人進場。o：{ patrol, elite, ang, boss, wave }；wave 進場的會先有一圈預告。
  function spawn(s, kind, x, y, o = {}) {
    const D = S3.data;
    const def = kind === 'boss' ? Object.assign({ boss: true, human: false, sight: 2000, fov: 4, cost: 0 }, D.bosses[o.boss]) : D.enemies[kind];
    const e = {
      id: s.nextId++, kind, def, x, y, r: def.r, ang: o.ang || 0, base: o.ang || 0, mvAng: o.ang || 0,
      hp: def.hp * s.spec.scale, speed: def.speed, state: s.alert || o.wave ? 'combat' : 'calm', aware: 0, call: 0,
      stun: 0, burn: 0, burnT: 0, mark: 0, blind: 0, distract: 0, resist: 0, noShield: 0, ally: 0,
      patrol: o.patrol || null, pi: 1, wait: 0, goal: null, look: 0, home: { x, y },
      atk: null, cd: 0.6 + s.rng.next() * 0.9, strafe: s.rng.chance(0.5) ? 1 : -1, strafeT: 1 + s.rng.next() * 1.5,
      seen: false, last: null, lostT: 0, elite: o.elite || null, grenade: kind === 'heavy', spawnT: o.wave ? 1.1 : 0,
      kx: 0, ky: 0, dead: false, boss: o.boss || null, phase: 1, pat: null, pt: 0, open: 0, shieldCd: 0, summons: 0,
    };
    if (e.elite === 'armored') e.hp *= 1.8;
    if (e.elite === 'swift') e.speed *= 1.35;
    if (e.elite) e.hp *= 1.25;
    e.maxHp = e.hp;
    s.en.push(e);
    return e;
  }

  // ===== 聲音、警報 =====
  // 聲音：範圍內還沒進入戰鬥的敵人會走過來看。loud（槍聲）：聽到的人直接進入戰鬥。
  function noise(s, x, y, r, loud) {
    if (r <= 0) return;
    s.ev.push({ k: 'noise', x, y, r });
    if (s.alert) return;
    for (const e of s.en) {
      if (e.dead || e.state === 'combat' || e.def.static || e.ally > 0 || e.distract > 0) continue;
      if (hyp(e.x - x, e.y - y) > r) continue;
      if (loud) { engage(s, e); continue; }
      e.state = 'suspect';
      e.goal = { x, y };
      e.look = 0;
    }
  }
  function engage(s, e) {
    if (e.state === 'combat') return;
    e.state = 'combat';
    e.distract = 0;
    e.atk = null;
    if (!s.alert) { e.call = CALL; s.ev.push({ k: 'spotted', x: e.x, y: e.y, id: e.id }); }
  }
  function raise(s) {
    if (s.alert) return;
    s.alert = true;
    s.waveT = WAVE_FIRST;
    for (const e of s.en) if (!e.dead && e.ally <= 0) { e.state = 'combat'; e.distract = 0; e.call = 0; }
    s.ev.push({ k: 'alarm' });
  }

  // ===== 傷害 =====
  // src：{ by: 'gun'|'melee'|'hack'|'env'|'ally', crit, sneak, quiet 不會讓還沒發現你的敵人發現你 }
  function hurt(s, e, dmg, src = {}) {
    if (e.dead || e.spawnT > 0) return 0;
    const fl = s.fl;
    let d = dmg;
    if (e.mark > 0) d *= fl.press ? 1.5 : 1.3;
    if (e.stun > 0 && fl.vuln) d *= 1 + 0.35 * fl.vuln;
    if (src.by === 'gun' && e.elite === 'armored') d *= 0.7;
    if (e.boss === 'carrier') d *= 1 - 0.35 * s.props.filter((p) => p.kind === 'pylon' && p.down <= 0).length;
    if (e.boss === 'keystone' && e.open <= 0 && e.stun <= 0) d *= 0.4;
    e.hp -= d;
    s.ev.push({ k: 'hit', x: e.x, y: e.y, n: d, crit: !!src.crit, id: e.id });
    if (e.hp <= 0) { kill(s, e, src); return d; }
    if (e.ally <= 0 && e.state !== 'combat') {
      // quiet：燒傷、陷阱這類不知道從哪裡來的傷害。會起疑、原地找一找，但不知道你在哪裡，不會叫人。
      if (src.quiet) { if (e.state === 'calm') { e.state = 'suspect'; e.goal = { x: e.x, y: e.y }; e.look = 0; } return d; }
      engage(s, e);
      // 旁邊看得到的同伴會過來看。
      for (const o of s.en) if (o !== e && !o.dead && o.state === 'calm' && o.distract <= 0 && hyp(o.x - e.x, o.y - e.y) < 220 && clear(s, o.x, o.y, e.x, e.y)) { o.state = 'suspect'; o.goal = { x: e.x, y: e.y }; o.look = 0; }
    }
    return d;
  }
  // 陷阱（配電箱、油桶、車、手榴彈、地雷）打到還沒發現你的敵人：一般的敵人當場倒下，精英和重裝兵受三倍傷害。
  // 這是潛行的回報：先佈置，再動手。警報響了之後，陷阱就只是普通的傷害。
  function trapHurt(s, e, dmg, src = {}) {
    if (!s.alert && e.state !== 'combat' && e.ally <= 0 && !e.boss && e.spawnT <= 0 && !e.dead) {
      if (!e.elite && e.kind !== 'heavy') {
        const left = e.hp;
        s.ev.push({ k: 'hit', x: e.x, y: e.y, n: left, crit: true, id: e.id });
        e.hp = 0;
        kill(s, e, Object.assign({ ambush: true }, src));
        return left;
      }
      return hurt(s, e, dmg * 3, Object.assign({ quiet: true }, src));
    }
    return hurt(s, e, dmg, src);
  }
  function kill(s, e, src = {}) {
    if (e.dead) return;
    e.dead = true;
    s.stats.kills++;
    const env = src.by === 'hack' || src.by === 'env' || src.by === 'ally';
    if (env) { s.stats.envKills++; if (s.fl.refund) s.p.bw = Math.min(s.st.bwMax, s.p.bw + s.fl.refund); }
    s.ev.push({ k: 'kill', x: e.x, y: e.y, kind: e.kind, r: e.r, boss: e.boss, machine: !!e.def.machine, ambush: !!src.ambush });
    if (!src.expire) drop(s, e);
    if (e.elite === 'volatile') s.zones.push({ k: 'tele', x: e.x, y: e.y, r: 110, t: 0.6, dmg: 22 * s.dmgScale, side: 'e' });
    if (s.fl.salvage && e.def.machine && !src.expire) shock(s, e.x, e.y, 110, 8, 1, 'env');
    if (e.boss) for (const o of s.en) if (!o.dead && o !== e) kill(s, o, { by: 'env', expire: true });
    // 倒下的時候，旁邊正好看著的同伴會起疑。
    if (!s.alert) for (const o of s.en) if (!o.dead && o.state === 'calm' && o.distract <= 0 && hyp(o.x - e.x, o.y - e.y) < 260 && Math.abs(angDiff(Math.atan2(e.y - o.y, e.x - o.x), o.ang)) < o.def.fov * 1.3 && clear(s, o.x, o.y, e.x, e.y)) { o.state = 'suspect'; o.goal = { x: e.x, y: e.y }; o.look = 0; }
  }
  function drop(s, e) {
    const total = e.def.data * s.spec.dataMul * s.st.dataMul * (e.elite ? 2 : 1) + s.gainAcc;
    const whole = Math.floor(total);
    s.gainAcc = total - whole;
    const n = whole > 8 ? 4 : whole > 3 ? 2 : 1;
    for (let i = 0; i < n && whole > 0; i++) {
      const a = s.rng.next() * TAU, sp = 60 + s.rng.next() * 120;
      s.picks.push({ k: 'data', x: e.x, y: e.y, v: Math.floor(whole / n) + (i < whole % n ? 1 : 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0 });
    }
    const low = s.p.hp / s.p.maxHp < 0.4;
    if (s.rng.chance(low ? 0.09 : 0.03)) s.picks.push({ k: 'med', x: e.x, y: e.y, v: 15, vx: 0, vy: 0, t: 0 });
  }
  // 電擊（不看頭目的抗性以外的東西）。回傳實際電了幾秒。
  function stun(s, e, dur) {
    if (e.dead) return 0;
    let d = dur * s.st.stunMul * (e.resist > 0 ? 0.5 : 1);
    if (e.boss) d *= e.resist > 0 ? 0 : 0.7;
    if (d <= 0) return 0;
    e.stun = Math.max(e.stun, d);
    e.resist = e.boss ? 9 : 5;
    e.atk = null;
    if (e.call > 0) e.call = CALL;
    return d;
  }
  // 對玩家造成傷害。回傳有沒有打到。
  function hitPlayer(s, dmg, o = {}) {
    const p = s.p;
    // 清場之後房間就安全了（剩下的火、還沒炸的油桶都不會再傷到人），小隊的體力在打完那一刻就定了。
    if (s.over || s.cleared || p.inv > 0 || p.dashT > 0) return false;
    if (p.guard > 0) { p.guard = 0; p.inv = 0.5; s.ev.push({ k: 'guard', x: p.x, y: p.y }); return true; }
    const d = dmg * s.st.dmgTaken * (o.hound ? s.st.houndDmg : 1);
    p.hp -= d;
    p.inv = 0.4;
    p.hurtT = 0.3;
    s.stats.hurt += d;
    if (o.kx !== undefined) { p.kx += o.kx; p.ky += o.ky; }
    s.ev.push({ k: 'hurt', x: p.x, y: p.y, n: d });
    if (p.hp <= 0) {
      if (s.fl.revive && !s.revived) {
        s.revived = s.usedRevive = true;
        p.hp = Math.round(p.maxHp * 0.4);
        p.inv = 2;
        s.ev.push({ k: 'revive', x: p.x, y: p.y });
        shock(s, p.x, p.y, 160, 0, 1.5, 'env');
      } else if (s.fl.getaway && !s.team[s.active].escaped) {
        // 接應撤離：這個人每趟可以從必倒的一下裡脫身一次。
        s.team[s.active].escaped = true;
        p.hp = 1;
        p.inv = 2;
        s.ev.push({ k: 'getaway', x: p.x, y: p.y });
      } else {
        // 倒下的人被抓走；還有人就換下一個上，全倒了這一趟才結束。
        const me = s.team[s.active];
        p.hp = 0;
        me.hp = 0;
        me.down = true;
        const next = s.team.findIndex((m) => !m.down);
        if (next < 0) { s.over = 'dead'; s.ev.push({ k: 'dead', x: p.x, y: p.y }); }
        else {
          s.ev.push({ k: 'down', x: p.x, y: p.y, i: s.active });
          swapTo(s, next, true);
          shock(s, p.x, p.y, 150, 0, 1.2, 'env');
        }
      }
    }
    return true;
  }
  // 換人上場：位置不變，體力、武器和裝備換成另一個隊員的；頻寬和專注全隊共用。forced：前一個人倒下，不看冷卻。
  function swapTo(s, i, forced) {
    const p = s.p, from = s.team[s.active], to = s.team[i];
    if (!to || to.down || i === s.active) return false;
    if (!forced && (s.swapCd > 0 || p.lock > 0 || p.dashT > 0 || s.over)) return false;
    from.hp = Math.max(0, p.hp);
    from.ammo = p.ammo;
    from.guard = p.guard;
    s.active = i;
    s.build = to.build; s.st = to.st; s.fl = to.fl; s.weapon = to.weapon;
    p.hp = to.hp; p.maxHp = to.maxHp; p.ammo = to.ammo; p.mag = to.mag; p.gad = to.gad; p.guard = to.guard;
    p.reload = 0;
    p.fireCd = 0.15;
    p.hurtT = 0;
    p.cloak = to.fresh && to.fl.disguise && !s.alert && !s.spec.boss ? 6 : 0;
    to.fresh = false;
    p.bw = Math.min(p.bw, to.st.bwMax);
    p.focus = Math.min(p.focus, to.st.focusMax);
    p.dashN = Math.min(p.dashN, to.st.dashCharges);
    p.inv = Math.max(p.inv, forced ? 1.5 : 0.35);
    s.swapCd = SWAP_CD;
    s.ev.push({ k: 'swap', x: p.x, y: p.y, i, forced: !!forced });
    return true;
  }
  // 房間結束時每個隊員的狀態（交還給 js/s3/run.js）。
  function teamState(s) {
    const me = s.team[s.active];
    if (!me.down) { me.hp = Math.max(0, s.p.hp); me.ammo = s.p.ammo; }
    return s.team.map((m) => ({ hp: m.down ? 0 : Math.max(1, Math.round(m.hp)), down: m.down, escaped: m.escaped }));
  }

  // ===== 範圍效果 =====
  // 爆炸。side：'p' 傷敵人（self 是連自己也會受的傷）、'e' 只傷玩家。會引爆範圍內的油桶。trap：算陷阱（見 trapHurt）。
  function blast(s, x, y, r, dmg, o = {}) {
    s.ev.push({ k: o.shock ? 'shock' : 'boom', x, y, r });
    if (o.side === 'e') {
      if (hyp(s.p.x - x, s.p.y - y) < r + s.p.r) hitPlayer(s, dmg);
    } else {
      for (const e of s.en) {
        if (e.dead || e.ally > 0) continue;
        const d = hyp(e.x - x, e.y - y) - e.r;
        if (d > r) continue;
        if (o.stun) stun(s, e, o.stun);
        if (o.burn) e.burn = Math.max(e.burn, o.burn);
        if (o.knock) { const a = Math.atan2(e.y - y, e.x - x); e.kx += Math.cos(a) * o.knock; e.ky += Math.sin(a) * o.knock; }
        if (o.noShield) e.noShield = Math.max(e.noShield, o.noShield);
        if (dmg) (o.trap ? trapHurt : hurt)(s, e, dmg * (1 - 0.4 * clamp(d / r, 0, 1)), { by: o.by || 'env' });
      }
      if (o.self && !s.fl.hardhat && hyp(s.p.x - x, s.p.y - y) < r * 0.8 + s.p.r) hitPlayer(s, o.self);
    }
    for (const pr of s.props) if (pr.kind === 'barrel' && !pr.gone && pr.fuse <= 0 && hyp(pr.x - x, pr.y - y) < r) pr.fuse = 0.12 + s.rng.next() * 0.1;
  }
  // 電擊爆發：電到的敵人會暈；有「連鎖」的話電弧再跳到附近的敵人。
  function shock(s, x, y, r, dmg, stunDur, by, trap) {
    const rr = r * s.st.aoeMul * (s.spec.mod === 'rain' ? 1.4 : 1);
    const before = s.en.filter((e) => !e.dead && e.ally <= 0 && hyp(e.x - x, e.y - y) - e.r <= rr);
    blast(s, x, y, rr, dmg * s.st.aoeDmg, { stun: stunDur, by: by || 'hack', shock: true, noShield: 3, trap });
    if (!s.fl.chain) return;
    let jumps = 2 * s.fl.chain, from = { x, y };
    const done = new Set(before);
    while (jumps-- > 0) {
      let best = null, bd = 240;
      for (const e of s.en) {
        if (e.dead || e.ally > 0 || done.has(e) || e.spawnT > 0) continue;
        const d = Math.min(hyp(e.x - from.x, e.y - from.y), ...before.map((b) => hyp(e.x - b.x, e.y - b.y)));
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      done.add(best);
      s.ev.push({ k: 'arc', x: from.x, y: from.y, x2: best.x, y2: best.y });
      stun(s, best, stunDur * 0.6);
      (trap ? trapHurt : hurt)(s, best, 15 * s.st.aoeDmg, { by: by || 'hack' });
      from = best;
    }
  }

  // 車會往哪一頭衝、能衝多遠：沿著車身的兩個方向，哪一邊車道上的敵人多就往哪邊；一樣多就往不會撞到玩家的那一邊。
  // 回傳 { dir 方向（DX、DY 的索引）, reach 車頭前面有多長的空路 }。畫面用它畫出車道。
  function carPath(s, pr) {
    const look = (dir) => {
      const dx = DX[dir], dy = DY[dir];
      let reach = 0;
      for (let d = T + 2; d < 1700; d += 10) { if (solidAt(s, pr.x + dx * d, pr.y + dy * d)) break; reach = d - T; }
      const inLane = (o, pad) => { const along = (o.x - pr.x) * dx + (o.y - pr.y) * dy, off = Math.abs((o.x - pr.x) * dy - (o.y - pr.y) * dx); return along > 0 && along < reach + 2 * T + pad && off < T / 2 + 8 + o.r; };
      return { dir, reach, n: s.en.filter((e) => !e.dead && e.ally <= 0 && !e.def.fly && e.spawnT <= 0 && inLane(e, 40)).length, me: inLane(s.p, 0) };
    };
    const a = look(pr.dir), b = look((pr.dir + 2) % 4);
    if (a.n !== b.n) return a.n > b.n ? a : b;
    if (a.me !== b.me) return a.me ? b : a;
    return a;
  }

  // ===== 駭入 =====
  function jammed(s, x, y) {
    for (const e of s.en) if (!e.dead && e.def.jam && e.ally <= 0 && e.stun <= 0 && e.spawnT <= 0 && hyp(e.x - x, e.y - y) < e.def.jam) return true;
    return false;
  }
  function propHack(s, pr) {
    const def = pr.def;
    if (!def.hack || pr.gone) return null;
    const k = pr.kind;
    if ((k === 'junction' || k === 'barrel' || k === 'car') && (pr.used || pr.fuse > 0 || pr.moving)) { if (!(pr.used && pr.cool > 0)) return null; }
    if (k === 'pylon' && !s.spec.boss) return null;
    const busy = pr.cool > 0 || pr.up > 0 || pr.down > 0 || (pr.used && k !== 'junction');
    return { act: def.hack, cost: def.cost, why: busy ? 'cool' : null };
  }
  function enemyHack(s, e) {
    const H = S3.data.hacks;
    if (e.dead || e.ally > 0 || e.spawnT > 0) return null;
    let act;
    if (e.boss) { if (e.boss !== 'bulldog') return null; act = 'bossShield'; }
    else if (e.kind === 'jammer') return { act: 'stun', cost: 1, why: 'jam' };
    else if (e.kind === 'turret') act = 'hijackTurret';
    else if (e.kind === 'drone') act = 'hijack';
    else if (e.kind === 'hound') act = 'reboot';
    else if (e.kind === 'sniper' && e.state === 'combat') act = 'blind';
    else if (e.kind === 'heavy' && e.grenade) act = 'detonate';
    else if (e.kind === 'shield' && e.noShield <= 0 && e.state === 'combat') act = 'dropShield';
    else act = e.state === 'combat' ? 'stun' : 'distract';
    let cost = H[act].cost;
    if (act === 'hijack' && s.fl.birds) cost = Math.max(1, cost - 1);
    let why = null;
    if (e.elite === 'firewall' && !s.fl.jailbreak) why = 'firewall';
    else if (act === 'bossShield' && e.shieldCd > 0) why = 'cool';
    else if (act === 'distract' && e.distract > 0) why = 'cool';
    return { act, cost, why };
  }
  // 游標附近最近的可駭目標。回傳 { x, y, act, cost, ok, why, prop|enemy }；沒有就是 null。
  function pickHack(s, ax, ay) {
    let best = null, bd = 64;
    for (const pr of s.props) {
      const slack = pr.kind === 'car' || pr.kind === 'bollard' ? 40 : 0;
      const d = hyp(pr.x - ax, pr.y - ay) - slack;
      if (d >= bd) continue;
      const info = propHack(s, pr);
      if (info) { bd = d; best = Object.assign(info, { x: pr.x, y: pr.y, prop: pr }); }
    }
    for (const e of s.en) {
      const d = hyp(e.x - ax, e.y - ay) - e.r;
      if (d >= bd) continue;
      const info = enemyHack(s, e);
      if (info) { bd = d; best = Object.assign(info, { x: e.x, y: e.y, enemy: e }); }
    }
    if (!best) return null;
    const p = s.p;
    const fl = s.fl;
    if (fl.legacy) best.cost = Math.max(1, best.cost - 1);
    if (fl.netAccess && ((best.prop && (best.prop.kind === 'camera' || best.prop.kind === 'speaker')) || (best.enemy && best.enemy.kind === 'turret'))) best.cost = Math.max(0, best.cost - 1);
    if (fl.driver && best.act === 'drive') best.cost = 1;
    if (fl.busker && best.act === 'distract') best.cost = 0;
    if (fl.freeFirst && !s.freeUsed) best.cost = 0;
    if (fl.backdoor && s.hackN % 4 === 3) best.cost = 0;
    if (!best.why) {
      if (hyp(best.x - p.x, best.y - p.y) > s.st.hackRange) best.why = 'range';
      else if (!s.fl.jailbreak && jammed(s, best.x, best.y)) best.why = 'jam';
      else if (p.bw < best.cost) best.why = 'bw';
    }
    best.ok = !best.why;
    return best;
  }
  function doHack(s, h) {
    const D = S3.data, p = s.p, e = h.enemy, pr = h.prop;
    p.bw -= h.cost;
    p.hackCd = 0.2;
    s.hackN++;
    s.freeUsed = true;
    s.stats.hacks++;
    s.ev.push({ k: 'hack', x: p.x, y: p.y, x2: h.x, y2: h.y, act: h.act });
    if (pr) {
      const def = pr.def;
      if (h.act === 'overload') { pr.fuse = def.fuse; pr.used = false; }
      else if (h.act === 'ignite') pr.fuse = 0.35;
      else if (h.act === 'steam') {
        s.zones.push({ k: 'steam', x: pr.x, y: pr.y, r: def.r * s.st.aoeMul, t: def.dur, burn: def.burn * s.st.burnMul, tick: 0 });
        pr.cool = 12;
        s.ev.push({ k: 'steam', x: pr.x, y: pr.y });
      } else if (h.act === 'drive') {
        stamp(s, pr, 0);
        // 車頭轉向要衝的那一頭（畫面跟著轉）。
        pr.go = pr.dir = carPath(s, pr).dir;
        pr.moving = true;
        pr.boost = s.fl.driver ? 1.5 : 1;
        pr.hit = new Set();
        s.ev.push({ k: 'rev', x: pr.x, y: pr.y });
      } else if (h.act === 'raise') {
        pr.up = def.dur;
        stamp(s, pr, 3);
        for (const o of s.en) if (!o.dead && !o.def.fly && Math.abs(o.x - pr.x) < pr.w * T / 2 + o.r && Math.abs(o.y - pr.y) < pr.h * T / 2 + o.r) {
          if (o.ally <= 0) { stun(s, o, def.stun); trapHurt(s, o, def.dmg * s.spec.scale, { by: 'hack' }); }
          moveCircle(s, o, 0, 0);
        }
        moveCircle(s, p, 0, 0);
        s.ev.push({ k: 'raise', x: pr.x, y: pr.y });
      } else if (h.act === 'loop') {
        pr.looped = true;
        pr.cool = 6;
        for (const o of s.en) if (!o.dead && o.ally <= 0 && hyp(o.x - pr.x, o.y - pr.y) < 460 && clear(s, pr.x, pr.y, o.x, o.y)) o.mark = def.mark;
        s.ev.push({ k: 'mark', x: pr.x, y: pr.y, r: 460 });
      } else if (h.act === 'shriek') {
        pr.cool = def.cd;
        s.decoys.push({ x: pr.x, y: pr.y, t: def.dur, r: def.r });
        noise(s, pr.x, pr.y, def.r);
        s.ev.push({ k: 'shriek', x: pr.x, y: pr.y, r: def.r });
      } else if (h.act === 'breach') {
        pr.down = def.down;
        s.ev.push({ k: 'breach', x: pr.x, y: pr.y });
        for (const o of s.en) if (o.boss === 'keystone' && !o.dead) { o.open = 6; pr.down = 14; }
      }
      return;
    }
    const H = D.hacks[h.act];
    if (s.fl.ransom) addData(s, 3 * s.fl.ransom);
    if (s.fl.profiler) e.mark = Math.max(e.mark, 8);
    if (h.act === 'distract') e.distract = H.dur * (s.fl.busker ? 2 : 1);
    else if (h.act === 'stun') {
      stun(s, e, H.dur);
      s.ev.push({ k: 'zap', x: e.x, y: e.y });
      if (s.fl.worm) {
        const near = s.en.filter((o) => o !== e && !o.dead && o.ally <= 0 && o.def.human && hyp(o.x - e.x, o.y - e.y) < 260).sort((a, b) => hyp(a.x - e.x, a.y - e.y) - hyp(b.x - e.x, b.y - e.y)).slice(0, 2);
        for (const o of near) { stun(s, o, H.dur * 0.6); s.ev.push({ k: 'arc', x: e.x, y: e.y, x2: o.x, y2: o.y }); if (o.state !== 'combat') engage(s, o); }
      }
      if (e.state !== 'combat') engage(s, e);
    } else if (h.act === 'dropShield') { e.noShield = H.dur; stun(s, e, H.stun); s.ev.push({ k: 'zap', x: e.x, y: e.y }); }
    else if (h.act === 'detonate') { e.grenade = false; blast(s, e.x, e.y, H.r * s.st.aoeMul, H.dmg * s.spec.scale * s.st.aoeDmg, { by: 'hack', self: 15, trap: true }); noise(s, e.x, e.y, 600); }
    else if (h.act === 'reboot') { stun(s, e, H.dur * (s.fl.dogfriend ? 2 : 1)); s.ev.push({ k: 'zap', x: e.x, y: e.y }); if (e.state !== 'combat') engage(s, e); }
    else if (h.act === 'blind') { e.blind = H.dur; e.atk = null; s.ev.push({ k: 'zap', x: e.x, y: e.y }); }
    else if (h.act === 'hijack' || h.act === 'hijackTurret') {
      e.ally = H.dur * s.st.hijackMul;
      e.state = 'combat';
      e.atk = null;
      e.stun = 0;
      e.call = 0;
      e.cd = 0.3;
      s.ev.push({ k: 'hijack', x: e.x, y: e.y });
    } else if (h.act === 'bossShield') { e.noShield = H.dur; e.shieldCd = H.cd; stun(s, e, 0.8); s.ev.push({ k: 'zap', x: e.x, y: e.y }); }
  }
  function addData(s, n) {
    const total = n + s.gainAcc;
    s.gain += Math.floor(total);
    s.gainAcc = total - Math.floor(total);
  }

  // ===== 玩家 =====
  // 可以制伏誰：被電暈的、被引開的、背對你而且還沒發現你的；有「處決」的話，血量四分之一以下的也可以。
  // 可以制伏的敵人：身邊（62 以內）背對你、被引開、被電暈、在蒸汽裡的；被電暈或在蒸汽裡的，隔 LUNGE 以內也能撲過去
  // （中間不能有牆或掩體）。打得到的裡面挑最近的。
  const REACH = 62, LUNGE = 150;
  function takedownTarget(s) {
    const p = s.p;
    let best = null, bd = Infinity;
    for (const e of s.en) {
      if (e.dead || e.ally > 0 || e.spawnT > 0) continue;
      const d = hyp(e.x - p.x, e.y - p.y) - e.r;
      if (d >= LUNGE || d >= bd) continue;
      const dazed = e.stun > 0 || (!e.boss && inSteam(s, e));
      if (d >= REACH && !(dazed && clear(s, p.x, p.y, e.x, e.y, true))) continue;
      const behind = e.state !== 'combat' && Math.abs(angDiff(Math.atan2(p.y - e.y, p.x - e.x), e.ang)) > 1.7;
      const ok = dazed || (e.state !== 'combat' && e.distract > 0) || behind || (s.fl.exec && !e.boss && e.hp < e.maxHp * 0.25);
      if (ok) { bd = d; best = e; }
    }
    return best;
  }
  function gunDamage(s, crit) {
    const p = s.p, st = s.st, fl = s.fl;
    let d = s.weapon.dmg * st.dmgMul;
    if (crit) d *= st.critMul;
    if (p.focusing && fl.focusDmg) d *= 1.4;
    if (fl.hoard) d *= 1 + Math.min(0.5, (s.baseData + s.gain) / 1000);
    if (fl.nightowl && s.spec.sector >= 1) d *= 1.1;
    return d;
  }
  function stepPlayer(s, inp, dt) {
    const p = s.p, st = s.st, fl = s.fl, w = s.weapon;
    p.fireCd -= dt; p.meleeCd -= dt; p.hackCd -= dt; p.inv -= dt; p.lock -= dt; p.hurtT -= dt;
    if (p.cloak > 0) p.cloak -= dt;
    for (const m of s.team) for (const g of m.gad) g.cd = Math.max(0, g.cd - dt); // 待命的人，裝備也在冷卻
    p.bw = Math.min(st.bwMax, p.bw + st.bwRegen * (s.spec.mod === 'jam' ? 0.6 : 1) * dt);
    if (p.dashN < st.dashCharges) { p.dashCd -= dt; if (p.dashCd <= 0) { p.dashN++; p.dashCd = st.dashCd; } }
    if (p.lock <= 0) p.ang = Math.atan2(inp.ay - p.y, inp.ax - p.x);

    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.ammo = p.mag; s.ev.push({ k: 'reloaded' }); } }
    else if ((inp.reload && p.ammo < p.mag) || (p.ammo <= 0 && !inp.fire)) { p.reload = w.reload * st.reloadMul; s.ev.push({ k: 'reload' }); }

    // 移動、衝刺
    let mx = inp.mx || 0, my = inp.my || 0;
    const ml = hyp(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const kd = Math.pow(0.002, dt), px0 = p.x, py0 = p.y;
    p.kx *= kd; p.ky *= kd;
    if (p.dashT > 0) {
      p.dashT -= dt;
      moveCircle(s, p, p.dvx * dt, p.dvy * dt);
      if (fl.shockdash) for (const e of s.en) if (!e.dead && e.ally <= 0 && !p.dashHit.has(e) && hyp(e.x - p.x, e.y - p.y) < e.r + p.r + 16) { p.dashHit.add(e); stun(s, e, 0.7); s.ev.push({ k: 'zap', x: e.x, y: e.y }); if (e.state !== 'combat') engage(s, e); }
    } else if (p.lock <= 0) moveCircle(s, p, (mx * st.speed + p.kx) * dt, (my * st.speed + p.ky) * dt);
    // 這一步實際的速度：敵人瞄準時會抓一點提前量。
    p.vx = (p.x - px0) / dt;
    p.vy = (p.y - py0) / dt;
    if (inp.dash && p.dashN > 0 && p.dashT <= 0 && p.lock <= 0) {
      let dx = mx, dy = my;
      if (ml < 0.1) { dx = Math.cos(p.ang); dy = Math.sin(p.ang); } else { dx /= Math.min(1, ml) || 1; dy /= Math.min(1, ml) || 1; }
      p.dashT = 0.16;
      p.dvx = dx * 950 * st.dashLen;
      p.dvy = dy * 950 * st.dashLen;
      p.inv = Math.max(p.inv, 0.24);
      p.dashN--;
      p.dashHit = new Set();
      if (fl.decoy) s.decoys.push({ x: p.x, y: p.y, t: 2.5, r: 380, ghost: true });
      s.ev.push({ k: 'dash', x: p.x, y: p.y, ang: Math.atan2(dy, dx) });
    }

    // 開槍
    if (inp.fire && p.fireCd <= 0 && p.reload <= 0 && p.lock <= 0) {
      if (p.ammo <= 0) { p.reload = w.reload * st.reloadMul; s.ev.push({ k: 'reload' }); }
      else {
        p.ammo--;
        p.shots++;
        p.fireCd = 1 / (w.rate * st.fireMul);
        const cloaked = p.cloak > 0;
        if (cloaked) p.cloak = 0;
        const shockShot = (w.stunEvery && p.shots % w.stunEvery === 0) ? w.stun : (fl.shockRounds && p.shots % 5 === 0 ? 0.7 : 0);
        for (let i = 0; i < w.pellets; i++) {
          const a = p.ang + (s.rng.next() - 0.5) * 2 * w.spread * st.spreadMul;
          const crit = s.rng.chance(st.critChance);
          s.bul.push({
            x: p.x + Math.cos(p.ang) * 18, y: p.y + Math.sin(p.ang) * 18, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, r: 4, side: 'p',
            dmg: gunDamage(s, crit) * (cloaked ? S3.data.gadgets.mask.mult : 1), crit, life: w.range / w.speed, pierce: (w.pierce || 0) + st.pierce, bounce: st.bounce,
            stun: shockShot, burn: fl.incend && s.rng.chance(0.15 * fl.incend) ? 3 : 0, knock: w.knock || 0, sneak: w.sneak * (fl.silent ? 1.5 : 1), hit: null,
          });
        }
        s.ev.push({ k: 'shot', x: p.x, y: p.y, ang: p.ang, w: s.build.weapon });
        if (!fl.silent && w.noise) noise(s, p.x, p.y, w.noise * st.noiseMul, true);
      }
    }

    // 駭入
    if (inp.hack && p.hackCd <= 0) {
      const h = pickHack(s, inp.ax, inp.ay);
      if (h && h.ok) doHack(s, h);
      else if (h) s.ev.push({ k: 'denied', x: h.x, y: h.y, why: h.why });
    }

    // 近戰和制伏
    if (inp.melee && p.meleeCd <= 0 && p.lock <= 0) {
      const t = takedownTarget(s);
      if (t) {
        // 撲過去：目標不在身邊，就先衝到它旁邊。
        const gap = t.r + p.r + 4, dist = hyp(t.x - p.x, t.y - p.y);
        if (dist > gap + 2) {
          const a = Math.atan2(t.y - p.y, t.x - p.x);
          moveCircle(s, p, Math.cos(a) * (dist - gap), Math.sin(a) * (dist - gap));
          s.ev.push({ k: 'dash', x: p.x, y: p.y, ang: a });
        }
        p.meleeCd = 0.5;
        p.lock = 0.22;
        p.inv = Math.max(p.inv, 0.35);
        p.cloak = 0;
        p.ang = Math.atan2(t.y - p.y, t.x - p.x);
        s.stats.takedowns++;
        s.ev.push({ k: 'takedown', x: t.x, y: t.y });
        if (t.boss || t.def.big || t.elite) hurt(s, t, 70 + st.meleeDmg, { by: 'melee' });
        else kill(s, t, { by: 'melee' });
        p.bw = Math.min(st.bwMax, p.bw + 1);
        p.focus = Math.min(st.focusMax, p.focus + 12);
        if (fl.lifesteal) p.hp = Math.min(p.maxHp, p.hp + 5 * fl.lifesteal);
        if (fl.loud) noise(s, p.x, p.y, 160);
      } else {
        p.meleeCd = 0.55;
        p.lock = 0.12;
        s.ev.push({ k: 'melee', x: p.x, y: p.y, ang: p.ang });
        for (const e of s.en) {
          if (e.dead || e.ally > 0 || e.spawnT > 0) continue;
          const d = hyp(e.x - p.x, e.y - p.y) - e.r;
          if (d > 60 || Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.ang)) > 1.1) continue;
          const blocked = shielded(e, p.x, p.y);
          if (blocked) { s.ev.push({ k: 'clang', x: e.x, y: e.y }); continue; }
          e.kx += Math.cos(p.ang) * 170; e.ky += Math.sin(p.ang) * 170;
          if (!e.boss) e.stun = Math.max(e.stun, 0.25);
          hurt(s, e, st.meleeDmg, { by: 'melee' });
        }
        // 近戰也能打爆油桶
        for (const pr of s.props) if (pr.kind === 'barrel' && !pr.gone && pr.fuse <= 0 && hyp(pr.x - p.x, pr.y - p.y) < 70) pr.fuse = 0.5;
      }
    }

    if (inp.g1) useGadget(s, 0, inp.ax, inp.ay);
    if (inp.g2) useGadget(s, 1, inp.ax, inp.ay);

    // 過敏：還沒被發現的時候偶爾打噴嚏。
    if (fl.sneeze && !s.alert && !s.cleared) {
      p.sneezeT -= dt;
      if (p.sneezeT <= 0) { p.sneezeT = 18 + s.rng.next() * 17; s.ev.push({ k: 'sneeze', x: p.x, y: p.y }); noise(s, p.x, p.y, 220); }
    }
  }
  // 盾牌擋不擋得住從 (x, y) 來的攻擊。
  function shielded(e, x, y) {
    if (e.stun > 0 || e.noShield > 0 || e.ally > 0) return false;
    if (e.kind !== 'shield' && e.boss !== 'bulldog') return false;
    if (e.boss && e.pat === 'charge') return false;
    return Math.abs(angDiff(Math.atan2(y - e.y, x - e.x), e.ang)) < 1.05;
  }

  // ===== 裝備 =====
  function useGadget(s, slot, ax, ay) {
    const p = s.p, g = p.gad[slot];
    if (!g || g.cd > 0 || p.lock > 0) { if (g) s.ev.push({ k: 'denied', x: p.x, y: p.y, why: 'cool' }); return; }
    const def = S3.data.gadgets[g.id], lv = g.lv - 1;
    g.cd = def.cd * (1 - 0.2 * lv);
    // 游標太遠就拉回射程內。
    const reach = (range) => {
      const d = hyp(ax - p.x, ay - p.y);
      const k = d > range ? range / d : 1;
      return { x: clamp(p.x + (ax - p.x) * k, T + 20, W - T - 20), y: clamp(p.y + (ay - p.y) * k, T + 20, H - T - 20) };
    };
    s.ev.push({ k: 'gadget', id: g.id, x: p.x, y: p.y });
    if (g.id === 'eagle') {
      const at = reach(def.range);
      s.zones.push({ k: 'eagle', x: at.x, y: at.y, fx: p.x, fy: p.y, r: def.r * (1 + 0.12 * lv), t: 0.5, t0: 0.5, stun: def.stun + 0.5 * lv, dmg: def.dmg + 8 * lv });
    } else if (g.id === 'blackout') {
      s.blackout = def.dur + lv;
      for (const e of s.en) { if (e.ally > 0) continue; e.atk = null; e.aware = 0; e.seen = false; if (e.call > 0) e.call = CALL; if (e.state === 'suspect') { e.state = 'calm'; e.goal = null; } }
    } else if (g.id === 'sergei') {
      const at = reach(def.range);
      s.zones.push({ k: 'tele', x: at.x, y: at.y, r: def.r * s.st.aoeMul, t: def.fuse, dmg: (def.dmg + 20 * lv) * s.st.aoeDmg, side: 'p', crate: def.crate + 4 * lv, cargo: true });
    } else if (g.id === 'hammer') {
      p.lock = 0.2;
      p.cloak = 0;
      s.ev.push({ k: 'smash', x: p.x, y: p.y, ang: p.ang, r: def.r });
      for (const e of s.en) {
        if (e.dead || e.ally > 0 || e.spawnT > 0) continue;
        const d = hyp(e.x - p.x, e.y - p.y) - e.r;
        if (d > def.r || Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.ang)) > def.arc) continue;
        e.noShield = Math.max(e.noShield, 6);
        e.kx += Math.cos(p.ang) * def.knock; e.ky += Math.sin(p.ang) * def.knock;
        stun(s, e, def.stun);
        hurt(s, e, (def.dmg + 15 * lv) * (e.def.machine ? 1.5 : 1), { by: 'melee' });
      }
      for (const pr of s.props) if (pr.kind === 'barrel' && !pr.gone && pr.fuse <= 0 && hyp(pr.x - p.x, pr.y - p.y) < def.r) pr.fuse = 0.6;
      noise(s, p.x, p.y, 300 * s.st.noiseMul);
    } else if (g.id === 'mask') {
      p.cloak = def.dur + lv;
      for (const e of s.en) { e.aware = 0; if (e.call > 0) e.call = CALL; }
    } else if (g.id === 'spider') {
      s.pets.push({ x: p.x, y: p.y, t: def.dur + 3 * lv, cd: 0, ang: p.ang, dmg: def.dmg + 2 * lv, rate: def.rate, sight: def.sight });
    } else if (g.id === 'lure') {
      const at = reach(def.range);
      s.decoys.push({ x: at.x, y: at.y, t: def.dur + lv, r: def.r });
      noise(s, at.x, at.y, def.r);
      s.ev.push({ k: 'shriek', x: at.x, y: at.y, r: def.r });
    } else if (g.id === 'mine') {
      if (s.mines.length >= def.max) s.mines.shift();
      s.mines.push({ x: p.x, y: p.y, arm: 0.6, r: def.r * (1 + 0.15 * lv), stun: def.stun + 0.5 * lv, dmg: def.dmg + 10 * lv });
    }
  }

  // ===== 子彈 =====
  function stepBullets(s, dt) {
    const p = s.p;
    for (const b of s.bul) {
      const ox = b.x, oy = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const v = solidAt(s, b.x, b.y);
      if (v) {
        if (v === 3 && b.side === 'p') {
          // 打到油桶就爆
          const tx = Math.floor(b.x / T), ty = Math.floor(b.y / T);
          const pr = s.props.find((q) => q.kind === 'barrel' && !q.gone && q.tx === tx && q.ty === ty);
          if (pr && pr.fuse <= 0) { pr.hp -= b.dmg; if (pr.hp <= 0) pr.fuse = 0.05; }
        }
        if (b.bounce > 0) {
          b.bounce--;
          const hx = solidAt(s, b.x, oy), hy = solidAt(s, ox, b.y);
          if (hx || !hy) b.vx = -b.vx;
          if (hy || !hx) b.vy = -b.vy;
          b.x = ox; b.y = oy;
          b.hit = null;
        } else b.life = 0;
        s.ev.push({ k: 'spark', x: ox, y: oy });
        continue;
      }
      if (b.side === 'p') {
        for (const e of s.en) {
          if (e.dead || e.ally > 0 || e.spawnT > 0 || (b.hit && b.hit.has(e))) continue;
          if (segDist(e.x, e.y, ox, oy, b.x, b.y) > e.r + b.r) continue;
          if (shielded(e, ox - b.vx * 0.02, oy - b.vy * 0.02)) { b.life = 0; s.ev.push({ k: 'clang', x: b.x, y: b.y }); engage(s, e); break; }
          const sneak = e.state !== 'combat' && b.by !== 'ally';
          if (b.stun) { stun(s, e, b.stun); s.ev.push({ k: 'zap', x: e.x, y: e.y }); }
          if (b.burn) e.burn = Math.max(e.burn, b.burn);
          if (b.knock) { const l = hyp(b.vx, b.vy) || 1; e.kx += (b.vx / l) * b.knock; e.ky += (b.vy / l) * b.knock; }
          hurt(s, e, b.dmg * (sneak ? b.sneak || 1 : 1), { by: b.by || 'gun', crit: b.crit });
          if (b.pierce > 0) { b.pierce--; (b.hit = b.hit || new Set()).add(e); } else { b.life = 0; break; }
        }
      } else if (segDist(p.x, p.y, ox, oy, b.x, b.y) < p.r + b.r - 2) {
        if (hitPlayer(s, b.dmg, { kx: b.vx * 0.12, ky: b.vy * 0.12 })) b.life = 0;
      }
    }
    s.bul = s.bul.filter((b) => b.life > 0);
  }

  // ===== 設施 =====
  function stepProps(s, dt) {
    const p = s.p;
    for (const pr of s.props) {
      if (pr.gone) continue;
      const def = pr.def;
      if (pr.cool > 0) { pr.cool -= dt; if (pr.cool <= 0 && pr.kind === 'junction') pr.used = false; }
      if (pr.fuse > 0) {
        pr.fuse -= dt;
        if (pr.fuse <= 0) {
          if (pr.kind === 'junction') {
            pr.used = true;
            if (s.fl.recycle) pr.cool = 10;
            // 設施的傷害跟著區段變強（後面的敵人血比較厚），陷阱才不會越後面越沒用。
            shock(s, pr.x, pr.y, def.r, def.dmg * s.spec.scale, def.stun, 'hack', true);
            noise(s, pr.x, pr.y, 520);
          } else if (pr.kind === 'barrel') {
            pr.gone = true;
            stamp(s, pr, 0);
            blast(s, pr.x, pr.y, def.r * s.st.aoeMul, def.dmg * s.spec.scale * s.st.aoeDmg, { by: 'env', burn: 3, self: def.self, knock: 200, trap: true });
            s.zones.push({ k: 'fire', x: pr.x, y: pr.y, r: 70, t: def.fire * (s.spec.mod === 'rain' ? 0.5 : 1), burn: 8 * s.st.burnMul, tick: 0 });
            noise(s, pr.x, pr.y, 600);
          }
        }
      }
      if (pr.kind === 'bollard' && pr.up > 0) { pr.up -= dt; if (pr.up <= 0) { stamp(s, pr, 0); pr.cool = def.cd; } }
      if (pr.kind === 'pylon' && pr.down > 0) pr.down -= dt;
      if (pr.temp !== undefined) { pr.temp -= dt; if (pr.temp <= 0) { pr.gone = true; stamp(s, pr, 0); } }
      if (pr.kind === 'car' && pr.moving) {
        const dx = DX[pr.go], dy = DY[pr.go];
        pr.x += dx * def.speed * dt;
        pr.y += dy * def.speed * dt;
        const hw = (dx ? T : T / 2 + 8), hh = (dy ? T : T / 2 + 8);
        for (const e of s.en) {
          if (e.dead || e.def.fly || pr.hit.has(e)) continue;
          if (Math.abs(e.x - pr.x) > hw + e.r || Math.abs(e.y - pr.y) > hh + e.r) continue;
          pr.hit.add(e);
          if (e.ally > 0) continue;
          e.kx += dx * 420 + dy * 160 * (e.x < pr.x ? -1 : 1); e.ky += dy * 420 + dx * 160 * (e.y < pr.y ? -1 : 1);
          stun(s, e, 1.5);
          trapHurt(s, e, def.dmg * s.spec.scale * s.st.aoeDmg * (pr.boost || 1), { by: 'hack' });
        }
        if (!pr.hit.has(p) && Math.abs(p.x - pr.x) < hw + p.r && Math.abs(p.y - pr.y) < hh + p.r) { pr.hit.add(p); hitPlayer(s, def.self, { kx: dx * 400, ky: dy * 400 }); }
        // 車頭撞到東西就停。
        if (solidAt(s, pr.x + dx * (T + 2), pr.y + dy * (T + 2))) {
          pr.moving = false;
          pr.used = true;
          pr.tx = Math.round((pr.x - (dx ? T : T / 2)) / T);
          pr.ty = Math.round((pr.y - (dy ? T : T / 2)) / T);
          pr.x = (pr.tx + pr.w / 2) * T;
          pr.y = (pr.ty + pr.h / 2) * T;
          stamp(s, pr, def.solid);
          // 撞到東西就炸：車頭那一片的敵人被炸飛，還會留下一小片火。
          s.ev.push({ k: 'crash', x: pr.x + dx * T, y: pr.y + dy * T });
          blast(s, pr.x + dx * T, pr.y + dy * T, def.r * s.st.aoeMul, def.blast * s.spec.scale * s.st.aoeDmg * (pr.boost || 1), { by: 'hack', stun: 1.2, knock: 220, burn: 3, trap: true });
          s.zones.push({ k: 'fire', x: pr.x + dx * T * 0.8, y: pr.y + dy * T * 0.8, r: 55, t: 3 * (s.spec.mod === 'rain' ? 0.5 : 1), burn: 8 * s.st.burnMul, tick: 0 });
          noise(s, pr.x, pr.y, 600);
          for (const e of s.en) if (!e.dead && !e.def.fly) moveCircle(s, e, 0, 0);
          moveCircle(s, p, 0, 0);
        }
      }
      // 攝影機：還沒響警報的時候會掃視，看到你就直接報警。
      if (pr.kind === 'camera' && !pr.looped && !s.alert && !s.cleared) {
        pr.look = pr.ang + Math.sin(s.t * 0.8 + pr.id) * 0.75;
        const sight = def.sight * sightMul(s);
        const d = hyp(p.x - pr.x, p.y - pr.y);
        const sees = !s.fl.keys && s.blackout <= 0 && p.cloak <= 0 && d < sight && Math.abs(angDiff(Math.atan2(p.y - pr.y, p.x - pr.x), pr.look)) < def.fov && clear(s, pr.x, pr.y, p.x, p.y) && !steamed(s, pr.x, pr.y, p.x, p.y);
        pr.aware = clamp(pr.aware + (sees ? 1.25 * s.st.detectMul : -0.6) * dt, 0, 1);
        if (pr.aware >= 1) { s.ev.push({ k: 'spotted', x: pr.x, y: pr.y }); raise(s); }
      }
    }
  }
  const sightMul = (s) => (s.spec.mod === 'fog' ? 0.65 : s.spec.mod === 'dark' ? 0.6 : 1);

  // ===== 範圍效果、寵物、地雷、誘餌 =====
  function stepZones(s, dt) {
    const p = s.p;
    for (const z of s.zones) {
      z.t -= dt;
      if (z.k === 'steam' || z.k === 'fire') {
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = 0.5;
          for (const e of s.en) if (!e.dead && e.ally <= 0 && !e.def.fly && hyp(e.x - z.x, e.y - z.y) < z.r + e.r) { hurt(s, e, z.burn * 0.5, { by: 'env', quiet: true }); if (z.k === 'fire') e.burn = Math.max(e.burn, 1.5); }
          if (z.k === 'fire' && !s.fl.fireproof && hyp(p.x - z.x, p.y - z.y) < z.r) hitPlayer(s, 5);
        }
      } else if (z.t <= 0) {
        if (z.k === 'tele') {
          if (z.side === 'p') {
            blast(s, z.x, z.y, z.r, z.dmg, { by: 'env', knock: 160 });
            noise(s, z.x, z.y, 500);
            if (z.crate) dropCrate(s, z.x, z.y, z.crate);
          } else blast(s, z.x, z.y, z.r, z.dmg, { side: 'e' });
        } else if (z.k === 'eagle') {
          shock(s, z.x, z.y, z.r, z.dmg, z.stun, 'env');
          for (const e of s.en) if (!e.dead && e.ally <= 0 && hyp(e.x - z.x, e.y - z.y) < z.r + e.r) e.noShield = Math.max(e.noShield, 5);
          noise(s, z.x, z.y, 420);
        }
      }
    }
    s.zones = s.zones.filter((z) => z.t > 0);

    for (const d of s.decoys) d.t -= dt;
    s.decoys = s.decoys.filter((d) => d.t > 0);

    for (const m of s.mines) {
      m.arm -= dt;
      if (m.arm > 0) continue;
      if (s.en.some((e) => !e.dead && e.ally <= 0 && e.spawnT <= 0 && !e.def.fly && hyp(e.x - m.x, e.y - m.y) < 42 + e.r)) { m.gone = true; shock(s, m.x, m.y, m.r, m.dmg, m.stun, 'env', true); noise(s, m.x, m.y, 380); }
    }
    s.mines = s.mines.filter((m) => !m.gone);

    for (const pet of s.pets) {
      pet.t -= dt;
      pet.cd -= dt;
      let best = null, bd = pet.sight;
      for (const e of s.en) {
        if (e.dead || e.ally > 0 || e.spawnT > 0) continue;
        const d = hyp(e.x - pet.x, e.y - pet.y);
        if (d < bd && clear(s, pet.x, pet.y, e.x, e.y, true)) { bd = d; best = e; }
      }
      if (!best) continue;
      pet.ang = Math.atan2(best.y - pet.y, best.x - pet.x);
      if (pet.cd <= 0) {
        pet.cd = 1 / pet.rate;
        s.bul.push({ x: pet.x, y: pet.y, vx: Math.cos(pet.ang) * 820, vy: Math.sin(pet.ang) * 820, r: 3, side: 'p', by: 'ally', dmg: pet.dmg * s.st.hijackMul, life: 0.7, pierce: 0, bounce: 0 });
        s.ev.push({ k: 'pshot', x: pet.x, y: pet.y, ang: pet.ang });
      }
    }
    s.pets = s.pets.filter((x) => x.t > 0);
  }
  // 謝爾蓋丟下來的貨箱：留在場上當掩體一陣子。
  function dropCrate(s, x, y, secs) {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    if (blockedTile(s, tx, ty)) return;
    const o = { id: s.nextId++, kind: 'crate', def: S3.data.props.crate, tx, ty, w: 1, h: 1, x: (tx + 0.5) * T, y: (ty + 0.5) * T, fuse: 0, cool: 0, used: false, gone: false, up: 0, down: 0, temp: secs };
    stamp(s, o, 3);
    s.props.push(o);
    for (const e of s.en) if (!e.dead && !e.def.fly) moveCircle(s, e, 0, 0);
    moveCircle(s, s.p, 0, 0);
  }

  // ===== 掉落物 =====
  // 急救包補誰：先補場上的人，多出來的給隊上傷得最重的人。全隊都滿血的時候不吸也不撿，留在地上。
  const teamHurt = (s) => s.p.hp < s.p.maxHp || s.team.some((m, i) => i !== s.active && !m.down && m.hp < m.maxHp);
  function healTeam(s, n) {
    const p = s.p;
    let left = n - Math.max(0, Math.min(n, p.maxHp - p.hp));
    p.hp = Math.min(p.maxHp, p.hp + n);
    while (left > 0.5) {
      const m = s.team.filter((x, i) => i !== s.active && !x.down && x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!m) break;
      const give = Math.min(left, m.maxHp - m.hp);
      m.hp += give;
      left -= give;
    }
  }
  function stepPicks(s, dt) {
    const p = s.p, wantMed = teamHurt(s);
    for (const k of s.picks) {
      k.t += dt;
      const d = hyp(p.x - k.x, p.y - k.y);
      const idle = k.k === 'med' && !wantMed;
      if (k.k !== 'cache' && !idle && (d < 120 || s.cleared || s.fl.magnet) && k.t > 0.25) {
        const pull = s.cleared ? 900 : 520;
        k.vx = ((p.x - k.x) / (d || 1)) * pull;
        k.vy = ((p.y - k.y) / (d || 1)) * pull;
        k.x += k.vx * dt; k.y += k.vy * dt;
      } else if (k.vx || k.vy) {
        const o = { x: k.x, y: k.y, r: 6 };
        moveCircle(s, o, k.vx * dt, k.vy * dt);
        k.x = o.x; k.y = o.y;
        k.vx *= Math.pow(0.01, dt); k.vy *= Math.pow(0.01, dt);
      }
      if (d < 26 + (k.k === 'cache' ? 14 : 0)) {
        if (idle) continue;
        k.gone = true;
        if (k.k === 'data') s.gain += k.v;
        else if (k.k === 'med') healTeam(s, k.v);
        else if (k.k === 'cache') s.cache.taken = true;
        s.ev.push({ k: 'pickup', what: k.k, x: k.x, y: k.y, n: k.v });
      }
    }
    s.picks = s.picks.filter((k) => !k.gone);
  }

  // ===== 增援、過關、離開 =====
  function stepFlow(s, dt) {
    const p = s.p;
    if (s.sweepT > 0) { s.sweepT -= dt; if (s.sweepT <= 0) raise(s); }
    const hostile = s.en.filter((e) => !e.dead && e.ally <= 0);
    if (s.alert && s.waves.length) {
      s.waveT -= dt;
      if (hostile.length <= 2 && s.waveT > 1.5) s.waveT = 1.5;
      if (s.waveT <= 0) {
        const wave = s.waves.shift();
        wave.forEach((w, i) => {
          const g = s.spec.gates[(i + s.waves.length) % s.spec.gates.length];
          const a = (i / wave.length) * TAU;
          const o = { x: g.x + Math.cos(a) * 26, y: g.y + Math.sin(a) * 26, r: 14 };
          moveCircle(s, o, 0, 0);
          spawn(s, w.kind, o.x, o.y, { wave: true, elite: w.elite, ang: Math.atan2(p.y - o.y, p.x - o.x) });
        });
        s.waveT = WAVE_NEXT;
        s.ev.push({ k: 'wave' });
      }
    }
    if (!s.cleared && !hostile.length && (!s.alert || !s.waves.length)) {
      s.cleared = true;
      s.silent = !s.alert;
      s.waves = [];
      for (const e of s.en) if (!e.dead) kill(s, e, { by: 'env', expire: true });
      s.bul = s.bul.filter((b) => b.side === 'p');
      s.zones = s.zones.filter((z) => z.side !== 'e');
      // 獎勵箱放在場地中間最近的空地。
      let cx = W / 2, cy = H / 2 - T;
      for (let r = 0; r < 6 && solidAt(s, cx, cy); r++) cy += T;
      s.cache = { x: cx, y: cy, taken: false };
      s.picks.push({ k: 'cache', x: cx, y: cy, v: 0, vx: 0, vy: 0, t: 0 });
      s.ev.push({ k: 'clear', silent: s.silent });
    }
    if (s.cleared && s.doorsOpen && s.exit < 0) {
      s.spec.doors.forEach((d, i) => { if (Math.abs(p.x - d.x) < 52 && p.y < d.y + 28) s.exit = i; });
    }
  }

  // 敵人之間互相推開，免得疊在一起。
  function separate(s) {
    const list = s.en;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.def.static) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || a.def.fly !== b.def.fly) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy), min = a.r + b.r;
        if (d >= min || d < 0.01) continue;
        const push = (min - d) / 2, nx = dx / d, ny = dy / d;
        moveCircle(s, a, -nx * push, -ny * push, a.def.fly);
        if (!b.def.static) moveCircle(s, b, nx * push, ny * push, b.def.fly);
      }
    }
  }

  // ===== 一步 =====
  // inp：{ mx, my 移動（-1～1）、ax, ay 瞄準的位置、fire 開槍、focus 專注（按住）、
  //        dash, hack, melee, g1, g2, reload（這一步剛按下才是 true）}
  function step(s, inp) {
    if (s.over) return;
    const p = s.p;
    p.focusing = !!inp.focus && p.focus > 0 && !p.focusLock && !s.cleared;
    if (p.focusing) { p.focus -= 28 * DT; if (p.focus <= 0) { p.focus = 0; p.focusLock = true; } }
    else { p.focus = Math.min(s.st.focusMax, p.focus + s.st.focusRegen * DT); if (p.focus >= 15) p.focusLock = false; }
    const dt = DT * (p.focusing ? 0.35 : 1);
    s.t += dt;
    s.rt += DT;
    s.tick++;
    if (s.swapCd > 0) s.swapCd -= DT;
    if (inp.swap !== undefined && inp.swap !== null && inp.swap >= 0) swapTo(s, inp.swap, false);
    stepPlayer(s, inp, DT * (p.focusing ? 0.8 : 1));
    if (s.blackout > 0) s.blackout -= dt;
    for (const e of s.en) if (!e.dead) S3.sim.think(s, e, dt);
    separate(s);
    stepBullets(s, dt);
    stepProps(s, dt);
    stepZones(s, dt);
    stepPicks(s, DT);
    stepFlow(s, dt);
    if (s.en.some((e) => e.dead)) s.en = s.en.filter((e) => !e.dead);
  }

  S3.sim = {
    GW, GH, T, W, H, DT, CALL,
    stats, createRoom, step, pickHack, takedownTarget, swapTo, teamState, setMember, carPath, SWAP_CD, REACH, LUNGE, think() {},
    // 給 js/s3/foes.js 和機器人用的內部工具
    api: { idx, clamp, angDiff, turn, segDist, solidAt, clear, steamed, inSteam, rayEnd, moveCircle, moveToward, field, spawn, noise, engage, raise, hurt, trapHurt, kill, stun, hitPlayer, blast, shock, sightMul, shielded, jammed },
  };
})(window.ECHO = window.ECHO || {});
