// 第二季原型：康登一區的夜間循環。
// 白天在街上掃描路人、決定今晚的行動；晚上派 1–3 個人走一串關卡。
// 每一關挑「解法 × 隊員」執行，成功率由能力、專長、特質、弱點、小習慣、關係和傷疤一起決定。
// 警戒累積到 30、60 會讓所有動作變難，到 100 就有人被捕。
// 所有狀態都在一個可以直接存檔的物件裡；亂數由（世界種子, 第幾步）決定，同一串操作永遠得到同樣的結果。
// 這裡不放任何台詞：文字都在 content-s2/ 和語言檔裡。
(function (E) {
  const people = () => E.s2.people;
  const content = () => E.s2.ops;

  const DISTRICT = 'camden';
  const MAX_NIGHTS = 10;
  const STREET_SIZE = 6;
  const STREET_STEP = 3;      // 每過一晚，街上換掉三個人
  const VOLUNTEERS = 1000;    // 開場自願者的編號
  const HELPERS = 2000;       // 「叫人」叫來的路人的編號
  const BANDWIDTH = 4;
  const MAX_SQUAD = 3;
  const LANGS = ['en', 'tc', 'sc'];

  // ===== 小工具 =====
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round2 = (v) => Math.round(v * 100) / 100;
  const indexOf = (id) => Number(String(id).split('-').pop());

  function person(s, id) {
    if (!s.people[id]) s.people[id] = E.people.generate(s.seed, DISTRICT, indexOf(id));
    return s.people[id];
  }
  const nameOf = (s, id) => ({ l: E.people.name(person(s, id)) });

  // 把資料表裡帶 {name} 的三語句子填好，交給 s2.raw 顯示。
  function fill(map, names) {
    const out = {};
    for (const l of LANGS) out[l] = map[l].replace(/\{(\w+)\}/g, (m, k) => (names[k] ? names[k][l] : m));
    return out;
  }
  const raw = (map) => ({ t: { l: map } });

  function say(s, c, k, v) {
    s.log.push({ c, k, v: v || {}, night: s.night });
    if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
  }

  function rand(s) {
    s.step++;
    return E.rng.derive(s.seed, 'step', s.step);
  }

  const traitIds = (s, id) => person(s, id).traits;
  const hasTrait = (s, id, t) => traitIds(s, id).includes(t);
  const hasQuirk = (s, id, q) => person(s, id).quirks.includes(q);
  const flawOf = (s, id) => E.people.flawOf(person(s, id));
  const perkId = (s, id) => E.people.occupationOf(person(s, id)).perk;
  const categoryOf = (s, id) => E.people.occupationOf(person(s, id)).category;
  const member = (s, id) => E.roster.get(s.roster, id);
  const scarsOf = (s, id) => (member(s, id) && member(s, id).scars) || [];

  // ===== 關係 =====
  function relationsOf(s, id) {
    return (s.relations[id] || []).map((r) => ({ other: r.other, type: r.type }));
  }
  const related = (s, a, b, type) => relationsOf(s, a).some((r) => r.other === b && r.type === type);

  // ===== 開新的一輪 =====
  function create(seed, opts = {}) {
    const s = {
      v: 1, seed: String(seed), night: 1, phase: 'start', district: DISTRICT,
      support: 0, heat: 10, towers: 4, step: 0, helperCount: 0,
      roster: E.roster.create({ ironman: !!opts.ironman }),
      people: {}, relations: {}, scanned: {}, owed: {},
      volunteers: [], featured: null, pick: null, op: null, queue: [], event: null, react: null, result: null, ended: null,
      log: [], stats: { ops: 0, wins: 0, recruited: [], lost: [], arrests: 0 },
    };

    // 開場的四個自願者：保證有駭客、身體、社交各一，第四個隨機。稀有人物留給玩家在街上發現。
    const used = new Set();
    for (const want of ['hacker', 'physical', 'social', null]) {
      for (let i = VOLUNTEERS; i < VOLUNTEERS + 300; i++) {
        if (used.has(i)) continue;
        const p = person(s, DISTRICT + '-' + i);
        if (!p.rare && (!want || E.people.occupationOf(p).category === want)) { used.add(i); s.volunteers.push(p.id); break; }
      }
    }
    // 前三晚，街上一定會出現一個稀有人物。
    for (let i = 100; i < 1000; i++) {
      if (person(s, DISTRICT + '-' + i).rare) { s.featured = DISTRICT + '-' + i; break; }
      delete s.people[DISTRICT + '-' + i];
    }
    const pool = [];
    for (let i = 0; i < MAX_NIGHTS * STREET_STEP + STREET_SIZE; i++) pool.push(i);
    if (s.featured) pool.push(indexOf(s.featured));
    s.relations = E.people.relations(s.seed, DISTRICT, pool);

    say(s, 'bagley', 's2.bagley.intro1');
    say(s, 'bagley', 's2.bagley.intro2');
    return s;
  }

  function recruitPerson(s, id) {
    if (!E.roster.canRecruit(s.roster) || member(s, id)) return false;
    E.roster.recruit(s.roster, person(s, id), s.night);
    Object.assign(member(s, id), { scars: [], wins: 0 });
    s.stats.recruited.push(id);
    delete s.owed[id];
    say(s, 'gain', 's2.log.joined', { name: nameOf(s, id) });
    return true;
  }

  function pickVolunteers(s, ids) {
    if (s.phase !== 'start' || ids.length !== 2 || !ids.every((id) => s.volunteers.includes(id))) return false;
    ids.forEach((id) => recruitPerson(s, id));
    s.phase = 'day';
    say(s, 'night', 's2.log.night', { n: s.night });
    say(s, 'bagley', 's2.bagley.first');
    return true;
  }

  // ===== 白天：街上的人 =====
  function street(s) {
    const from = (s.night - 1) * STREET_STEP;
    const ids = [];
    for (let i = from; i < from + STREET_SIZE; i++) ids.push(DISTRICT + '-' + i);
    if (s.featured && s.night <= 3 && !ids.includes(s.featured)) ids.splice(2, 0, s.featured);
    return ids.filter((id) => !member(s, id) && !s.owed[id]);
  }

  function scan(s, id) {
    if (s.phase !== 'day' || s.scanned[id]) return;
    s.scanned[id] = true;
  }

  function recruitOwed(s, id) {
    if (s.phase !== 'day' || !s.owed[id]) return false;
    return recruitPerson(s, id);
  }

  // 今晚可以做的行動。
  function ops(s) {
    const list = [];
    if (s.towers > 0) list.push({ key: 'tower', op: 'tower' });
    list.push({ key: 'broadcast', op: 'broadcast' });
    for (const m of s.roster.members) {
      if (m.status === 'arrested') list.push({ key: 'rescue:' + m.person.id, op: 'rescue', target: m.person.id, left: E.roster.TRANSFER_AFTER - (s.night - m.since) });
    }
    for (const id of street(s)) if (s.scanned[id]) list.push({ key: 'recruit:' + id, op: 'recruit', target: id });
    return list.map((e) => Object.assign(e, info(s, e)));
  }

  function info(s, e) {
    const C = content();
    const def = e.op === 'recruit' ? C.recruitOp : C.ops[e.op];
    let stages = e.op === 'recruit' ? C.recruit[people().problems.find((p) => p.id === person(s, e.target).problem).mission] : def.stages;
    const names = e.target ? { name: E.people.name(person(s, e.target)) } : {};
    // 家人已經在隊上：家人幫忙說話，第一關不用打。
    const family = e.target && relationsOf(s, e.target).find((r) => r.type === 'family' && member(s, r.other) && member(s, r.other).status === 'active');
    if (family && stages.length > 2) stages = stages.slice(1);
    return {
      kind: def.kind,
      name: fill(def.name, names),
      desc: e.op === 'recruit' ? E.people.problemText(person(s, e.target)) : fill(def.desc, names),
      stages,
      reward: def.reward,
      family: family ? family.other : null,
    };
  }

  function pickOp(s, key) {
    if (s.phase !== 'day' || !ops(s).some((e) => e.key === key)) return false;
    s.pick = key;
    s.phase = 'squad';
    return true;
  }

  function cancel(s) {
    if (s.phase === 'squad') { s.pick = null; s.phase = 'day'; }
  }

  // 檢查一支隊伍能不能出發：人數、狀態、死對頭。
  function squadCheck(s, ids) {
    if (!ids.length) return { ok: false, reason: 's2.squad.empty' };
    if (ids.length > MAX_SQUAD) return { ok: false, reason: 's2.squad.full' };
    if (!ids.every((id) => member(s, id) && member(s, id).status === 'active')) return { ok: false, reason: 's2.squad.unavailable' };
    for (const a of ids) for (const b of ids) {
      if (a < b && related(s, a, b, 'rival')) return { ok: false, reason: 's2.squad.rival', a, b };
    }
    return { ok: true };
  }

  // ===== 晚上：行動 =====
  const membersOf = (s) => s.op.squad.concat(s.op.temp);
  const able = (s, id) => !s.op.hurt[id] && !s.op.away[id] && !s.op.stageAway[id] && !s.op.taken[id];
  const stage = (s) => content().stages[s.op.stages[s.op.i]];
  const others = (s, id) => membersOf(s).filter((m) => m !== id);

  // 起始警戒：區域熱度，加上有前科、上夜班這類調整。
  function startAlert(s, ids) {
    let alert = s.heat;
    for (const id of ids) {
      alert += flawOf(s, id).startAlert || 0;
      for (const q of E.people.quirksOf(person(s, id))) alert += q.startAlert || 0;
    }
    return clamp(alert, 0, 90);
  }

  function launch(s, ids) {
    if (s.phase !== 'squad' || !squadCheck(s, ids).ok) return false;
    const e = ops(s).find((x) => x.key === s.pick);
    s.op = {
      key: e.key, op: e.op, target: e.target || null, name: e.name, stages: e.stages, reward: e.reward,
      i: 0, squad: ids.slice(), temp: [], alert: startAlert(s, ids), bw: BANDWIDTH,
      used: {}, ghost: null, cover: null, force: null, boost: -1, keycard: false,
      revealed: {}, hurt: {}, away: {}, stageAway: {}, taken: {}, extraRisk: {}, sulk: {}, backdoor: {}, fired: {},
    };
    s.pick = null;
    s.phase = 'op';
    say(s, 'op', 's2.log.opStart', { op: { l: e.name } });
    if (e.family) say(s, 'gain', 's2.log.familyHelp', { name: nameOf(s, e.family), target: nameOf(s, e.target) });
    for (const id of ids) {
      if (flawOf(s, id).event === 'freeze' && rand(s).chance(0.5)) s.queue.push({ type: 'freeze', who: id, choices: ['out', 'go'] });
    }
    enterStage(s);
    return true;
  }

  // 每進入一關，檢查弱點和小習慣會不會出包。
  function enterStage(s) {
    const st = stage(s);
    s.op.stageAway = {};
    say(s, 'stage', 's2.log.stage', { i: s.op.i + 1, n: s.op.stages.length, stage: { l: st.name } });
    for (const id of membersOf(s)) {
      if (!able(s, id)) continue;
      const flaw = flawOf(s, id);
      const r = rand(s);
      if (flaw.event === 'panic' && st.tags.includes('tunnel')) {
        const calm = others(s, id).find((o) => able(s, o) && hasTrait(s, o, 'calm'));
        if (calm) say(s, 'ok', 's2.ev.panic.calm', { name: nameOf(s, id), other: nameOf(s, calm) });
        else { s.op.stageAway[id] = true; say(s, 'warn', 's2.ev.panic', { name: nameOf(s, id) }); }
      }
      if (flaw.event === 'sneeze' && r.chance(0.25)) { say(s, 'warn', 's2.ev.sneeze', { name: nameOf(s, id) }); addAlert(s, 8, id); }
      if (hasQuirk(s, id, 'smoker') && r.chance(0.2)) { say(s, 'warn', 's2.ev.smoke', { name: nameOf(s, id) }); addAlert(s, 5, id); }
      if (flaw.event === 'lost' && st.tags.includes('exit') && r.chance(0.6)
        && !others(s, id).some((o) => hasTrait(s, o, 'driver') || hasTrait(s, o, 'memory'))) {
        say(s, 'warn', 's2.ev.lost', { name: nameOf(s, id) });
        addAlert(s, 10, id);
      }
      if (flaw.event === 'phone' && st.tags.includes('patrol') && r.chance(0.5)) s.queue.push({ type: 'phone', who: id, choices: ['take', 'risk'] });
      if (s.phase !== 'op') return;
    }
    pump(s);
  }

  // 有選項的事件一次處理一個。
  function pump(s) {
    if (s.phase === 'op' && s.queue.length) {
      s.event = s.queue.shift();
      s.phase = 'event';
    }
  }

  function answer(s, choice) {
    const ev = s.event;
    if (s.phase !== 'event' || !ev || !ev.choices.includes(choice)) return false;
    s.event = null;
    s.phase = 'op';
    const v = { name: nameOf(s, ev.who) };
    if (ev.type === 'freeze') {
      if (choice === 'out') s.op.away[ev.who] = true;
      else s.op.extraRisk[ev.who] = 0.15;
      say(s, 'ok', 's2.ev.freeze.' + choice + 'Done', v);
    } else if (ev.type === 'phone') {
      if (choice === 'take') { s.op.sulk[ev.who] = true; say(s, 'ok', 's2.ev.phone.takeDone', v); }
      else if (rand(s).chance(0.5)) say(s, 'ok', 's2.ev.phone.lucky', v);
      else { say(s, 'warn', 's2.ev.phone.caught', v); addAlert(s, 20, ev.who); }
    }
    pump(s);
    return true;
  }

  // ===== 解法 =====
  // 默契組合：回傳一群人會觸發哪些。組隊畫面也用它預覽。
  function combos(s) {
    if (!s.op) return [];
    return combosFor(s, membersOf(s).filter((id) => able(s, id)));
  }
  function combosFor(s, ms) {
    const pair = (fa, fb) => ms.some((a) => fa(a) && ms.some((b) => b !== a && fb(b)));
    const out = [];
    if (pair((a) => hasTrait(s, a, 'silver'), (b) => hasTrait(s, b, 'nimble'))) out.push('con_duo');
    if (ms.some((a) => hasTrait(s, a, 'memory')) && ms.some((b) => categoryOf(s, b) === 'hacker')) out.push('photo_hack');
    if (pair((a) => hasQuirk(s, a, 'cantonese'), (b) => hasQuirk(s, b, 'cantonese'))) out.push('cantonese_pair');
    if (pair((a) => hasQuirk(s, a, 'man_utd'), (b) => hasQuirk(s, b, 'liverpool'))) out.push('derby');
    return out;
  }

  // 目前這一關所有的解法，包括隱藏解法、偷來的門卡、稀有人物和默契組合帶來的解法。
  function approaches(s) {
    const st = stage(s);
    const sp = content().special;
    const list = st.approaches.slice();
    if (s.op.revealed[s.op.i] && st.hidden) list.push(Object.assign({ hidden: true }, st.hidden));
    if (s.op.keycard && st.tags.includes('door')) list.push(sp.keycard);
    for (const id of membersOf(s)) {
      const perk = perkId(s, id);
      const own = (a) => list.push(Object.assign({}, a, { id: a.id + ':' + id, only: id }));
      if (perk === 'master_keys' && st.tags.includes('door')) own(sp.master_keys);
      if (perk === 'pigeon_post' && st.tags.includes('data')) own(sp.pigeon_post);
      if (perk === 'rooftops' && st.tags.includes('patrol')) own(sp.rooftops);
      if (perk === 'pirate_radio' && st.tags.includes('broadcast')) own(sp.pirate_radio);
      if (hasTrait(s, id, 'driver') && st.tags.includes('exit')) own(sp.pickup);
      if (st.tags.includes('door') && hasTrait(s, id, 'nimble') && combos(s).includes('con_duo')
        && others(s, id).some((o) => able(s, o) && hasTrait(s, o, 'silver'))) own(sp.con_duo);
    }
    return list;
  }

  function bandwidthCost(s, a, id, mark) {
    const b = a.bandwidth || 0;
    if (!b) return 0;
    if (categoryOf(s, id) === 'hacker' && combos(s).includes('photo_hack')) return 0;
    if (perkId(s, id) === 'backdoor' && !s.op.backdoor[id]) {
      if (mark) s.op.backdoor[id] = true;
      return 0;
    }
    return b;
  }

  function tagsOf(s, a) {
    return new Set((a.tags || []).concat(stage(s).tags));
  }

  function riskOf(s, a, id) {
    if (a.sure) return 0;
    const p = person(s, id);
    const needs = a.needs || {};
    const tags = tagsOf(s, a);
    const perk = perkId(s, id);
    const ms = membersOf(s);
    let r = a.risk === undefined ? 0.3 : a.risk;
    for (const k in needs.skill || {}) r -= 0.1 * Math.max(0, (p.skills[k] || 0) - needs.skill[k]);
    if (a.perkBonus && a.perkBonus[perk]) r += a.perkBonus[perk];
    if (needs.ability && perk === needs.ability) r -= 0.1;
    if (hasTrait(s, id, 'calm')) r -= 0.05;
    if (hasTrait(s, id, 'nightowl') && s.op.i >= 2) r -= 0.15;
    const flaw = flawOf(s, id);
    r += flaw.risk || 0;
    for (const t in flaw.riskTags || {}) if (tags.has(t)) r += flaw.riskTags[t];
    for (const q of E.people.quirksOf(p)) for (const t in q.risk || {}) if (tags.has(t)) r += q.risk[t];
    const scars = scarsOf(s, id);
    if (scars.includes('inside')) r -= 0.1;
    if (scars.includes('veteran')) r -= 0.1;
    if (scars.includes('old_wound') && (tags.has('run') || tags.has('climb'))) r += 0.15;
    for (const o of ms) {
      if (o === id) continue;
      if (related(s, id, o, 'coworker')) r -= 0.1;
      if (related(s, id, o, 'ex')) r += 0.1;
    }
    if (combos(s).includes('derby')) r += 0.1;
    if (perk === 'legacy' && tags.has('hack')) r -= 0.25;
    if (perk === 'rooftops' && tags.has('climb')) r -= 0.3;
    if (s.op.alert >= 60) r += 0.2;
    else if (s.op.alert >= 30) r += 0.1;
    if (s.op.boost === s.op.i) r -= 0.15;
    r += s.op.extraRisk[id] || 0;
    return clamp(round2(r), 0.05, 0.95);
  }

  function exposureOf(s, a, id) {
    if (s.op.ghost === id) return 0;
    const tags = tagsOf(s, a);
    const perk = perkId(s, id);
    if (perk === 'legacy' && tags.has('hack')) return 0;
    let x = a.exposure === undefined ? 5 : a.exposure;
    if (perk === 'network_access' && tags.has('hack') && tags.has('office')) x = 0;
    x += flawOf(s, id).exposure || 0;
    if (combos(s).includes('cantonese_pair')) x -= 1;
    return Math.max(0, x);
  }

  // 某個隊員能不能用某個解法；能的話附上失敗率、警戒和頻寬。
  function candidate(s, a, id) {
    if (a.only && a.only !== id) return null;
    if (!able(s, id)) return { id, ok: false, reason: 's2.need.out' };
    const needs = a.needs || {};
    const blocks = flawOf(s, id).blocks || [];
    if (needs.perk && perkId(s, id) !== needs.perk) return { id, ok: false, reason: 's2.need.perk' };
    if ((needs.ability && blocks.includes(needs.ability)) || (a.tags || []).some((t) => blocks.includes(t))) return { id, ok: false, reason: 's2.need.blocked' };
    const forced = s.op.force === id && (a.tags || []).includes('physical');
    if (!forced) {
      for (const k in needs.skill || {}) if ((person(s, id).skills[k] || 0) < needs.skill[k]) return { id, ok: false, reason: 's2.need.skill' };
    }
    const bw = bandwidthCost(s, a, id);
    if (bw > s.op.bw) return { id, ok: false, reason: 's2.need.bandwidth' };
    return { id, ok: true, risk: riskOf(s, a, id), exposure: exposureOf(s, a, id), bandwidth: bw };
  }

  function options(s) {
    return approaches(s).map((a) => ({
      approach: a,
      candidates: membersOf(s).map((id) => candidate(s, a, id)).filter(Boolean),
    }));
  }

  // ===== 招式卡 =====
  function cards(s) {
    const out = [];
    for (const id of membersOf(s)) {
      const p = person(s, id);
      for (const t of E.people.traitsOf(p)) out.push(cardState(s, id, t.id, t.card));
      if (perkId(s, id) === 'take_over') out.push(cardState(s, id, 'take_over', { kind: 'active', effect: 'jam', name: people().perks.take_over.name, desc: people().perks.take_over.desc }));
    }
    return out;
  }

  function cardState(s, owner, cid, card) {
    const used = !!s.op.used[owner + ':' + cid];
    let usable = card.kind === 'active' && !used && able(s, owner) && !s.op.sulk[owner];
    const st = stage(s);
    if (usable) {
      if (card.effect === 'summon') usable = s.op.temp.length === 0;
      if (card.effect === 'reveal') usable = !!st.hidden && !s.op.revealed[s.op.i];
      if (card.effect === 'pickpocket') usable = !s.op.keycard;
      if (card.effect === 'talkdown' || card.effect === 'jam') usable = s.op.alert > 0;
      if (card.effect === 'ghost') usable = s.op.ghost !== owner;
      if (card.effect === 'cover') usable = s.op.cover !== owner;
      if (card.effect === 'force') usable = s.op.force !== owner;
      if (card.effect === 'boost') usable = s.op.boost !== s.op.i;
    }
    return { owner, id: cid, card, used, usable, sulking: !!s.op.sulk[owner] };
  }

  function useCard(s, owner, cid) {
    if (s.phase !== 'op') return false;
    const c = cards(s).find((x) => x.owner === owner && x.id === cid);
    if (!c || !c.usable) return false;
    s.op.used[owner + ':' + cid] = true;
    const v = { name: nameOf(s, owner) };
    switch (c.card.effect) {
      case 'summon': {
        const helper = person(s, DISTRICT + '-' + (HELPERS + s.helperCount++));
        s.op.temp.push(helper.id);
        say(s, 'gain', 's2.card.summon', Object.assign(v, { helper: nameOf(s, helper.id), job: { l: E.people.occupationOf(helper).name } }));
        break;
      }
      case 'reveal': s.op.revealed[s.op.i] = true; say(s, 'card', 's2.card.reveal', v); break;
      case 'ghost': s.op.ghost = owner; say(s, 'card', 's2.card.ghost', v); break;
      case 'talkdown': say(s, 'card', 's2.card.talkdown', v); addAlert(s, -15, owner); break;
      case 'pickpocket': s.op.keycard = true; say(s, 'card', 's2.card.pickpocket', v); break;
      case 'force': s.op.force = owner; say(s, 'card', 's2.card.force', v); break;
      case 'boost': s.op.boost = s.op.i; say(s, 'card', 's2.card.boost', v); break;
      case 'cover': s.op.cover = owner; say(s, 'card', 's2.card.cover', v); break;
      case 'jam': say(s, 'card', 's2.card.jam', v); addAlert(s, -30, owner); break;
    }
    return true;
  }

  // ===== 執行一個動作 =====
  function act(s, aid, id) {
    if (s.phase !== 'op') return false;
    const a = approaches(s).find((x) => x.id === aid);
    const c = a && candidate(s, a, id);
    if (!c || !c.ok) return false;
    s.op.bw -= bandwidthCost(s, a, id, true);
    const success = a.sure || rand(s).next() >= c.risk;
    if (s.op.ghost === id) s.op.ghost = null;
    if (s.op.force === id && (a.tags || []).includes('physical')) s.op.force = null;
    if (success) return succeed(s, a, id, c.exposure);
    if (s.op.cover === id) {
      s.op.cover = null;
      say(s, 'ok', 's2.card.coverSaved', { name: nameOf(s, id) });
      return true;
    }
    // 冷靜：同隊任何一個冷靜的人，都可以把這次失敗改判成功。
    const calm = membersOf(s).find((m) => able(s, m) && hasTrait(s, m, 'calm') && !s.op.used[m + ':calm'] && !s.op.sulk[m]);
    if (calm) {
      s.react = { type: 'reroll', owner: calm, who: id, approach: a, exposure: c.exposure };
      s.phase = 'react';
      return true;
    }
    fail(s, a, id, c.exposure);
    return true;
  }

  function succeed(s, a, id, exposure) {
    say(s, 'ok', 's2.raw', raw(fill(a.ok, { name: E.people.name(person(s, id)) })));
    addAlert(s, exposure, id);
    if (s.phase !== 'op' && s.phase !== 'event') return true;
    s.op.i++;
    if (s.op.i >= s.op.stages.length) return finish(s, 'win');
    enterStage(s);
    return true;
  }

  const FAIL_LINES = ['hack', 'physical', 'social', 'hands'];
  function fail(s, a, id, exposure) {
    const kind = FAIL_LINES.find((t) => (a.tags || []).includes(t)) || 'other';
    say(s, 'bad', 's2.fail.' + kind, { name: nameOf(s, id) });
    addAlert(s, exposure + (a.fail === undefined ? 10 : a.fail), id);
    if (s.phase !== 'op' && s.phase !== 'event') return;
    if (a.injure && rand(s).chance(a.injure)) {
      s.op.hurt[id] = true;
      say(s, 'bad', 's2.log.hurt', { name: nameOf(s, id) });
    }
    if (!membersOf(s).some((m) => able(s, m))) finish(s, 'retreat');
  }

  function react(s, use) {
    const rc = s.react;
    if (s.phase !== 'react' || !rc) return false;
    s.react = null;
    s.phase = 'op';
    if (rc.type === 'reroll') {
      if (use) {
        s.op.used[rc.owner + ':calm'] = true;
        say(s, 'card', rc.owner === rc.who ? 's2.card.rerollSelf' : 's2.card.reroll', { name: nameOf(s, rc.owner), other: nameOf(s, rc.who) });
        succeed(s, rc.approach, rc.who, rc.exposure);
      } else fail(s, rc.approach, rc.who, rc.exposure);
    } else if (rc.type === 'escape') {
      if (use) {
        s.op.used[rc.who + ':fast'] = true;
        say(s, 'card', 's2.card.escape', { name: nameOf(s, rc.who) });
      } else arrest(s, rc.who);
      finish(s, 'fail');
    }
    return true;
  }

  // ===== 警戒 =====
  function addAlert(s, amount, id) {
    const op = s.op;
    const before = op.alert;
    op.alert = clamp(before + amount, 0, 100);
    if (before < 30 && op.alert >= 30) {
      say(s, 'warn', 's2.alert.30');
      // 脾氣差的人在警戒升高時會跟巡邏員吵起來，除非同隊有口才好的人拉住。
      for (const m of membersOf(s)) {
        if (flawOf(s, m).event !== 'fight' || !able(s, m) || op.fired['fight:' + m]) continue;
        op.fired['fight:' + m] = true;
        const calmer = others(s, m).find((o) => able(s, o) && hasTrait(s, o, 'silver'));
        if (calmer) say(s, 'ok', 's2.ev.fight.calm', { name: nameOf(s, m), other: nameOf(s, calmer) });
        else { say(s, 'warn', 's2.ev.fight', { name: nameOf(s, m) }); return addAlert(s, 15, m); }
      }
    }
    if (before < 60 && op.alert >= 60) say(s, 'warn', 's2.alert.60');
    if (op.alert >= 100) bust(s, id);
  }

  // 警戒滿了：最後一個動手的人被無人機鎖定。
  function bust(s, id) {
    say(s, 'bad', 's2.alert.100', { name: nameOf(s, id) });
    const cab = membersOf(s).find((m) => perkId(s, m) === 'getaway' && able(s, m));
    if (cab) {
      say(s, 'card', 's2.log.cab', { name: nameOf(s, cab) });
      return finish(s, 'fail');
    }
    if (hasTrait(s, id, 'fast') && !s.op.used[id + ':fast'] && able(s, id)) {
      s.queue = [];
      s.react = { type: 'escape', owner: id, who: id };
      s.phase = 'react';
      return;
    }
    arrest(s, id);
    finish(s, 'fail');
  }

  function arrest(s, id) {
    s.op.taken[id] = true;
    s.stats.arrests++;
    say(s, 'bad', 's2.log.arrested', { name: nameOf(s, id) });
    if (!member(s, id)) return; // 叫來幫忙的路人
    E.roster.arrest(s.roster, id, s.night);
    if (member(s, id).status === 'lost') s.stats.lost.push(id);
    // 被捕者的家人會找上門來幫忙。
    for (const r of relationsOf(s, id)) {
      if (r.type === 'family' && !member(s, r.other)) {
        s.owed[r.other] = 'family';
        say(s, 'gain', 's2.log.familyCome', { name: nameOf(s, r.other), other: nameOf(s, id) });
      }
    }
  }

  function retreat(s) {
    if (s.phase !== 'op') return false;
    say(s, 'warn', 's2.log.retreat');
    return finish(s, 'retreat');
  }

  // ===== 結算 =====
  function finish(s, outcome) {
    const op = s.op;
    const res = { outcome, op: op.op, name: op.name, alert: op.alert, support: 0, heat: 0 };
    s.stats.ops++;
    s.queue = [];
    s.event = null;
    if (outcome === 'win') {
      s.stats.wins++;
      let support = op.reward.support;
      if (op.op === 'broadcast' && membersOf(s).some((m) => perkId(s, m) === 'pirate_radio')) {
        support *= 2;
        say(s, 'gain', 's2.log.radio');
      }
      if (op.op === 'tower') { s.towers--; say(s, 'gain', 's2.log.towerDown', { n: s.towers }); }
      if (op.op === 'rescue' && E.roster.rescue(s.roster, op.target)) {
        member(s, op.target).scars.push('inside');
        say(s, 'gain', 's2.log.rescued', { name: nameOf(s, op.target) });
      }
      if (op.op === 'recruit' && !recruitPerson(s, op.target)) {
        s.owed[op.target] = 'later';
        say(s, 'warn', 's2.log.full', { name: nameOf(s, op.target) });
      }
      for (const id of op.squad) {
        const m = member(s, id);
        m.wins = (m.wins || 0) + 1;
        if (m.wins === 3 && !m.scars.includes('veteran')) { m.scars.push('veteran'); say(s, 'gain', 's2.log.veteran', { name: nameOf(s, id) }); }
      }
      for (const id of membersOf(s)) {
        if (flawOf(s, id).event === 'brag' && !op.taken[id]) {
          support += 5;
          res.heat += 10;
          say(s, 'warn', 's2.ev.brag', { name: nameOf(s, id) });
        }
      }
      res.support = support;
      res.heat += Math.round(op.alert / 5);
      s.support = Math.min(100, s.support + support);
      say(s, 'gain', 's2.log.support', { n: support });
    } else {
      res.heat += 10 + Math.round(op.alert / 10);
    }
    const nurse = s.roster.members.some((m) => m.status === 'active' && perkId(s, m.person.id) === 'heal');
    for (const id in op.hurt) {
      if (!member(s, id) || op.taken[id]) continue;
      E.roster.injure(s.roster, id, nurse ? 1 : 2);
      if (rand(s).chance(0.4) && !member(s, id).scars.includes('old_wound')) {
        member(s, id).scars.push('old_wound');
        say(s, 'bad', 's2.log.oldWound', { name: nameOf(s, id) });
      }
    }
    for (const id of op.temp) {
      if (op.taken[id]) continue;
      s.owed[id] = 'helper';
      say(s, 'gain', 's2.log.helperOwed', { name: nameOf(s, id) });
    }
    s.heat = clamp(s.heat + res.heat, 0, 100);
    s.result = res;
    s.op = null;
    s.react = null;
    s.phase = 'result';
    return true;
  }

  // 今晚不出門：讓受傷的人休息，熱度也會退一點。
  function rest(s) {
    if (s.phase !== 'day') return false;
    say(s, 'night', 's2.log.rest');
    s.result = { outcome: 'rest', support: 0, heat: 0 };
    s.phase = 'result';
    return true;
  }

  // ===== 天亮了 =====
  function nextDay(s) {
    if (s.phase !== 'result') return false;
    s.night++;
    s.result = null;
    for (const ev of E.roster.tickNight(s.roster, s.night)) {
      if (ev.type === 'healed') say(s, 'gain', 's2.log.healed', { name: nameOf(s, ev.id) });
      if (ev.type === 'transferred') { s.stats.lost.push(ev.id); say(s, 'bad', 's2.log.transferred', { name: nameOf(s, ev.id) }); }
    }
    s.heat = Math.max(0, s.heat - 5);
    if (s.support >= 100) return end(s, 'liberated');
    if (s.night > MAX_NIGHTS) return end(s, 'curfew');
    if (!E.roster.housed(s.roster).length && !Object.keys(s.owed).length) return end(s, 'wiped');
    s.phase = 'day';
    say(s, 'night', 's2.log.night', { n: s.night });
    const held = s.roster.members.find((m) => m.status === 'arrested');
    if (held) say(s, 'bagley', 's2.bagley.held', { name: nameOf(s, held.person.id), n: E.roster.TRANSFER_AFTER - (s.night - held.since) });
    else if (s.heat >= 40) say(s, 'bagley', 's2.bagley.heat');
    else say(s, 'bagley', 's2.bagley.d' + rand(s).int(1, 5));
    return true;
  }

  function end(s, kind) {
    s.ended = kind;
    s.phase = 'end';
    return true;
  }

  E.night = {
    MAX_NIGHTS, BANDWIDTH, MAX_SQUAD,
    create, person, relationsOf, pickVolunteers,
    street, scan, recruitOwed, ops, pickOp, cancel, squadCheck, startAlert, combosFor, launch, rest,
    stage, options, combos, cards, useCard, act, react, answer, retreat, nextDay,
    members: (s) => (s.op ? membersOf(s) : []),
    able: (s, id) => !!s.op && able(s, id),
  };
})(window.ECHO = window.ECHO || {});
