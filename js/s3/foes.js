// 第三季敵人的行為：還沒發現你（巡邏、起疑）、戰鬥（每一種敵人自己的打法）、被劫持之後幫你打、三個首領。
// 每一種攻擊都有預備動作（e.atk），畫面會照著畫出預告，玩家才有時間閃。
// 這裡不直接改玩家的血：一律走 js/s3/sim.js 的 hitPlayer、hurt、stun。
(function (E) {
  const S3 = E.s3, sim = S3.sim, A = sim.api;
  const { T, W, H } = sim, TAU = Math.PI * 2, hyp = Math.hypot;
  const clamp = A.clamp;

  function bullet(s, e, ang, speed, dmg, o) {
    s.bul.push(Object.assign({
      x: e.x + Math.cos(ang) * (e.r + 4), y: e.y + Math.sin(ang) * (e.r + 4), vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      r: 5, side: 'e', dmg: dmg * s.dmgScale, life: 3.2, pierce: 0, bounce: 0,
    }, o));
    s.ev.push({ k: 'eshot', x: e.x, y: e.y, ang, kind: e.kind });
  }
  function summon(s, kinds) {
    kinds.forEach((kind, i) => {
      const g = s.spec.gates[i % s.spec.gates.length];
      const o = { x: g.x + (i % 2 ? 24 : -24), y: g.y + (i > 1 ? 24 : -24), r: 14 };
      A.moveCircle(s, o, 0, 0);
      A.spawn(s, kind, o.x, o.y, { wave: true });
    });
    s.ev.push({ k: 'wave' });
  }

  // 還沒進入戰鬥時，看不看得到玩家：要在視角和距離內，中間沒有牆和蒸汽。
  function sees(s, e) {
    const p = s.p;
    if (s.blackout > 0 || p.cloak > 0 || e.blind > 0) return false;
    const d = hyp(p.x - e.x, p.y - e.y);
    if (d > e.def.sight * A.sightMul(s)) return false;
    if (Math.abs(A.angDiff(Math.atan2(p.y - e.y, p.x - e.x), e.ang)) > e.def.fov) return false;
    return A.clear(s, e.x, e.y, p.x, p.y) && !A.steamed(s, e.x, e.y, p.x, p.y);
  }

  // ===== 還沒發現你 =====
  function calmThink(s, e, dt) {
    const p = s.p;
    if (e.distract > 0) { e.distract -= dt; e.aware = Math.max(0, e.aware - dt); return; }
    const d = hyp(p.x - e.x, p.y - e.y);
    if (sees(s, e)) {
      let rate = (1 + 1.9 * (1 - d / (e.def.sight * A.sightMul(s)))) * s.st.detectMul * (e.state === 'suspect' ? 1.7 : 1);
      if (e.kind === 'hound' && s.fl.dogfriend) rate *= 0.5;
      e.aware += rate * dt;
    } else if (d < e.r + p.r + 6 && p.cloak <= 0 && s.blackout <= 0) e.aware += 2.5 * dt; // 撞到人了
    else e.aware = Math.max(0, e.aware - 0.45 * dt);
    if (e.aware >= 1) { A.engage(s, e); return; }

    if (e.def.static) { e.ang = e.base + Math.sin(s.t * 0.7 + e.id) * 0.8; return; }
    if (e.state === 'suspect') {
      // 走到出聲的地方，左右看一看，沒事就回去。
      const left = A.moveToward(s, e, e.goal.x, e.goal.y, e.speed * 0.7, dt);
      if (left > 40) { e.ang = A.turn(e.ang, e.mvAng, 6 * dt); e.look += dt * 0.25; }
      else { e.look += dt; e.ang += Math.sin(e.look * 3) * 2.2 * dt; }
      if (e.look > 2.4) { e.state = 'calm'; e.goal = null; e.look = 0; }
      return;
    }
    if (e.patrol) {
      if (e.wait > 0) { e.wait -= dt; e.ang += Math.sin(s.t * 1.3 + e.id) * 0.9 * dt; return; }
      const g = e.patrol[e.pi];
      const left = A.moveToward(s, e, g.x, g.y, e.speed * 0.45, dt);
      e.ang = A.turn(e.ang, e.mvAng, 5 * dt);
      if (left < 12) { e.pi = (e.pi + 1) % e.patrol.length; e.wait = 1.4 + s.rng.next() * 1.6; }
    } else if (hyp(e.home.x - e.x, e.home.y - e.y) > 20) {
      A.moveToward(s, e, e.home.x, e.home.y, e.speed * 0.45, dt);
      e.ang = A.turn(e.ang, e.mvAng, 5 * dt);
    } else e.ang = A.turn(e.ang, e.base + Math.sin(s.t * 0.6 + e.id * 1.7) * 0.7, 2 * dt);
  }

  // ===== 戰鬥中的目標 =====
  // 誘餌優先；看不到玩家（隱形、停電、被致盲）就去最後看到的位置附近找。
  function target(s, e, dt) {
    let best = null, bd = 1e9;
    for (const d of s.decoys) {
      const dd = hyp(d.x - e.x, d.y - e.y);
      if (dd < d.r && dd < bd && A.clear(s, e.x, e.y, d.x, d.y)) { bd = dd; best = d; }
    }
    if (best) return { x: best.x, y: best.y, seen: true, decoy: true };
    const p = s.p;
    if (s.blackout > 0 || p.cloak > 0 || e.blind > 0) {
      if (!e.last) e.last = { x: e.x, y: e.y };
      if (hyp(e.last.x - e.x, e.last.y - e.y) < 34) {
        const a = s.rng.next() * TAU;
        e.last = { x: clamp(e.x + Math.cos(a) * 150, T * 1.5, W - T * 1.5), y: clamp(e.y + Math.sin(a) * 150, T * 1.5, H - T * 1.5) };
      }
      return { x: e.last.x, y: e.last.y, seen: false, lost: true };
    }
    const seen = A.clear(s, e.x, e.y, p.x, p.y) && !A.steamed(s, e.x, e.y, p.x, p.y);
    e.last = { x: p.x, y: p.y };
    return { x: p.x, y: p.y, seen };
  }

  // 遠程敵人的走位：沒有射擊線就靠過去，太近就退，其他時候左右橫移。回傳現在有沒有射擊線。
  function hold(s, e, tg, lo, hi, dt, speedMul = 1) {
    const dx = tg.x - e.x, dy = tg.y - e.y, d = hyp(dx, dy) || 1;
    const line = tg.seen && A.clear(s, e.x, e.y, tg.x, tg.y, true);
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafeT = 1 + s.rng.next() * 1.8; e.strafe = -e.strafe; }
    const sp = e.speed * speedMul;
    if (!line || d > hi) { A.moveToward(s, e, tg.x, tg.y, sp, dt); return line; }
    const nx = dx / d, ny = dy / d, rad = d < lo ? -1 : 0;
    const vx = nx * rad - ny * e.strafe * 0.7, vy = ny * rad + nx * e.strafe * 0.7, l = hyp(vx, vy) || 1;
    const ox = e.x, oy = e.y, len = sp * 0.75 * dt;
    A.moveCircle(s, e, (vx / l) * len, (vy / l) * len, e.def.fly);
    if (hyp(e.x - ox, e.y - oy) < len * 0.4) e.strafe = -e.strafe;
    e.mvAng = Math.atan2(vy, vx);
    return line;
  }
  // 瞄準之後連開幾槍。c：{ n 幾發、gap 間隔、speed、spread、cd 打完休息多久、turn 轉身速度 }
  function burst(s, e, dt, want, c) {
    const a = e.atk;
    a.t -= dt;
    if (a.n === undefined) {
      if (a.t > 0.14) e.ang = A.turn(e.ang, want, (c.turn || 7) * dt);
      if (a.t > 0) return;
      a.n = c.n;
      a.t = 0;
      // 開火的瞬間往玩家移動的方向修正一點（抓一半的提前量），所以一直往同一邊跑會被打到。
      if (c.lead && s.p.cloak <= 0 && s.blackout <= 0) {
        const p = s.p, tt = (hyp(p.x - e.x, p.y - e.y) / c.speed) * c.lead;
        const la = Math.atan2(p.y + p.vy * tt - e.y, p.x + p.vx * tt - e.x);
        if (Math.abs(A.angDiff(la, e.ang)) < 0.5) e.ang = la;
      }
    }
    if (a.t > 0) return;
    bullet(s, e, e.ang + (s.rng.next() - 0.5) * c.spread, c.speed, e.def.dmg);
    a.n--;
    a.t = c.gap;
    if (a.n <= 0) { e.atk = null; e.cd = c.cd * (0.85 + s.rng.next() * 0.4) * (e.elite === 'swift' ? 0.75 : 1); }
  }
  const BURST = {
    guard: { n: 3, gap: 0.12, speed: 470, spread: 0.1, cd: 1.25, lead: 0.5 },
    drone: { n: 2, gap: 0.14, speed: 420, spread: 0.1, cd: 1.4, lead: 0.4 },
    shield: { n: 1, gap: 0.1, speed: 400, spread: 0.06, cd: 1.7, turn: 1.9 },
    jammer: { n: 1, gap: 0.1, speed: 400, spread: 0.08, cd: 1.8 },
    turret: { n: 3, gap: 0.1, speed: 460, spread: 0.08, cd: 1.2, turn: 2.2, lead: 0.5 },
  };

  function combat(s, e, dt) {
    const p = s.p, tg = target(s, e, dt);
    const d = hyp(tg.x - e.x, tg.y - e.y), want = Math.atan2(tg.y - e.y, tg.x - e.x);
    const quick = e.elite === 'swift' ? 0.75 : 1, dmg = e.def.dmg * s.dmgScale, a = e.atk;
    e.cd -= dt;
    switch (e.kind) {
      case 'guard': case 'drone': case 'jammer': {
        if (a) { burst(s, e, dt, want, BURST[e.kind]); return; }
        const band = e.kind === 'guard' ? [190, 360] : e.kind === 'drone' ? [150, 260] : [280, 520];
        const line = hold(s, e, tg, band[0], band[1], dt);
        e.ang = A.turn(e.ang, tg.seen ? want : e.mvAng, 7 * dt);
        if (line && e.cd <= 0 && d < 560) e.atk = { k: 'burst', t: e.kind === 'drone' ? 0.35 : 0.38 };
        return;
      }
      case 'shield': {
        if (a) { burst(s, e, dt, want, BURST.shield); return; }
        const line = tg.seen && A.clear(s, e.x, e.y, tg.x, tg.y, true);
        if (d > 150 || !line) A.moveToward(s, e, tg.x, tg.y, e.speed, dt);
        e.ang = A.turn(e.ang, want, 1.9 * dt);
        if (line && e.cd <= 0 && d < 430 && Math.abs(A.angDiff(want, e.ang)) < 0.4) e.atk = { k: 'burst', t: 0.5 };
        return;
      }
      case 'turret': {
        if (a) { burst(s, e, dt, want, BURST.turret); return; }
        const line = tg.seen && A.clear(s, e.x, e.y, tg.x, tg.y, true);
        e.ang = line ? A.turn(e.ang, want, 2.2 * dt) : e.ang + 0.6 * dt;
        if (line && e.cd <= 0 && d < 520 && Math.abs(A.angDiff(want, e.ang)) < 0.2) e.atk = { k: 'burst', t: 0.3 };
        return;
      }
      case 'rusher': {
        if (a) {
          a.t -= dt;
          if (a.t > 0) return;
          s.ev.push({ k: 'swing', x: e.x, y: e.y, ang: e.ang });
          if (hyp(p.x - e.x, p.y - e.y) < 84 && Math.abs(A.angDiff(Math.atan2(p.y - e.y, p.x - e.x), e.ang)) < 1.1) A.hitPlayer(s, dmg, { kx: Math.cos(e.ang) * 260, ky: Math.sin(e.ang) * 260 });
          e.atk = null;
          e.cd = 0.7 * quick;
          return;
        }
        A.moveToward(s, e, tg.x, tg.y, e.speed, dt);
        e.ang = A.turn(e.ang, d < 150 ? want : e.mvAng, 9 * dt);
        if (d < 64 && e.cd <= 0 && !tg.lost) e.atk = { k: 'swing', t: 0.36 };
        return;
      }
      case 'hound': {
        if (a) {
          a.t -= dt;
          if (!a.go) { if (a.t <= 0) { a.go = true; a.t = 0.3; a.ang = e.ang; s.ev.push({ k: 'leap', x: e.x, y: e.y }); } return; }
          A.moveCircle(s, e, Math.cos(a.ang) * 720 * dt, Math.sin(a.ang) * 720 * dt);
          if (!a.hit && hyp(p.x - e.x, p.y - e.y) < e.r + p.r + 6) { a.hit = true; A.hitPlayer(s, dmg, { hound: true, kx: Math.cos(a.ang) * 220, ky: Math.sin(a.ang) * 220 }); }
          if (a.t <= 0) { e.atk = null; e.cd = 1.2 * quick; }
          return;
        }
        A.moveToward(s, e, tg.x, tg.y, e.speed, dt);
        e.ang = A.turn(e.ang, d < 260 ? want : e.mvAng, 10 * dt);
        if (d < 220 && e.cd <= 0 && tg.seen && !tg.decoy && A.clear(s, e.x, e.y, tg.x, tg.y, true)) e.atk = { k: 'leap', t: 0.32 };
        return;
      }
      case 'sniper': {
        if (a) {
          a.t -= dt;
          if (a.t > 0.28) { if (!tg.seen) { e.atk = null; e.cd = 0.8; return; } a.ang = want; }
          e.ang = a.ang;
          if (a.t > 0) return;
          const end = A.rayEnd(s, e.x, e.y, a.ang, 1500, true);
          s.ev.push({ k: 'snipe', x: e.x, y: e.y, x2: end.x, y2: end.y });
          if (A.segDist(p.x, p.y, e.x, e.y, end.x, end.y) < p.r + 3) A.hitPlayer(s, dmg, { kx: Math.cos(a.ang) * 200, ky: Math.sin(a.ang) * 200 });
          e.atk = null;
          e.cd = 2.3 * quick;
          e.strafe = -e.strafe;
          return;
        }
        const line = hold(s, e, tg, 380, 760, dt);
        e.ang = A.turn(e.ang, tg.seen ? want : e.mvAng, 6 * dt);
        if (line && e.cd <= 0) e.atk = { k: 'snipe', t: 1.15 * (s.spec.mod === 'fog' ? 1.5 : 1), ang: want };
        return;
      }
      case 'bomber': {
        if (a) {
          a.t -= dt;
          if (a.t > 0) return;
          s.zones.push({ k: 'tele', x: a.x, y: a.y, r: 95, t: 1.05, t0: 1.05, dmg, side: 'e', fx: e.x, fy: e.y });
          s.ev.push({ k: 'lob', x: e.x, y: e.y, x2: a.x, y2: a.y });
          e.atk = null;
          e.cd = 3 * quick;
          return;
        }
        hold(s, e, tg, 220, 420, dt);
        e.ang = A.turn(e.ang, tg.seen ? want : e.mvAng, 7 * dt);
        if (tg.seen && e.cd <= 0 && d < 540) e.atk = { k: 'lob', t: 0.45, x: tg.x, y: tg.y };
        return;
      }
      case 'heavy': {
        if (a) {
          a.t -= dt;
          if (!a.go) { e.ang = A.turn(e.ang, want, 2.2 * dt); if (a.t <= 0) { a.go = true; a.t = 1.5; a.shot = 0; } return; }
          e.ang = A.turn(e.ang, want, 1 * dt);
          a.shot -= dt;
          if (a.shot <= 0) { a.shot = 0.075; bullet(s, e, e.ang + (s.rng.next() - 0.5) * 0.22, 460, e.def.dmg); }
          A.moveToward(s, e, tg.x, tg.y, e.speed * 0.3, dt);
          if (a.t <= 0) { e.atk = null; e.cd = 2.2 * quick; }
          return;
        }
        const line = tg.seen && A.clear(s, e.x, e.y, tg.x, tg.y, true);
        if (d > 300 || !line) A.moveToward(s, e, tg.x, tg.y, e.speed, dt); else hold(s, e, tg, 150, 330, dt);
        e.ang = A.turn(e.ang, want, 2.2 * dt);
        if (line && e.cd <= 0 && d < 520) e.atk = { k: 'spray', t: 0.75 };
        return;
      }
    }
  }

  // ===== 被劫持：幫玩家打，時間到就燒掉 =====
  function allyThink(s, e, dt) {
    const p = s.p;
    let best = null, bd = 540;
    for (const o of s.en) {
      if (o === e || o.dead || o.ally > 0 || o.spawnT > 0) continue;
      const d = hyp(o.x - e.x, o.y - e.y);
      if (d < bd && A.clear(s, e.x, e.y, o.x, o.y, true)) { bd = d; best = o; }
    }
    e.cd -= dt;
    if (!best) {
      if (!e.def.static && hyp(p.x - e.x, p.y - e.y) > 130) A.moveToward(s, e, p.x, p.y, e.speed, dt);
      return;
    }
    const want = Math.atan2(best.y - e.y, best.x - e.x);
    e.ang = A.turn(e.ang, want, 6 * dt);
    if (!e.def.static && bd > 240) A.moveToward(s, e, best.x, best.y, e.speed, dt);
    if (e.cd <= 0 && Math.abs(A.angDiff(want, e.ang)) < 0.25) {
      e.cd = 0.4;
      s.bul.push({ x: e.x + Math.cos(e.ang) * e.r, y: e.y + Math.sin(e.ang) * e.r, vx: Math.cos(e.ang) * 560, vy: Math.sin(e.ang) * 560, r: 4, side: 'p', by: 'ally', dmg: e.def.dmg * 2.2 * s.st.hijackMul * s.spec.scale, life: 1.5, pierce: 0, bounce: 0 });
      s.ev.push({ k: 'pshot', x: e.x, y: e.y, ang: e.ang });
    }
  }

  // ===== 首領 =====
  function phase(s, e, ph) {
    if (ph === e.phase) return false;
    e.phase = ph;
    s.ev.push({ k: 'phase', x: e.x, y: e.y, n: ph });
    return true;
  }
  // 掃過去的雷射。回傳這一步有沒有打到玩家。
  function beam(s, e, ang, dmg) {
    const p = s.p, end = A.rayEnd(s, e.x, e.y, ang, 2000, false);
    if (A.segDist(p.x, p.y, e.x, e.y, end.x, end.y) < p.r + 6) A.hitPlayer(s, dmg);
    return end;
  }
  const BOSS = {
    // 鎮暴隊長「鬥牛犬」：正面有盾。衝撞撞到牆（或升起的路樁）會暈，那是最好的輸出時機。
    bulldog(s, e, dt) {
      const p = s.p, tg = target(s, e, dt), d = hyp(tg.x - e.x, tg.y - e.y), want = Math.atan2(tg.y - e.y, tg.x - e.x);
      const ph = e.hp < e.maxHp * 0.5 ? 2 : 1;
      if (phase(s, e, ph)) summon(s, ['rusher', 'rusher', 'hound']);
      e.cd -= dt;
      const a = e.atk;
      if (a) {
        a.t -= dt;
        if (a.k === 'charge') {
          if (!a.go) {
            if (a.t > 0.25) a.ang = want;
            e.ang = a.ang;
            if (a.t <= 0) { a.go = true; a.t = 1.6; a.hit = new Set(); s.ev.push({ k: 'leap', x: e.x, y: e.y }); }
            return;
          }
          const ox = e.x, oy = e.y, len = 820 * dt;
          A.moveCircle(s, e, Math.cos(a.ang) * len, Math.sin(a.ang) * len);
          const moved = hyp(e.x - ox, e.y - oy);
          if (!a.hitP && hyp(p.x - e.x, p.y - e.y) < e.r + p.r + 4) { a.hitP = true; A.hitPlayer(s, 22 * s.dmgScale, { kx: Math.cos(a.ang) * 500, ky: Math.sin(a.ang) * 500 }); }
          for (const o of s.en) if (o !== e && !o.dead && !a.hit.has(o) && hyp(o.x - e.x, o.y - e.y) < e.r + o.r) { a.hit.add(o); A.hurt(s, o, 30, { by: 'env' }); }
          if (moved < len * 0.5 || a.t <= 0) {
            e.atk = null;
            e.pat = null;
            e.cd = 1;
            if (moved < len * 0.5) { e.stun = 1.8; e.resist = 0; s.ev.push({ k: 'crash', x: e.x, y: e.y }); }
          }
          return;
        }
        if (a.k === 'shotgun') {
          e.ang = A.turn(e.ang, want, (a.t > 0.2 ? 4 : 0.4) * dt);
          if (a.t > 0) return;
          for (let i = -3; i <= 3; i++) bullet(s, e, e.ang + i * 0.085, 420, e.def.dmg * 0.6);
          if (--a.n > 0) a.t = 0.5; else { e.atk = null; e.cd = ph === 2 ? 0.8 : 1.2; }
          return;
        }
        if (a.k === 'grenades') {
          if (a.t > 0) return;
          for (let i = 0; i < 3; i++) {
            const an = s.rng.next() * TAU, r = i ? 110 + s.rng.next() * 60 : 0;
            s.zones.push({ k: 'tele', x: clamp(p.x + Math.cos(an) * r, T * 1.5, W - T * 1.5), y: clamp(p.y + Math.sin(an) * r, T * 1.5, H - T * 1.5), r: 90, t: 1 + i * 0.15, t0: 1 + i * 0.15, dmg: 18 * s.dmgScale, side: 'e', fx: e.x, fy: e.y });
          }
          s.ev.push({ k: 'lob', x: e.x, y: e.y, x2: p.x, y2: p.y });
          e.atk = null;
          e.cd = 1.2;
          return;
        }
        if (a.k === 'slam') {
          if (a.t > 0) return;
          s.ev.push({ k: 'boom', x: e.x, y: e.y, r: 125 });
          if (hyp(p.x - e.x, p.y - e.y) < 125) A.hitPlayer(s, 18 * s.dmgScale, { kx: Math.cos(want) * 420, ky: Math.sin(want) * 420 });
          e.atk = null;
          e.cd = 0.9;
          return;
        }
      }
      e.pat = null;
      if (d > 90) A.moveToward(s, e, tg.x, tg.y, e.speed * (ph === 2 ? 1.25 : 1), dt);
      e.ang = A.turn(e.ang, want, 2.6 * dt);
      if (e.cd > 0) return;
      if (d < 100) { e.atk = { k: 'slam', t: 0.55 }; return; }
      const pick = s.rng.weighted({ charge: 4, shotgun: 3, grenades: 2 });
      if (pick === 'charge') { e.atk = { k: 'charge', t: 0.85, ang: want }; e.pat = 'charge'; }
      else if (pick === 'shotgun') e.atk = { k: 'shotgun', t: 0.6, n: ph };
      else e.atk = { k: 'grenades', t: 0.5 };
    },

    // 守夜人母機：飛在上半場。中繼器還在線上的時候很硬（每座 −35% 傷害），駭掉才打得動。
    carrier(s, e, dt) {
      const p = s.p, want = Math.atan2(p.y - e.y, p.x - e.x);
      const ph = e.hp < e.maxHp * 0.5 ? 2 : 1;
      phase(s, e, ph);
      e.cd -= dt;
      const a = e.atk;
      if (!a || a.k !== 'laser') {
        A.moveToward(s, e, clamp(p.x + Math.sin(s.t * 0.7) * 260, 220, W - 220), 190 + Math.sin(s.t * 1.1) * 60, e.speed * (ph === 2 ? 1.3 : 1), dt);
        e.ang = want;
      }
      if (a) {
        a.t -= dt;
        if (a.k === 'laser') {
          if (!a.go) { if (a.t <= 0) { a.go = true; a.t = a.dur; } e.ang = a.ang; return; }
          a.ang += a.dir * a.rate * dt;
          e.ang = a.ang;
          const end = beam(s, e, a.ang, 16 * s.dmgScale);
          a.x2 = end.x; a.y2 = end.y;
          if (a.t <= 0) { e.atk = null; e.cd = 1.3; }
        } else if (a.k === 'missiles') {
          a.next -= dt;
          if (a.next <= 0 && a.n > 0) {
            a.n--;
            a.next = 0.3;
            s.zones.push({ k: 'tele', x: clamp(p.x + (s.rng.next() - 0.5) * 60, T * 1.5, W - T * 1.5), y: clamp(p.y + (s.rng.next() - 0.5) * 60, T * 1.5, H - T * 1.5), r: 80, t: 0.9, t0: 0.9, dmg: 16 * s.dmgScale, side: 'e', fx: e.x, fy: e.y });
          }
          if (a.n <= 0) { e.atk = null; e.cd = 1.6; }
        } else if (a.k === 'fan') {
          if (a.t > 0) return;
          for (let i = -2; i <= 2; i++) bullet(s, e, want + i * 0.16, 330, e.def.dmg);
          if (--a.n > 0) a.t = 0.42; else { e.atk = null; e.cd = 1.3; }
        }
        return;
      }
      if (e.cd > 0) return;
      const drones = s.en.filter((o) => o.kind === 'drone' && !o.dead && o.ally <= 0).length;
      const pick = s.rng.weighted({ laser: 3, missiles: 3, fan: 3, drones: drones < ph + 1 ? 3 : 0 });
      if (pick === 'drones') {
        for (const dx of [-70, 70]) A.spawn(s, 'drone', clamp(e.x + dx, T * 2, W - T * 2), e.y + 50, { wave: true });
        s.ev.push({ k: 'wave' });
        e.cd = 2;
      } else if (pick === 'laser') {
        const dir = s.rng.chance(0.5) ? 1 : -1;
        e.atk = { k: 'laser', t: 0.9, dur: ph === 2 ? 1.5 : 1.9, rate: ph === 2 ? 1.25 : 0.95, dir, ang: want - dir * 0.85 };
      } else if (pick === 'missiles') e.atk = { k: 'missiles', t: 9, n: ph === 2 ? 7 : 5, next: 0.4 };
      else e.atk = { k: 'fan', t: 0.5, n: 3 };
    },

    // 基石核心：不會動。平常只吃四成傷害；駭掉一座中繼器，外殼會打開幾秒。
    keystone(s, e, dt) {
      const p = s.p, f = e.hp / e.maxHp, ph = f < 0.33 ? 3 : f < 0.66 ? 2 : 1;
      if (phase(s, e, ph)) summon(s, ph === 2 ? ['guard', 'rusher', 'drone'] : ['shield', 'hound', 'hound', 'drone']);
      e.ang += 0.6 * dt;
      e.cd -= dt;
      const a = e.atk, dmg = e.def.dmg;
      if (a) {
        a.t -= dt;
        if (a.k === 'ring') {
          if (a.t > 0) return;
          const gap = s.rng.next() * TAU;
          for (let i = 0; i < 24; i++) { const an = (i / 24) * TAU; if (Math.abs(A.angDiff(an, gap)) > 0.45) bullet(s, e, an, 230, dmg); }
          if (--a.n > 0) a.t = 0.75; else { e.atk = null; e.cd = 1.6 - 0.2 * ph; }
        } else if (a.k === 'spiral') {
          a.shot -= dt;
          if (a.shot <= 0) {
            a.shot = 0.09;
            a.ang += 0.21 * a.dir;
            const arms = ph >= 3 ? 3 : 2;
            for (let i = 0; i < arms; i++) bullet(s, e, a.ang + (i * TAU) / arms, 250, dmg * 0.8);
          }
          if (a.t <= 0) { e.atk = null; e.cd = 1.4; }
        } else if (a.k === 'purge') {
          if (a.t > 0) return;
          if (--a.n > 0) { purge(s, a.par ^ 1); a.t = 1.35; } else { e.atk = null; e.cd = 1.1; }
        } else if (a.k === 'laser') {
          if (!a.go) { if (a.t <= 0) { a.go = true; a.t = a.dur; } return; }
          a.ang += a.dir * a.rate * dt;
          const e1 = beam(s, e, a.ang, 16 * s.dmgScale), e2 = beam(s, e, a.ang + Math.PI, 16 * s.dmgScale);
          a.x2 = e1.x; a.y2 = e1.y; a.x3 = e2.x; a.y3 = e2.y;
          if (a.t <= 0) { e.atk = null; e.cd = 1.2; }
        }
        return;
      }
      if (e.cd > 0) return;
      const pick = s.rng.weighted({ ring: 3, spiral: 3, purge: 2, laser: ph >= 2 ? 2 : 0 });
      if (pick === 'ring') e.atk = { k: 'ring', t: 0.6, n: 1 + ph };
      else if (pick === 'spiral') e.atk = { k: 'spiral', t: 2.2 + 0.4 * ph, shot: 0, ang: s.rng.next() * TAU, dir: s.rng.chance(0.5) ? 1 : -1 };
      else if (pick === 'purge') { const par = s.rng.int(0, 1); purge(s, par); e.atk = { k: 'purge', t: 1.35, n: ph >= 3 ? 2 : 1, par }; }
      else { const dir = s.rng.chance(0.5) ? 1 : -1; e.atk = { k: 'laser', t: 1, dur: 3, rate: 0.7 + 0.1 * ph, dir, ang: Math.atan2(p.y - e.y, p.x - e.x) + dir * 1.2 }; }
    },
  };
  // 清場：地板像棋盤一樣一格隔一格炸。
  function purge(s, par) {
    for (let by = 0; by < 4; by++) for (let bx = 0; bx < 8; bx++) {
      if ((bx + by + par) % 2) continue;
      s.zones.push({ k: 'tele', x: Math.min(W - T * 1.5, (1 + bx * 4 + 2) * T), y: (1 + by * 4 + 2) * T, r: 96, t: 1.3, t0: 1.3, dmg: 18 * s.dmgScale, side: 'e', quiet: bx + by > 0 });
    }
  }

  // ===== 每一步 =====
  function think(s, e, dt) {
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (!e.def.static && (e.kx || e.ky)) {
      A.moveCircle(s, e, e.kx * dt, e.ky * dt, e.def.fly);
      const k = Math.pow(0.003, dt);
      e.kx *= k; e.ky *= k;
      if (hyp(e.kx, e.ky) < 6) e.kx = e.ky = 0;
    }
    if (e.burn > 0) {
      e.burn -= dt;
      e.burnT -= dt;
      if (e.burnT <= 0) { e.burnT = 0.5; A.hurt(s, e, 2.5 * s.st.burnMul, { by: 'env' }); if (e.dead) return; }
    }
    if (e.mark > 0) e.mark -= dt;
    if (e.blind > 0) e.blind -= dt;
    if (e.resist > 0) e.resist -= dt;
    if (e.noShield > 0) e.noShield -= dt;
    if (e.shieldCd > 0) e.shieldCd -= dt;
    if (e.open > 0) e.open -= dt;
    if (e.ally > 0) {
      e.ally -= dt;
      if (e.ally <= 0) {
        // 燒掉的時候炸一下旁邊的敵人。
        A.blast(s, e.x, e.y, 80, 20, { by: 'ally' });
        A.kill(s, e, { by: 'ally' });
        return;
      }
      allyThink(s, e, dt);
      return;
    }
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.boss) { BOSS[e.boss](s, e, dt); return; }
    if (e.state !== 'combat') { calmThink(s, e, dt); return; }
    if (e.call > 0) { e.call -= dt; if (e.call <= 0) A.raise(s); }
    combat(s, e, dt);
  }

  sim.think = think;
})(window.ECHO = window.ECHO || {});
