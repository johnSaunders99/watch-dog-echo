// 第二季的戰術地圖：夜間行動的另一種玩法（俯視、回合制的潛入）。
// 一張 15×11 的格子地圖（content-s2/maps.js）：牆、地板、暗處、圍欄、上鎖的門、藏身處、目標、撤離點。
// 每個隊員一回合有兩個行動點：移動一次（三格左右）或用一個能力各花一點。按「結束回合」之後，守衛、攝影機、無人機才會動。
// 能力來自這個人的類別、專長、特質、弱點和小習慣：駭客遠端駭門、攝影機和無人機（目標還是要走到旁邊）；身體類翻圍欄、制伏守衛、撞門；
// 社交類搭話引開守衛、偽裝；專長各有一手（鎖匠撬鎖、護理師急救、司機叫車）。沒有對應的人也能硬來，只是更慢、更吵。
// 每個特質是一張招式卡，在地圖上每次行動能用一次（叫人、順手牽羊、打氣……）；稀有人物的專長是地圖上的王牌（信鴿、地下電台……）。
// 守衛犬靠鼻子：暗處、藏身處、偽裝都騙不過牠，但牠不會抓人，只會叫，把附近的守衛引過來。
// 被看到會增加警戒（沿用夜間行動的警戒）：警戒 30 會來增援，60 以上無人機會開火，滿了就有人被捕；被守衛追上也會被捕。
// 每次潛入可能遇到一種特殊狀況（大霧、大雨、停電演練、換班、散場人潮……，content-s2/maps.js 的 mapEvents），在 build 時套上。
// 隊友事件送的天賦也在這裡：扳手的謝爾蓋（召喚小無人機）、Darcy 教的無聲腳步；朋友在旁邊時，會把被追上的人拉開一次。
// 狀態全部放在 s.op.tac，可以直接存檔。這裡不碰隊伍和結算，需要的時候都經由夜間引擎傳進來的 api。
(function (E) {
  const AP = 2;
  const MOVE = 3;
  const STAND = '.,dXSHE';   // 人可以站的格子
  const OPAQUE = '#D';        // 擋住視線的格子
  const OBJ = 'TPF';          // 目標（終端、控制箱、天線、被關的人、要燒的檔案）
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SPOT = { guard: 8, cam: 5, drone: 6, dog: 6 }; // 被看到時增加的警戒（比擲骰失敗的代價小：親自指揮不該比快速結算難）
  const UNLOCKS = ['lockpick', 'master_keys', 'site_pass', 'building_access']; // 開得了鎖的專長
  const BICKER = 0.12; // 德比戰、死對頭：每回合吵起來的機率

  const tile = (t, x, y) => (x < 0 || y < 0 || x >= t.w || y >= t.h ? '#' : t.map[y][x]);
  const setTile = (t, x, y, c) => { t.map[y] = t.map[y].slice(0, x) + c + t.map[y].slice(x + 1); };
  const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
  const manh = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
  const key = (x, y) => x + ',' + y;
  const live = (t) => t.units.filter((u) => !u.out && !u.taken);
  const active = (f) => !f.down && !(f.off > 0) && !(f.loop > 0) && f.state !== 'distracted';

  // ===== 建立地圖 =====
  // o：{ map, obj（T 格的目標種類；'none' 代表這一段只要穿過去）, ids（出發的隊員）, rank（第幾區，越後面守衛越多）, limit（限時行動：有的話改用地圖的 turns）,
  //      escort（被救的人）, intel, event（特殊狀況的 id）, rng（擺放特殊狀況用的亂數） }
  function build(o) {
    const tpl = E.s2.maps[o.map];
    const t = {
      map: o.obj === 'none' ? tpl.rows.map((r) => r.replace(/T/g, '.')) : tpl.rows.slice(), mapId: o.map, theme: tpl.theme || 'site', w: tpl.rows[0].length, h: tpl.rows.length, turn: 1, limit: o.limit ? tpl.turns || o.limit : null,
      keys: tpl.keys !== false, units: [], foes: [], objs: [], used: {}, seen: {}, locks: {}, spotted: {}, undo: null, intel: !!o.intel, escort: o.escort || null, spawns: [], keycard: false,
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
      if (g.face) f.face = g.face.slice(); // 站崗的守衛面向哪裡
      t.foes.push(f);
    }
    for (const d of tpl.drones || []) if ((d.minRank || 0) <= o.rank) t.foes.push({ id: 'd' + n++, kind: 'drone', x: d.route[0][0], y: d.route[0][1], face: [1, 0], route: d.route, ri: 1, state: 'patrol', timer: 0, loop: 0, down: false });
    for (const c of tpl.cams || []) if ((c.minRank || 0) <= o.rank) t.foes.push({ id: 'c' + n++, kind: 'cam', x: c.x, y: c.y, face: c.faces[0], faces: c.faces, fi: 0, off: 0, down: false, state: 'patrol' });
    for (const d of tpl.dogs || []) if ((d.minRank || 0) <= o.rank) t.foes.push(Object.assign(guard(t, 'k' + n++, d.route), { kind: 'dog' }));
    if (o.event) applyEvent(t, o.event, o.rng || E.rng.create(o.map + ':' + o.event));
    return t;
  }

  // ===== 特殊狀況 =====
  // 大霧、大雨在看和聽的時候算（inView、noise）；換班在 endTurn；其他的在這裡直接改地圖和敵人。
  function applyEvent(t, id, r) {
    t.event = id;
    // 可以擺東西的空地：不在出發點、撤離點和敵人旁邊。
    const open = () => {
      const out = [];
      for (let y = 1; y < t.h - 1; y++) {
        for (let x = 1; x < t.w - 1; x++) {
          if (t.map[y][x] !== '.') continue;
          const close = (c) => [[0, 0]].concat(DIRS).some(([dx, dy]) => tile(t, x + dx, y + dy) === c);
          if (close('S') || close('X') || close('E') || t.foes.some((f) => f.x === x && f.y === y)) continue;
          out.push([x, y]);
        }
      }
      return out;
    };
    if (id === 'drill') for (const f of t.foes) if (f.kind === 'cam') f.off = 3;
    if (id === 'crowd' || id === 'trolley') for (const [x, y] of r.shuffle(open()).slice(0, id === 'crowd' ? 3 : 1)) setTile(t, x, y, 'H');
    if (id === 'kennel' && !t.foes.some((f) => f.kind === 'dog')) {
      const g = t.foes.find((f) => f.kind === 'guard' && f.route.length > 1);
      if (g) t.foes.push(Object.assign(guard(t, 'k' + t.foes.length, g.route.slice().reverse()), { kind: 'dog' }));
    }
    if (id === 'sweep') {
      const y = Math.floor(t.h / 2);
      t.foes.push({ id: 'd' + t.foes.length, kind: 'drone', x: t.w - 3, y, face: [-1, 0], route: [[t.w - 3, y], [2, y]], ri: 1, state: 'patrol', timer: 0, loop: 0, down: false });
    }
    if (id === 'echo') t.intel = true;
  }

  // 出發前：上夜班的人第一回合多一個行動點；過目不忘、酒保在隊上，看得到巡邏路線。
  function prepare(s, api) {
    const t = s.op.tac;
    for (const u of t.units) {
      if (u.escort) continue;
      if (api.quirks(s, u.id).includes('night_shift')) { u.ap = AP + 1; api.say(s, 'card', 'tac.log.nightShift', { name: api.name(s, u.id) }); }
      // 白天忙了一整天：第一回合少一個行動點。
      if (api.tired && api.tired(s, u.id)) { u.ap--; api.say(s, 'warn', 'tac.log.tired', { name: api.name(s, u.id) }); }
      if (!t.intel && caps(s, api, u.id).intel) { t.intel = true; api.say(s, 'card', 'tac.log.intelMemory', { name: api.name(s, u.id) }); }
    }
  }

  function guard(t, id, route, state) {
    return { id, kind: 'guard', x: route[0][0], y: route[0][1], face: [1, 0], route, ri: route.length > 1 ? 1 : 0, state: state || 'patrol', timer: 0, target: null, down: false };
  }

  // 一個空的鄰格（給多出來的人、被救出來的人、叫來的人用）。ok 可以再篩選，例如「沒有人看得到的格子」。
  function near(t, x, y, ok = () => true) {
    for (let r = 1; r < 4; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (STAND.includes(tile(t, nx, ny)) && tile(t, nx, ny) !== 'X' && !occupied(t, nx, ny) && ok(nx, ny)) return [nx, ny];
        }
      }
    }
    return null;
  }

  // 守衛和狗會擋路；倒下的守衛和交上朋友的狗不擋。
  function occupied(t, x, y, ignore) {
    return live(t).some((u) => u !== ignore && u.x === x && u.y === y)
      || t.foes.some((f) => f !== ignore && (f.kind === 'guard' || f.kind === 'dog') && !f.down && f.x === x && f.y === y);
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
    if (f.kind === 'drone') return cheb(f.x, f.y, x, y) <= 2 + bonus - (t.event === 'rain' ? 1 : 0); // 大雨：無人機看不清楚
    const dx = x - f.x, dy = y - f.y;
    if (dx === 0 && dy === 0) return false;
    // 狗用鼻子：四面八方兩格（隔著牆聞不到）。
    if (f.kind === 'dog') return manh(f.x, f.y, x, y) <= 2 + bonus && los(t, f.x, f.y, x, y);
    const range = (f.kind === 'cam' ? 5 : f.state === 'alert' ? 5 : 4) + bonus - (t.event === 'fog' ? 1 : 0); // 大霧：少看一格
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

  // 敵人有沒有發現某個人：暗處、藏身處、偽裝都只在貼身時才會被看到。狗例外：靠鼻子，躲哪裡都聞得到。
  function spots(s, api, f, u) {
    const t = s.op.tac;
    if (!active(f) || u.out || u.taken) return false;
    const fl = api.flaw(s, u.id), tr = api.traits(s, u.id), q = api.quirks(s, u.id);
    if (f.kind === 'dog') return !q.includes('dogs_love') && inView(t, f, u.x, u.y, q.includes('dogs_fear') ? 1 : 0);
    // 毫不起眼、有前科改變守衛和攝影機的距離；賞鳥的人知道怎麼在天上的眼睛底下不動。
    const soft = (api.gifts(s, u.id) || []).includes('quietstep');
    const bonus = f.kind === 'drone' ? (q.includes('birdwatcher') ? -1 : 0) : (tr.includes('unremarkable') || soft ? -1 : 0) + (fl === 'record' ? 1 : 0);
    if (!inView(t, f, u.x, u.y, bonus)) return false;
    const adjacent = cheb(f.x, f.y, u.x, u.y) <= 1;
    const c = tile(t, u.x, u.y);
    if (c === 'H') return adjacent && f.kind === 'guard';
    if (c === ',' && f.kind !== 'drone' && (!adjacent || tr.includes('nightowl'))) return false;
    if ((u.disguise > 0 || u.ghost > 0) && !adjacent) return false;
    // 夜班清潔工：守衛和攝影機看到也只當是打掃的人。
    if (api.perk(s, u.id) === 'master_keys' && f.kind !== 'drone' && !adjacent) return false;
    return true;
  }

  // ===== 能力 =====
  // 一個人在戰術地圖上會什麼：由類別、專長、特質、弱點、小習慣決定。src 是給畫面顯示的「為什麼會」。
  function caps(s, api, id) {
    // 被救出來的人只能移動（被關了好幾天，走不快）。
    const t = s.op.tac;
    const unit = t.units.find((x) => x.id === id);
    if (unit && unit.escort) return { move: MOVE - 1, escort: true, list: [] };
    const cat = api.category(s, id), perk = api.perk(s, id), tr = api.traits(s, id), fl = api.flaw(s, id), q = api.quirks(s, id);
    const skills = api.person(s, id).skills;
    const has = (x) => tr.includes(x);
    const hq = (x) => q.includes(x);
    const gifts = api.gifts(s, id) || [];
    const c = { cat, perk, list: [], gifts };
    // 騎單車通勤：目標都完成之後，騎車走人。
    c.bike = hq('cyclist') && !objsLeft(t);
    c.move = MOVE + (has('fast') ? 1 : 0) + (hq('marathon') ? 1 : 0) + (perk === 'sprint' ? 1 : 0) + (perk === 'rooftops' ? 2 : 0) + (c.bike ? 2 : 0) - (fl === 'bad_knees' ? 1 : 0);
    c.hack = cat === 'hacker' || skills.hack >= 2 || ['take_over', 'legacy', 'backdoor', 'botnet', 'network_access', 'broadcast'].includes(perk);
    // 駭入距離四格（還要看得到）：地圖變大之後，駭客也得走進去，不能站在出發點把整張圖駭完。
    c.hackRange = 4 + (perk === 'botnet' ? 2 : 0) + (hq('gamer') ? 1 : 0);
    c.remote = perk === 'legacy'; // 老系統全都連在一起：目標也能遠端駭
    c.climb = (cat === 'physical' || has('nimble') || ['climb', 'rooftops'].includes(perk)) && fl !== 'acrophobia';
    c.climbCost = perk === 'rooftops' ? 0 : fl === 'bad_knees' ? 2 : 1;
    c.takedown = cat === 'physical' || has('strong') || hq('ex_army');
    c.anyAngle = has('strong') || hq('ex_army') || perk === 'river_route';
    // 搭話：社交類、口才好、唱詩班，幾種會說話的專長；什麼都不會的人也可以請守衛喝杯茶。
    const talker = cat === 'social' || has('silver') || hq('choir') || ['distraction', 'smooth_talk', 'bail', 'gossip'].includes(perk);
    c.talk = talker || hq('tea');
    c.teaOnly = !talker && hq('tea');
    c.talkRange = 1 + (has('silver') ? 1 : 0) + (hq('choir') ? 1 : 0) + (perk === 'distraction' ? 3 : 0) + (perk === 'smooth_talk' ? 1 : 0);
    c.talkTurns = Math.max(1, (talker ? 2 : 1) + (has('silver') ? 1 : 0) + (perk === 'smooth_talk' ? 2 : 0) + (perk === 'gossip' ? 1 : 0)
      + (hq('mahjong') ? 1 : 0) + (talker && hq('tea') ? 1 : 0) + (hq('man_utd') || hq('liverpool') ? 1 : 0) - (fl === 'honest' ? 1 : 0));
    c.talkAlert = has('silver') || ['bail', 'smooth_talk'].includes(perk); // 連追過來的守衛都講得聽
    c.talkDrone = perk === 'distraction';                                   // 引來人群，連無人機也一起引開
    c.disguise = (cat === 'social' || perk === 'disguise') && fl !== 'honest';
    c.disguiseTurns = perk === 'disguise' ? 5 : 3;
    c.unlock = UNLOCKS.includes(perk) || t.keycard;
    c.needles = !c.unlock && hq('knitting'); // 毛線針撬鎖：慢，但安靜
    c.heal = perk === 'heal';
    c.cab = perk === 'getaway' || has('driver');
    c.strong = cat === 'physical' || has('strong');
    c.lift = perk === 'heavy_lift'; // 搬家工人：撞門、拆圍欄都很安靜
    c.quiet = has('careful') || gifts.includes('quietstep');
    c.sergei = gifts.includes('sergei');
    c.loud = fl === 'loudmouth';
    c.clumsy = fl === 'clumsy';
    c.dark = fl === 'dark';
    c.lost = fl === 'no_sense';
    c.slip = has('fast') || perk === 'sprint';
    c.intel = has('memory') || perk === 'gossip';
    return c;
  }

  // 打開了（或被抓了）之後還有沒有剩下沒完成的目標；被救的人要帶出去才算完成。
  const objsLeft = (t) => t.objs.some((o) => !o.done);

  // ===== 招式卡 =====
  // 地圖上的招式卡：每次行動用一次。src 是卡片從哪裡來（特質、專長、小習慣），key 是那個特質／專長／小習慣的 id。
  // 叫車、偽裝也算一張卡（本來就只能用一次）。搬家工人拆圍欄、愛狗的人摸狗不限次數，不算卡。
  const CARDS = {
    summon: { src: 'trait', key: 'connected' },
    code: { src: 'trait', key: 'memory' },
    ghost: { src: 'trait', key: 'unremarkable' },
    soothe: { src: 'trait', key: 'silver' },
    lift: { src: 'trait', key: 'nimble' },
    breach: { src: 'trait', key: 'strong' },
    boost: { src: 'trait', key: 'cheerful' },
    cover: { src: 'trait', key: 'careful' },
    cab: { src: 'trait', key: 'driver', perk: 'getaway' },
    disguise: { src: 'perk', key: 'disguise' },
    radio: { src: 'perk', key: 'pirate_radio' },
    pigeon: { src: 'perk', key: 'pigeon_post' },
    sergei: { src: 'gift', key: 'sergei' },
  };
  const usedCard = (t, ab, id) => (ab === 'cab' ? !!t.used.cab : ab === 'lift' ? t.keycard : !!t.used[ab + ':' + id]);

  // 一個人身上有哪些招式卡（不管現在能不能用），給畫面列出來：{ ab, used, ready }。
  function cards(s, api, id) {
    const t = s.op.tac;
    const u = t.units.find((x) => x.id === id);
    if (!u || u.escort) return [];
    const c = caps(s, api, id);
    const tr = api.traits(s, id);
    const ready = abilities(s, api, id).map((a) => a.id);
    const out = [];
    for (const ab of Object.keys(CARDS)) {
      const d = CARDS[ab];
      let mine = d.src === 'trait' ? tr.includes(d.key) || (d.perk && c.perk === d.perk) : d.src === 'gift' ? c.gifts.includes(d.key) : c.perk === d.key;
      if (ab === 'disguise') mine = c.disguise;
      if (ab === 'summon' && u.helper) mine = false; // 叫來的人不會再叫人
      if (ab === 'breach' && c.lift) mine = false;   // 搬家工人本來就能拆
      if (!mine) continue;
      out.push({ ab, used: usedCard(t, ab, id), ready: ready.includes(ab) });
    }
    return out;
  }

  // 某個人現在能用的能力，每個附上可以選的目標格。ap 是需要的行動點；card 表示是招式卡。
  function abilities(s, api, id) {
    const t = s.op.tac;
    const u = t.units.find((x) => x.id === id);
    if (!u || u.out || u.taken || u.ap <= 0) return [];
    const c = caps(s, api, id);
    if (c.escort) return [];
    const out = [];
    const tr = api.traits(s, id), q = api.quirks(s, id), perk = c.perk;
    const has = (x) => tr.includes(x);
    const once = (ab) => !t.used[ab + ':' + id];
    const self = [[u.x, u.y]];
    const push = (a) => { if (u.ap >= a.ap && a.targets.length) out.push(a); };
    const adj = DIRS.map(([dx, dy]) => [u.x + dx, u.y + dy]);
    const foesAt = (pred) => t.foes.filter((f) => !f.down && pred(f));
    const bw = api.bw(s);
    // 老系統不花頻寬；後門每次行動一次免費；內網權限在辦公室裡不花頻寬。
    const hackCost = perk === 'legacy' || (perk === 'backdoor' && once('backdoor')) || (perk === 'network_access' && t.theme === 'office') ? 0 : 1;
    if (c.hack && bw >= hackCost) {
      const inRange = (x, y) => manh(u.x, u.y, x, y) <= c.hackRange && los(t, u.x, u.y, x, y);
      const targets = []
        .concat(foesAt((f) => f.kind === 'cam' && !(f.off > 0) && inRange(f.x, f.y)).map((f) => [f.x, f.y]))
        .concat(foesAt((f) => f.kind === 'drone' && !(f.loop > 0) && inRange(f.x, f.y)).map((f) => [f.x, f.y]));
      for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
        const ch = tile(t, x, y);
        if ((ch === 'D' || (ch === 'd' && !t.keys)) && inRange(x, y)) targets.push([x, y]);
      }
      // 目標一般不能遠端駭：一定要有人走到旁邊。只有退休的 COBOL 工程師可以，老系統全都連在一起。
      if (c.remote) for (const o of t.objs) if (!o.done && ['terminal', 'box', 'antenna'].includes(o.kind) && inRange(o.x, o.y)) targets.push([o.x, o.y]);
      push({ id: 'hack', ap: 1, bw: hackCost, targets });
    }
    if (c.climb) {
      const targets = [];
      for (const [dx, dy] of DIRS) {
        const fx = u.x + dx, fy = u.y + dy, lx = u.x + 2 * dx, ly = u.y + 2 * dy;
        if (tile(t, fx, fy) === '=' && STAND.includes(tile(t, lx, ly)) && !occupied(t, lx, ly)) targets.push([fx, fy]);
      }
      push({ id: 'climb', ap: c.climbCost, targets });
    }
    if (c.takedown) {
      push({ id: 'takedown', ap: 1, targets: foesAt((f) => f.kind === 'guard' && manh(f.x, f.y, u.x, u.y) === 1 && (c.anyAngle || f.state === 'distracted' || !inFront(f, u))).map((f) => [f.x, f.y]) });
    }
    if (c.talk) {
      const inTalk = (f) => manh(f.x, f.y, u.x, u.y) <= c.talkRange && los(t, u.x, u.y, f.x, f.y);
      push({ id: 'talk', ap: 1, targets: foesAt((f) => inTalk(f) && ((f.kind === 'guard' && f.state !== 'distracted' && (f.state !== 'alert' || c.talkAlert))
        || (f.kind === 'drone' && c.talkDrone && !(f.loop > 0)))).map((f) => [f.x, f.y]) });
    }
    if (c.disguise && once('disguise')) push({ id: 'disguise', ap: 1, card: true, targets: self });
    const doors = adj.filter(([x, y]) => tile(t, x, y) === 'D');
    if (c.unlock || c.needles) push({ id: 'unlock', ap: c.unlock ? 1 : 2, targets: doors });
    push({ id: 'force', ap: c.strong || c.lift ? 1 : 2, targets: doors });
    if (c.heal) push({ id: 'heal', ap: 1, targets: live(t).filter((v) => api.hurt(s, v.id) && manh(v.x, v.y, u.x, u.y) <= 1).map((v) => [v.x, v.y]) });
    if (c.cab && !t.used.cab && tile(t, u.x, u.y) !== 'X') push({ id: 'cab', ap: 1, card: true, targets: self });
    // ----- 特質的招式卡 -----
    // 人脈廣：叫一個路人來幫忙（地圖上最多兩個），行動結束後可以直接招募。
    if (has('connected') && !u.helper && once('summon') && t.units.filter((v) => v.helper).length < 2 && near(t, u.x, u.y)) push({ id: 'summon', ap: 1, card: true, targets: self });
    // 過目不忘：記得在哪裡看過門禁密碼，看得到的一扇上鎖的門直接打開。
    if (has('memory') && once('code')) {
      const targets = [];
      for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (tile(t, x, y) === 'D' && manh(u.x, u.y, x, y) <= 6 && los(t, u.x, u.y, x, y)) targets.push([x, y]);
      push({ id: 'code', ap: 1, card: true, targets });
    }
    // 毫不起眼：這一回合和下一回合，沒有人會多看一眼（除非貼身）。
    if (has('unremarkable') && once('ghost')) push({ id: 'ghost', ap: 0, card: true, targets: self });
    // 口才好：把事情圓過去，警戒 −15，附近追過來的守衛回去巡邏。
    if (has('silver') && once('soothe') && (s.op.alert > 0 || t.foes.some((f) => f.kind === 'guard' && f.state === 'alert' && !f.down))) push({ id: 'soothe', ap: 1, card: true, targets: self });
    // 手很巧：從守衛身上摸走門卡（要從背後或側面，或對方正在聊天），全隊今晚刷卡開門。
    if (has('nimble') && !t.keycard) {
      push({ id: 'lift', ap: 1, card: true, targets: foesAt((f) => f.kind === 'guard' && f.state !== 'alert' && manh(f.x, f.y, u.x, u.y) === 1 && (f.state === 'distracted' || !inFront(f, u))).map((f) => [f.x, f.y]) });
    }
    // 力氣大：硬闖，扯開一段圍欄（會發出聲音）。搬家工人隨時都能拆，而且很安靜。
    if ((has('strong') && once('breach')) || c.lift) push({ id: 'breach', ap: 1, card: !c.lift, targets: adj.filter(([x, y]) => tile(t, x, y) === '=') });
    // 樂天：替兩格內的隊友打氣，這一回合每人多一個行動點。
    if (has('cheerful') && once('boost') && live(t).some((v) => v !== u && !v.escort && manh(v.x, v.y, u.x, u.y) <= 2)) push({ id: 'boost', ap: 0, card: true, targets: self });
    // 謹慎：留後路，在腳下佈置一個藏身處。
    if (has('careful') && once('cover') && '.,'.includes(tile(t, u.x, u.y))) push({ id: 'cover', ap: 1, card: true, targets: self });
    // ----- 稀有人物的王牌 -----
    // 地下電台：全區守衛的無線電都在播你的節目，兩回合什麼都聽不進去。
    if (perk === 'pirate_radio' && once('radio') && t.foes.some((f) => f.kind === 'guard' && !f.down && f.state !== 'distracted')) push({ id: 'radio', ap: 1, card: true, targets: self });
    // 信鴿：讓鴿子把隨身碟送進去，一個目標不用走過去就完成。
    if (perk === 'pigeon_post' && once('pigeon')) push({ id: 'pigeon', ap: 1, card: true, targets: t.objs.filter((o) => !o.done && !['prisoner', 'person'].includes(o.kind)).map((o) => [o.x, o.y]) });
    // ----- 天賦 -----
    // 扳手送的謝爾蓋：飛去六格內的守衛或攝影機（牆擋不住），附近的守衛盯著它看，攝影機關機。
    if (c.sergei && once('sergei')) push({ id: 'sergei', ap: 1, card: true, targets: foesAt((f) => (f.kind === 'guard' || (f.kind === 'cam' && !(f.off > 0))) && manh(f.x, f.y, u.x, u.y) <= 6).map((f) => [f.x, f.y]) });
    // ----- 小習慣 -----
    // 愛狗：蹲下來摸摸狗，牠就不叫了。
    if (q.includes('dogs_love')) push({ id: 'pet', ap: 1, targets: foesAt((f) => f.kind === 'dog' && manh(f.x, f.y, u.x, u.y) <= 1).map((f) => [f.x, f.y]) });
    // 目標：沒有對應的人也做得到，只是要兩個行動點，還會發出聲音。
    for (const o of t.objs.filter((v) => !v.done && manh(v.x, v.y, u.x, u.y) === 1)) push({ id: 'use', ap: interactCost(s, api, id, o, c), targets: [[o.x, o.y]], kind: o.kind });
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
  // 回傳 { best: { "x,y": { d 步數, e 經過幾格被看到的格子 } }, prev: { "步數|x,y": 上一格 } }。
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
          if (!STAND.includes(ch) || occupied(t, nx, ny, u) || (nx === u.x && ny === u.y)) continue;
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

  function snapshot(s) {
    const t = s.op.tac;
    const saved = Object.assign({}, t, { undo: null });
    return { tac: JSON.stringify(saved), alert: s.op.alert, bw: s.op.bw, hurt: JSON.stringify(s.op.hurt), step: s.step, log: s.log.length, temp: s.op.temp.length };
  }
  // 動作做完之後：有沒有發生撤回不了的事（擲了骰子、警戒變了、紀錄裡出現警告、叫了人來）。
  function settle(s, snap) {
    if (s.phase !== 'tac') return;
    const t = s.op.tac;
    const fresh = s.log.slice(snap.log);
    const clean = s.step === snap.step && s.op.alert === snap.alert && s.op.temp.length === snap.temp && !fresh.some((e) => e.c === 'warn' || e.c === 'bad');
    t.undo = clean ? snap : null;
  }
  function undo(s) {
    const t = s.op && s.op.tac;
    if (s.phase !== 'tac' || !t || !t.undo) return false;
    const snap = t.undo;
    s.op.tac = JSON.parse(snap.tac);
    s.op.alert = snap.alert;
    s.op.bw = snap.bw;
    s.op.hurt = JSON.parse(snap.hurt);
    s.log.length = Math.min(s.log.length, snap.log);
    return true;
  }

  function move(s, api, id, x, y) {
    const snap = snapshot(s);
    const done = doMove(s, api, id, x, y);
    if (done) settle(s, snap);
    return done;
  }

  function doMove(s, api, id, x, y) {
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
    if (t.event === 'rain') r = Math.max(1, r - 1); // 大雨蓋過了聲音
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
    const snap = s.phase === 'tac' && snapshot(s);
    const done = doUse(s, api, id, ab, x, y);
    if (done) settle(s, snap);
    return done;
  }

  function doUse(s, api, id, ab, x, y) {
    const t = s.op.tac;
    if (s.phase !== 'tac') return false;
    const u = t.units.find((v) => v.id === id);
    const a = abilities(s, api, id).find((v) => v.id === ab && v.targets.some(([tx, ty]) => tx === x && ty === y));
    if (!u || !a || u.ap < a.ap) return false;
    const c = caps(s, api, id);
    const perk = c.perk;
    const v = { name: api.name(s, id) };
    // 只有真的要擲骰子的時候才擲（擲過骰子的動作不能撤回）。
    let roll = null;
    const r = () => roll || (roll = api.rand(s));
    const loud = (radius) => { if (!c.quiet) noise(s, api, u.x, u.y, radius + (c.loud ? 2 : 0)); };
    u.ap -= a.ap;
    if (CARDS[ab] && ab !== 'lift') t.used[ab === 'cab' ? ab : ab + ':' + id] = true;
    const foe = t.foes.find((f) => f.x === x && f.y === y && !f.down);
    if (ab === 'hack') {
      api.spend(s, a.bw);
      if (a.bw === 0 && perk === 'backdoor') t.used['backdoor:' + id] = true;
      const obj = t.objs.find((o) => o.x === x && o.y === y && !o.done);
      if (foe && foe.kind === 'cam') {
        // 前獅心防務的無人機操作員知道後台密碼：攝影機整晚都不會再開。
        if (perk === 'take_over') { foe.down = true; api.say(s, 'card', 'tac.log.camTaken', v); }
        else { foe.off = 3; api.say(s, 'card', 'tac.log.camOff', v); }
      } else if (foe && foe.kind === 'drone') {
        if (perk === 'take_over') { foe.down = true; api.say(s, 'card', 'tac.log.droneTaken', v); api.addAlert(s, -10, id); }
        else { foe.loop = perk === 'botnet' ? 3 : 2; api.say(s, 'card', 'tac.log.droneLoop', Object.assign({ n: foe.loop }, v)); }
      } else if (obj) { obj.done = true; api.say(s, 'gain', 'tac.log.remote', v); api.say(s, 'gain', 'tac.log.obj.' + obj.kind, v); }
      else if (tile(t, x, y) === 'D') { setTile(t, x, y, 'd'); api.say(s, 'card', 'tac.log.doorHack', v); }
      else if (tile(t, x, y) === 'd') { setTile(t, x, y, 'D'); t.locks[key(x, y)] = t.turn + 2; api.say(s, 'card', 'tac.log.doorLock', v); }
      // 老系統、內網權限：駭入不增加警戒。
      if (perk !== 'legacy' && perk !== 'network_access') api.addAlert(s, 2, id);
    } else if (ab === 'climb') {
      const dx = x - u.x, dy = y - u.y;
      if (c.clumsy && r().chance(0.25)) { api.say(s, 'bad', 'tac.log.climbFail', v); loud(3); }
      else { u.x = x + dx; u.y = y + dy; api.say(s, 'ok', perk === 'rooftops' ? 'tac.log.vault' : 'tac.log.climb', v); }
    } else if (ab === 'takedown') {
      if (c.clumsy && r().chance(0.25)) {
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
      if (foe.kind === 'drone') {
        // 街頭藝人引來一群人，無人機跟著人群拍。
        foe.loop = 2;
        api.say(s, 'ok', 'tac.log.crowd', v);
      } else {
        const was = foe.state;
        foe.state = 'distracted';
        foe.timer = c.talkTurns;
        foe.target = null;
        foe.face = [Math.sign(u.x - foe.x), Math.sign(u.y - foe.y)];
        if (foe.face[0] && foe.face[1]) foe.face[1] = 0;
        api.say(s, 'ok', was === 'alert' ? 'tac.log.talkAlert' : c.teaOnly ? 'tac.log.tea' : 'tac.log.talk', Object.assign({ n: c.talkTurns }, v));
      }
    } else if (ab === 'disguise') {
      u.disguise = c.disguiseTurns;
      api.say(s, 'ok', 'tac.log.disguise', Object.assign({ n: c.disguiseTurns }, v));
    } else if (ab === 'unlock') {
      setTile(t, x, y, 'd');
      api.say(s, 'ok', 'tac.log.unlock.' + (UNLOCKS.includes(perk) ? perk : t.keycard ? 'keycard' : 'knitting'), v);
    } else if (ab === 'force') {
      setTile(t, x, y, 'd');
      if (c.lift) api.say(s, 'ok', 'tac.log.forceQuiet', v);
      else {
        api.say(s, 'warn', c.strong ? 'tac.log.force' : 'tac.log.forceHard', v);
        loud(c.strong ? 3 : 5);
        if (!c.strong) api.addAlert(s, 5, id);
      }
    } else if (ab === 'heal') {
      const w = live(t).find((o) => o.x === x && o.y === y);
      api.heal(s, w.id);
      api.say(s, 'gain', 'tac.log.heal', { name: api.name(s, id), other: api.name(s, w.id) });
    } else if (ab === 'cab') {
      setTile(t, u.x, u.y, 'X');
      api.say(s, 'card', 'tac.log.cab', v);
    } else if (ab === 'summon') {
      // 叫來的人站在旁邊沒人看得到的地方（沒有的話就隨便一格），這一回合還能動一下。
      const hidden = (nx, ny) => !t.foes.some((f) => active(f) && inView(t, f, nx, ny));
      const [hx, hy] = near(t, u.x, u.y, hidden) || near(t, u.x, u.y);
      const hid = api.summon(s);
      const h = { id: hid, x: hx, y: hy, ap: 1, out: false, taken: false, disguise: 0, helper: true };
      t.units.push(h);
      api.say(s, 'card', 'tac.log.summon', Object.assign({ other: api.name(s, hid), job: { l: E.people.occupationOf(api.person(s, hid)).name } }, v));
      detect(s, api, [h]);
    } else if (ab === 'code') {
      setTile(t, x, y, 'd');
      api.say(s, 'card', 'tac.log.code', v);
    } else if (ab === 'ghost') {
      u.ghost = 2;
      api.say(s, 'card', 'tac.log.ghost', v);
    } else if (ab === 'soothe') {
      let n = 0;
      for (const f of t.foes) {
        if (f.kind !== 'guard' || f.down || f.state !== 'alert' || f.reinforce || manh(f.x, f.y, u.x, u.y) > 5) continue;
        f.state = 'patrol';
        f.target = null;
        n++;
      }
      api.say(s, 'card', 'tac.log.soothe', Object.assign({ n }, v));
      api.addAlert(s, -15, id);
    } else if (ab === 'lift') {
      if (c.clumsy && r().chance(0.25)) {
        api.say(s, 'bad', 'tac.log.liftFail', v);
        foe.state = 'alert';
        foe.target = [u.x, u.y];
        api.addAlert(s, 8, id);
      } else {
        t.keycard = true;
        api.say(s, 'card', 'tac.log.lift', v);
      }
    } else if (ab === 'breach') {
      setTile(t, x, y, '.');
      if (c.lift) api.say(s, 'ok', 'tac.log.breachQuiet', v);
      else { api.say(s, 'card', 'tac.log.breach', v); loud(3); }
    } else if (ab === 'boost') {
      let n = 0;
      for (const o of live(t)) if (o !== u && !o.escort && manh(o.x, o.y, u.x, u.y) <= 2) { o.ap++; n++; }
      api.say(s, 'card', 'tac.log.boost', Object.assign({ n }, v));
    } else if (ab === 'cover') {
      setTile(t, u.x, u.y, 'H');
      api.say(s, 'card', 'tac.log.cover', v);
    } else if (ab === 'radio') {
      for (const f of t.foes) if (f.kind === 'guard' && !f.down) { f.state = 'distracted'; f.timer = 2; f.target = null; }
      api.say(s, 'card', 'tac.log.radio', v);
    } else if (ab === 'pigeon') {
      const obj = t.objs.find((o) => o.x === x && o.y === y && !o.done);
      obj.done = true;
      api.say(s, 'card', 'tac.log.pigeon', v);
      api.say(s, 'gain', 'tac.log.obj.' + obj.kind, v);
    } else if (ab === 'sergei') {
      let n = 0;
      for (const f of t.foes) {
        if (f.down || manh(f.x, f.y, x, y) > 2) continue;
        if (f.kind === 'guard') {
          f.state = 'distracted';
          f.timer = 2;
          f.target = null;
          n++;
        } else if (f.kind === 'cam') { f.off = Math.max(f.off || 0, 2); n++; }
      }
      api.say(s, 'card', 'tac.log.sergei', Object.assign({ n }, v));
    } else if (ab === 'pet') {
      foe.down = true;
      foe.friend = true;
      api.say(s, 'ok', 'tac.log.pet', v);
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
        else if (obj.kind === 'box' && !c.hack) loud(3);
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
        if (!u.escort) t.spotted[u.id] = true;
        const v = { name: api.name(s, u.id) };
        // 冷靜：第一次被看到時，站著不動，對方以為只是路人。
        if (!u.escort && api.traits(s, u.id).includes('calm') && !t.used['calm:' + u.id]) {
          t.used['calm:' + u.id] = true;
          api.say(s, 'card', 'tac.log.calm', v);
          continue;
        }
        // 退休教師：被看到也沒人起疑，守衛不會追過來，警戒只加一半（警戒 60 以上就沒用了）。
        const plain = !u.escort && api.perk(s, u.id) === 'unsuspicious' && s.op.alert < 60 && f.kind !== 'dog';
        api.say(s, 'warn', plain ? 'tac.log.plain' : 'tac.log.spotted.' + f.kind, v);
        const chase = (g) => { g.state = 'alert'; g.target = [u.x, u.y]; g.timer = 0; };
        if (f.kind === 'guard' && !plain) chase(f);
        if (f.kind === 'cam' && !plain) {
          const g = t.foes.filter((x) => x.kind === 'guard' && !x.down && x.state === 'patrol').sort((a, b) => manh(a.x, a.y, u.x, u.y) - manh(b.x, b.y, u.x, u.y))[0];
          if (g) chase(g);
        }
        // 狗叫：自己跟著味道追，五格內的守衛都會過來看。
        if (f.kind === 'dog') {
          chase(f);
          for (const g of t.foes) if (g.kind === 'guard' && !g.down && g.state !== 'distracted' && manh(g.x, g.y, f.x, f.y) <= 5) chase(g);
        }
        const extra = !u.escort && !plain && api.flaw(s, u.id) === 'hothead' && f.kind === 'guard' ? 5 : 0;
        if (extra) api.say(s, 'warn', 'tac.log.hothead', v);
        let amount = SPOT[f.kind] + extra;
        if (plain) amount = Math.ceil(amount / 2);
        // 粵語密語：兩個會講粵語的人在一起，被看到也像兩個街坊在聊天。
        const canto = (o) => !o.escort && api.quirks(s, o.id).includes('cantonese');
        if (canto(u) && live(t).some((o) => o !== u && canto(o))) {
          amount = Math.max(1, amount - 3);
          if (!t.used.cantonese) { t.used.cantonese = true; api.say(s, 'card', 'tac.log.cantonese', v); }
        }
        const blame = u.escort ? (live(t).find((x) => !x.escort) || u).id : u.id;
        api.addAlert(s, amount, blame);
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
  // 守衛找路：守衛有鑰匙，可以穿過上鎖的門（突襲的地圖除外；狗也沒有鑰匙）；不會走進有人的格子。
  function path(t, f, tx, ty) {
    const keys = t.keys && f.kind === 'guard';
    const ok = (x, y) => STAND.includes(tile(t, x, y)) || (keys && tile(t, x, y) === 'D');
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
    t.undo = null;
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
    // 德比戰、死對頭：兩個人在同一張地圖上，偶爾會吵起來。
    const ppl = live(t).filter((u) => !u.escort);
    for (const a of ppl) {
      for (const b of ppl) {
        if (a.id >= b.id) continue;
        const qa = api.quirks(s, a.id), qb = api.quirks(s, b.id);
        const derby = (qa.includes('man_utd') && qb.includes('liverpool')) || (qa.includes('liverpool') && qb.includes('man_utd'));
        if (!derby && !api.rival(s, a.id, b.id)) continue;
        const r = api.rand(s);
        if (!r.chance(BICKER)) continue;
        const w = r.chance(0.5) ? a : b;
        api.say(s, 'warn', derby ? 'tac.log.derby' : 'tac.log.feud', { name: api.name(s, a.id), other: api.name(s, b.id) });
        noise(s, api, w.x, w.y, 2);
      }
    }
    // 換班：第三回合結束時，守衛聚在一起交接，兩回合不看別的地方。
    if (t.event === 'shift' && t.turn === 3) {
      for (const f of t.foes) if (f.kind === 'guard' && !f.down && f.state === 'patrol') { f.state = 'distracted'; f.timer = 2; }
      api.say(s, 'gain', 'tac.log.ev.shift');
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
      // 狗：平常跟著路線走，一回合一格；聞到人就追著味道跑，一回合兩格，追到了叫兩回合再回去。狗不會抓人。
      if (f.kind === 'dog') {
        if (f.state === 'alert' && f.target) {
          step(t, f, path(t, f, f.target[0], f.target[1]).slice(0, 2));
          if (manh(f.x, f.y, f.target[0], f.target[1]) <= 1 && ++f.timer >= 2) { f.state = 'patrol'; f.target = null; }
        } else {
          let [tx, ty] = f.route[f.ri];
          if (f.x === tx && f.y === ty) { f.ri = (f.ri + 1) % f.route.length; [tx, ty] = f.route[f.ri]; }
          step(t, f, path(t, f, tx, ty).slice(0, 1));
        }
        continue;
      }
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
      if (u.ghost > 0) u.ghost--;
      if (u.escort) continue;
      const fl = api.flaw(s, u.id);
      const v = { name: api.name(s, u.id) };
      const close = (kind) => t.foes.some((f) => f.kind === kind && !f.down && manh(f.x, f.y, u.x, u.y) <= 2);
      const calmBy = live(t).some((o) => o !== u && !o.escort && manh(o.x, o.y, u.x, u.y) <= 1 && api.traits(s, o.id).includes('calm'));
      // 容易緊張：守衛走到兩格以內；怕黑：站在暗處，旁邊又沒有冷靜的人陪著；怕狗：狗在兩格以內。這一回合都少一個行動點。
      if (fl === 'nervous' && close('guard')) { u.ap = AP - 1; api.say(s, 'warn', 'tac.log.nervous', v); }
      else if (fl === 'dark' && tile(t, u.x, u.y) === ',' && !calmBy) { u.ap = AP - 1; api.say(s, 'warn', 'tac.log.dark', v); }
      else if (api.quirks(s, u.id).includes('dogs_fear') && close('dog')) { u.ap = AP - 1; api.say(s, 'warn', 'tac.log.dogFear', v); }
    }
    if (t.limit && t.turn > t.limit) { api.timeUp(s); return true; }
    return check(s, api);
  }

  function nearestUnit(t, f) {
    const us = live(t).sort((a, b) => manh(a.x, a.y, f.x, f.y) - manh(b.x, b.y, f.x, f.y));
    return us.length ? [us[0].x, us[0].y] : null;
  }

  // 追捕中的守衛走到某人身邊：那個人被捕。跑得快的人、健身教練可以甩開一次；躲在藏身處的人不會被發現；
  // 隊上的律師每次行動可以出面一次（「我的當事人有權保持沉默」），守衛愣住兩回合。
  function catchUp(s, api, f) {
    const t = s.op.tac;
    if (f.kind !== 'guard' || f.state !== 'alert') return false;
    for (const u of live(t)) {
      if (f.state !== 'alert') break;
      if (manh(f.x, f.y, u.x, u.y) !== 1 || tile(t, u.x, u.y) === 'H' || (u.disguise > 0 && !f.chase)) continue;
      const v = { name: api.name(s, u.id) };
      if (!u.escort && caps(s, api, u.id).slip && !t.used['fast:' + u.id]) {
        t.used['fast:' + u.id] = true;
        f.state = 'distracted';
        f.timer = 1;
        api.say(s, 'card', 'tac.log.slip', v);
        continue;
      }
      // 朋友就在兩格內：一把把人拉開（每對朋友每次行動一次）。
      const pal = !u.escort && live(t).find((o) => o !== u && !o.escort && manh(o.x, o.y, u.x, u.y) <= 2 && api.friend(s, o.id, u.id) && !t.used['pal:' + [o.id, u.id].sort().join('|')]);
      if (pal) {
        t.used['pal:' + [pal.id, u.id].sort().join('|')] = true;
        f.state = 'distracted';
        f.timer = 1;
        api.say(s, 'card', 'tac.log.friend', { name: api.name(s, pal.id), other: v.name });
        continue;
      }
      // 教學關：被追上也不算數，守衛放人，回去站崗。
      if (t.practice) {
        f.state = 'patrol';
        f.target = null;
        api.say(s, 'warn', 'tac.log.practice', v);
        continue;
      }
      const lawyer = live(t).find((o) => !o.escort && api.perk(s, o.id) === 'bail');
      if (lawyer && !t.used.bail) {
        t.used.bail = true;
        f.state = 'distracted';
        f.timer = 2;
        f.target = null;
        api.say(s, 'card', 'tac.log.bail', { name: api.name(s, lawyer.id), other: v.name });
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
    AP, CARDS, UNLOCKS, build, prepare, vision, caps, abilities, cards, reach, risky, move, use, endTurn, undo, tile, objsLeft, live,
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
