// 第三季一整趟的流程：從名冊挑三個人組成小隊 → 一間一間打 → 每間打完拿獎勵、選下一扇門 → 首領 → 下一個區段。
// 小隊一次只有一個人在場上，倒下的人會被獅心防務抓走，關進基石的拘留室；之後的夜晚可以把人救出來。
// 一趟的狀態（run）和名冊（meta）都是純資料，可以直接存檔。這裡不碰畫面：介面（js/s3/main.js）和機器人（js/s3/bot.js）都呼叫同一組函式。
(function (E) {
  const S3 = (E.s3 = E.s3 || {});
  const D = () => S3.data;
  // 第 1 版是單人的時代：沒有名冊，「更多人選」那個強化改成「加床位」。
  const META = E.save.slot('watchdogs-echo.s3.meta', 2, {
    1: (m) => {
      const perks = Object.assign({}, m.perks);
      if (perks.fourth) { perks.bunks = perks.fourth; delete perks.fourth; }
      return Object.assign({ roster: [], vol: 0, story: {}, rescued: 0 }, m, { perks });
    },
  });
  const RUN = E.save.slot('watchdogs-echo.s3.run', 2);
  const REWARD_WEIGHT = { fight: { exploit: 50, gadget: 12, data: 16, heal: 13, max: 9 }, elite: { exploit: 60, gadget: 40 } };
  const SQUAD = 3, ROSTER_MAX = 8, RECRUIT_COST = 2;
  // 名冊最多幾個人（「加床位」每級多兩個）。
  const rosterMax = (m) => ROSTER_MAX + 2 * ((m && m.perks && m.perks.bunks) || 0);

  const rngOf = (run) => E.rng.restore(run.rng);
  const keep = (run, r) => { run.rng = r.state; };
  const exploitDef = (id) => D().exploits.find((x) => x.id === id);
  const occOf = (p) => E.people.occupationOf(p);

  // ===== 永久進度 =====
  // roster：名冊，每一筆是 { p 路人, status: 'ready' 待命｜'held' 被關, runs 出過幾趟 }。
  // story：看過哪些劇情。rescued：一共救出過幾個人。seed：這份存檔的路人種子。
  function meta() {
    const m = META.read() || {};
    return Object.assign({ echoes: 0, perks: {}, runs: 0, wins: 0, best: 0, seen: {}, roster: [], vol: 0, story: {}, rescued: 0, seed: '', endings: {} }, m);
  }
  function saveMeta(m) { META.write(m); }
  const perkLv = (m, id) => (m.perks && m.perks[id]) || 0;
  function buyPerk(m, id) {
    const def = D().perks.find((p) => p.id === id), lv = perkLv(m, id);
    if (!def || lv >= def.max || m.echoes < def.cost[lv]) return false;
    m.echoes -= def.cost[lv];
    m.perks[id] = lv + 1;
    saveMeta(m);
    return true;
  }

  // ===== 《宵禁》的隊伍 =====
  // 打完《宵禁》的話（全滅和時間到不算），那一輪的隊伍會跟過來：還在的人直接進名冊；
  // 當時被捕、被轉移走的人關在基石裡，要到拘留室才救得回來。
  // 回傳 { ready: [路人], held: [路人] }，沒有可以接的就回傳 null。
  const CURFEW_KEY = 'watchdogs-echo.s2.proto';
  const CURFEW_DONE = ['dawn', 'cage', 'wild', 'deal'];
  const CURFEW_READY = ['active', 'injured', 'away', 'network'], CURFEW_HELD = ['arrested', 'lost'];
  const same = (a, b) => a.id === b.id && a.district === b.district && a.occupation === b.occupation;
  function inherit(m) {
    const old = E.save.peek(CURFEW_KEY);
    const members = old && CURFEW_DONE.includes(old.ended) && old.roster && Array.isArray(old.roster.members) ? old.roster.members : null;
    if (!members) return null;
    // 同一輪《宵禁》只接一次；之後再打完新的一輪，那一輪的人也會過來。
    const key = String(old.seed || '') + ':' + old.ended;
    if (m.imported === key) return null;
    // 那份存檔不是這裡寫的：每個人都要是這一季認得的樣子才收。
    const usable = (p) => {
      if (!p || !p.id || !p.district || !p.skills || !Array.isArray(p.traits) || !Array.isArray(p.quirks)) return false;
      try { return !!D().kits[occOf(p).category] && !m.roster.some((x) => same(x.p, p)); } catch (e) { return false; }
    };
    const out = { ready: [], held: [] };
    const take = (statuses, status, list, max) => {
      for (const st of statuses) for (const x of members) {
        if (x.status !== st || list.length >= max || m.roster.length >= rosterMax(m) || !usable(x.person)) continue;
        m.roster.push({ p: x.person, status, runs: 0, veteran: true });
        list.push(x.person);
      }
    };
    // 名冊有上限：先收還在的人（最多五個），再收被關的人（最多三個）。
    take(CURFEW_READY, 'ready', out.ready, 5);
    take(CURFEW_HELD, 'held', out.held, 3);
    m.imported = key;
    saveMeta(m);
    return out.ready.length || out.held.length ? out : null;
  }

  // ===== 名冊 =====
  // 找 n 個路人，盡量是名冊裡還沒有的職業分類。tag 讓不同用途抽到不同的人。
  function findPeople(seed, tag, n, taken) {
    const districts = Object.keys(E.s2.people.districts);
    const r = E.rng.derive(seed, 's3', tag);
    const out = [], have = (taken || []).map((p) => occOf(p).category);
    for (let i = 0; out.length < n && i < 80; i++) {
      const p = E.people.generate(seed + ':s3:' + tag, r.pick(districts), i);
      const cat = occOf(p).category;
      if ((taken || []).some((q) => same(q, p))) continue;
      if ((have.includes(cat) || out.some((o) => occOf(o).category === cat)) && i < 40) continue;
      out.push(p);
    }
    return out;
  }
  // 沒有連著名冊的單趟（機器人、測試）用的三人小隊。
  const crewFor = (seed) => findPeople(seed, 'crew', SQUAD);
  // 名冊裡待命的人不到 need 個，就補上新來的志願者（開局是四個人）。
  function ensureRoster(m) {
    if (!m.seed) m.seed = 'meta-' + Math.floor(Math.random() * 1e9).toString(36);
    const need = m.roster.length ? SQUAD : 4;
    const ready = m.roster.filter((x) => x.status === 'ready').length;
    if (ready >= need) return [];
    const fresh = findPeople(m.seed, 'join' + m.vol, need - ready, m.roster.map((x) => x.p));
    m.vol++;
    for (const p of fresh) m.roster.push({ p, status: 'ready', runs: 0 });
    return fresh;
  }
  // 這一晚願意加入的志願者（兩個）。
  const volunteers = (m) => findPeople(m.seed || 'meta', 'vol' + m.vol, 2, m.roster.map((x) => x.p));
  function recruit(m, i) {
    const p = volunteers(m)[i];
    if (!p || m.roster.length >= rosterMax(m) || m.echoes < RECRUIT_COST) return false;
    m.echoes -= RECRUIT_COST;
    m.roster.push({ p, status: 'ready', runs: 0 });
    m.vol++;
    saveMeta(m);
    return true;
  }
  function dismiss(m, i) {
    const x = m.roster[i];
    if (!x || x.status !== 'ready' || m.roster.filter((y) => y.status === 'ready').length <= SQUAD) return false;
    m.roster.splice(i, 1);
    saveMeta(m);
    return true;
  }

  // ===== 小隊 =====
  // 一個隊員：路人本身，加上這一季用得到的東西（武器、自己的裝備、職業專長）。
  // 裝備只看這個人是誰，不看是哪一晚：同一個人每次出門帶的都是同一件。
  function memberOf(p) {
    const occ = occOf(p), kit = D().kits[occ.category];
    const r = E.rng.derive('s3-kit', p.district, p.id, p.occupation, p.age);
    return {
      p, cat: occ.category, job: occ.perk, weapon: D().weaponByJob[occ.id] || D().weaponByCategory[occ.category],
      gadget: { id: r.pick(kit.gadget), lv: 1 }, hp: 0, down: false, escaped: false,
    };
  }
  // 第 i 個隊員交給戰鬥模擬的配置：自己的特質和專長，加上全隊共用的漏洞和永久強化。
  function buildOf(run, i) {
    const m = run.squad[i], p = m.p;
    return {
      person: p, cat: m.cat, job: m.job, weapon: m.weapon, skills: p.skills, traits: p.traits, flaw: p.flaw, quirks: p.quirks,
      exploits: run.build.exploits, extra: run.build.extra, escaped: m.escaped,
      gadgets: [m.gadget].concat(run.gear ? [run.gear] : []),
    };
  }
  const simBuild = (run) => ({ squad: run.squad.map((m, i) => buildOf(run, i)), active: run.active });
  const statsOf = (run, i) => S3.sim.stats(buildOf(run, i));
  const maxHp = (run, i = run.active) => statsOf(run, i).st.maxHp;
  const alive = (run) => run.squad.map((m, i) => i).filter((i) => !run.squad[i].down);
  const hasJob = (run, flag) => alive(run).some((i) => statsOf(run, i).fl[flag]);
  const insightOf = (run) => run.insight + (hasJob(run, 'lockpick') ? 1 : 0);
  const carry = (run) => ({ hp: run.squad.map((m) => (m.down ? 0 : m.hp)), data: run.data, revived: run.revived });

  // 開始一趟。people：三個路人。m：永久進度（有名冊的話，被關的人數會影響路線）。
  function start(seed, people, m) {
    m = m || meta();
    const run = {
      v: 2, seed, sector: 0, depth: 0, roomNo: 0, data: 25 * perkLv(m, 'stash'), rerolls: perkLv(m, 'reroll'),
      squad: people.slice(0, SQUAD).map((p) => memberOf(p)), active: 0, gear: null,
      build: { exploits: {}, extra: { maxHp: 8 * perkLv(m, 'hp'), bwMax: perkLv(m, 'bw'), focusMul: perkLv(m, 'focus') ? 1.2 : 1 } },
      node: null, options: [], phase: 'route',
      seen: [], shops: {}, cells: {}, held: (m.roster || []).filter((x) => x.status === 'held').length,
      lost: [], revived: false, bailUsed: false, curse: null, kit: perkLv(m, 'kit'), insight: perkLv(m, 'insight'), pending: null, shop: null, event: null, notes: [],
      stats: { kills: 0, hacks: 0, takedowns: 0, silent: 0, rooms: 0, hurt: 0, bosses: 0, rescued: 0, captured: 0 },
      rng: E.rng.hash(seed + ':s3:run'),
    };
    run.squad.forEach((mem, i) => { mem.hp = maxHp(run, i); run.rerolls += statsOf(run, i).fl.reroll || 0; });
    route(run);
    return run;
  }

  // ===== 路線：下一批門 =====
  // 門只看（種子、區段、第幾間）和當下的狀態，不吃這一趟的亂數：這樣進房間的時候就能先知道打完會有幾扇門。
  function route(run) {
    const r = E.rng.derive(run.seed, 'route', run.sector, run.depth, run.roomNo), sec = D().sectors[run.sector];
    const roomNo = run.roomNo + 1;
    let opts;
    if (run.depth >= sec.rooms) opts = [{ type: 'boss', reward: 'boss', mod: null }];
    else {
      const n = run.roomNo === 0 ? 2 : r.chance(0.55) ? 3 : 2;
      const last = run.depth === sec.rooms - 1;
      const cellsOpen = run.depth >= 1 && !(run.cells || {})[run.sector];
      opts = [];
      for (let i = 0; i < n; i++) {
        let type = 'fight';
        if (run.depth > 0) {
          type = r.weighted({
            fight: 55, elite: run.depth >= 2 ? 16 : 0, event: 14,
            shop: run.shops[run.sector] ? 3 : run.depth >= 2 ? 22 : 0,
            safe: last ? 30 : run.depth >= 3 ? 8 : 0,
            cells: cellsOpen ? (run.held ? 22 : 8) : 0,
          });
        }
        if (type !== 'fight' && type !== 'elite' && opts.some((o) => o.type === type)) type = 'fight';
        opts.push({ type });
      }
      // 每個區段中段保證看得到一次黑市；首領前保證有安全屋；有人被關的話，每個區段保證有一次拘留室；至少有一扇門是戰鬥。
      if (run.depth === 2 && !run.shops[run.sector] && !opts.some((o) => o.type === 'shop')) opts[opts.length - 1] = { type: 'shop' };
      if (run.depth === 3 && run.held && cellsOpen && !opts.some((o) => o.type === 'cells')) opts[opts.length - 1] = { type: 'cells' };
      if (last && !opts.some((o) => o.type === 'safe')) opts[opts.length - 1] = { type: 'safe' };
      if (!opts.some((o) => o.type === 'fight' || o.type === 'elite')) opts[0] = { type: 'fight' };
      for (const o of opts) {
        if (o.type === 'cells') { o.reward = 'rescue'; o.mod = null; continue; }
        if (o.type !== 'fight' && o.type !== 'elite') continue;
        o.reward = r.weighted(REWARD_WEIGHT[o.type]);
        const pool = Object.keys(D().mods).filter((id) => (D().mods[id].from || 0) <= roomNo);
        o.mod = r.chance(o.type === 'elite' ? 0.3 : 0.42) ? r.weighted(pool, (id) => D().mods[id].w) : null;
      }
      if (run.curse) { const f = opts.find((o) => o.type === 'fight' || o.type === 'elite'); f.mod = run.curse; }
    }
    run.options = opts;
    run.phase = 'route';
    return opts;
  }
  const isRoom = (node) => node.type === 'fight' || node.type === 'elite' || node.type === 'boss' || node.type === 'cells';

  // 走進第 i 扇門。戰鬥類的門回傳房間的 spec（交給 sim.createRoom）；其他的回傳 null，畫面看 run.phase。
  function enter(run, i) {
    const node = run.options[i] || run.options[0];
    run.node = node;
    run.roomNo++;
    if (isRoom(node)) {
      if (node.mod && node.mod === run.curse) run.curse = null;
      if (node.type === 'cells') run.cells[run.sector] = 1;
      run.phase = 'room';
      return spec(run);
    }
    if (node.type === 'shop') { run.shops[run.sector] = 1; run.shop = stock(run); run.phase = 'shop'; }
    else if (node.type === 'safe') { run.phase = 'safe'; bail(run); }
    else if (node.type === 'event') { run.event = pickEvent(run); run.phase = 'event'; }
    return null;
  }
  // 目前這個房間的 spec。門的數量要先知道，所以先算一次打完之後的那一批門。
  function spec(run) {
    const sec = D().sectors[run.sector], boss = run.node.type === 'boss';
    let doors = 1;
    if (!(boss && run.sector >= D().sectors.length - 1)) {
      const cells = Object.assign({}, run.cells);
      doors = route({ seed: run.seed, sector: boss ? run.sector + 1 : run.sector, depth: boss ? 0 : run.depth + 1, roomNo: run.roomNo, shops: run.shops, cells, held: run.held, curse: run.curse }).length;
    }
    return S3.gen.room(run.seed, run.sector, Math.min(run.depth, sec.rooms - 1), run.roomNo, run.node, doors);
  }

  // ===== 治療、保釋 =====
  // 治療是全隊的：還在的每個人都回 n（n 小於 1 就當成比例）。
  function heal(run, n) {
    for (const i of alive(run)) {
      const mem = run.squad[i], top = maxHp(run, i);
      mem.hp = Math.min(top, mem.hp + (n < 1 ? Math.round(top * n) : n));
    }
  }
  // 律師的專長：到安全屋或打完首領時，把一個倒下的隊友保出來（每趟一次）。
  function bail(run) {
    if (run.bailUsed || !hasJob(run, 'bail')) return false;
    const i = run.squad.findIndex((m) => m.down);
    if (i < 0) return false;
    run.bailUsed = true;
    run.squad[i].down = false;
    run.squad[i].hp = Math.round(maxHp(run, i) * 0.5);
    run.notes.push({ k: 'bail', i });
    return true;
  }
  // 全隊的體力上限變了（拿到防彈背心之類），每個人的體力跟著調整。
  function withMaxHp(run, change) {
    const before = run.squad.map((m, i) => maxHp(run, i));
    change();
    run.squad.forEach((m, i) => {
      const after = maxHp(run, i);
      if (!m.down) m.hp = Math.max(1, Math.min(after, m.hp + Math.max(0, after - before[i])));
    });
  }

  // ===== 房間打完 =====
  // 把房間的結果記回這一趟，回傳獎勵：{ kind, picks?, n?, bonus }。全隊都倒了回傳 null。
  function finishRoom(run, s) {
    const st = run.stats;
    st.kills += s.stats.kills; st.hacks += s.stats.hacks; st.takedowns += s.stats.takedowns; st.hurt += s.stats.hurt;
    if (s.usedRevive) { run.revived = true; delete run.build.exploits.secondwind; }
    S3.sim.teamState(s).forEach((t, i) => {
      const mem = run.squad[i];
      if (t.down && !mem.down) st.captured++;
      mem.down = t.down; mem.hp = t.hp; mem.escaped = t.escaped;
    });
    if (s.over === 'dead' || !alive(run).length) { run.phase = 'dead'; return null; }
    run.active = run.squad[s.active].down ? alive(run)[0] : s.active;
    st.rooms++;
    let bonus = 0;
    if (s.silent && !s.spec.boss) { st.silent++; bonus = 10 + Math.round(s.gain * 0.5); }
    if (run.node.type === 'elite') bonus += 25;
    run.data += s.gain + bonus;
    // 每間打完的回復：急救訓練、樂天的人、護理師。
    for (const i of alive(run)) {
      const fl = statsOf(run, i).fl;
      if (fl.roomHeal) run.squad[i].hp = Math.min(maxHp(run, i), run.squad[i].hp + 6 * fl.roomHeal);
    }
    if (hasJob(run, 'nurse')) heal(run, 3);
    const r = rngOf(run), stat = statsOf(run, run.active).st;
    let reward;
    const kind = run.node.reward;
    if (kind === 'boss') {
      st.bosses++;
      heal(run, 0.1);
      bail(run);
      reward = { kind: 'exploit', picks: draft(run, r, 3 + insightOf(run), 'boss'), boss: true };
    } else if (kind === 'rescue') reward = { kind: 'rescue' };
    else if (kind === 'exploit') reward = { kind, picks: draft(run, r, 3 + insightOf(run), run.node.type === 'elite' ? 'elite' : 'fight') };
    else if (kind === 'gadget') reward = { kind, picks: draftGadgets(run, r, 3) };
    else if (kind === 'data') reward = { kind, n: Math.round((35 + 4 * run.roomNo) * stat.dataMul) };
    else if (kind === 'heal') reward = { kind, n: 0.2 };
    else reward = { kind: 'max', n: 12 };
    if (reward.picks && !reward.picks.length) reward = { kind: 'data', n: 40 };
    reward.bonus = bonus;
    reward.silent = s.silent && !s.spec.boss;
    keep(run, r);
    run.pending = reward;
    run.phase = 'reward';
    return reward;
  }

  // 抽 n 個還沒疊滿的漏洞：稀有度看房間種類，已經有同一類的會稍微容易抽到（比較容易成套）。
  function draft(run, r, n, source, minRar) {
    const w = D().rarityWeight[source] || D().rarityWeight.fight;
    const own = run.build.exploits, tags = {};
    for (const x of D().exploits) if (own[x.id]) tags[x.tag] = 1;
    const pool = D().exploits.filter((x) => (own[x.id] || 0) < x.max && !(x.id === 'secondwind' && run.revived) && (!minRar || (minRar === 'u' ? x.rar !== 'c' : x.rar === 'r')));
    const out = [];
    while (out.length < n && pool.length) {
      const x = r.weighted(pool, (o) => (minRar ? 1 : w[o.rar]) * (tags[o.tag] ? 1.4 : 1) + 0.001);
      out.push(x.id);
      pool.splice(pool.indexOf(x), 1);
    }
    return out;
  }
  // 裝備：每個隊員有自己的一件（Q），全隊另外共用一件撿來的（E）。
  const gadgetOwner = (run, id) => run.squad.find((m) => m.gadget.id === id) || (run.gear && run.gear.id === id ? { gadget: run.gear } : null);
  function draftGadgets(run, r, n) {
    const pool = Object.keys(D().gadgets).filter((id) => { const o = gadgetOwner(run, id); return !o || o.gadget.lv < 3; });
    return r.shuffle(pool).slice(0, n);
  }
  function addExploit(run, id) {
    const def = exploitDef(id), own = run.build.exploits;
    if (!def || (own[id] || 0) >= def.max) { run.data += 30; return false; }
    withMaxHp(run, () => { own[id] = (own[id] || 0) + 1; });
    return true;
  }
  // 拿一件裝備：隊上已經有同一件（誰的都算）就升級；不然放進共用的那一格（原本有東西就換掉）。
  function addGadget(run, id) {
    const o = gadgetOwner(run, id);
    if (o) o.gadget.lv = Math.min(3, o.gadget.lv + 1);
    else run.gear = { id, lv: 1 };
  }

  // 領獎勵。choice：漏洞或裝備的 id（不拿就給 null，換成 15 資料）。
  function take(run, choice) {
    const rw = run.pending;
    if (!rw) return;
    if (rw.kind === 'exploit') { if (choice && rw.picks.includes(choice)) addExploit(run, choice); else run.data += 15; }
    else if (rw.kind === 'gadget') { if (choice && rw.picks.includes(choice)) addGadget(run, choice); else run.data += 15; }
    else if (rw.kind === 'data') run.data += rw.n;
    else if (rw.kind === 'heal') heal(run, rw.n);
    else if (rw.kind === 'max') withMaxHp(run, () => { run.build.extra.maxHp += rw.n; });
    run.pending = null;
    if (rw.then) { run.phase = rw.then; return; }
    run.phase = 'doors';
  }
  // 重抽獎勵（漏洞或裝備）。
  function reroll(run) {
    const rw = run.pending;
    if (!rw || !rw.picks || run.rerolls <= 0) return false;
    run.rerolls--;
    const r = rngOf(run);
    rw.picks = rw.kind === 'gadget' ? draftGadgets(run, r, 3) : draft(run, r, rw.picks.length, rw.boss ? 'boss' : run.node && run.node.type === 'elite' ? 'elite' : 'fight', rw.min);
    keep(run, r);
    return true;
  }

  // ===== 拘留室：救人 =====
  // 名冊裡有人被關，就救出最早被關的那一個；沒有的話，救出來的是名單上的陌生人，願意加入。
  // 小隊有人倒下的話，救出來的人直接補上那個位置（六成體力）。回傳 { p, known 是不是自己人, joined 有沒有補進小隊, full 名冊滿了 }。
  function rescue(run, m) {
    const rw = run.pending;
    if (!rw || rw.kind !== 'rescue') return null;
    const held = m ? m.roster.find((x) => x.status === 'held') : null;
    let p, known = false, full = false;
    if (held) { held.status = 'ready'; p = held.p; known = true; run.held = Math.max(0, run.held - 1); }
    else {
      p = findPeople(run.seed, 'cell' + run.roomNo, 1, run.squad.map((x) => x.p).concat(m ? m.roster.map((x) => x.p) : []))[0];
      if (m) { if (m.roster.length < rosterMax(m)) m.roster.push({ p, status: 'ready', runs: 0 }); else full = true; }
    }
    if (m) { m.rescued = (m.rescued || 0) + 1; saveMeta(m); }
    run.stats.rescued++;
    const slot = run.squad.findIndex((x) => x.down);
    let joined = false;
    if (slot >= 0 && !full) {
      run.lost.push(run.squad[slot].p); // 被換下來的人還是被抓走了，結算時要記進名冊
      run.squad[slot] = memberOf(p);
      run.squad[slot].hp = Math.round(maxHp(run, slot) * 0.6);
      joined = true;
    } else if (full) run.data += 40;
    run.pending = null;
    run.phase = 'doors';
    return { p, known, joined, full, slot };
  }

  // 這個節點結束，往下走：下一批門、下一個區段，或是打贏了。
  function advance(run) {
    const wasBoss = run.node && run.node.type === 'boss';
    run.node = null;
    run.shop = null;
    run.event = null;
    if (wasBoss) {
      if (run.sector >= D().sectors.length - 1) { run.phase = 'won'; return 'won'; }
      run.sector++;
      run.depth = 0;
      if (run.kit) heal(run, 15);
    } else run.depth++;
    route(run);
    return run.phase;
  }

  // ===== 黑市 =====
  function stock(run) {
    const r = rngOf(run), P = D().price;
    // 價格看隊上最會講價的人；越後面的區段，東西越貴（手上的資料也越多）。
    const mul = Math.min(...alive(run).map((i) => statsOf(run, i).st.priceMul));
    const cost = (n) => Math.max(1, Math.round(n * mul * (1 + 0.35 * run.sector)));
    const items = draft(run, r, 3, 'shop').map((id) => ({ k: 'exploit', id, price: cost(P[exploitDef(id).rar]) }));
    const g = draftGadgets(run, r, 1)[0];
    if (g) items.push({ k: 'gadget', id: g, price: cost(P.gadget) });
    items.push({ k: 'heal', n: 20, price: cost(P.heal) });
    keep(run, r);
    return { items, reroll: cost(P.reroll) };
  }
  const hurtSomeone = (run) => alive(run).some((i) => run.squad[i].hp < maxHp(run, i));
  function buy(run, i) {
    const it = run.shop && run.shop.items[i];
    if (!it || it.sold || run.data < it.price) return false;
    if (it.k === 'heal' && !hurtSomeone(run)) return false;
    run.data -= it.price;
    it.sold = true;
    if (it.k === 'exploit') addExploit(run, it.id);
    else if (it.k === 'gadget') addGadget(run, it.id);
    else heal(run, it.n);
    return true;
  }
  function restock(run) {
    if (!run.shop || run.data < run.shop.reroll) return false;
    run.data -= run.shop.reroll;
    const price = run.shop.reroll + 10;
    run.shop = stock(run);
    run.shop.reroll = price;
    return true;
  }

  // ===== 安全屋 =====
  // rest 休息、tune 調校（挑一個少見以上的漏洞）、train 擴充頻寬。
  function safe(run, choice) {
    if (choice === 'rest') heal(run, 0.25);
    else if (choice === 'train') run.build.extra.bwMax += 1;
    else if (choice === 'tune') {
      const r = rngOf(run);
      const picks = draft(run, r, 2 + insightOf(run), 'elite', 'u');
      keep(run, r);
      if (picks.length) { run.pending = { kind: 'exploit', picks, min: 'u', then: 'done' }; run.phase = 'reward'; return; }
      run.data += 40;
    }
    run.phase = 'done';
  }

  // ===== 事件 =====
  function pickEvent(run) {
    const r = rngOf(run);
    const pool = D().events.filter((e) => !(e.once && run.seen.includes(e.id)) && !(run.seen[run.seen.length - 1] === e.id));
    const ev = r.pick(pool.length ? pool : D().events);
    run.seen.push(ev.id);
    keep(run, r);
    return { id: ev.id, result: null };
  }
  const eventDef = (id) => D().events.find((e) => e.id === id);
  function canChoose(run, i) {
    const c = eventDef(run.event.id).choices[i];
    return !!c && (!c.cost || run.data >= c.cost);
  }
  // 選事件的第 i 個選項。回傳 { key 結果文字的 key、fx 發生了什麼 }。
  function choose(run, i) {
    const def = eventDef(run.event.id), c = def.choices[i];
    if (!canChoose(run, i)) return null;
    if (c.cost) run.data -= c.cost;
    let fx = c.fx, tail = '';
    if (c.roll) {
      const r = rngOf(run), x = r.next();
      const hit = c.roll.find((o) => x < o[0]) || c.roll[c.roll.length - 1];
      fx = hit[1];
      tail = '.' + hit[2];
      keep(run, r);
    }
    const got = applyFx(run, fx || {});
    run.event.result = { key: 's3.ev.' + def.id + '.r' + i + tail, fx: got };
    if (run.phase !== 'reward') run.phase = 'done';
    return run.event.result;
  }
  // 事件的效果。治療是全隊的；受傷算在場上那個人身上（不會因此倒下）。
  function applyFx(run, fx) {
    const out = Object.assign({}, fx);
    if (fx.data) run.data += fx.data;
    if (fx.heal) heal(run, fx.heal);
    if (fx.hurt) { const me = run.squad[run.active]; me.hp = Math.max(1, me.hp - fx.hurt); }
    if (fx.maxHp) withMaxHp(run, () => { run.build.extra.maxHp += fx.maxHp; });
    if (fx.maxBw) run.build.extra.bwMax += fx.maxBw;
    if (fx.rerolls) run.rerolls += fx.rerolls;
    if (fx.gadget) addGadget(run, fx.gadget);
    if (fx.exploit) addExploit(run, fx.exploit);
    if (fx.curse) run.curse = fx.curse;
    if (fx.draft) {
      const r = rngOf(run);
      const picks = draft(run, r, 3, 'elite', fx.draft);
      keep(run, r);
      if (picks.length) { run.pending = { kind: 'exploit', picks, min: fx.draft, then: 'done' }; run.phase = 'reward'; } else run.data += 40;
    }
    if (fx.recompile) {
      // Bagley 重新編譯：順利的話，兩個常見的漏洞換成少見的；出錯就掉一層。
      const r = rngOf(run), own = run.build.exploits;
      const ids = r.shuffle(Object.keys(own));
      out.lost = []; out.got = [];
      withMaxHp(run, () => {
        if (fx.recompile > 0) {
          for (const id of ids.filter((x) => exploitDef(x).rar === 'c').slice(0, 2)) {
            if (--own[id] <= 0) delete own[id];
            out.lost.push(id);
            const pick = draft(run, r, 1, 'elite', 'u')[0];
            if (pick) { own[pick] = (own[pick] || 0) + 1; out.got.push(pick); }
          }
          if (!out.lost.length) { run.data += 30; out.data = 30; }
        } else if (ids.length) {
          if (--own[ids[0]] <= 0) delete own[ids[0]];
          out.lost.push(ids[0]);
        }
      });
      keep(run, r);
    }
    return out;
  }

  // ===== 結束：算殘響，更新名冊 =====
  // 倒下的隊員被關進基石（打通的話，所有被關的人都放出來）。回傳 { earned, meta, captured: [路人], freed: 幾個人 }。
  function finish(run, won, m) {
    m = m || meta();
    const earned = run.stats.rooms + 5 * run.stats.bosses + 2 * run.stats.rescued + (won ? 15 : 0);
    m.echoes += earned;
    m.runs++;
    if (won) m.wins++;
    m.best = Math.max(m.best, run.roomNo);
    const captured = [];
    const entryOf = (p) => (m.roster || []).find((x) => same(x.p, p));
    for (const mem of run.squad) {
      const entry = entryOf(mem.p);
      if (entry) entry.runs++;
      if (mem.down && !won) { captured.push(mem.p); if (entry) entry.status = 'held'; }
    }
    if (!won) for (const p of run.lost || []) { captured.push(p); const entry = entryOf(p); if (entry) entry.status = 'held'; }
    let freed = 0;
    if (won) for (const x of m.roster || []) if (x.status === 'held') { x.status = 'ready'; freed++; }
    m.rescued = (m.rescued || 0) + freed;
    m.vol = (m.vol || 0) + 1;
    saveMeta(m);
    RUN.clear();
    return { earned, meta: m, captured, freed };
  }

  S3.run = {
    SQUAD, ROSTER_MAX, RECRUIT_COST, rosterMax,
    meta, saveMeta, perkLv, buyPerk, inherit, ensureRoster, volunteers, recruit, dismiss, crewFor, memberOf, buildOf, simBuild, statsOf, alive,
    start, route, enter, spec, carry, finishRoom, take, reroll, rescue, advance, bail, heal,
    buy, restock, safe, choose, canChoose, finish, addExploit, addGadget, maxHp, exploitDef, eventDef, hurtSomeone, isRoom,
    save(run) { RUN.write(run); },
    load() { return RUN.read(); },
    clear() { RUN.clear(); },
  };
})(window.ECHO = window.ECHO || {});
