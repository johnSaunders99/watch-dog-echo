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
    add('s3.mark.', Object.keys(D.imprints));
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

    // 燒傷不會讓還沒發現你的敵人發現你：會起疑、從火裡走出來，但不會叫人。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 300, ang: UP }] });
    s.p.cloak = 1e9;
    const burnt = s.en[0], burntHp = burnt.hp;
    s.zones.push({ k: 'fire', x: 800, y: 300, r: 70, t: 2, burn: 8, tick: 0 });
    const burnEv = go(s, 90);
    if (!(burnt.hp < burntHp) || burnt.state === 'combat' || s.alert || burnEv.includes('spotted')) fail('s3 trap: burning should hurt a guard without giving the player away');
    if (Math.hypot(burnt.x - 800, burnt.y - 300) < 70) fail('s3 trap: a burning guard should walk out of the fire');
    // 去查看爆炸的人停在火的外圍，不會自己走進去。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 250, ang: UP }] });
    s.p.cloak = 1e9;
    const looker = s.en[0];
    s.zones.push({ k: 'fire', x: 800, y: 500, r: 70, t: 10, burn: 8, tick: 0 });
    A.noise(s, 800, 500, 600);
    let closest = 1e9;
    for (let i = 0; i < 300; i++) { go(s, 1); closest = Math.min(closest, Math.hypot(looker.x - 800, looker.y - 500)); }
    if (closest < 70 || looker.hp < looker.maxHp || s.alert) fail(`s3 trap: a guard checking the explosion walked into the fire (closest ${Math.round(closest)})`);

    // 蒸汽：裡面的敵人暈頭轉向，正面也能制伏，隔一小段也能撲過去。
    s = face(room({ enemies: [{ kind: 'guard', x: 800, y: 450, ang: DOWN }] }), DOWN);
    s.zones.push({ k: 'steam', x: 800, y: 450, r: 130, t: 6, burn: 0, tick: 0 });
    s.p.x = 800; s.p.y = 530;
    const steamed = s.en[0];
    if (sim.takedownTarget(s) !== steamed) fail('s3 fight: a guard in steam should be open to a takedown from the front');
    go(s, 2, (i) => pad({ melee: i === 0 }));
    if (!steamed.dead || s.alert) fail('s3 fight: the takedown in steam did not land quietly');
    // 警報之後，用干擾耳機電暈，再撲過去制伏；中間有牆就撲不過去。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 470, ang: DOWN }] });
    A.raise(s);
    s.p.x = 800; s.p.y = 600;
    const dazed = s.en[0];
    go(s, 1, pad({ hack: true, ax: dazed.x, ay: dazed.y }));
    if (!(dazed.stun > 1.5)) fail(`s3 hack: the earpiece stun is too short to close in (${dazed.stun.toFixed(2)}s)`);
    if (sim.takedownTarget(s) !== dazed) fail('s3 fight: a stunned guard within lunge range should be open to a takedown');
    go(s, 2, (i) => pad({ melee: i === 0 }));
    if (!dazed.dead || Math.hypot(s.p.x - dazed.x, s.p.y - dazed.y) > dazed.r + s.p.r + 10) fail('s3 fight: the lunge takedown did not land');
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 470, ang: DOWN }] });
    A.raise(s);
    s.p.x = 800; s.p.y = 600;
    s.solid[A.idx(16, 10)] = 1;
    A.stun(s, s.en[0], 2);
    if (sim.takedownTarget(s)) fail('s3 fight: lunged through a wall');
    // 清場之後房間就安全了：剩下的火、油桶都不會再傷到人。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 300, ang: UP }] });
    A.kill(s, s.en[0], { by: 'gun' });
    go(s, 5);
    s.p.inv = 0;
    if (!s.cleared || A.hitPlayer(s, 50) !== false || s.p.hp !== s.p.maxHp) fail('s3 fight: the player was hurt after the room was clear');

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
      // 拘留室救出來的人：同一個房間裡就能補上倒下的人的位置，也能換上場；場上那個人不能被換掉。
      if (!sim.setMember(s, 1, build({ weapon: 'nailgun' }), 40) || s.team[1].down || s.team[1].hp !== 40) fail('s3 squad: a rescued teammate could not join the room');
      go(s, Math.ceil(sim.SWAP_CD * 60) + 2);
      go(s, 1, pad({ swap: 1 }));
      if (s.active !== 1 || s.build.weapon !== 'nailgun' || s.p.hp !== 40) fail('s3 squad: could not swap to the teammate who joined mid-room');
      if (sim.setMember(s, s.active, build(), 10)) fail('s3 squad: replaced the member on the floor');
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
    console.log('stealth and takedowns, the call before the alarm, gun noise, junction boxes, traps on unaware enemies, shields, hijacking, cars, medkits, fire and steam that stay quiet, steam and lunge takedowns, a safe room after clearing, bollards, jammers, dash, resync, focus, squads, swapping and mid-room joins, job perks, repeatable results');
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
        const snap = () => JSON.stringify([r.data, r.squad.map((m) => [m.hp, m.gadget, m.p.imprints]), r.build, r.gear, r.rerolls, r.curse, r.pending]);
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
    if (R.meta().campaign !== 'active') fail('s3 carry: saved veterans must be resumable');
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

  section('第三季：開局、重開、全名冊被捕');
  {
    storage.clear();
    const CURFEW = 'watchdogs-echo.s2.proto', META = 'watchdogs-echo.s3.meta', RUN = 'watchdogs-echo.s3.run';
    const put = (key, v, data) => storage.set(key, JSON.stringify({ v, data }));
    const json = JSON.stringify, ready = (m) => m.roster.filter((x) => x.status === 'ready');
    const squad = (m) => ready(m).slice(0, R.SQUAD).map((x) => x.p);
    const down = (r) => r.squad.forEach((x) => { x.down = true; x.hp = 0; });
    const from = (ended, members) => put(CURFEW, 6, { seed: 'curfew', ended, roster: { members } });
    const members = ['lost', 'network', 'active', 'dead', 'injured', 'arrested', 'away', 'injured', 'lost', 'arrested', 'active', 'active']
      .map((status, i) => ({ status, person: E.people.generate('old-crew', 'soho', 70 + i) }));
    const freshFields = (m) => !m.echoes && !m.runs && !m.wins && !m.best && !m.vol && !m.rescued && !m.squad &&
      json(m.perks) === '{}' && json(m.story) === '{}' && json(m.seen) === '{}' && json(m.unlocks) === '{"jobs":[],"events":[]}';
    if (R.inheritance().reason !== 'missing' || R.newGame('inherit', 'none') || storage.size) fail('s3 campaign: missing save was accepted or modified');
    from('dawn', members);
    const prevSource = storage.get(CURFEW);
    // 含同名候選人的種子：直接比《宵禁》真正的開場名單，而不只比職業分類。
    const N = sandbox(['js/engine/rng.js', 'js/engine/people.js', 'content-s2/people.js', 'js/engine/roster.js', 'js/engine/night.js']).E.night;
    for (const seed of ['zero-day', 'camden-ci-30', 'whitehall']) {
      const city = N.create(seed, { skipStory: true }), people = city.volunteers.map((id) => city.people[id]);
      const { meta: m, vets } = R.newGame('random', seed);
      if (vets || m.imported || m.roster.length !== 4 || ready(m).length !== 4 || m.roster.some((x) => x.veteran) || json(m.roster.map((x) => x.p)) !== json(people))
        fail('s3 campaign: random opening differs from Curfew or inherited automatically: ' + seed);
      const loaded = R.meta(); R.ensureRoster(loaded);
      if (json(loaded) !== json(m) || storage.get(CURFEW) !== prevSource) fail('s3 campaign: visiting the safehouse changed the crew or the Curfew source');
    }
    if (/\bR\.inherit\s*\(/.test(fs.readFileSync(path.join(root, 'js/s3/main.js'), 'utf8'))) fail('s3 campaign: UI merged the Curfew save outside the chosen new-game source');
    const prev = R.meta();
    Object.assign(prev, { echoes: 40, perks: { hp: 2 }, runs: 8, wins: 2, best: 17, rescued: 3, vol: 5, squad: ['old'],
      endings: { return: 1 }, story: { ended: 'return' }, seen: { hack: 1 }, unlocks: { jobs: ['fixture-job'], events: ['fixture-event'] } });
    R.saveMeta(prev); R.save(R.start('interrupted', squad(prev), prev));
    const savedMeta = storage.get(META), savedRun = storage.get(RUN);
    for (const ended of [null, 'curfew', 'wiped']) {
      from(ended, members);
      if (R.inheritance().reason !== 'unfinished' || R.newGame('inherit', 'nope')) fail('s3 campaign: incomplete Curfew save was accepted');
    }
    put(CURFEW, 6, { ended: 'deal' });
    if (R.inheritance().reason !== 'unreadable' || R.newGame('inherit', 'nope')) fail('s3 campaign: missing Curfew roster was accepted');
    const memberIds = (list) => list.map((p) => p.id).join(',');
    for (const ended of ['dawn', 'cage', 'wild', 'deal']) {
      from(ended, [null, { status: 'active', person: {} }, members[2], ...members]);
      const info = R.inheritance();
      if (info.reason || memberIds(info.ready) !== memberIds([2, 10, 11, 4, 7].map((i) => members[i].person)) ||
        memberIds(info.held) !== memberIds([5, 9, 0].map((i) => members[i].person))) fail('s3 campaign: preview priority, duplicates or limits: ' + ended);
    }
    if (storage.get(META) !== savedMeta || storage.get(RUN) !== savedRun) fail('s3 campaign: preview or failed inheritance discarded existing progress');
    const src = storage.get(CURFEW), plan = R.inheritance(), replaced = R.newGame('inherit', 'new-seed').meta;
    if (!freshFields(replaced) || !replaced.endings.return || replaced.roster.length !== 8 || !replaced.roster.every((x) => x.veteran) ||
      memberIds(replaced.roster.map((x) => x.p)) !== memberIds(plan.ready.concat(plan.held)) || R.load() || storage.get(CURFEW) !== src)
      fail('s3 campaign: confirmed restart did not replace only the campaign or did not honour the preview');
    // 舊老兵即使全在拘留室，也不會因為開啟舊存檔而回溯判定全滅。
    const legacy = Object.assign({}, prev, { imported: 'curfew:dawn', roster: replaced.roster.map((x) => Object.assign({}, x, { status: 'held', runs: 5 })) });
    delete legacy.campaign; delete legacy.unlocks;
    put(META, 3, legacy); storage.set(RUN, savedRun);
    const oldBytes = storage.get(META), old = R.meta();
    if (old.campaign !== 'active' || json(old.roster) !== json(legacy.roster) || old.wins !== 2 || old.echoes !== 40 || old.imported !== legacy.imported ||
      old.perks.hp !== 2 || !old.endings.return || old.unlocks.jobs.length || old.unlocks.events.length || !R.load() || storage.get(META) !== oldBytes)
      fail('s3 campaign: legacy veterans/progress changed on read');
    if (R.ensureRoster(old).length !== 3 || old.roster.filter((x) => x.veteran && x.status === 'held').length !== 8) fail('s3 campaign: a legacy all-held roster could not resume');
    const captive = E.people.generate('fill', 'camden', 1000);
    from('cage', [{ status: 'arrested', person: captive }]);
    const m = R.newGame('inherit', 'fill').meta;
    if (m.roster.length !== 4 || ready(m).length !== 3 || !m.roster[0].veteran || m.roster[0].status !== 'held' ||
      ready(m).some((x) => x.veteran || x.p.rare || x.p.district !== 'camden' || x.p.id === captive.id)) fail('s3 campaign: no deployable squad alongside the imported prisoner');
    let r = R.start('before-first-win', squad(m), m); down(r); r.stats.rooms = 2;
    const first = R.finish(r, false, m);
    if (first.wiped || first.meta.echoes !== 2 || ready(m).length || R.ensureRoster(m).length !== 3) fail('s3 wipe: total capture before a first win must allow replacements');
    r = R.start('win', squad(m), m); const victory = R.finish(r, true, m);
    if (victory.wiped || victory.freed !== 4 || m.wins !== 1 || ready(m).length !== 7) fail('s3 wipe: victory should free the holding cells');
    r = R.start('squad-not-roster', squad(m), m); down(r);
    if (R.finish(r, false, m).wiped || ready(m).length !== 4) fail('s3 wipe: three lost with reserves must not wipe');
    r = R.start('retreat', squad(m), m); r.squad[0].down = true;
    if (R.finish(r, false, m).wiped || ready(m).length !== 3) fail('s3 wipe: surviving operatives must return from retreat');
    // 本輪最後三人，又在拘留室中換下一個人：結算必須先處理 run.lost，再檢查整份名冊。
    r = R.start('last-squad', squad(m), m); r.squad[0].down = true; r.pending = { kind: 'rescue' };
    if (!R.rescue(r, m).joined) fail('s3 wipe: rescue setup did not replace the captured operative');
    Object.assign(m, { perks: { hp: 2 }, unlocks: { jobs: ['fixture-job'], events: ['fixture-event'] }, seen: { hack: 1 }, story: { intro: 1 },
      squad: ['last'], echoes: 50, endings: { return: 1, open: 1 } });
    R.saveMeta(m); R.save(r); down(r);
    const end = R.finish(r, false, m), closed = R.meta();
    if (!end.wiped || end.captured.length !== 4 || end.earned || closed.campaign !== 'wiped' || !freshFields(closed) || closed.seed || closed.imported ||
      closed.roster.length || R.ensureRoster(closed).length || R.inherit(closed) || R.load() || json(closed.endings) !== '{"return":1,"open":1,"wipe":1}')
      fail('s3 wipe: terminal save retained campaign progress, refilled prisoners, or dropped an ending');
    const again = R.newGame('inherit', 'another-night').meta;
    if (again.campaign !== 'active' || !freshFields(again) || !again.endings.wipe || !again.roster[0].veteran || ready(again).length !== 3)
      fail('s3 wipe: could not pick the same Curfew crew for a fresh campaign');
    r = R.start('first-again', squad(again), again); down(r);
    if (R.finish(r, false, again).wiped) fail('s3 wipe: remembered endings must not remove first-win protection');
    from('dawn', []);
    const empty = R.newGame('inherit', 'empty-source').meta;
    if (ready(empty).length !== 3 || empty.roster.some((x) => x.veteran)) fail('s3 carry: a completed empty roster must still supply a squad');
    empty.roster = []; empty.wins = 1;
    if (R.finish(R.start('no-roster', R.crewFor('no-roster'), empty), false, empty).wiped) fail('s3 wipe: an empty roster is not a captured roster');
    storage.clear();
    console.log('Camden opening matches Curfew, explicit import and caps, read-only previews, restart, legacy progress, full-roster loss after victory, rescue replacements, endings and fresh unlocks');
  }

  section('第三季：無人機與裝備存檔');
  {
    const gad = (id, lv = 1) => ({ id, lv });
    const deploy = (s, x, y, shared = false) => sim.step(s, pad({ ax: x, ay: y, [shared ? 'g2' : 'g1']: true }));
    const near = (a, b) => Math.abs(a - b) < 0.04;
    const crew = R.crewFor('kit-save'), jobs = ['builder', 'docker', 'removals'];
    for (const job of jobs) if (R.memberOf(Object.assign({}, crew[0], { occupation: job })).gadget.id !== 'cargo') fail('s3 kits: missing worker cargo: ' + job);
    const common = { hacker: ['escort', 'kamikaze'], physical: ['sledge', 'mine'], social: ['lure', 'mask'], specialist: ['spider', 'mine'] };
    for (const [k, ids] of Object.entries(common)) if (String(D.kits[k].gadget) !== String(ids)) fail('s3 kits: incorrect defaults for ' + k);
    const people = [crew[0], Object.assign({}, crew[1], { occupation: 'builder' }), Object.assign({}, crew[2], { occupation: 'locksmith' })];
    const old = R.start('kit-save', people, newMeta()); old.v = 2;
    old.squad.forEach((m, i) => { m.gadget = gad(i ? 'sergei' : 'eagle', i ? 3 : 2); });
    const roster = old.squad.map((m, i) => ({ p: m.p, status: i === 2 ? 'held' : 'ready', runs: 4, gadget: m.gadget }));
    storage.set('watchdogs-echo.s3.meta', JSON.stringify({ v: 2, data: Object.assign(newMeta(), { roster }) }));
    const migrated = R.meta(), fresh = R.start('kit-loaded', people, migrated);
    const kit = (m) => m.gadget.id + ':' + m.gadget.lv;
    const expected = 'kamikaze:2,cargo:3,mine:3';
    if (migrated.roster.map(kit).join() !== expected || fresh.squad.map(kit).join() !== expected || migrated.roster[2].status !== 'held') fail('s3 save: old roster lost its loadouts or custody status');
    for (const id of ['eagle', 'sergei']) {
      old.gear = gad(id, 2); old.phase = 'reward'; old.pending = { kind: 'gadget', picks: ['hammer', 'blackout', id] };
      old.shop = { items: [{ k: 'gadget', id: 'hammer', price: 75 }] };
      storage.set('watchdogs-echo.s3.run', JSON.stringify({ v: 2, data: old }));
      const r = R.load();
      if (r.v !== 3 || r.squad.map(kit).join() !== expected || r.gear.id !== id || r.gear.lv !== 2 || r.phase !== old.phase || r.rng !== old.rng ||
        r.pending.picks.includes('hammer') || r.pending.picks.includes('blackout') || r.shop.items[0].id !== 'sledge') fail('s3 save: own, shared or unclaimed gear migrated incorrectly');
      sim.createRoom(arena(), R.simBuild(r), R.carry(r));
      R.save(r); if (JSON.stringify(R.load()) !== JSON.stringify(r)) fail('s3 save: converted run did not round-trip');
    }
    R.saveMeta(migrated);
    if (R.meta().roster.map(kit).join() !== expected) fail('s3 save: converted roster did not round-trip');
    storage.clear();
    // 房間獎勵和商店都不能提供還沒從事件拿到的專屬裝備。
    for (let i = 0; i < 16; i++) {
      const r = R.start('cameo-stock-' + i, crew, newMeta());
      r.options = [{ type: 'shop' }]; R.enter(r, 0);
      const exclusive = (id) => D.gadgets[id].cameo || D.gadgets[id].signature;
      if (r.shop.items.some((it) => it.k === 'gadget' && exclusive(it.id))) fail('s3 kits: unearned exclusive in shop');
      r.pending = { kind: 'gadget', picks: [] }; r.rerolls = 1; R.reroll(r);
      if (r.pending.picks.some(exclusive)) fail('s3 kits: unearned exclusive in reward');
    }
    // 跟隨機：掩體後不射擊。換人、移動之後能跟上並從新位置開火；蜘蛛留在原地。
    const companion = (id) => build({ gadgets: [gad(id)] });
    let s = sim.createRoom(arena({ enemies: [{ kind: 'heavy', x: 800, y: 475 }] }), { squad: [companion('escort'), companion('spider')] });
    s.solid[A.idx(15, 12)] = s.solid[A.idx(16, 12)] = 1;
    deploy(s, 800, 475); go(s, 20);
    const pet = s.pets[0];
    if (!pet || !near(pet.t, 7 - s.t) || s.en[0].hp !== s.en[0].maxHp || s.bul.some((b) => b.by === 'ally')) fail('s3 escort: duration or line of fire behind cover');
    sim.swapTo(s, 1); deploy(s, 800, 475);
    const spider = s.pets[1], origin = spider.x;
    go(s, 70, pad({ mx: 1 }));
    if (s.active !== 1 || pet.x < origin + 160 || Math.hypot(pet.x - s.p.x, pet.y - s.p.y) > 65 || spider.x !== origin || spider.t <= pet.t) fail('s3 escort: did not follow the new operative or spider moved');
    s.en[0].x = pet.x + 170; s.en[0].y = pet.y; s.en[0].stun = 20; s.pets = [pet];
    if (!go(s, 50).includes('pshot') || s.en[0].hp >= s.en[0].maxHp) fail('s3 escort: no effective fire on a visible enemy');
    go(s, 330); if (s.pets.length) fail('s3 escort: remained after battery expired');

    s = room({ enemies: [{ kind: 'heavy', x: 800, y: 375 }] }, { gadgets: [gad('kamikaze')] });
    deploy(s, 800, 375); const target = s.en[0];
    if (target.hp !== target.maxHp || !s.zones.some((z) => z.k === 'kamikaze')) fail('s3 kamikaze: no flight before impact');
    if (!go(s, 31).includes('shock') || target.hp >= target.maxHp || target.stun < 2 || s.recon) fail('s3 kamikaze: no impact damage or shock');

    const guard = { kind: 'heavy', x: 810, y: 380 };
    s = room({ enemies: [guard] }, { gadgets: [gad('cargo')] }); deploy(s, 810, 380); go(s, 43);
    const crate = s.props.find((p) => p.kind === 'crate');
    if (!crate || !near(crate.temp, 10) || A.solidAt(s, crate.x, crate.y) !== 3 || !s.en[0] || s.en[0].hp >= s.en[0].maxHp || s.en[0].confused) fail('s3 cargo: missing impact, ordinary cover or clean targeting');

    // 偵查機在真正到達前不能引爆。牆後也能標記，噪音的目的地不是玩家；偵查本身沒有傷害。
    const arenaRecon = arena({ enemies: [{ kind: 'guard', x: 980, y: 370 }], props: [{ kind: 'camera', tx: 16, ty: 6, w: 1, h: 1, dir: 1 }] });
    arenaRecon.tiles[A.idx(18, 7)] = 1;
    const withEagle = () => build({ gadgets: [gad('mine'), gad('eagle')] });
    s = sim.createRoom(arenaRecon, { squad: [withEagle(), withEagle()] });
    s.p.cloak = 20;
    deploy(s, 800, 375, true); deploy(s, 800, 375, true);
    if (!s.recon || s.recon.orbit || s.p.gad[1].cd) fail('s3 eagle: flight input exploded the scout or started cooldown early');
    const scoutGuard = s.en[0], scoutHp = scoutGuard.hp;
    const pulses = go(s, 138);
    if (!s.recon.orbit || scoutGuard.mark <= 0 || !scoutGuard.goal || scoutGuard.goal.x !== 800 || scoutGuard.goal.y !== 375 ||
      scoutGuard.hp !== scoutHp || pulses.includes('pshot') || pulses.filter((k) => k === 'noise').length < 2 || s.alert) fail('s3 eagle: did not scout and lure quietly through the wall');
    const drone = A.spawn(s, 'drone', 800, 330), jammer = A.spawn(s, 'jammer', 780, 365), ambush = A.spawn(s, 'guard', 855, 390);
    for (const e of [drone, jammer]) { e.hp = e.maxHp = 300; e.state = 'combat'; }
    sim.swapTo(s, 1); deploy(s, 800, 375, true);
    if (s.recon || !ambush.dead || !near(drone.stun, 4) || !near(jammer.stun, 1.5) || !near(s.props[0].down, 4) || A.jammed(s, jammer.x, jammer.y) ||
      s.team.some((m) => !near(m.gad[1].cd, 16)) || !s.ev.some((e) => e.k === 'shock')) fail('s3 eagle: manual pulse, trap, machine outage or shared cooldown wrong');
    go(s, 100); if (jammer.stun > 0 || A.jammed(s, jammer.x, jammer.y) || s.props[0].aware) fail('s3 eagle: jammer electronics woke with the operator or camera spotted early');
    go(s, 145); if (!A.jammed(s, jammer.x, jammer.y) || s.props[0].down > 0) fail('s3 eagle: electronics did not recover');
    s = room({}, { gadgets: [gad('eagle', 2)] }); deploy(s, 2000, 775);
    if (s.recon.x !== s.p.x + 520) fail('s3 eagle: exceeded launch range');
    go(s, 504); if (!s.recon || !s.recon.orbit || s.p.gad[0].cd) fail('s3 eagle: level-two orbit ended early');
    go(s, 10); if (s.recon || !near(s.eagleCd, 12.8 - 0.05)) fail('s3 eagle: no timed detonation or wrong cooldown');

    // 先從投箱到命中，再觀察真正的敵人 AI；兩個交火目標之間放玩家，確認不會攔截干擾中的子彈。
    s = room({ enemies: [{ kind: 'turret', x: 675, y: 450 }, { kind: 'turret', x: 925, y: 450 }] }, { gadgets: [gad('sergei')] });
    s.p.cloak = 20; deploy(s, 800, 375); go(s, 43);
    const [left, right] = s.en; s.p.x = 800; s.p.y = 450;
    if (!s.props.some((p) => p.kind === 'crate') || !s.en.every((e) => e.confused > 5.9 && !e.ally && !e.call)) fail('s3 sergei: crate and scramble did not arrive together');
    go(s, 205);
    if (left.hp >= left.maxHp || right.hp >= right.maxHp || s.stats.hurt || s.alert || s.cleared) fail('s3 sergei: turrets did not trade real fire safely');
    s = room({ enemies: [{ kind: 'rusher', x: 730, y: 410 }, { kind: 'heavy', x: 920, y: 420 }] }, { gadgets: [gad('sergei')] });
    s.p.cloak = 20; deploy(s, 800, 530); go(s, 44);
    const [runner, heavy] = s.en; heavy.stun = 15;
    go(s, 120);
    if (runner.x <= 765 || heavy.hp >= heavy.maxHp || s.alert || s.stats.hurt) fail('s3 sergei: melee did not chase and damage the other enemy');
    go(s, 248); if (runner.confused > 0 || runner.call || s.alert || runner.state === 'combat') fail('s3 sergei: scrambled target did not recover to search');
    console.log('own and shared save migration, cameo sources, escort and swap, impact and cover, recon lure and manual/timed EMP, melee and machine crossfire');
  }

  section('零時差：特工邀約、高級客串與個人印記');
  {
    const ids = ['hitman', 'spy', 'drone_expert', 'hooligan', 'beekeeper', 'statue'];
    const endings = { return: 'aiden', burn: 'wrench', open: 'marcus', teach: 'darcy' };
    const contacts = Object.values(endings), ordinary = D.events.filter((e) => !e.premium);
    const crew = (m) => m.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p);
    const event = (r, id, i, m) => { r.phase = 'event'; r.event = { id, result: null }; return R.choose(r, i, m); };
    const draw = (r) => { r.options = [{ type: 'event' }]; R.enter(r, 0); return r.event.id; };
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!equal(Object.keys(S3.ops.profiles).sort(), ids.slice().sort()) || ordinary.length < 18 ||
      !equal(D.events.filter((e) => e.premium).map((e) => e.id).sort(), contacts.slice().sort())) fail('s3 contacts: incomplete pool');
    for (const id of ids) {
      const d = S3.ops.profiles[id], p = S3.ops.person(id);
      if (!equal(p, S3.ops.person(id)) || p.id !== 'elite-' + id || S3.ops.jobOf(p) !== d || !E.s2.people.districts[p.district] ||
        !['tc', 'sc', 'en'].every((k) => d.bio[k] && d.name[k] && E.people.name(p)[k]) ||
        !D.weapons[R.memberOf(p).weapon] || !D.gadgets[R.memberOf(p).gadget.id] || !S3.pictures[d.portrait]) fail('s3 fixed operative: ' + id);
    }
    storage.clear();
    let m = R.newGame('random', 'safehouse-door').meta;
    if (m.roster.some((x) => x.p.elite) || R.volunteers(m).some((p) => p.elite) || m.unlocks.jobs.length || m.unlocks.events.length) fail('s3 contacts: not a clean start');
    const firstRun = R.start('first-invite', crew(m), m), mirror = JSON.parse(JSON.stringify(m));
    const first = R.finish(firstRun, true, m, 'return').unlocked, id = first.job;
    if (!equal(first, R.finish(firstRun, true, mirror, 'return').unlocked) || !first.events.includes('aiden') || m.unlocks.jobs.length !== 1) fail('s3 contacts: seed or guaranteed ending');
    for (let i = 1; i < 7; i++) {
      const ending = Object.keys(endings)[i % 4], before = m.unlocks.jobs.slice();
      const u = R.finish(R.start('next-' + i, crew(m), m), true, m, ending).unlocked;
      if (!m.unlocks.events.includes(endings[ending]) || !m.endings[ending] ||
        (i < 6 ? !ids.includes(u.job) || before.includes(u.job) || m.unlocks.jobs.length !== i + 1 : u.job !== null)) fail('s3 contacts: duplicate or missing win award ' + i);
    }
    if (!equal(m.invitations, m.unlocks.jobs) || new Set(m.unlocks.events).size !== 4) fail('s3 contacts: invitation ledger');
    const flags = new Set(), awarded = new Set();
    for (let i = 0; i < 48; i++) {
      const n = R.newGame('random', 'one-win-' + i).meta, ending = Object.keys(endings)[i % 4];
      const u = R.finish(R.start('ending-sample', crew(n), n), true, n, ending).unlocked;
      if (u.events[0] !== endings[ending] || u.events.length > 2 || new Set(u.events).size !== u.events.length) fail('s3 contacts: ending or extra not distinct ' + ending);
      flags.add(u.events.length); awarded.add(u.job);
    }
    if (flags.size !== 2 || awarded.size !== 6) fail('s3 contacts: extra not optional or operative cannot be drawn');
    // 名冊滿時，不消耗邀請。過夜、重讀後還在；免費領取一次，普通志願者仍收費。
    while (m.roster.length < R.rosterMax(m)) m.roster.push({ p: E.people.generate('reserves', 'soho', m.roster.length), status: 'ready', runs: 0 });
    m.vol++; m.echoes = 0; R.saveMeta(m); m = R.meta();
    if (R.recruit(m, 0) || R.volunteers(m)[0].elite !== id) fail('s3 contacts: lost a full-roster invitation');
    R.dismiss(m, m.roster.length - 1);
    if (!R.recruit(m, 0) || m.echoes !== 0 || m.invitations.includes(id) || R.volunteers(m).some((p) => p.elite === id)) fail('s3 contacts: free recruitment or repeat invitation');
    const operative = m.roster.find((x) => x.p.elite === id);
    const captured = R.start('captured-contact', [operative.p, ...crew(m).slice(0, 2)], m);
    captured.squad[0].down = true;
    if (R.finish(captured, false, m).wiped || operative.status !== 'held' || m.invitations.length !== 5) fail('s3 contacts: capture with reserves');
    const rescue = R.start('rescue-contact', crew(m), m); rescue.pending = { kind: 'rescue' }; rescue.squad[1].down = true;
    const freed = R.rescue(rescue, m);
    if (!freed.known || !freed.joined || freed.p.elite !== id || rescue.squad[1].p.id !== operative.p.id || operative.status !== 'ready') fail('s3 contacts: rescue changed fixed identity');
    R.dismiss(m, m.roster.indexOf(operative));
    if (R.volunteers(m).some((p) => p.elite === id)) fail('s3 contacts: dismissal reissued the invitation');
    m.roster = m.roster.slice(0, 3);
    const wipe = R.start('closed-book', crew(m), m); wipe.squad.forEach((x) => { x.down = true; });
    const wiped = R.finish(wipe, false, m);
    if (!wiped.wiped || R.meta().invitations.length || R.meta().unlocks.jobs.length || R.meta().unlocks.events.length || !R.meta().endings.teach) fail('s3 contacts: wipe did not close only this campaign’s book');

    m = R.newGame('random', 'pool').meta;
    let r = R.start('pool-draw', crew(m), m);
    for (let i = 0; i < 70; i++) if (R.eventDef(draw(r)).premium) fail('s3 contacts: locked guest drawn');
    const met = new Set(); let firstDraws = 0;
    m.unlocks.events = contacts.slice();
    r = R.start('all-contacts', crew(m), m);
    for (let i = 0; i < 600; i++) {
      r.seen = []; r.rng = E.rng.hash('lobby-deck:' + i);
      const pick = draw(r);
      if (R.eventDef(pick).premium) { met.add(pick); firstDraws++; }
    }
    if (met.size !== 4 || firstDraws < 10 || firstDraws > 60) fail('s3 contacts: rare first-draw weight or reachability ' + firstDraws);
    for (const contact of contacts) {
      m.unlocks.events = [contact]; r = R.start('one-contact-' + contact, crew(m), m);
      for (let i = 0; i < 1200 && !r.seen.includes(contact); i++) draw(r);
      if (!r.seen.includes(contact)) fail('s3 contacts: guest never appears after unlock: ' + contact);
      R.save(r); r = R.load();
      for (let i = 0; i < 45; i++) draw(r);
      if (!equal(r.seen.filter((key) => R.eventDef(key).premium), [contact])) fail('s3 contacts: wrong guest or second visit on resume');
    }
    // 第三階段已經抽到的客串、已到手的裝備要能讀。未設定 contacts 的舊趟不追溯抽卡。
    delete r.contacts; r.seen = ['marcus']; r.gear = { id: 'eagle', lv: 2 }; r.event = { id: 'marcus', result: null }; r.phase = 'event';
    R.save(r); r = R.load();
    if (!R.choose(r, 1) || r.gear.id !== 'eagle' || r.gear.lv !== 2) fail('s3 contacts: legacy in-flight cameo or owned gear lost');
    r.seen = [];
    for (let i = 0; i < 60; i++) if (R.eventDef(draw(r)).premium) fail('s3 contacts: backfilled an old night');
    // 存檔後隊員和名冊是不同的物件。四個印記只跟做決定的人走，直到下一趟、被抓和救出。
    const events = ['hotwash', 'lastferry', 'bellwire', 'seamstress'], marks = ['softstep', 'tidebreath', 'arcscar', 'lining'];
    m = R.newGame('random', 'lasting').meta; const people = crew(m), agent = people[1];
    r = R.start('lasting', people, m); r.active = 1; R.save(r); r = R.load(); m = R.meta();
    const base = R.statsOf(r, 1).st, baseline = JSON.stringify(R.statsOf(r, 0));
    for (const [i, ev] of events.entries()) {
      const res = event(r, ev, 0, m);
      if (res.fx.person.id !== agent.id || res.fx.imprint !== marks[i] || R.choose(r, 0, m)) fail('s3 marks: wrong recipient or claim repeated: ' + ev);
      if (ev === 'bellwire' && (R.maxHp(r, 1) !== base.maxHp - 6 || r.squad[1].hp > R.maxHp(r, 1))) fail('s3 marks: scar failed to clamp active HP');
    }
    if (!event(r, 'seamstress', 0, m).fx.known || agent.imprints || r.squad[1].p.imprints.length !== 4) fail('s3 marks: duplicate effect or leaked into the original input');
    R.save(r); r = R.load(); m = R.meta();
    const again = R.start('next-night', crew(m), m), st = R.statsOf(again, 1).st;
    if (!equal(r.squad[1].p.imprints, marks) || !equal(again.squad[1].p.imprints, marks) || again.squad.some((x, i) => i !== 1 && x.p.imprints) ||
      st.maxHp !== base.maxHp + 6 || st.meleeDmg !== base.meleeDmg + 10 || Math.abs(st.detectMul - .85 * base.detectMul) > 1e-8 ||
      Math.abs(st.focusRegen - 1.2 * base.focusRegen) > 1e-8 || JSON.stringify(R.statsOf(again, 0)) !== baseline) fail('s3 marks: personal mechanics did not survive the next night');
    again.squad[1].down = true; R.finish(again, false, m);
    r = R.start('rescue-marks', crew(m), m); r.pending = { kind: 'rescue' }; r.squad[0].down = true;
    if (!equal(R.rescue(r, m).p.imprints, marks) || R.maxHp(r, 0) !== st.maxHp) fail('s3 marks: custody lost personal history');
    storage.clear();
    console.log('six unique invitations; paid/free, custody, wipe, seeded endings, legacy saves, four persistent personal marks; premium first draws: ' + firstDraws + '/600 with all four unlocked');
  }

  section('零時差：六位特工實戰與專屬裝備');
  {
    const crew = R.crewFor('field-partners');
    const field = (id, enemies, gear) => {
      const r = R.start('field-test', [S3.ops.person(id), ...crew.slice(0, 2)], newMeta());
      if (gear) R.addGadget(r, gear);
      return sim.createRoom(arena({ enemies }), R.simBuild(r), R.carry(r));
    };
    const foe = (kind, x, y) => ({ kind, x, y });
    const cast = (s, x, y, shared) => sim.step(s, pad({ [shared ? 'g2' : 'g1']: true, ax: x, ay: y }));
    const near = (x, y, eps = 0.04) => Math.abs(x - y) < eps;
    let s = field('hitman', [foe('heavy', 800, 720)]);
    s.p.ammo = 1; s.p.reload = 0.9;
    sim.step(s, pad({ dash: true }));
    if (s.p.reload || s.p.ammo !== 14 || s.weapon.noise || s.weapon.dmg <= D.weapons.pistol.dmg || s.weapon.rate <= D.weapons.pistol.rate) fail('s3 hitman: dash reload or custom suppressed pistol');
    s = field('hitman', [Object.assign(foe('heavy', 800, 725), { elite: 'armored' }), foe('turret', 830, 728)]);
    const [victim, next] = s.en; victim.state = next.state = 'combat'; next.cd = 20;
    sim.step(s, pad({ melee: true }));
    if (!victim.dead || !near(s.team[0].execCd, 4) || sim.takedownTarget(s)) fail('s3 hitman: alert execution or immediate repeat');
    go(s, 244);
    if (sim.takedownTarget(s) !== next) fail('s3 hitman: execution never recovered');
    s = field('hitman', [Object.assign(foe('boss', 800, 710), { boss: 'bulldog' })]); s.en[0].state = 'combat';
    if (sim.takedownTarget(s)) fail('s3 hitman: executed a healthy, alert boss');

    s = field('spy', [foe('guard', 800, 665), foe('guard', 945, 665)]);
    s.en[0].ang = UP; s.en[1].ang = s.en[1].base = Math.PI;
    const spyTarget = s.en[0], witness = s.en[1];
    const normal = room({ enemies: [foe('guard', 800, 665)] }); normal.en[0].ang = UP;
    if (sim.takedownTarget(s) !== spyTarget || sim.takedownTarget(normal)) fail('s3 spy: ambush reach did not extend');
    sim.step(s, pad({ melee: true }));
    if (!spyTarget.dead || witness.state !== 'calm') fail('s3 spy: extended silent takedown alerted a distant witness');
    s = field('spy', [foe('turret', 800, 375)]);
    sim.step(s, pad({ fire: true }));
    if (!s.bul.some((b) => b.sneak === 4.5 && b.assassin) || s.weapon.noise) fail('s3 spy: suppressed ambush multiplier');
    s = field('spy', [foe('turret', 800, 375), foe('turret', 1060, 375)]); const [at, away] = s.en;
    at.maxHp = at.hp = 400; at.cd = away.cd = 20;
    cast(s, 800, 375); const mark = s.zones[0];
    if (mark.k !== 'strike' || at.hp !== 400 || mark.x !== 800 || mark.y !== 375) fail('s3 spy: mortar did not mark the aimed point');
    const hits = go(s, 140, pad({ ax: 1060, ay: 375 })).filter((k) => k === 'boom').length;
    if (hits !== 3 || !near(at.hp, 400 - 3 * D.props.barrel.dmg) || away.hp !== away.maxHp || s.zones.length) fail('s3 spy: three separate barrel-strength impacts on the original mark');

    s = field('drone_expert', [foe('turret', 770, 550), foe('turret', 758, 450)]); s.p.cloak = 30;
    const [front, back] = s.en; front.stun = back.stun = 25; front.hp = back.hp = 400;
    cast(s, 770, 550); const pet = s.pets[0], shot = s.bul.find((b) => b.tracer);
    if (pet.kind !== 'expert' || !near(pet.t, 16) || !shot || shot.pierce !== 1 || shot.dmg !== 12 || pet.rate !== 5) fail('s3 expert: heavy escort loadout');
    pet.cd = 25; go(s, 33);
    if (front.hp !== 388 || back.hp !== 388) fail('s3 expert: first projectile did not pierce two targets');
    sim.swapTo(s, 1); go(s, 75, pad({ mx: 1 }));
    if (pet.x < 1000 || Math.hypot(s.p.x - pet.x, s.p.y - pet.y) > 65) fail('s3 expert: drone did not follow the new operative');
    go(s, 856); if (s.pets.length) fail('s3 expert: battery did not expire');

    s = field('hooligan', [foe('turret', 800, 655)]); s.en[0].stun = 15; s.en[0].hp = 5000;
    cast(s, 800, 655); const mates = s.pets;
    const replay = field('hooligan', [foe('turret', 800, 655)]); cast(replay, 800, 655);
    if (mates.length !== 3 || new Set(mates.map((m) => m.person.id)).size !== 3 || mates.some((m) => m.kind !== 'brawler' || m.dmg !== 22 || !near(m.t, 10)) ||
      JSON.stringify(mates.map((m) => m.person)) !== JSON.stringify(replay.pets.map((m) => m.person))) fail('s3 brawl: three deterministic civilian identities');
    const punches = go(s, 110).filter((k) => k === 'punch').length;
    if (punches < 3 || s.en[0].hp !== 5000 - 22 * punches || s.team.length !== 3) fail('s3 brawl: summoned people did not land real punches');
    go(s, 495); if (s.pets.length) fail('s3 brawl: crowd did not disperse');

    s = field('beekeeper', [foe('turret', 800, 450), foe('turret', 1040, 450)]); s.p.cloak = 20;
    const [inside, outside] = s.en;
    cast(s, 800, 450);
    if (!inside.bees || outside.bees > 0 || A.sightMul(s, inside) !== .38 || A.sightMul(s, outside) !== 1) fail('s3 swarm: did not shorten only vision inside the hive');
    go(s, 370);
    if (!near(inside.maxHp - inside.hp, 72) || outside.hp !== outside.maxHp || s.zones.length || inside.bees > 0) fail('s3 swarm: six-second damage, boundary or sight recovery');
    const shotAngle = (bees) => {
      const z = field('beekeeper', [foe('turret', 800, 660)]), t = z.en[0];
      t.bees = bees; t.state = 'combat'; t.ang = DOWN; t.atk = { k: 'burst', t: 0, n: 2 };
      sim.step(z, pad()); return z.ev.find((ev) => ev.k === 'eshot').ang;
    };
    if (near(shotAngle(0), shotAngle(1), 1e-5)) fail('s3 swarm: impaired gunfire still has the same aim');

    s = field('statue', [foe('rusher', 800, 630), foe('turret', 925, 795)]);
    const [frozen, side] = s.en; frozen.state = 'combat'; side.cd = 20;
    cast(s, 800, 500);
    if (!near(frozen.trance, 5) || side.trance > 0 || A.detectMul(s) !== .25 * s.st.detectMul) fail('s3 statue: cone or stillness');
    sim.step(s, pad({ mx: 1 })); if (A.detectMul(s) !== s.st.detectMul) fail('s3 statue: moving retained stillness');
    sim.step(s, pad({ fire: true, ax: 1400, ay: 775 })); if (A.detectMul(s) !== s.st.detectMul) fail('s3 statue: firing retained stillness');
    go(s, 284);
    if (frozen.y !== 630 || frozen.atk || frozen.trance <= 0) fail('s3 statue: enemy moved or attacked during trance');
    go(s, 55); if (frozen.trance > 0 || frozen.y === 630) fail('s3 statue: trance did not end');
    s = field('statue', [Object.assign(foe('boss', 800, 620), { boss: 'bulldog' })]); cast(s, 800, 600);
    if (!near(s.en[0].trance, 1.25)) fail('s3 statue: boss stayed under for a full trance');

    s = field('spy', [foe('shield', 800, 675), foe('heavy', 800, 827), foe('turret', 950, 775)], 'eightball');
    const [shield, behind, wall] = s.en; shield.ang = DOWN; s.solid[A.idx(17, 15)] = 1;
    cast(s, 800, 675, true);
    if (shield.hp !== shield.maxHp - 85 || behind.hp !== behind.maxHp - 85 || wall.hp !== wall.maxHp || !near(shield.stun, 2) ||
      !near(shield.noShield, 3) || s.p.gad[1].cd !== 7) fail('s3 eightball: circle, shield, wall or cooldown');
    sim.swapTo(s, 1); cast(s, 800, 675, true);
    if (shield.hp !== shield.maxHp - 85 || s.p.gad[1].cd < 6.9) fail('s3 eightball: swapping bypassed the shared cooldown');
    console.log('dash and execution; silent extended takedown and three marked impacts; two-target escort; three civilian punches; hive sight, aim and damage; cone, stillness and recovery; shared eight-ball');
  }

  // ===== 機器人打整趟 =====
  section('第三季：機器人');
  {
    const RUNS = 20;
    let wins = 0, reached = 0;
    const beaten = new Set(), nodes = new Set();
    for (let i = 0; i < RUNS; i++) {
      const out = S3.bot.playRun('ci-' + i, { held: i % 2 });
      if (out.run.squad.some((m) => m.p.elite) || out.run.seen.some((id) => R.eventDef(id).premium)) fail('s3 bot: collection content leaked into a fresh ordinary seed');
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
    for (const id of Object.keys(S3.ops.profiles)) {
      const seed = 'operative-' + id, crew = [S3.ops.person(id), ...R.crewFor(seed).slice(0, 2)];
      const out = S3.bot.playRun(seed, { crew });
      if (!['won', 'dead'].includes(out.run.phase) || !out.rooms.length || out.rooms.some((r) => r.timeout || !Number.isFinite(r.hp + r.secs))) fail('s3 operative bot: ' + id + ' did not finish normally');
      console.log(seed + ': ' + out.run.phase + ', room ' + out.run.roomNo + ', bosses ' + out.run.stats.bosses);
    }
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
