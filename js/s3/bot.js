// 第三季的機器人玩家：自動測試和平衡用，也可以在網址加 ?bot=1 看它自己打。
// 它的打法是「正常但不完美的玩家」：會躲看得到的子彈和預告、會風箏近戰、會用划算的駭入和裝備、看到被電暈的會去制伏，
// 但不會刻意潛行，瞄準有一點誤差，也不是每一顆子彈都閃得掉。
// act(s) 回傳這一步的輸入，格式跟 js/s3/sim.js 的 step 一樣。
(function (E) {
  const S3 = E.s3, sim = S3.sim, A = sim.api;
  const { T, W, H, GW, GH } = sim, hyp = Math.hypot;
  const DX = [1, 0, -1, 0, 1, 1, -1, -1], DY = [0, 1, 0, -1, 1, -1, 1, -1];

  function create(seed) {
    const rng = E.rng.derive(seed, 'bot');
    const b = { strafe: 1, strafeT: 0, aimErr: 0, aimT: 0, door: 0, last: {} };

    // 往某一點走的方向（會繞牆）。
    function toward(s, x, y) {
      const p = s.p;
      if (A.clear(s, p.x, p.y, x, y, true)) { const d = hyp(x - p.x, y - p.y) || 1; return [(x - p.x) / d, (y - p.y) / d]; }
      const f = A.field(s, x, y);
      const tx = A.clamp(Math.floor(p.x / T), 0, GW - 1), ty = A.clamp(Math.floor(p.y / T), 0, GH - 1);
      let best = f[A.idx(tx, ty)], bx = -1, by = -1;
      if (best < 0) best = 9999;
      for (let k = 0; k < 8; k++) {
        const nx = tx + DX[k], ny = ty + DY[k];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const v = f[A.idx(nx, ny)];
        if (v < 0 || v >= best) continue;
        if (k >= 4 && (s.solid[A.idx(nx, ty)] || s.solid[A.idx(tx, ny)])) continue;
        best = v; bx = nx; by = ny;
      }
      const wx = bx >= 0 ? (bx + 0.5) * T : x, wy = bx >= 0 ? (by + 0.5) * T : y;
      const d = hyp(wx - p.x, wy - p.y) || 1;
      return [(wx - p.x) / d, (wy - p.y) / d];
    }

    // 危險：快打到的子彈、腳下的預告圈、瞄準線、衝撞。回傳 { x, y 該往哪躲, urgent 要不要衝刺 }。
    function danger(s) {
      const p = s.p;
      let dx = 0, dy = 0, urgent = false;
      for (const bl of s.bul) {
        if (bl.side !== 'e') continue;
        // 四顆子彈裡有一顆沒注意到。
        if (bl.botSkip === undefined) bl.botSkip = rng.chance(0.25);
        if (bl.botSkip) continue;
        const rx = p.x - bl.x, ry = p.y - bl.y, v2 = bl.vx * bl.vx + bl.vy * bl.vy;
        const t = (rx * bl.vx + ry * bl.vy) / v2;
        if (t < 0 || t > 0.5) continue;
        const cx = rx - bl.vx * t, cy = ry - bl.vy * t, miss = hyp(cx, cy);
        if (miss > p.r + bl.r + 16) continue;
        const side = (rx * bl.vy - ry * bl.vx) >= 0 ? 1 : -1, l = Math.sqrt(v2), w = 1 / (t + 0.08);
        dx += (bl.vy / l) * side * w;
        dy += (-bl.vx / l) * side * w;
        if (t < 0.12 && miss < p.r + bl.r + 4) urgent = true;
      }
      for (const z of s.zones) {
        if (z.side === 'e' && z.k === 'tele') {
          const d = hyp(p.x - z.x, p.y - z.y);
          if (d > z.r + 30) continue;
          const w = 3 / (z.t + 0.1);
          dx += ((p.x - z.x) / (d || 1)) * w; dy += ((p.y - z.y) / (d || 1)) * w;
          if (z.t < 0.3 && d < z.r + 6) urgent = true;
        } else if (z.k === 'fire') {
          const d = hyp(p.x - z.x, p.y - z.y);
          if (d < z.r + 24) { dx += ((p.x - z.x) / (d || 1)) * 4; dy += ((p.y - z.y) / (d || 1)) * 4; }
        }
      }
      for (const e of s.en) {
        const a = e.atk;
        if (e.dead || e.ally > 0 || !a) continue;
        const line = (ang, len, width, soon) => {
          const ex = e.x + Math.cos(ang) * len, ey = e.y + Math.sin(ang) * len;
          const d = A.segDist(p.x, p.y, e.x, e.y, ex, ey);
          if (d > width) return;
          const side = ((p.x - e.x) * Math.sin(ang) - (p.y - e.y) * Math.cos(ang)) >= 0 ? 1 : -1;
          dx += Math.sin(ang) * side * 5; dy += -Math.cos(ang) * side * 5;
          if (soon && d < width * 0.6) urgent = true;
        };
        if (a.k === 'snipe' && a.t < 0.3) line(a.ang, 1500, 34, a.t < 0.12);
        else if (a.k === 'charge') line(a.ang, 900, 70, a.go || a.t < 0.2);
        else if (a.k === 'laser') { line(a.ang, 1800, a.go ? 60 : 46, a.go); if (a.x3 !== undefined) line(a.ang + Math.PI, 1800, 60, a.go); }
        else if ((a.k === 'swing' || a.k === 'slam') && hyp(p.x - e.x, p.y - e.y) < 135) {
          const d = hyp(p.x - e.x, p.y - e.y) || 1;
          dx += ((p.x - e.x) / d) * 6; dy += ((p.y - e.y) / d) * 6;
          if (a.t < 0.14) urgent = true;
        } else if (a.k === 'leap' && !a.go) line(e.ang, 260, 40, a.t < 0.1);
      }
      return { x: dx, y: dy, urgent, any: dx !== 0 || dy !== 0 };
    }

    // 這一步要不要駭、駭誰。回傳要點的位置，或 null。
    function hackPlan(s, foes) {
      const p = s.p, range = s.st.hackRange;
      if (p.hackCd > 0 || p.bw < 1) return null;
      const near = (x, y, r) => foes.filter((e) => hyp(e.x - x, e.y - y) < r + e.r).length;
      const can = (x, y) => { const h = sim.pickHack(s, x, y); return h && h.ok ? h : null; };
      let best = null, score = 0;
      const offer = (x, y, sc) => { if (sc > score && hyp(x - p.x, y - p.y) <= range) { const h = can(x, y); if (h) { score = sc; best = { x, y, h }; } } };
      for (const pr of s.props) {
        if (pr.gone) continue;
        if (pr.kind === 'junction' && !pr.used && pr.fuse <= 0) { const n = near(pr.x, pr.y, 140); if (n) offer(pr.x, pr.y, n * 3 + (hyp(p.x - pr.x, p.y - pr.y) > 160 ? 1 : 0)); }
        else if (pr.kind === 'barrel' && pr.fuse <= 0 && hyp(p.x - pr.x, p.y - pr.y) > 175) { const n = near(pr.x, pr.y, 125); if (n) offer(pr.x, pr.y, n * 3.5); }
        else if (pr.kind === 'vent' && pr.cool <= 0) { const n = near(pr.x, pr.y, 120); if (n >= 2) offer(pr.x, pr.y, n * 1.5); }
        else if (pr.kind === 'pylon' && pr.down <= 0) offer(pr.x, pr.y, 9);
        else if (pr.kind === 'car' && !pr.used && !pr.moving) {
          const path = sim.carPath(s, pr), dx = DX[path.dir], dy = DY[path.dir];
          const n = foes.filter((e) => { const along = (e.x - pr.x) * dx + (e.y - pr.y) * dy, off = Math.abs((e.x - pr.x) * dy - (e.y - pr.y) * dx); return along > 0 && along < path.reach + 130 && off < 50; }).length;
          const me = (p.x - pr.x) * dx + (p.y - pr.y) * dy, off = Math.abs((p.x - pr.x) * dy - (p.y - pr.y) * dx);
          if (n && !(me > 0 && off < 60)) offer(pr.x, pr.y, n * 4);
        } else if (pr.kind === 'camera' && pr.cool <= 0 && foes.length >= 3 && p.bw >= 3) offer(pr.x, pr.y, 1.5);
      }
      for (const e of foes) {
        const d = hyp(e.x - p.x, e.y - p.y);
        if (e.boss === 'bulldog') { if (e.noShield <= 0 && e.stun <= 0) offer(e.x, e.y, 5); continue; }
        if (e.kind === 'drone' && p.bw >= 2) offer(e.x, e.y, 4);
        else if (e.kind === 'turret' && p.bw >= 3) offer(e.x, e.y, 4.5);
        else if (e.kind === 'heavy' && e.grenade) offer(e.x, e.y, 6);
        else if (e.kind === 'shield' && e.noShield <= 0 && e.stun <= 0 && d < 380) offer(e.x, e.y, 3);
        else if (e.kind === 'sniper' && e.atk && e.blind <= 0) offer(e.x, e.y, 4);
        else if ((e.kind === 'rusher' || e.kind === 'hound') && d < 170 && e.stun <= 0 && e.resist <= 0) offer(e.x, e.y, 3.2);
        else if (e.def.human && e.stun <= 0 && e.resist <= 0 && d < 140 && p.bw >= 3) offer(e.x, e.y, 2);
      }
      return best;
    }

    function gadgetPlan(s, foes, inp) {
      const p = s.p;
      p.gad.forEach((g, i) => {
        if (g.cd > 0 || !foes.length) return;
        const key = i === 0 ? 'g1' : 'g2';
        const nearMe = foes.filter((e) => hyp(e.x - p.x, e.y - p.y) < 110 + e.r).length;
        const far = foes.slice().sort((a, b) => hyp(a.x - p.x, a.y - p.y) - hyp(b.x - p.x, b.y - p.y))[0];
        const cluster = (r) => { let best = null, n = 0; for (const e of foes) { const c = foes.filter((o) => hyp(o.x - e.x, o.y - e.y) < r).length; if (c > n) { n = c; best = e; } } return { e: best, n }; };
        if (g.id === 'hammer') { if (nearMe) { inp[key] = true; inp.ax = far.x; inp.ay = far.y; } }
        else if (g.id === 'eagle') { const c = cluster(160); if (c.n >= 2 || foes.some((e) => e.boss)) { inp[key] = true; inp.ax = c.e.x; inp.ay = c.e.y; } }
        else if (g.id === 'sergei') { const c = cluster(90); if (c.e && hyp(c.e.x - p.x, c.e.y - p.y) > 120) { inp[key] = true; inp.ax = c.e.x; inp.ay = c.e.y; } }
        else if (g.id === 'spider') { if (s.alert) inp[key] = true; }
        else if (g.id === 'mine') { if (foes.some((e) => (e.kind === 'rusher' || e.kind === 'hound' || e.boss === 'bulldog') && hyp(e.x - p.x, e.y - p.y) < 260)) inp[key] = true; }
        else if (g.id === 'mask') { if (p.hp < p.maxHp * 0.5 && foes.length >= 2) inp[key] = true; }
        else if (g.id === 'blackout') { if (p.hp < p.maxHp * 0.6 && foes.length >= 3) inp[key] = true; }
        else if (g.id === 'lure') { if (foes.length >= 3) { inp[key] = true; inp.ax = W - p.x; inp.ay = H - p.y; } }
      });
    }

    function act(s) {
      const p = s.p;
      const inp = { mx: 0, my: 0, ax: p.x, ay: p.y - 100, fire: false, focus: false, dash: false, hack: false, melee: false, g1: false, g2: false, reload: false, swap: -1 };
      // 場上的人快倒了，就換體力最多的隊友上來。
      if (!s.cleared && s.swapCd <= 0 && p.hp < p.maxHp * 0.3) {
        let best = -1, frac = 0.45;
        s.team.forEach((m, i) => { if (i !== s.active && !m.down && m.hp / m.maxHp > frac) { frac = m.hp / m.maxHp; best = i; } });
        inp.swap = best;
      }
      // 打完了：撿獎勵箱，然後走去門口。
      if (s.cleared) {
        const goal = !s.cache.taken ? s.cache : s.spec.doors[Math.min(b.door, s.spec.doors.length - 1)];
        const [mx, my] = toward(s, goal.x, s.cache.taken ? goal.y + 10 : goal.y);
        inp.mx = mx; inp.my = my;
        inp.reload = p.ammo < p.mag;
        return inp;
      }
      const foes = s.en.filter((e) => !e.dead && e.ally <= 0 && e.spawnT <= 0);
      b.strafeT -= sim.DT;
      if (b.strafeT <= 0) { b.strafeT = 0.8 + rng.next() * 1.2; b.strafe = -b.strafe; }
      b.aimT -= sim.DT;
      if (b.aimT <= 0) { b.aimT = 0.25; b.aimErr = (rng.next() - 0.5) * 0.14; }

      // 目標：有射擊線的最近敵人；沒有就最近的。被盾擋住正面的排後面。
      let tgt = null, bd = 1e9, los = false;
      for (const e of foes) {
        const d = hyp(e.x - p.x, e.y - p.y);
        const line = A.clear(s, p.x, p.y, e.x, e.y, true);
        // 已經在打的目標加一點分，免得在兩個差不多的目標之間來回跑。
        const sc = d + (line ? 0 : 600) + (A.shielded(e, p.x, p.y) ? 250 : 0) - (e.stun > 0 ? 120 : 0) - (e.kind === 'jammer' ? 100 : 0) - (e.id === b.tgtId ? 320 : 0);
        if (sc < bd) { bd = sc; tgt = e; los = line; }
      }
      const dg = danger(s);
      b.tgtId = tgt ? tgt.id : 0;
      if (tgt) {
        const d = hyp(tgt.x - p.x, tgt.y - p.y), ang = Math.atan2(tgt.y - p.y, tgt.x - p.x) + b.aimErr * Math.min(1, d / 300);
        inp.ax = p.x + Math.cos(ang) * d; inp.ay = p.y + Math.sin(ang) * d;
        const w = s.weapon, reach = Math.min(w.range * 0.9, 520);
        inp.fire = los && d < reach && (!A.shielded(tgt, p.x, p.y) || tgt.state !== 'combat');
        // 走位：太遠就靠近、太近就退、其他時候橫移。近戰型的敵人保持更遠。
        const melee = tgt.kind === 'rusher' || tgt.kind === 'hound' || tgt.boss === 'bulldog';
        const want = melee ? 250 : w.range < 500 ? 190 : 260;
        let mx = 0, my = 0;
        if (!los || d > Math.min(reach, want + 90)) [mx, my] = toward(s, tgt.x, tgt.y);
        else {
          const nx = (tgt.x - p.x) / (d || 1), ny = (tgt.y - p.y) / (d || 1), rad = d < want - 60 ? -1 : 0;
          mx = nx * rad - ny * b.strafe * 0.8; my = ny * rad + nx * b.strafe * 0.8;
        }
        // 首領戰：中繼器好了就靠過去駭。
        const py = s.spec.boss && p.bw >= 2 ? s.props.filter((q) => q.kind === 'pylon' && q.down <= 0).sort((x, y) => hyp(x.x - p.x, x.y - p.y) - hyp(y.x - p.x, y.y - p.y))[0] : null;
        if (py && hyp(py.x - p.x, py.y - p.y) > s.st.hackRange * 0.9) [mx, my] = toward(s, py.x, py.y);
        // 被電暈的就衝過去制伏。
        const down = foes.filter((e) => (e.stun > 0.35 || (e.distract > 0.5 && e.state !== 'combat')) && !e.boss && hyp(e.x - p.x, e.y - p.y) < 190).sort((x, y) => hyp(x.x - p.x, x.y - p.y) - hyp(y.x - p.x, y.y - p.y))[0];
        if (down && !dg.urgent) [mx, my] = toward(s, down.x, down.y);
        if (sim.takedownTarget(s)) inp.melee = true;
        else if (melee && d < 58 + tgt.r && p.meleeCd <= 0 && !tgt.atk) inp.melee = true;
        // 躲
        if (dg.any) { const l = hyp(dg.x, dg.y) || 1; mx = mx * 0.35 + (dg.x / l) * 1.2; my = my * 0.35 + (dg.y / l) * 1.2; }
        // 離牆太近會卡住，稍微往場地中間偏。
        mx += ((W / 2 - p.x) / W) * 0.25; my += ((H / 2 - p.y) / H) * 0.25;
        inp.mx = mx; inp.my = my;
        if (dg.urgent && p.dashN > 0 && rng.chance(0.8)) inp.dash = true;
        inp.focus = p.hp < p.maxHp * 0.35 && dg.any;

        const hp = hackPlan(s, foes);
        if (hp) { inp.hack = true; inp.ax = hp.x; inp.ay = hp.y; inp.fire = false; }
        else gadgetPlan(s, foes, inp);
      } else {
        // 場上暫時沒人（增援還沒到）：回場地中間等。
        const [mx, my] = toward(s, W / 2, H * 0.6);
        if (hyp(W / 2 - p.x, H * 0.6 - p.y) > 60) { inp.mx = mx; inp.my = my; }
        if (dg.any) { inp.mx = dg.x; inp.my = dg.y; if (dg.urgent && p.dashN > 0) inp.dash = true; }
        inp.reload = p.ammo < p.mag;
      }
      return inp;
    }
    return { act, state: b };
  }

  // ===== 路上的決定：選門、選獎勵、逛黑市 =====
  const TAG_LOVE = { shock: 3, net: 2.5, blast: 2, body: 2.2, gun: 2.4, puppet: 1.5 };
  function scoreExploit(run, id) {
    const x = S3.run.exploitDef(id), own = run.build.exploits;
    let sc = { c: 1, u: 1.6, r: 2.4 }[x.rar] * (TAG_LOVE[x.tag] || 1);
    if (Object.keys(own).some((o) => S3.run.exploitDef(o).tag === x.tag)) sc *= 1.25;
    if (id === 'kevlar' || id === 'plating' || id === 'secondwind') sc *= 1.5;
    if (id === 'glasscannon' || id === 'silencer' || id === 'hoard') sc *= 0.5;
    return sc;
  }
  // 全隊還剩幾成體力（倒下的人算零）。
  function health(run) {
    let hp = 0, top = 0;
    run.squad.forEach((m, i) => { top += S3.run.maxHp(run, i); if (!m.down) hp += m.hp; });
    return hp / top;
  }
  function chooseDoor(run) {
    const frac = health(run);
    let best = 0, bs = -1e9;
    run.options.forEach((o, i) => {
      let sc = 0;
      if (o.type === 'safe') sc = frac < 0.7 ? 9 : 3;
      else if (o.type === 'shop') sc = run.data >= 70 ? 7 : 2;
      else if (o.type === 'event') sc = 5;
      else if (o.type === 'elite') sc = frac > 0.7 ? 6 : 0;
      else if (o.type === 'boss') sc = 1;
      else if (o.type === 'cells') sc = run.squad.some((m) => m.down) ? 9 : run.held ? 6.5 : 4.5;
      else sc = { exploit: 5.5, gadget: 4.5, heal: frac < 0.6 ? 8 : 2, max: 5, data: 3.5 }[o.reward] || 4;
      if (o.mod === 'overtime' || o.mod === 'sweep' || o.mod === 'kennel' || o.mod === 'jam') sc -= frac < 0.6 ? 3 : 1;
      if (o.mod === 'supply' || o.mod === 'shift') sc += 1;
      if (sc > bs) { bs = sc; best = i; }
    });
    return best;
  }
  function chooseReward(run, rw) {
    if (!rw.picks) return null;
    if (rw.kind === 'gadget') {
      // 隊上已經有的就升級；共用的那一格空著就拿新的；都不是就不換。
      const have = (id) => run.squad.some((m) => m.gadget.id === id) || (run.gear && run.gear.id === id);
      return rw.picks.find(have) || (run.gear ? null : rw.picks[0]);
    }
    return rw.picks.slice().sort((a, b) => scoreExploit(run, b) - scoreExploit(run, a))[0];
  }
  function settle(run) {
    // 把安全屋、事件給的「再挑一個」領完。
    while (run.phase === 'reward' && run.pending) S3.run.take(run, chooseReward(run, run.pending));
  }
  function visit(run) {
    const frac = health(run);
    if (run.phase === 'shop') {
      const items = run.shop.items;
      const healIdx = items.findIndex((it) => it.k === 'heal');
      if (frac < 0.65) S3.run.buy(run, healIdx);
      items.map((it, i) => ({ it, i })).filter((o) => o.it.k === 'exploit').sort((a, b) => scoreExploit(run, b.it.id) - scoreExploit(run, a.it.id)).forEach((o) => S3.run.buy(run, o.i));
      if (!run.gear) S3.run.buy(run, items.findIndex((it) => it.k === 'gadget'));
      run.phase = 'done';
    } else if (run.phase === 'safe') S3.run.safe(run, frac < 0.7 ? 'rest' : 'tune');
    else if (run.phase === 'event') {
      const def = S3.run.eventDef(run.event.id), c0 = def.choices[0];
      const risky = (c0.fx && (c0.fx.hurt || c0.fx.maxHp < 0) && frac < 0.6) || !S3.run.canChoose(run, 0);
      S3.run.choose(run, risky ? 1 : 0);
    }
    settle(run);
  }

  // 自己打完一整趟。o：{ perks 永久強化、held 名冊裡有幾個人被關、limit 每間最多幾步 }。回傳 { won, run, rooms: [...] }。
  function playRun(seed, o = {}) {
    const m = { echoes: 0, perks: o.perks || {}, runs: 0, wins: 0, best: 0, seen: {}, roster: [] };
    const run = S3.run.start(seed, S3.run.crewFor(seed), m);
    if (o.held) run.held = o.held;
    const limit = o.limit || 60 * 150, rooms = [];
    for (let guard = 0; guard < 80 && run.phase === 'route'; guard++) {
      const spec = S3.run.enter(run, chooseDoor(run));
      if (spec) {
        const s = sim.createRoom(spec, S3.run.simBuild(run), S3.run.carry(run));
        const bot = create(seed + ':' + run.roomNo);
        let n = 0;
        while (!s.over && !(s.cleared && s.cache.taken) && n++ < limit) { sim.step(s, bot.act(s)); s.ev.length = 0; }
        if (n >= limit && !s.cleared) s.over = 'dead';
        rooms.push({ no: run.roomNo, type: run.node.type, mod: run.node.mod, boss: spec.boss, secs: Math.round(s.rt), hp: Math.round(s.p.hp), hurt: Math.round(s.stats.hurt), dead: s.over === 'dead', timeout: n >= limit, silent: s.silent, down: s.team.filter((t) => t.down).length });
        const rw = S3.run.finishRoom(run, s);
        if (!rw) break;
        if (rw.kind === 'rescue') S3.run.rescue(run, null); else S3.run.take(run, chooseReward(run, rw));
      } else visit(run);
      if (run.phase === 'doors' || run.phase === 'done') S3.run.advance(run);
    }
    return { won: run.phase === 'won', run, rooms };
  }

  S3.bot = { create, playRun, chooseDoor, chooseReward, visit, health };
})(window.ECHO = window.ECHO || {});
