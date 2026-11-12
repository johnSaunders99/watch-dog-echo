// 第三季《零時差》的自動測試，由 tools/check.js 呼叫（node tools/check.js 會一起跑）。
// 檢查：三語文字、資料表、房間生成、戰鬥規則、一整趟的流程、機器人的勝率、音效。
// 戰鬥的模擬不碰畫面也不用 Math.random，所以在 Node 裡可以一步一步跑，結果每次都一樣。
const fs = require('fs');
const path = require('path');

module.exports = function checkS3({ sandbox, fail, section, storage, root }) {
  const html = fs.readFileSync(path.join(root, 's3.html'), 'utf8');
  // 照 s3.html 的順序載入；畫面相關的（插畫、canvas、主程式）不載。
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/ui\/art|s3\/render|s3\/main/.test(f));
  const page = sandbox(scripts);
  const E = page.E, S3 = E.s3, D = S3.data, sim = S3.sim, A = sim.api, R = S3.run;
  const LANGS = ['zh-Hant', 'zh-Hans', 'en'];
  const T = sim.T;

  // ===== 文字 =====
  section('第三季：三語文字');
  {
    const src = ['js/s3/main.js', 's3.html'].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
    const want = new Set();
    for (const m of src.matchAll(/['"`](s3\.[\w.]+)['"`]/g)) if (!m[1].endsWith('.')) want.add(m[1]);
    const add = (pre, ids, tails = ['']) => { for (const id of ids) for (const t of tails) want.add(pre + id + t); };
    add('s3.ex.', D.exploits.map((x) => x.id), ['.n', '.d']);
    add('s3.gad.', Object.keys(D.gadgets), ['.n', '.d']);
    add('s3.wp.', Object.keys(D.weapons), ['.n', '.d']);
    add('s3.en.', Object.keys(D.enemies), ['.n', '.d']);
    add('s3.prop.', Object.keys(D.props).filter((k) => D.props[k].hack && k !== 'pylon'), ['.n', '.d']);
    add('s3.mod.', Object.keys(D.mods), ['.n', '.d']);
    add('s3.sec.', D.sectors.map((s) => s.id), ['.n', '.d']);
    add('s3.boss.', Object.keys(D.bosses), ['.n']);
    add('s3.perk.', D.perks.map((p) => p.id), ['.n', '.d']);
    add('s3.tag.', [...new Set(D.exploits.map((x) => x.tag)), 'gadget']);
    add('s3.rar.', ['c', 'u', 'r']);
    add('s3.node.', ['fight', 'elite', 'shop', 'safe', 'event', 'boss', 'cells'], ['', '.d']);
    add('s3.rw.', ['exploit', 'gadget', 'data', 'heal', 'max', 'rescue']);
    add('s3.rw.got.', ['data', 'heal', 'max']);
    add('s3.hack.', [...new Set([...Object.values(D.props).map((p) => p.hack).filter(Boolean), ...Object.keys(D.hacks)])]);
    add('s3.why.', ['range', 'bw', 'jam', 'firewall', 'cool']);
    add('s3.trait.', Object.keys(D.traitFx));
    add('s3.flaw.', Object.keys(D.flawFx));
    add('s3.quirk.', Object.keys(D.quirkFx));
    add('s3.ctl.', ['move', 'aim', 'fire', 'hack', 'dash', 'focus', 'melee', 'swap', 'gadget', 'reload', 'pause'], ['', '.k']);
    add('s3.tip.', ['stealth', 'doors', 'hack', 'takedown', 'spotted', 'swap', 'trap']);
    add('s3.stat.', ['rooms', 'kills', 'hacks', 'takedowns', 'silent', 'bosses', 'rescued', 'captured']);
    add('s3.job.', Object.keys(D.jobFx));
    // 劇本：每一句台詞（含依前兩季結局換掉的那幾句）、說話的人、結局、無線電、安全屋的閒聊。
    const ST = S3.story;
    const lineKeys = (l) => [l.k].concat(...['v1', 's2', 'ally'].map((f) => Object.values(l[f] || {})));
    for (const l of [...Object.values(ST.beats).flat(), ...ST.endings.flatMap((e) => e.lines), ...Object.values(ST.hub).flat()]) for (const k of lineKeys(l)) want.add(k);
    for (const b of Object.values(ST.bossBeats)) for (const k of b.again) want.add(k);
    for (const c of Object.values(ST.comms)) for (const k of c.k) want.add(k);
    add('s3.who.', Object.keys(ST.speakers));
    add('s3.end.', ST.endings.map((e) => e.id), ['.t', '.c', '.d']);
    add('s3.safe.', ['rest', 'tune', 'train'], ['', '.d']);
    for (const ev of D.events) {
      add('s3.ev.' + ev.id, ['.t', '.x', '.c0', '.c1']);
      ev.choices.forEach((c, i) => { if (c.roll) for (const r of c.roll) want.add(`s3.ev.${ev.id}.r${i}.${r[2]}`); else want.add(`s3.ev.${ev.id}.r${i}`); });
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const code of LANGS) {
      const table = page.tables[code] || {};
      for (const k of want) if (table[k] === undefined) fail(`s3 text: ${code} is missing ${k}`);
      for (const k of Object.keys(table)) {
        if (!k.startsWith('s3.')) continue;
        if (!want.has(k)) fail(`s3 text: ${code} has ${k}, which nothing uses`);
        if (page.tables['zh-Hant'][k] !== undefined && vars(table[k]) !== vars(page.tables['zh-Hant'][k])) fail(`s3 text: ${code} ${k} has different {variables}`);
        if (!table[k].trim()) fail(`s3 text: ${code} ${k} is empty`);
      }
    }
    // 簡體的表裡不該出現只有繁體才用的字（整批取代時最容易漏）。
    const trad = /[駭頻寬體資訊號擊傷這個們鎖門響報區設電暈彈槍裝備標記擋關開機樁還沒發現戰鬥點選]/;
    for (const [k, v] of Object.entries(page.tables['zh-Hans'])) if (k.startsWith('s3.') && trad.test(v)) fail(`s3 text: zh-Hans ${k} contains a Traditional character (${v.match(trad)[0]})`);
    console.log(`${want.size} keys in three languages, none missing, none unused`);
  }

  // ===== 資料表 =====
  section('第三季：資料表');
  {
    const ST = S3.story;
    for (const l of [...Object.values(ST.beats).flat(), ...ST.endings.flatMap((e) => e.lines), ...Object.values(ST.hub).flat()]) if (l.who && !ST.speakers[l.who]) fail(`s3 story: unknown speaker ${l.who}`);
    for (const [id, b] of Object.entries(ST.bossBeats)) {
      if (!D.bosses[id]) fail(`s3 story: lines for unknown boss ${id}`);
      for (const k of [b.meet, b.down]) if (k && !ST.beats[k]) fail(`s3 story: boss ${id} points at missing beat ${k}`);
      if (!ST.speakers[b.who] || !b.again.length) fail(`s3 story: boss ${id} needs a speaker and at least one repeat line`);
    }
    for (const id of D.sectors.map((x) => x.boss)) if (!ST.bossBeats[id]) fail(`s3 story: boss ${id} has no lines`);
    for (const [sec, k] of Object.entries(ST.sectorBeats)) if (!D.sectors.some((x) => x.id === sec) || !ST.beats[k]) fail(`s3 story: sector beat ${sec} is broken`);
    for (const c of Object.values(ST.comms)) if (!ST.speakers[c.who]) fail(`s3 story: radio line from unknown speaker ${c.who}`);
    for (const p of [...E.s2.people.occupations, ...E.s2.people.rares]) if (!D.jobFx[p.perk]) fail(`s3 data: job ${p.id} (${p.perk}) does nothing in Season 3`);
    // 圖片清單裡的每個檔案都要在；首領一定要有登場插圖。
    for (const [k, p] of Object.entries(S3.pictures || {})) if (!fs.existsSync(path.join(root, p))) fail(`s3 art: picture ${k} points at a missing file (${p})`);
    for (const [k, a] of Object.entries(S3.atlas || {})) if (!fs.existsSync(path.join(root, a.src))) fail(`s3 art: sprite sheet ${k} is missing (${a.src})`);
    for (const id of Object.keys(D.bosses)) if (!(S3.pictures || {})['boss-' + id]) fail(`s3 art: boss ${id} has no illustration`);
    const P = E.s2.people;
    const exIds = new Set(D.exploits.map((x) => x.id));
    if (exIds.size !== D.exploits.length) fail('s3 data: duplicate exploit id');
    for (const x of D.exploits) {
      if (!'cur'.includes(x.rar) || !(x.max >= 1)) fail(`s3 data: exploit ${x.id} has a bad rarity or max`);
      for (const k of Object.keys(x.mods)) if (!(k in D.baseStats)) fail(`s3 data: exploit ${x.id} changes unknown stat ${k}`);
    }
    for (const [cat, kit] of Object.entries(D.kits)) {
      for (const g of kit.gadget) if (!D.gadgets[g]) fail(`s3 data: kit ${cat} has unknown gadget ${g}`);
      for (const x of kit.exploit) if (!exIds.has(x)) fail(`s3 data: kit ${cat} has unknown exploit ${x}`);
    }
    for (const cat of ['hacker', 'physical', 'social', 'specialist']) if (!D.kits[cat] || !D.weapons[D.weaponByCategory[cat]]) fail(`s3 data: no kit or weapon for ${cat}`);
    for (const w of Object.values(D.weaponByJob)) if (!D.weapons[w]) fail(`s3 data: unknown weapon ${w}`);
    for (const t of P.traits) if (!D.traitFx[t.id]) fail(`s3 data: trait ${t.id} does nothing in Season 3`);
    for (const f of P.flaws) if (!D.flawFx[f.id]) fail(`s3 data: flaw ${f.id} does nothing in Season 3`);
    for (const [name, table] of [['trait', D.traitFx], ['flaw', D.flawFx], ['quirk', D.quirkFx]]) {
      for (const [id, fx] of Object.entries(table)) for (const k of Object.keys(fx.mods || {})) if (!(k in D.baseStats)) fail(`s3 data: ${name} ${id} changes unknown stat ${k}`);
    }
    for (const ev of D.events) {
      if (ev.choices.length !== 2) fail(`s3 data: event ${ev.id} needs two choices`);
      for (const c of ev.choices) for (const fx of c.roll ? c.roll.map((r) => r[1]) : [c.fx]) {
        if (fx.gadget && !D.gadgets[fx.gadget]) fail(`s3 data: event ${ev.id} gives unknown gadget ${fx.gadget}`);
        if (fx.exploit && !exIds.has(fx.exploit)) fail(`s3 data: event ${ev.id} gives unknown exploit ${fx.exploit}`);
        if (fx.curse && !D.mods[fx.curse]) fail(`s3 data: event ${ev.id} uses unknown room condition ${fx.curse}`);
      }
      if (ev.choices.some((c) => c.roll && c.roll[c.roll.length - 1][0] !== 1)) fail(`s3 data: event ${ev.id}: the last roll must be 1`);
    }
    for (const p of D.perks) if (p.cost.length !== p.max) fail(`s3 data: perk ${p.id} needs one cost per level`);
    for (const s of D.sectors) {
      if (!D.bosses[s.boss] || !P.districts[s.district]) fail(`s3 data: sector ${s.id} has an unknown boss or district`);
      for (const k of Object.keys(s.props)) if (!D.props[k]) fail(`s3 data: sector ${s.id} places unknown prop ${k}`);
    }
    // 能力值：疊加的方向正確（加的用加、乘的用乘）。
    const base = sim.stats({ skills: { hack: 0, physical: 0, social: 0 }, exploits: {} }).st;
    const more = sim.stats({ skills: { hack: 3, physical: 3, social: 3 }, traits: ['fast'], flaw: 'bad_knees', quirks: ['gamer'], exploits: { overclock: 3, kevlar: 2, fiber: 2 }, extra: { maxHp: 8, bwMax: 1 } });
    if (more.st.bwMax !== base.bwMax + 3 + 3 + 1) fail(`s3 stats: bandwidth ${more.st.bwMax}`);
    if (more.st.maxHp !== base.maxHp + 36 + 40 + 8) fail(`s3 stats: health ${more.st.maxHp}`);
    if (Math.abs(more.st.bwRegen - base.bwRegen * 1.25 * 1.25) > 1e-9) fail('s3 stats: bandwidth recovery should multiply per stack');
    if (!(more.st.dashCd > base.dashCd) || !(more.st.speed > base.speed) || !(more.st.critChance > base.critChance)) fail('s3 stats: trait, flaw or quirk not applied');
    console.log(`${D.exploits.length} exploits, ${Object.keys(D.gadgets).length} gadgets, ${Object.keys(D.enemies).length} enemies, ${D.events.length} encounters, ${D.perks.length} permanent upgrades`);
  }

  // ===== 房間生成 =====
  section('第三季：房間生成');
  {
    const G = S3.gen;
    let rooms = 0;
    const kinds = new Set(), propKinds = new Set();
    for (let seed = 0; seed < 12; seed++) for (let si = 0; si < D.sectors.length; si++) for (const depth of [0, 2, D.sectors[si].rooms - 1]) for (const type of ['fight', 'elite']) {
      const roomNo = si * 7 + depth + 1, node = { type, mod: seed % 3 || roomNo < D.mods.kennel.from ? null : 'kennel', reward: 'exploit' };
      const spec = G.room('gen-' + seed, si, depth, roomNo, node, 1 + (seed % 3));
      const again = G.room('gen-' + seed, si, depth, roomNo, node, 1 + (seed % 3));
      if (JSON.stringify(spec) !== JSON.stringify(again)) fail(`s3 gen: seed ${seed} sector ${si} depth ${depth} is not repeatable`);
      rooms++;
      const occ = new Array(G.GW * G.GH).fill(0), used = new Set();
      for (const pr of spec.props) {
        propKinds.add(pr.kind);
        const wall = pr.kind === 'camera' || pr.kind === 'speaker';
        for (let y = pr.ty; y < pr.ty + pr.h; y++) for (let x = pr.tx; x < pr.tx + pr.w; x++) {
          const i = y * G.GW + x;
          if (x < 0 || y < 0 || x >= G.GW || y >= G.GH) fail(`s3 gen: ${pr.kind} is outside the room`);
          if (!!spec.tiles[i] !== wall) fail(`s3 gen: ${pr.kind} at ${x},${y} is ${wall ? 'not on a wall' : 'inside a wall'}`);
          if (used.has(i)) fail(`s3 gen: two props share ${x},${y}`);
          used.add(i);
          if (D.props[pr.kind].solid) occ[i] = 1;
        }
      }
      // 每一塊地板都走得到，設施沒有把路堵死。
      const dist = G.flood(spec.tiles, occ);
      for (let i = 0; i < spec.tiles.length; i++) if (!spec.tiles[i] && !occ[i] && dist[i] < 0) { fail(`s3 gen: seed ${seed} sector ${si} depth ${depth}: floor ${i % G.GW},${Math.floor(i / G.GW)} cannot be reached`); break; }
      for (const d of spec.doors) if (dist[1 * G.GW + d.tx] < 0) fail('s3 gen: a door cannot be reached');
      if (spec.doors.length !== 1 + (seed % 3)) fail('s3 gen: wrong number of doors');
      if (spec.enemies.length < 3) fail(`s3 gen: only ${spec.enemies.length} enemies`);
      for (const e of spec.enemies) {
        kinds.add(e.kind);
        if (spec.tiles[e.ty * G.GW + e.tx] || occ[e.ty * G.GW + e.tx]) fail(`s3 gen: ${e.kind} starts inside something`);
        if (Math.hypot(e.x - spec.entry.x, e.y - spec.entry.y) < 4 * T) fail(`s3 gen: ${e.kind} starts ${Math.round(Math.hypot(e.x - spec.entry.x, e.y - spec.entry.y))}px from the entrance`);
        if (D.enemies[e.kind].from > roomNo) fail(`s3 gen: ${e.kind} appears too early (room ${roomNo})`);
      }
      for (const w of spec.waves) for (const e of w) kinds.add(e.kind);
      if (type === 'elite' && !spec.enemies.some((e) => e.elite)) fail('s3 gen: an elite room has no elite');
      if (node.mod === 'kennel' && spec.enemies.filter((e) => e.kind === 'hound').length < 2) fail('s3 gen: the dog unit brought no hounds');
      if (!spec.gates.length) fail('s3 gen: no entry points for reinforcements');
      // 一進門不會馬上被看到：站在入口不動一秒，沒有任何人或攝影機開始注意。
      const st = sim.createRoom(spec, { weapon: 'pistol', skills: { hack: 1, physical: 1, social: 0 }, exploits: {}, gadgets: [] });
      for (let i = 0; i < 60; i++) sim.step(st, { mx: 0, my: 0, ax: 800, ay: 0 });
      if (node.mod !== 'sweep' && (st.en.some((e) => e.aware > 0 || e.state !== 'calm') || st.props.some((p) => p.aware > 0))) fail(`s3 gen: seed ${seed} sector ${si} depth ${depth}: seen within a second of walking in`);
    }
    for (const k of Object.keys(D.enemies)) if (!kinds.has(k)) fail(`s3 gen: ${k} never appears`);
    for (const k of ['junction', 'vent', 'barrel', 'car', 'bollard', 'camera', 'speaker', 'crate']) if (!propKinds.has(k)) fail(`s3 gen: ${k} never appears`);
    D.sectors.forEach((sec, si) => {
      const spec = G.room('gen-boss', si, sec.rooms, 20, { type: 'boss' }, 1);
      if (spec.boss !== sec.boss || spec.enemies[0].kind !== 'boss') fail(`s3 gen: sector ${sec.id} has no boss`);
      const pylons = spec.props.filter((p) => p.kind === 'pylon').length;
      if (pylons !== (D.bosses[sec.boss].pylons || 0)) fail(`s3 gen: ${sec.boss} has ${pylons} relays`);
    });
    console.log(`${rooms} rooms: repeatable, every floor square reachable, props placed legally, enemies away from the entrance, every enemy and prop kind appears`);
  }

  // ===== 戰鬥規則 =====
  section('第三季：戰鬥規則');
  // 空的場地，自己擺東西進去。
  function arena(o = {}) {
    const tiles = new Array(32 * 18).fill(0);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 32; x++) if (!x || !y || x === 31 || y === 17) tiles[y * 32 + x] = 1;
    return {
      seed: o.seed || 7, sector: 0, depth: 0, roomNo: 1, theme: 'docks', type: 'fight', mod: o.mod || null, scale: 1, dataMul: 1,
      doors: [{ tx: 15, x: 800, y: 50 }], entry: { x: 800, y: 775 }, boss: null, waves: o.waves || [], supply: false,
      tiles, props: o.props || [], enemies: o.enemies || [], gates: [{ tx: 2, ty: 3, x: 125, y: 175 }],
    };
  }
  const build = (o = {}) => Object.assign({ weapon: 'pistol', skills: { hack: 1, physical: 1, social: 0 }, traits: [], flaw: null, quirks: [], exploits: {}, gadgets: [], extra: {} }, o);
  const pad = (o = {}) => Object.assign({ mx: 0, my: 0, ax: 800, ay: 0, fire: false, focus: false, dash: false, hack: false, melee: false, g1: false, g2: false, reload: false }, o);
  const go = (s, n, inp) => { const seen = []; for (let i = 0; i < n; i++) { sim.step(s, typeof inp === 'function' ? inp(i) : inp || pad()); for (const ev of s.ev) seen.push(ev.k); s.ev.length = 0; } return seen; };
  // 房間一開始，離入口近的守衛會背對入口；測試要人面對玩家時用 face 轉回來。
  const room = (o, b) => sim.createRoom(arena(o), build(b));
  const face = (s, ang) => { for (const e of s.en) e.ang = e.base = ang; return s; };
  const UP = -Math.PI / 2, DOWN = Math.PI / 2;
  {
    // 從背後靠近不會被發現，可以直接制伏；沒響警報就清場算「無聲」。
    let s = room({ enemies: [{ kind: 'guard', x: 800, y: 600, ang: UP }] });
    go(s, 120);
    if (s.en[0].state !== 'calm' || s.en[0].aware > 0) fail('s3 fight: a guard facing away noticed the player');
    go(s, 28, pad({ my: -1 }));
    if (sim.takedownTarget(s) !== s.en[0]) fail('s3 fight: no takedown from behind');
    const seen = go(s, 3, (i) => pad({ melee: i === 0 }));
    go(s, 3);
    if (!seen.includes('takedown') || !s.cleared || !s.silent || s.alert) fail(`s3 fight: takedown did not clear the room silently (${seen.join(',')})`);
    if (!s.cache || s.cache.taken) fail('s3 fight: no reward cache after clearing');

    // 正面被看到：先是發現，叫人要 CALL 秒，叫完才響警報、增援才會來。
    s = face(room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: DOWN }], waves: [[{ kind: 'rusher' }]] }), DOWN);
    go(s, 20);
    if (s.en[0].state === 'combat') fail('s3 fight: spotted instantly');
    const ev = go(s, 50);
    if (s.en[0].state !== 'combat' || !(s.en[0].call > 0) || s.alert || !ev.includes('spotted')) fail('s3 fight: a guard who sees the player should start calling it in');
    go(s, Math.ceil(sim.CALL * 60) + 5);
    if (!s.alert) fail('s3 fight: no alarm after the call');
    go(s, 60 * 5);
    if (!s.en.some((e) => e.kind === 'rusher')) fail('s3 fight: reinforcements never came');
    // 叫完之前放倒，就不會響警報，增援也不會來。
    s = face(room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: DOWN }], waves: [[{ kind: 'rusher' }]] }), DOWN);
    go(s, 70);
    A.kill(s, s.en[0], { by: 'gun' });
    go(s, 200);
    if (s.alert || !s.cleared || !s.silent) fail('s3 fight: killing the caller in time should keep the room quiet');

    // 槍聲會驚動附近的人；滅音手槍不會。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: UP }] });
    go(s, 40);
    go(s, 2, pad({ fire: true, ax: 800, ay: 900 }));
    if (s.en[0].state !== 'combat') fail('s3 fight: a gunshot 275px away went unheard');
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: UP }] }, { weapon: 'silenced' });
    go(s, 40);
    go(s, 2, pad({ fire: true, ax: 800, ay: 900 }));
    if (s.en[0].state !== 'calm') fail('s3 fight: the silenced pistol was heard');

    // 配電箱：花 2 頻寬，頓一下之後放電；還沒發現你的守衛直接倒下，不會響警報。太遠、頻寬不夠都會說原因。
    s = room({ props: [{ kind: 'junction', tx: 16, ty: 8, w: 1, h: 1 }, { kind: 'junction', tx: 2, ty: 2, w: 1, h: 1 }], enemies: [{ kind: 'guard', x: 900, y: 425, ang: UP }] });
    const victim = s.en[0];
    let h = sim.pickHack(s, 825, 425);
    if (!h || h.act !== 'overload' || h.cost !== 2 || !h.ok) fail('s3 hack: junction box not offered');
    if (sim.pickHack(s, 125, 125).why !== 'range') fail('s3 hack: a far junction box should be out of range');
    const bw = s.p.bw;
    go(s, 1, pad({ hack: true, ax: 825, ay: 425 }));
    if (Math.abs(bw - s.p.bw - 2) > 0.05) fail(`s3 hack: overload cost ${bw - s.p.bw}`);
    go(s, 40);
    if (!victim.dead || s.alert) fail('s3 hack: an overload should put down a guard who has not seen the player, with no alarm');
    h = sim.pickHack(s, 825, 425);
    if (h && h.prop) fail('s3 hack: a used junction box should not be offered again');
    s.p.bw = 0;
    s.p.x = 200; s.p.y = 200;
    if (sim.pickHack(s, 125, 125).why !== 'bw') fail('s3 hack: no bandwidth should be the reason');

    // 盾兵：正面擋子彈；盾牌被癱瘓就打得到。
    s = face(room({ enemies: [{ kind: 'shield', x: 800, y: 450, ang: DOWN }] }), DOWN);
    A.raise(s);
    const shield = s.en[0];
    let clang = go(s, 50, pad({ fire: true, ax: 800, ay: 450 }));
    if (shield.hp < shield.maxHp || !clang.includes('clang')) fail('s3 fight: the shield did not block from the front');
    h = sim.pickHack(s, shield.x, shield.y);
    if (!h || h.act !== 'dropShield') fail('s3 hack: shield trooper should offer the shield hack');
    shield.noShield = 5;
    go(s, 40, (i) => pad({ fire: true, ax: shield.x, ay: shield.y }));
    if (!(shield.hp < shield.maxHp)) fail('s3 fight: no damage with the shield down');

    // 劫持無人機：會幫忙打，時間到就燒掉。
    s = room({ enemies: [{ kind: 'drone', x: 700, y: 500, ang: DOWN }, { kind: 'heavy', x: 900, y: 400, ang: DOWN }] });
    A.raise(s);
    const drone = s.en[0], heavy = s.en[1];
    go(s, 1, pad({ hack: true, ax: drone.x, ay: drone.y }));
    if (!(drone.ally > 0)) fail('s3 hack: the drone was not hijacked');
    const hp0 = heavy.hp;
    go(s, 240);
    if (!(heavy.hp < hp0)) fail('s3 hack: the hijacked drone did not attack');
    go(s, 60 * 10);
    if (!drone.dead) fail('s3 hack: the hijacked drone never burned out');

    // 無人車：往車頭方向衝，撞倒路上的人，撞到牆才停。
    s = room({ props: [{ kind: 'car', tx: 10, ty: 8, w: 2, h: 1, dir: 0 }], enemies: [{ kind: 'guard', x: 725, y: 425, ang: UP }] });
    go(s, 1, pad({ hack: true, ax: 550, ay: 425 }));
    go(s, 150);
    const car = s.props[0];
    if (!car.used || car.moving || car.tx !== 29) fail(`s3 hack: the car stopped at ${car.tx}`);
    if (s.stats.kills !== 1) fail('s3 hack: the car did not run the guard over');

    // 車會往敵人多的那一頭衝（車頭跟著轉過去），撞到牆會爆炸。
    s = room({ props: [{ kind: 'car', tx: 10, ty: 8, w: 2, h: 1, dir: 0 }], enemies: [{ kind: 'guard', x: 300, y: 425, ang: UP }] });
    if (sim.carPath(s, s.props[0]).dir !== 2) fail('s3 hack: the car should pick the end with the enemy in its lane');
    let crash = go(s, 1, pad({ hack: true, ax: 550, ay: 425 }));
    crash = crash.concat(go(s, 150));
    if (s.props[0].dir !== 2 || s.props[0].tx > 2 || s.stats.kills !== 1 || !crash.includes('crash') || !s.zones.some((z) => z.k === 'fire')) fail(`s3 hack: the car should turn round, run the guard over and explode at the wall (tx ${s.props[0].tx})`);

    // 陷阱的規則：還沒發現你的一般敵人直接倒下；精英和重裝兵受三倍傷害；警報響了之後就是普通的傷害。
    s = room({ enemies: [{ kind: 'guard', x: 400, y: 300, ang: UP }, { kind: 'heavy', x: 1200, y: 300, ang: UP }] });
    go(s, 5);
    const [unaware, heavyOne] = s.en;
    A.trapHurt(s, unaware, 1, { by: 'env' });
    const heavyHp = heavyOne.hp;
    A.trapHurt(s, heavyOne, 10, { by: 'env' });
    if (!unaware.dead || s.alert) fail('s3 trap: a trap should put down a guard who has not seen the player');
    if (heavyOne.dead || Math.abs(heavyHp - heavyOne.hp - 30) > 0.01) fail('s3 trap: a heavy should take triple damage and stay up');
    s = room({ enemies: [{ kind: 'guard', x: 400, y: 300, ang: UP }] });
    A.raise(s);
    const awake = s.en[0], awakeHp = awake.hp;
    A.trapHurt(s, awake, 10, { by: 'env' });
    if (awake.dead || Math.abs(awakeHp - awake.hp - 10) > 0.01) fail('s3 trap: after the alarm a trap should do only its normal damage');

    // 急救包：全隊都滿血的時候留在地上，不會被吸過來；有人受傷才撿，先補場上的人，多的給場下傷得最重的人。
    {
      const crew3 = { squad: [build(), build(), build()], active: 0 };
      s = sim.createRoom(arena({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }), crew3);
      go(s, 30);
      const mx = s.p.x + 60;
      s.picks.push({ k: 'med', x: mx, y: s.p.y, v: 15, vx: 0, vy: 0, t: 1 });
      go(s, 60);
      const kit = s.picks.find((k) => k.k === 'med');
      if (!kit || Math.abs(kit.x - mx) > 1) fail('s3 pickup: a medkit was pulled in while everyone was at full health');
      s.team[1].hp = s.team[1].maxHp - 30;
      s.p.hp = s.p.maxHp - 5;
      go(s, 60);
      if (s.picks.some((k) => k.k === 'med') || s.p.hp !== s.p.maxHp || s.team[1].hp !== s.team[1].maxHp - 20) fail('s3 pickup: the medkit should top up the active member first, then the most hurt teammate');
    }

    // 路樁：升起來擋子彈，不擋視線；時間到會降下去。
    s = room({ props: [{ kind: 'bollard', tx: 15, ty: 12, w: 3, h: 1, horiz: true }], enemies: [{ kind: 'guard', x: 825, y: 300, ang: UP }] });
    if (!A.clear(s, 800, 775, 825, 300, true)) fail('s3 hack: lowered bollards should not block bullets');
    go(s, 1, pad({ hack: true, ax: 825, ay: 625 }));
    if (A.clear(s, 800, 775, 825, 300, true) || !A.clear(s, 800, 775, 825, 300)) fail('s3 hack: raised bollards should block bullets but not sight');
    go(s, 60 * 9);
    if (!A.clear(s, 800, 775, 825, 300, true)) fail('s3 hack: bollards never went back down');

    // 干擾兵：範圍裡的東西駭不了；有「越獄」就可以。
    const jam = { props: [{ kind: 'junction', tx: 16, ty: 7, w: 1, h: 1 }], enemies: [{ kind: 'jammer', x: 800, y: 450, ang: DOWN }] };
    s = room(jam);
    A.raise(s);
    if (sim.pickHack(s, 825, 375).why !== 'jam') fail('s3 hack: the jammer did not block the hack');
    s = room(jam, { exploits: { jailbreak: 1 } });
    A.raise(s);
    if (!sim.pickHack(s, 825, 375).ok) fail('s3 hack: jailbreak should ignore the jammer');

    // 衝刺的瞬間不會受傷；「重新同步」只救一次；「謹慎」擋掉每間的第一下。
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { exploits: { secondwind: 1 } });
    go(s, 60);
    go(s, 1, pad({ dash: true, mx: 1 }));
    if (A.hitPlayer(s, 10) !== false) fail('s3 fight: hurt in the middle of a dash');
    go(s, 40);
    if (A.hitPlayer(s, 10) !== true || !(s.p.hp < s.p.maxHp)) fail('s3 fight: a hit after the dash did nothing');
    go(s, 40);
    A.hitPlayer(s, 999);
    if (s.over || !s.usedRevive || s.p.hp !== Math.round(s.p.maxHp * 0.4)) fail('s3 fight: resync did not bring the player back');
    go(s, 150);
    A.hitPlayer(s, 999);
    if (s.over !== 'dead') fail('s3 fight: resync worked twice');
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { traits: ['careful'] });
    go(s, 60);
    A.hitPlayer(s, 20);
    if (s.p.hp !== s.p.maxHp) fail('s3 fight: careful should block the first hit');
    go(s, 60);
    A.hitPlayer(s, 20);
    if (!(s.p.hp < s.p.maxHp)) fail('s3 fight: careful blocked twice');

    // 過敏：還沒被發現時會打噴嚏。
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { flaw: 'allergic' });
    if (!go(s, 60 * 40).includes('sneeze')) fail('s3 fight: no sneeze in 40 seconds');

    // 專注：時間變慢，專注條會掉；放開會回來。
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] });
    const t0 = s.t;
    go(s, 60, pad({ focus: true }));
    if (!(s.t - t0 < 0.5) || !(s.p.focus < s.st.focusMax)) fail('s3 fight: focus did not slow time');
    const f0 = s.p.focus;
    go(s, 60);
    if (!(s.p.focus > f0)) fail('s3 fight: focus did not recover');


    // ===== 小隊：一次一個人上場，隨時可以換；倒下的人被抓走，下一個人自動補上 =====
    {
      const three = { squad: [build({ weapon: 'pistol', traits: ['fast'] }), build({ weapon: 'shotgun', skills: { hack: 0, physical: 3, social: 0 } }), build({ weapon: 'silenced', job: 'disguise' })], active: 0 };
      s = sim.createRoom(arena({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }), three, { hp: [50, 70, 30] });
      if (s.team.length !== 3 || s.p.hp !== 50 || s.build.weapon !== 'pistol') fail('s3 squad: the first member should be on the field with their own health and weapon');
      go(s, 30);
      const bw = s.p.bw, x = s.p.x;
      go(s, 1, pad({ swap: 1 }));
      if (s.active !== 1 || s.p.hp !== 70 || s.build.weapon !== 'shotgun' || s.p.maxHp !== s.team[1].maxHp) fail('s3 squad: swapping did not bring in the second member');
      if (s.team[0].hp !== 50 || s.p.x !== x || s.p.bw > bw + 0.1 || s.p.bw > s.st.bwMax) fail('s3 squad: swapping should keep the position, the bandwidth and the first member\'s health');
      go(s, 1, pad({ swap: 0 }));
      if (s.active !== 1) fail('s3 squad: swapped again before the cooldown');
      go(s, Math.ceil(sim.SWAP_CD * 60) + 2);
      go(s, 1, pad({ swap: 2 }));
      if (s.active !== 2 || !(s.p.cloak > 0)) fail('s3 squad: the actor should come in disguised while the room is calm');
      // 倒下：被抓走，下一個還站著的人補上；全倒才算輸。
      go(s, 60);
      A.hitPlayer(s, 999);
      if (s.over || !s.team[2].down || s.active === 2 || s.p.hp <= 0) fail('s3 squad: when one member goes down the next should step in');
      const state = sim.teamState(s);
      if (!state[2].down || state[2].hp !== 0 || state[0].hp !== 50) fail('s3 squad: team state after a capture is wrong');
      go(s, 120);
      A.hitPlayer(s, 999);
      go(s, 120);
      A.hitPlayer(s, 999);
      if (s.over !== 'dead' || !s.team.every((m) => m.down)) fail('s3 squad: the run should end only when everyone is down');
      // 被抓的人不能換上來。
      s = sim.createRoom(arena({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }), three, { hp: [50, 0, 30] });
      go(s, 1, pad({ swap: 1 }));
      if (s.active !== 0) fail('s3 squad: swapped to a captured member');
    }

    // ===== 職業專長 =====
    {
      const jb = { props: [{ kind: 'junction', tx: 16, ty: 8, w: 1, h: 1 }, { kind: 'car', tx: 10, ty: 12, w: 2, h: 1, dir: 0 }], enemies: [{ kind: 'guard', x: 900, y: 425, ang: UP }, { kind: 'turret', x: 700, y: 600, ang: UP }] };
      // 後門：每間第一次駭入不用錢。
      s = room(jb, { job: 'backdoor' });
      if (sim.pickHack(s, 825, 425).cost !== 0) fail('s3 job: backdoor should make the first hack free');
      go(s, 1, pad({ hack: true, ax: 825, ay: 425 }));
      if (sim.pickHack(s, 900, 425).cost === 0) fail('s3 job: backdoor is only for the first hack');
      // 老系統：每次駭入少花一點；內網權限：砲塔便宜；水路：開車只要一點。
      if (sim.pickHack(room(jb, { job: 'legacy' }), 825, 425).cost !== 1) fail('s3 job: legacy systems should cut hack costs');
      if (sim.pickHack(room(jb, { job: 'network_access' }), 700, 600).cost !== S3.data.hacks.hijackTurret.cost - 1) fail('s3 job: network access should make turrets cheaper');
      if (sim.pickHack(room(jb, { job: 'river_route' }), 550, 625).cost !== 1) fail('s3 job: the docker should start cars for 1');
      // 工地門卡：自己不會被炸傷；消防員：不怕火。
      s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { job: 'site_pass' });
      go(s, 60);
      A.blast(s, s.p.x, s.p.y, 100, 0, { self: 30 });
      if (s.p.hp !== s.p.maxHp) fail('s3 job: the builder was hurt by a blast');
      const plain = sim.stats(build()).st, nurse = sim.stats(build({ job: 'heal' })), climber = sim.stats(build({ job: 'climb' }));
      if (climber.st.maxHp !== plain.maxHp + 20 || !climber.fl.fireproof || !nurse.fl.nurse) fail('s3 job: firefighter or nurse perk missing');
      // 接應撤離：每趟一次從必倒的一下裡脫身。
      s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { job: 'getaway' });
      go(s, 60);
      A.hitPlayer(s, 999);
      if (s.over || s.p.hp !== 1) fail('s3 job: the cab driver should get away once');
      go(s, 150);
      A.hitPlayer(s, 999);
      if (s.over !== 'dead') fail('s3 job: the getaway worked twice');
      for (const o of E.s2.people.occupations.concat(E.s2.people.rares)) if (!S3.data.jobFx[o.perk]) fail(`s3 job: ${o.id} (${o.perk}) does nothing in Season 3`);
    }

    // 同一個房間、同一串輸入，結果要一模一樣。
    const play = () => {
      const spec = S3.gen.room('same', 1, 3, 10, { type: 'fight', mod: 'rain', reward: 'exploit' }, 2);
      const st = sim.createRoom(spec, build({ exploits: { chain: 1 }, gadgets: [{ id: 'eagle', lv: 1 }] }));
      const bot = S3.bot.create('same');
      for (let i = 0; i < 1500 && !st.over && !st.cleared; i++) { sim.step(st, bot.act(st)); st.ev.length = 0; }
      return [st.tick, st.p.hp.toFixed(3), st.p.x.toFixed(2), st.stats.kills, st.stats.hacks, st.en.length].join('|');
    };
    const a = play(), b = play();
    if (a !== b) fail(`s3 fight: the same room played twice differs (${a} vs ${b})`);
    console.log('stealth and takedowns, the call before the alarm, gun noise, junction boxes, traps on unaware enemies, shields, hijacking, cars, medkits, bollards, jammers, dash, resync, focus, squads and swapping, job perks, repeatable results');
  }

  // ===== 一整趟的流程 =====
  section('第三季：流程');
  const newMeta = (perks = {}) => ({ echoes: 0, perks, runs: 0, wins: 0, best: 0, seen: {}, roster: [], vol: 0, story: {}, rescued: 0, seed: 'ci' });
  {
    const crew = R.crewFor('flow');
    const cat = (p) => E.people.occupationOf(p).category;
    if (crew.length !== 3 || new Set(crew.map(cat)).size !== 3) fail('s3 run: a crew of three different kinds expected');
    if (JSON.stringify(R.crewFor('flow')) !== JSON.stringify(crew)) fail('s3 run: the crew is not repeatable');
    const plain = R.start('flow', crew, newMeta()), buffed = R.start('flow', crew, newMeta({ hp: 2, bw: 1, stash: 2, reroll: 1 }));
    if (plain.squad.length !== 3 || plain.squad.some((m) => !D.weapons[m.weapon] || !D.gadgets[m.gadget.id] || !D.jobFx[m.job] || m.hp <= 0)) fail('s3 run: a member starts without a full kit');
    if (buffed.squad[0].hp !== plain.squad[0].hp + 16 || buffed.data !== 50 || buffed.rerolls !== plain.rerolls + 1) fail('s3 run: permanent upgrades not applied at the start');
    if (R.statsOf(buffed, 0).st.bwMax !== R.statsOf(plain, 0).st.bwMax + 1) fail('s3 run: the bandwidth upgrade did nothing');
    for (const p of crew) for (const code of LANGS) { E.i18n.set(code); if (!E.i18n.pick(E.people.name(p))) fail('s3 run: a crew member has no name'); }
    E.i18n.set('zh-Hant');

    // 打一間：門的數量在進房間時就知道，而且和打完之後的那批門一樣多。
    const run = R.start('flow', crew, newMeta());
    if (run.options.length !== 2 || run.options.some((o) => o.type !== 'fight')) fail('s3 run: the first choice should be two fights');
    const clearRoom = (r, i = 0, hurt) => {
      const spec = R.enter(r, i);
      const st = sim.createRoom(spec, R.simBuild(r), R.carry(r));
      if (hurt) hurt(st);
      for (const e of st.en.slice()) A.kill(st, e, { by: 'gun' });
      st.waves = [];
      sim.step(st, pad());
      st.cache.taken = true;
      return { spec, s: st, rw: R.finishRoom(r, st) };
    };
    let res = clearRoom(run);
    if (run.phase !== 'reward' || !res.rw) fail('s3 run: no reward after a room');
    const before = JSON.stringify(run.build.exploits);
    if (res.rw.picks) { R.take(run, res.rw.picks[0]); if (res.rw.kind === 'exploit' && JSON.stringify(run.build.exploits) === before) fail('s3 run: the exploit was not added'); } else R.take(run, null);
    R.advance(run);
    if (run.options.length !== res.spec.doors.length) fail(`s3 run: the room had ${res.spec.doors.length} doors but ${run.options.length} choices followed`);
    if (run.depth !== 1 || run.roomNo !== 1) fail('s3 run: depth or room count wrong after one room');
    // 存檔再讀回來，接下來的門和房間都一樣。
    const copy = JSON.parse(JSON.stringify(run));
    if (JSON.stringify(R.enter(copy, 0)) !== JSON.stringify(R.enter(run, 0))) fail('s3 run: a saved run continues differently');

    // 每一種獎勵都領得到；治療是全隊的。
    for (const kind of ['exploit', 'gadget', 'data', 'heal', 'max']) {
      const r = R.start('rw-' + kind, crew, newMeta());
      r.options = [{ type: 'fight', reward: kind, mod: null }];
      r.squad.forEach((m) => { m.hp = 20; });
      const out = clearRoom(r);
      const data = r.data, hp = r.squad.map((m) => m.hp), top = r.squad.map((m, i) => R.maxHp(r, i)), gear = JSON.stringify([r.gear, r.squad.map((m) => m.gadget)]);
      if (out.rw.kind !== kind) fail(`s3 run: asked for ${kind}, got ${out.rw.kind}`);
      R.take(r, out.rw.picks ? out.rw.picks[0] : null);
      if (kind === 'data' && !(r.data > data)) fail('s3 run: data reward gave nothing');
      if (kind === 'heal' && !r.squad.every((m, i) => m.hp > hp[i])) fail('s3 run: healing should reach the whole squad');
      if (kind === 'max' && !r.squad.every((m, i) => R.maxHp(r, i) === top[i] + 12)) fail('s3 run: max health reward gave nothing');
      if (kind === 'gadget' && JSON.stringify([r.gear, r.squad.map((m) => m.gadget)]) === gear) fail('s3 run: gadget reward gave nothing');
      if (r.phase !== 'doors') fail('s3 run: after a reward the doors should open');
    }
    // 裝備：隊上已經有的會升級（最多 3 級）；沒有的放進共用的那一格。
    {
      const r = R.start('gad', crew, newMeta());
      const mine = r.squad[1].gadget.id, other = Object.keys(D.gadgets).find((g) => !r.squad.some((m) => m.gadget.id === g));
      R.addGadget(r, mine); R.addGadget(r, mine); R.addGadget(r, mine);
      if (r.squad[1].gadget.lv !== 3 || r.gear) fail('s3 run: a member\'s own gadget should level up to 3');
      R.addGadget(r, other);
      if (!r.gear || r.gear.id !== other || R.buildOf(r, 0).gadgets.length !== 2) fail('s3 run: a new gadget should go to the shared slot');
      R.addGadget(r, other);
      if (r.gear.lv !== 2) fail('s3 run: the shared gadget should level up');
    }
    // 有人倒下：下一間還是打得下去，全倒才結束。
    {
      const r = R.start('down', crew, newMeta());
      // 一定打得倒：先拿掉無敵、謹慎的那一下，還有接應撤離。
      const drop = (st) => { st.p.inv = 0; st.p.guard = 0; st.team.forEach((m) => { m.escaped = true; m.guard = 0; }); A.hitPlayer(st, 999); };
      let out = clearRoom(r, 0, drop);
      if (!out.rw || !r.squad[0].down || r.active === 0 || r.stats.captured !== 1) fail('s3 run: one capture should not end the run');
      R.take(r, out.rw.picks ? out.rw.picks[0] : null);
      R.advance(r);
      const spec = R.enter(r, 0), st = sim.createRoom(spec, R.simBuild(r), R.carry(r));
      if (st.active === 0 || !st.team[0].down) fail('s3 run: the captured member came back');
      for (let i = 0; i < 3 && !st.over; i++) { for (let k = 0; k < 150; k++) sim.step(st, pad()); drop(st); }
      if (R.finishRoom(r, st) !== null || r.phase !== 'dead') fail('s3 run: the run should end when the whole squad is down');
    }
    // 黑市、安全屋。
    {
      const r = R.start('shop', crew, newMeta());
      r.options = [{ type: 'shop' }];
      r.data = 900; r.squad.forEach((m) => { m.hp = 10; });
      R.enter(r, 0);
      if (r.phase !== 'shop' || r.shop.items.length < 4) fail('s3 run: the black market is empty');
      r.shop.items.forEach((it, i) => {
        const data = r.data;
        if (!R.buy(r, i) || r.data !== data - it.price || !it.sold) fail(`s3 run: could not buy ${it.k} ${it.id || ''}`);
        if (R.buy(r, i)) fail('s3 run: bought the same thing twice');
      });
      if (!r.squad.every((m) => m.hp > 10)) fail('s3 run: the medkit should treat the whole squad');
      r.data = 0;
      if (R.restock(r)) fail('s3 run: restocked with no data');
      for (const choice of ['rest', 'train', 'tune']) {
        const q = R.start('safe-' + choice, crew, newMeta());
        q.options = [{ type: 'safe' }];
        q.squad.forEach((m) => { m.hp = 10; });
        R.enter(q, 0);
        const bwMax = R.statsOf(q, 0).st.bwMax;
        R.safe(q, choice);
        if (choice === 'rest' && !q.squad.every((m) => m.hp > 10)) fail('s3 run: rest did nothing');
        if (choice === 'train' && R.statsOf(q, 0).st.bwMax !== bwMax + 1) fail('s3 run: adding bandwidth did nothing');
        if (choice === 'tune') {
          if (q.phase !== 'reward' || q.pending.picks.some((id) => R.exploitDef(id).rar === 'c')) fail('s3 run: tuning should offer uncommon or better');
          R.take(q, q.pending.picks[0]);
        }
        if (q.phase !== 'done') fail(`s3 run: safe room ${choice} did not finish`);
      }
    }
    // 事件：每個選項、每種擲骰結果都走得到，文字存在，效果有發生。
    for (const def of D.events) def.choices.forEach((c, i) => {
      const wantKeys = new Set(c.roll ? c.roll.map((r) => `s3.ev.${def.id}.r${i}.${r[2]}`) : [`s3.ev.${def.id}.r${i}`]);
      const got = new Set();
      for (let n = 0; n < 60 && got.size < wantKeys.size; n++) {
        const r = R.start('ev-' + def.id, crew, newMeta());
        r.phase = 'event';
        r.event = { id: def.id, result: null };
        r.data = 100; r.squad.forEach((m) => { m.hp = 50; }); r.rng = 1000 + n * 7919;
        r.build.exploits.hollow = 1; r.build.exploits.fiber = 1;
        const snap = () => JSON.stringify([r.data, r.squad.map((m) => [m.hp, m.gadget]), r.build, r.gear, r.rerolls, r.curse, r.pending]);
        const was = snap();
        const out = R.choose(r, i);
        if (!out) { fail(`s3 event ${def.id}: choice ${i} refused`); break; }
        got.add(out.key);
        if (page.tables['zh-Hant'][out.key] === undefined) fail(`s3 event ${def.id}: no text for ${out.key}`);
        const fx = c.roll ? c.roll.find((x) => out.key.endsWith('.' + x[2]))[1] : c.fx;
        if ((Object.keys(fx).length || c.cost) && snap() === was) fail(`s3 event ${def.id}: ${out.key} changed nothing`);
        if (r.phase === 'reward') R.take(r, r.pending.picks[0]);
        if (r.phase !== 'done') fail(`s3 event ${def.id}: did not finish (${r.phase})`);
        r.squad.forEach((m, k) => { if (m.hp < 1 || m.hp > R.maxHp(r, k)) fail(`s3 event ${def.id}: health ${m.hp} out of range`); });
      }
      for (const k of wantKeys) if (!got.has(k)) fail(`s3 event ${def.id}: ${k} never happens`);
    });
    {
      const r = R.start('poor', crew, newMeta());
      r.phase = 'event'; r.event = { id: 'vending', result: null }; r.data = 0;
      if (R.canChoose(r, 0) || R.choose(r, 0)) fail('s3 event: paid for the vending machine with no data');
    }
    console.log(`a crew of three, permanent upgrades, rooms and doors, saving, all rewards, gadgets, captures, black market, safe room, ${D.events.length} encounters with every outcome`);
  }

  // ===== 名冊：招募、被捕、救人 =====
  section('第三季：名冊');
  {
    storage.clear();
    const m = R.meta();
    m.seed = 'roster';
    const joined = R.ensureRoster(m);
    if (joined.length !== 4 || m.roster.length !== 4 || m.roster.some((x) => x.status !== 'ready')) fail('s3 roster: a new save should start with four people');
    if (R.ensureRoster(m).length) fail('s3 roster: people were added when nobody was needed');
    const vols = R.volunteers(m);
    if (vols.length !== 2 || vols.some((p) => m.roster.some((x) => x.p.id === p.id && x.p.district === p.district))) fail('s3 roster: volunteers should be two new people');
    if (R.recruit(m, 0)) fail('s3 roster: recruited with no echoes');
    m.echoes = 10;
    if (!R.recruit(m, 0) || m.roster.length !== 5 || m.echoes !== 10 - R.RECRUIT_COST) fail('s3 roster: recruiting a volunteer failed');
    if (JSON.stringify(R.volunteers(m)) === JSON.stringify(vols)) fail('s3 roster: the volunteers should change after recruiting');
    // 一趟打輸：倒下的人被關；下一趟到拘留室把人救出來。
    const squad = m.roster.slice(0, 3).map((x) => x.p);
    const run = R.start('night-1', squad, m);
    run.squad[0].down = true; run.squad[0].hp = 0;
    run.squad[1].down = true; run.squad[1].hp = 0;
    run.squad[2].down = true; run.squad[2].hp = 0;
    run.stats.rooms = 4; run.stats.bosses = 0; run.roomNo = 5;
    const end = R.finish(run, false, m);
    if (end.captured.length !== 3 || m.roster.filter((x) => x.status === 'held').length !== 3 || end.earned !== 4) fail('s3 roster: the captured squad was not recorded');
    const fresh = R.ensureRoster(m);
    if (m.roster.filter((x) => x.status === 'ready').length < 3 || !fresh.length) fail('s3 roster: there should always be three people ready');
    const next = R.start('night-2', m.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p), m);
    if (next.held !== 3) fail('s3 roster: the run should know how many people are held');
    // 有人被關：每個區段到第四間前一定看得到拘留室。
    let sawCells = false;
    for (let d = 1; d <= 3 && !sawCells; d++) { next.depth = d; next.roomNo = d; sawCells = R.route(next).some((o) => o.type === 'cells'); }
    if (!sawCells) fail('s3 roster: no holding cells offered while people are held');
    next.options = [{ type: 'cells', reward: 'rescue', mod: null }];
    const spec = R.enter(next, 0);
    if (!spec.cells || !spec.enemies.some((e) => e.elite)) fail('s3 roster: the holding cells should be guarded by elites');
    const st = sim.createRoom(spec, R.simBuild(next), R.carry(next));
    st.p.inv = 0; st.p.guard = 0; st.team.forEach((t) => { t.escaped = true; }); // 剛進房間有一小段無敵；謹慎和接應撤離也先拿掉
    A.hitPlayer(st, 999);
    for (const e of st.en.slice()) A.kill(st, e, { by: 'gun' });
    st.waves = [];
    sim.step(st, pad());
    st.cache.taken = true;
    const rw = R.finishRoom(next, st);
    if (!rw || rw.kind !== 'rescue') fail('s3 roster: the holding cells should end in a rescue');
    const lost = next.squad[0].p;
    const saved = R.rescue(next, m);
    if (!saved || !saved.known || !saved.joined || next.squad[0].down || next.squad[0].p.id !== saved.p.id) fail('s3 roster: the rescued teammate should take the empty place in the squad');
    if (m.roster.filter((x) => x.status === 'held').length !== 2 || m.rescued !== 1 || next.phase !== 'doors') fail('s3 roster: the rescue was not recorded');
    // 被換下來的人還是被抓走了。
    const end2 = R.finish(next, false, m);
    if (!end2.captured.some((p) => p.id === lost.id) || m.roster.find((x) => x.p.id === lost.id && x.p.district === lost.district).status !== 'held') fail('s3 roster: the replaced member should be recorded as captured');
    // 沒有人被關的時候，拘留室救出來的是願意加入的陌生人。
    const m2 = R.meta();
    m2.seed = 'roster2'; m2.roster = []; m2.rescued = 0;
    R.ensureRoster(m2);
    const r3 = R.start('night-3', m2.roster.slice(0, 3).map((x) => x.p), m2);
    r3.pending = { kind: 'rescue' };
    const stranger = R.rescue(r3, m2);
    if (stranger.known || stranger.joined || m2.roster.length !== 5) fail('s3 roster: a freed stranger should join the roster');
    // 律師：到安全屋把倒下的隊友保出來，一趟一次。
    const law = R.start('bail', squad, newMeta());
    law.squad[0].job = 'bail';
    law.squad[1].down = true; law.squad[1].hp = 0;
    law.options = [{ type: 'safe' }];
    R.enter(law, 0);
    if (law.squad[1].down || !(law.squad[1].hp > 0) || !law.bailUsed) fail('s3 roster: the lawyer did not bail the teammate out');
    law.squad[2].down = true;
    if (R.bail(law)) fail('s3 roster: bail worked twice');
    // 打通：所有被關的人都放出來。
    const win = R.start('night-4', m.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p), m);
    win.stats.rooms = 17; win.stats.bosses = 3;
    const end3 = R.finish(win, true, m);
    if (m.roster.some((x) => x.status === 'held') || !(end3.freed > 0) || m.wins !== 1) fail('s3 roster: winning should free everyone');
    // 打完《宵禁》（盟友帶來的結局）：那一輪的隊伍跟過來，還在的人進名冊、被抓走的人關在基石；過世的人不會來。
    // 時間到、全滅不算；同一輪只接一次；名冊有上限。
    storage.clear();
    const curfewCrew = ['camden', 'soho', 'rotherhithe', 'westminster', 'isle_of_dogs', 'camden'].map((d, i) => E.people.generate('curfew-ci', d, i));
    const curfewSave = (ended, seed) => storage.set('watchdogs-echo.s2.proto', JSON.stringify({ v: 6, data: { seed, ended, roster: { members: curfewCrew.map((p, i) => ({ person: p, status: ['active', 'injured', 'network', 'arrested', 'lost', 'dead'][i] })) } } }));
    const mc = R.meta();
    mc.seed = 'carry';
    curfewSave('curfew', 'c1');
    if (R.inherit(mc)) fail('s3 carry: a curfew that ran out of time should not bring its crew over');
    curfewSave('deal', 'c1');
    const carried = R.inherit(mc);
    if (!carried || carried.ready.length !== 3 || carried.held.length !== 2 || mc.roster.filter((x) => x.veteran).length !== 5 || mc.roster.filter((x) => x.status === 'held').length !== 2) fail('s3 carry: the Curfew crew did not come over as expected');
    if (R.inherit(mc)) fail('s3 carry: the same Curfew crew came over twice');
    R.ensureRoster(mc);
    const vetRun = R.start('vet-night', mc.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p), mc);
    if (vetRun.held !== 2) fail('s3 carry: held veterans should send the squad to the holding cells');
    while (mc.roster.length < R.rosterMax(mc)) mc.roster.push({ p: E.people.generate('filler', 'soho', 100 + mc.roster.length), status: 'ready', runs: 0 });
    const others = curfewCrew.map((p, i) => E.people.generate('curfew-ci-2', p.district, i));
    storage.set('watchdogs-echo.s2.proto', JSON.stringify({ v: 6, data: { seed: 'c2', ended: 'dawn', roster: { members: others.map((p) => ({ person: p, status: 'active' })) } } }));
    R.inherit(mc);
    if (mc.roster.length > R.rosterMax(mc)) fail('s3 carry: the carry-over went past the roster limit');

    // 永久強化：殘響夠才買得到，買滿就不能再買。
    storage.clear();
    const m3 = R.meta();
    if (R.buyPerk(m3, 'hp')) fail('s3 meta: bought an upgrade with no echoes');
    m3.echoes = 100;
    for (let i = 0; i < 3; i++) if (!R.buyPerk(m3, 'hp')) fail('s3 meta: could not buy an upgrade');
    if (R.buyPerk(m3, 'hp') || R.perkLv(R.meta(), 'hp') !== 3 || R.meta().echoes !== 100 - 6 - 10 - 15) fail('s3 meta: upgrade levels or cost wrong');
    storage.set('watchdogs-echo.s3.meta', JSON.stringify({ v: 1, data: { echoes: 7, perks: { hp: 1 } } }));
    const old = R.meta();
    if (old.echoes !== 7 || !Array.isArray(old.roster) || old.perks.hp !== 1) fail('s3 meta: an older save did not migrate');
    storage.clear();
    console.log('four people to start, volunteers, captures recorded, holding cells and rescues, strangers joining, bail, everyone freed on a win, the Curfew crew carried over, older saves');
  }

  // ===== 機器人打整趟 =====
  section('第三季：機器人');
  {
    const RUNS = 20;
    let wins = 0, reached = 0;
    const beaten = new Set(), nodes = new Set();
    for (let i = 0; i < RUNS; i++) {
      const out = S3.bot.playRun('ci-' + i, { held: i % 2 });
      if (out.won) wins++;
      reached += out.run.roomNo;
      for (const r of out.rooms) {
        if (r.timeout) fail(`s3 bot: seed ci-${i} room ${r.no} (${r.boss || r.type}) never ended`);
        if (r.boss && !r.dead) beaten.add(r.boss);
        nodes.add(r.type);
      }
      if (out.won !== (out.run.phase === 'won')) fail('s3 bot: result and phase disagree');
    }
    // 難度的界線：正常打法的機器人不該幾乎每次都贏，也不該幾乎贏不了。
    if (wins < RUNS * 0.3 || wins > RUNS * 0.8) fail(`s3 balance: the bot won ${wins}/${RUNS} (expected 30%–80%)`);
    if (reached / RUNS < 12) fail(`s3 balance: the bot only reaches room ${(reached / RUNS).toFixed(1)} on average`);
    for (const b of Object.keys(D.bosses)) if (!beaten.has(b)) fail(`s3 balance: nobody beat ${b}`);
    for (const t of ['fight', 'elite', 'boss', 'cells']) if (!nodes.has(t)) fail(`s3 bot: no ${t} room was played`);
    const again = S3.bot.playRun('ci-3', { held: 1 }), first = S3.bot.playRun('ci-3', { held: 1 });
    if (JSON.stringify(again.rooms) !== JSON.stringify(first.rooms)) fail('s3 bot: the same seed played twice differs');
    console.log(`the bot won ${wins}/${RUNS} runs, reaching room ${(reached / RUNS).toFixed(1)} on average; all three bosses beaten`);
  }

  // ===== 音效和音樂 =====
  section('第三季：音效');
  {
    const param = () => ({
      value: 0,
      setValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error('bad value'); },
      cancelScheduledValues() {},
      exponentialRampToValueAtTime(v, t) { if (!(v > 0) || !Number.isFinite(t)) throw new Error('exponential ramp to ' + v); },
      linearRampToValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error('bad ramp'); },
      setTargetAtTime(v, t, c) { if (!Number.isFinite(v) || !(c > 0)) throw new Error('bad target'); },
    });
    let nodes = 0;
    const node = (fields = []) => { nodes++; const n = { connect: (x) => x, start() {}, stop() {} }; for (const k of fields) n[k] = param(); return n; };
    class FakeAudio {
      constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
      createGain() { return node(['gain']); }
      createOscillator() { return node(['frequency', 'detune']); }
      createBiquadFilter() { return node(['frequency', 'Q']); }
      createBufferSource() { return node(); }
      createConvolver() { return node(); }
      createDelay() { return node(['delayTime']); }
      createWaveShaper() { return node(); }
      createStereoPanner() { return node(['pan']); }
      createDynamicsCompressor() { return node(['threshold', 'knee', 'ratio', 'attack', 'release']); }
      createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
      resume() {}
      suspend() {}
    }
    page.ctx.AudioContext = FakeAudio;
    page.ctx.setTimeout = () => 0;
    page.ctx.clearTimeout = () => {};
    storage.delete('watchdogs-echo.muted');
    const X = E.sfx;
    X.unlock();
    const mine = X.names.filter((n) => n.startsWith('s3'));
    if (mine.length < 25) fail(`s3 sfx: only ${mine.length} sounds`);
    for (const name of mine) {
      const before = nodes;
      for (let i = 0; i < 8; i++) X.play(name);
      if (nodes === before) fail(`s3 sfx ${name}: built nothing (an error was swallowed?)`);
    }
    // 主程式用到的聲音都要存在。
    const text = fs.readFileSync(path.join(root, 'js/s3/main.js'), 'utf8');
    const used = new Set();
    // play('名稱') 和 play(條件 ? '甲' : '乙')：只收開頭、問號和冒號後面的字串，條件裡拿來比較的字串不算。
    for (const m of text.matchAll(/play\(([^;]*?)\)/g)) for (const q of m[1].matchAll(/(?:^|[?:]\s*)'(\w+)'/g)) used.add(q[1]);
    for (const block of text.matchAll(/const (?:SHOT|GADGET_SOUND|EVENT_SOUND) = \{([^}]*)\}/g)) for (const q of block[1].matchAll(/: '(\w+)'/g)) used.add(q[1]);
    for (const name of used) if (!X.names.includes(name)) fail(`s3 sfx: ${name} is used but not defined`);
    for (const g of Object.keys(D.gadgets)) if (!new RegExp(`\\b${g}: '\\w+'`).test(text)) fail(`s3 sfx: gadget ${g} has no sound`);
    // 音樂：三種情境的每一步都排得出來。
    if (X.now() !== 0) fail('s3 music: the clock should be readable once sound is on');
    for (const mode of ['calm', 'fight', 'boss']) {
      const before = nodes;
      for (let i = 0; i < 64; i++) S3.music.test(mode, i);
      if (nodes === before) fail(`s3 music: ${mode} scheduled nothing`);
    }
    S3.music.set('fight');
    if (S3.music.mode !== 'fight') fail('s3 music: mode not set');
    S3.music.set(null);
    console.log(`${mine.length} sounds built without errors, ${used.size} used by the game, music in three moods`);
  }
};
