// 第二季的白天：早上、中午、傍晚三個時段，每個時段安排一件事；晚上才出去行動。
// 交情：兩個人一起做事會變熟，到 3 變成朋友，掉到 −3 變成死對頭；死對頭的交情回到 0 就算和好。
// 弱點練得掉：有對應的教練一次算兩次，練夠了這個弱點就沒了。
// 每天早上可能發生一件隊友之間的事（足球、生日、前任、客串角色來訪、白天的奇遇……），有的會佔掉一個時段。
// 同一個人白天做了兩件事（派對不算），晚上就會累：失敗率 +10%，戰術地圖上第一回合少一個行動點。
// 資料在 content-s2/days.js；這裡只放規則。需要的夜間引擎功能（找人、說話、亂數、受傷）都經由 api 傳進來。
// 狀態：s.day（今天走到第幾個時段、做過什麼、早上的事件）、s.bonds（交情）、成員身上的 train（練到哪裡）、overcame（練掉的弱點）、gifts（天賦）。
(function (E) {
  const D = () => E.s2.days;
  const FRIEND = 3;
  const RIVAL = -3;
  const EVENT_CHANCE = 0.6;  // 每天早上發生隊友事件的機率
  const EVENT_GAP = 4;       // 同一件事至少隔幾晚才會再發生
  const PARTY_HEAT = 3;
  const SCOUT_THREAT = 5;    // 踩點的人威脅評分上升
  const AVAILABLE = ['active', 'injured', 'network']; // 白天找得到的人（外圍成員白天也可以過來）
  const OUT = ['active', 'network'];                   // 要出門的事（幫街坊、踩點、當教練、照顧人）

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const statusOf = (s, api, id) => (api.member(s, id) ? api.member(s, id).status : null);
  const housed = (s) => s.roster.members.filter((m) => ['active', 'injured'].includes(m.status)).map((m) => m.person.id);
  const actDef = (id) => D().activities.find((a) => a.id === id);
  const slotName = (s) => (s.day && s.day.slot < D().SLOTS.length ? D().SLOTS[s.day.slot] : null);

  // ===== 交情 =====
  // 還沒一起做過事的兩個人，交情從原本的關係算起。
  function bond(s, api, a, b) {
    const k = pairKey(a, b);
    if (s.bonds && s.bonds[k] !== undefined) return s.bonds[k];
    if (api.related(s, a, b, 'rival')) return RIVAL;
    if (api.related(s, a, b, 'family')) return 2;
    if (api.related(s, a, b, 'coworker')) return 1;
    if (api.related(s, a, b, 'ex')) return -1;
    return 0;
  }

  function setRel(s, a, b, type, on) {
    for (const [x, y] of [[a, b], [b, a]]) {
      const list = (s.relations[x] = s.relations[x] || []);
      const i = list.findIndex((r) => r.other === y && r.type === type);
      if (on && i < 0) list.push({ other: y, type });
      if (!on && i >= 0) list.splice(i, 1);
    }
  }

  // 改變交情；跨過門檻就變成朋友、死對頭，或和好、鬧翻。
  function addBond(s, api, a, b, d) {
    if (!d || !a || !b || a === b) return;
    s.bonds = s.bonds || {};
    const after = clamp(bond(s, api, a, b) + d, -5, 5);
    s.bonds[pairKey(a, b)] = after;
    const v = { name: api.name(s, a), other: api.name(s, b) };
    const rival = api.related(s, a, b, 'rival');
    const friend = api.related(s, a, b, 'friend');
    if (after >= FRIEND && !friend) {
      setRel(s, a, b, 'rival', false);
      setRel(s, a, b, 'friend', true);
      api.say(s, 'gain', 's2.day.log.friends', v);
    } else if (after <= RIVAL && !rival) {
      setRel(s, a, b, 'friend', false);
      setRel(s, a, b, 'rival', true);
      api.say(s, 'bad', 's2.day.log.rivals', v);
    } else if (rival && after >= 0) {
      setRel(s, a, b, 'rival', false);
      api.say(s, 'gain', 's2.day.log.madeUp', v);
    } else if (friend && after < 1) {
      setRel(s, a, b, 'friend', false);
      api.say(s, 'bad', 's2.day.log.fellOut', v);
    }
  }

  // ===== 弱點 =====
  const trainOf = (s, api, id) => D().training[api.flaw(s, id)] || null;
  function goodCoach(s, api, flaw, c) {
    const T = D().training[flaw];
    if (!T || !c || api.flaw(s, c) === flaw) return false;
    const k = T.coach;
    return (k.perks || []).includes(api.perk(s, c)) || (k.traits || []).some((x) => api.traits(s, c).includes(x)) || (k.cats || []).includes(api.category(s, c));
  }
  // 這個人練到哪裡：{ flaw, n, need }；沒有練得掉的弱點就是 null。
  function progress(s, api, id) {
    const flaw = api.flaw(s, id);
    const T = D().training[flaw];
    const m = api.member(s, id);
    return T && m ? { flaw, n: (m.train && m.train[flaw]) || 0, need: T.need } : null;
  }

  function trainUp(s, api, id, n, coach) {
    const p = progress(s, api, id);
    if (!p) return;
    const m = api.member(s, id);
    m.train = m.train || {};
    m.train[p.flaw] = p.n + n;
    const flawName = { l: E.people.flawOf(api.person(s, id)).name };
    if (m.train[p.flaw] < p.need) {
      api.say(s, 'day', coach ? 's2.day.log.trainCoach' : 's2.day.log.train', { name: api.name(s, id), other: coach ? api.name(s, coach) : null, flaw: flawName, n: m.train[p.flaw], max: p.need });
      return;
    }
    // 練夠了：弱點沒了。有前科的人，律師把紀錄處理掉，威脅評分也降下來。
    delete m.train[p.flaw];
    m.overcame = (m.overcame || []).concat(p.flaw);
    api.setPerson(s, id, (x) => { x.flaw = null; });
    if (p.flaw === 'record') m.threat = Math.max(0, (m.threat || 0) - 25);
    api.say(s, 'gain', 's2.day.log.overcame', { name: api.name(s, id), flaw: flawName });
  }

  function swapQuirk(s, api, id, from, to) {
    api.setPerson(s, id, (p) => {
      const i = from ? p.quirks.indexOf(from) : -1;
      if (i >= 0) p.quirks[i] = to;
      else if (!p.quirks.includes(to)) p.quirks.push(to);
    });
    const q = E.s2.people.quirks.find((x) => x.id === to);
    api.say(s, 'gain', 's2.day.log.quirk', { name: api.name(s, id), quirk: { l: q.name } });
  }

  function giveGift(s, api, id, g) {
    const m = api.member(s, id);
    if (!m || (m.gifts || []).includes(g)) return;
    m.gifts = (m.gifts || []).concat(g);
    api.say(s, 'gain', 's2.day.log.gift', { name: api.name(s, id), gift: { l: D().gifts[g].name } });
  }

  // ===== 一天開始 =====
  // quiet：搬到新的一區、開場那天，早上不會有事件。
  function begin(s, api, quiet) {
    s.day = { slot: 0, did: {}, event: null };
    if (s.scout && s.scout.night !== s.night) s.scout = null;
    if (!quiet) rollEvent(s, api);
  }

  // 給事件資料用的查詢工具（content-s2/days.js 的 who）。挑人用自己的亂數，不影響夜間的亂數順序。
  function query(s, api) {
    const r = E.rng.derive(s.seed, 'day', s.night);
    const ids = (st) => r.shuffle(s.roster.members.filter((m) => st.includes(m.status)).map((m) => m.person.id));
    return {
      home: ids(['active', 'injured']),
      up: ids(['active']),
      quirks: (id) => api.person(s, id).quirks,
      flaw: (id) => api.flaw(s, id),
      cat: (id) => api.category(s, id),
      skill: (id, k) => api.person(s, id).skills[k] || 0,
      wins: (id) => (api.member(s, id) && api.member(s, id).wins) || 0,
      rel: (a, b, t) => api.related(s, a, b, t),
      gifts: (id) => ((api.member(s, id) && api.member(s, id).gifts) || []).length,
      lacks: (id, g) => !((api.member(s, id) && api.member(s, id).gifts) || []).includes(g),
      mainOpen: api.mainOpen(s),
      trainable: (id) => !!trainOf(s, api, id),
      pick: (list) => (list.length ? r.pick(list) : null),
      best: (list, score) => list.slice().sort((a, b) => score(b) - score(a))[0] || null,
      pair(list, test) {
        for (const a of list) for (const b of list) if (a !== b && test(a, b)) return [a, b];
        return null;
      },
      quirkName: (q) => ({ l: E.s2.people.quirks.find((x) => x.id === q).name }),
      flawName: (id) => ({ l: E.people.flawOf(api.person(s, id)).name }),
    };
  }

  const whoOf = (ev, q) => { const who = ev.who(q); return who && who.length && !who.some((x) => !x) ? who : null; };
  function rollEvent(s, api) {
    if (s.night < 2) return;
    const r = api.rand(s);
    if (!r.chance(EVENT_CHANCE)) return;
    const q = query(s, api);
    const last = s.devLast || {};
    const pool = [];
    for (const ev of D().events) {
      if (last[ev.id] !== undefined && (ev.once || s.night - last[ev.id] < EVENT_GAP)) continue;
      if (ev.perDistrict && (s.devWhere || {})[ev.id] === s.district) continue;
      if ((ev.from && s.night < ev.from) || (ev.minHeat && s.heat < ev.minHeat)) continue;
      if (ev.after && last[ev.after] === undefined) continue;
      const who = whoOf(ev, q);
      if (who) pool.push({ ev, who });
    }
    if (!pool.length) return;
    const { ev, who } = r.weighted(pool, (x) => x.ev.weight || 1);
    open(s, api, ev, who, q);
  }
  function open(s, api, ev, who, q) {
    s.devLast = Object.assign(s.devLast || {}, { [ev.id]: s.night });
    s.devWhere = Object.assign(s.devWhere || {}, { [ev.id]: s.district });
    const v = { name: api.name(s, who[0]) };
    if (who[1]) v.other = api.name(s, who[1]);
    Object.assign(v, ev.vars ? ev.vars(q, who) : {});
    s.day.event = { id: ev.id, who, v, choices: ev.choices.map((c) => c.id) };
  }
  // 測試用：不看機率和間隔，直接讓某件事發生（找不到合適的人就回傳 false）。
  function force(s, api, id) {
    const ev = D().events.find((x) => x.id === id);
    if (!ev || s.phase !== 'day' || !s.day) return false;
    const q = query(s, api);
    const who = whoOf(ev, q);
    if (!who) return false;
    open(s, api, ev, who, q);
    return true;
  }

  // 回答早上的事件。
  function answer(s, api, choice) {
    const ev = s.day && s.day.event;
    const def = ev && D().events.find((x) => x.id === ev.id);
    const c = def && def.choices.find((x) => x.id === choice);
    if (s.phase !== 'day' || !c) return false;
    s.day.event = null;
    if (c.slot) {
      s.day.slot = Math.min(D().SLOTS.length, s.day.slot + 1);
      busy(s, ev.who);
    }
    // 事件裡的人可能已經不在了（被捕、離隊）：只執行還找得到的人的效果。
    let fx = c.fx;
    let key = 's2.dev.' + ev.id + '.' + choice + 'Done';
    if (c.p !== undefined) {
      const ok = api.rand(s).chance(c.p);
      fx = ok ? c.ok : c.bad;
      key = 's2.dev.' + ev.id + '.' + choice + (ok ? 'Ok' : 'Bad');
    }
    api.say(s, 'day', key, ev.v);
    run(s, api, fx || [], ev.who);
    return true;
  }

  function run(s, api, fx, who) {
    const here = (i) => (who[i] && AVAILABLE.concat(['away']).includes(statusOf(s, api, who[i])) ? who[i] : null);
    for (const [k, ...a] of fx) {
      if (k === 'bond') addBond(s, api, here(a[0]), here(a[1]), a[2]);
      else if (k === 'bondAll') { const x = here(a[0]); if (x) for (const o of housed(s)) addBond(s, api, x, o, a[1]); }
      else if (k === 'hurt' && here(a[0])) api.injure(s, here(a[0]), a[1]);
      else if (k === 'support') { s.support = Math.min(100, s.support + a[0]); api.say(s, 'gain', 's2.log.support', { n: a[0] }); }
      else if (k === 'heat') {
        s.heat = clamp(s.heat + a[0], 0, 100);
        api.say(s, a[0] > 0 ? 'warn' : 'gain', a[0] > 0 ? 's2.day.log.heatUp' : 's2.day.log.heatDown', { n: Math.abs(a[0]) });
      } else if (k === 'threat' && here(a[0])) { const m = api.member(s, here(a[0])); m.threat = clamp((m.threat || 0) + a[1], 0, 100); }
      else if (k === 'gift' && here(a[0])) giveGift(s, api, here(a[0]), a[1]);
      else if (k === 'train' && here(a[0])) trainUp(s, api, here(a[0]), a[1]);
      else if (k === 'quirk' && here(a[0])) swapQuirk(s, api, here(a[0]), a[1], a[2]);
      else if (k === 'send') api.send(s);
      else if (k === 'hour') { s.day.spare = (s.day.spare || 0) + 1; api.say(s, 'gain', 's2.day.log.hour'); }
      else if (k === 'tap') { s.tap = Math.max(s.tap || 0, s.night + a[0]); api.say(s, 'gain', 's2.log.job.tap', { n: a[0] }); }
      else if (k === 'rest') {
        s.day.slot = D().SLOTS.length;
        s.day.busy = {};
        for (const m of s.roster.members) if (m.threat) m.threat = Math.max(0, m.threat - 3);
        api.say(s, 'gain', 's2.day.log.rest');
      }
    }
  }

  // ===== 白天的安排 =====
  // 第 i 個位置可不可以放這個人（介面的選人畫面用）。train 的第二個人是教練，care 的第一個人是傷員。
  function canPick(s, api, act, i, id) {
    const st = statusOf(s, api, id);
    const m = api.member(s, id);
    if (act === 'train') return i === 0 ? AVAILABLE.includes(st) && !!trainOf(s, api, id) : AVAILABLE.includes(st);
    if (act === 'care') return i === 0 ? st === 'injured' : OUT.includes(st);
    if (act === 'scout' || act === 'neighbours') return OUT.includes(st) && !(m && m.critical);
    return AVAILABLE.includes(st);
  }

  // 能不能做這件事：回傳 { ok, reason }（reason 是 s2.day.need.* 的 key）。
  function check(s, api, act, ids) {
    ids = ids || [];
    const def = actDef(act);
    const no = (k) => ({ ok: false, reason: 's2.day.need.' + k });
    if (s.phase !== 'day' || !def || !s.day) return no('slots');
    if (s.day.event) return no('event');
    if (!slotName(s)) return no('slots');
    if (def.daily && s.day.did[act]) return no('daily');
    if (def.evening && slotName(s) !== 'evening') return no('evening');
    if (def.every && s.lastParty && s.night - s.lastParty < def.every) return no('party');
    if (act === 'party') return housed(s).length >= 3 ? { ok: true } : no('crowd');
    const want = def.people + (def.coach && ids[1] ? 1 : 0);
    if (ids.length !== want || new Set(ids).size !== ids.length) return no('people');
    if (!ids.every((id, i) => canPick(s, api, act, i, id))) return no(act === 'train' ? 'flaw' : act === 'care' ? 'injured' : 'people');
    if (act === 'train' && trainOf(s, api, ids[0]).solo === false && !goodCoach(s, api, api.flaw(s, ids[0]), ids[1])) return no('coach');
    return { ok: true };
  }

  const HANG_BONUS = ['family', 'coworker'];
  function act(s, api, id, ids) {
    ids = ids || [];
    if (!check(s, api, id, ids).ok) return false;
    const [a, b] = ids;
    const v = { name: a ? api.name(s, a) : null, other: b ? api.name(s, b) : null };
    s.day.did[id] = true;
    if (s.day.spare) s.day.spare--; // 多出來的一小時
    else s.day.slot++;
    if (id !== 'party') busy(s, ids);
    if (id === 'hang') {
      const qa = api.person(s, a).quirks, qb = api.person(s, b).quirks;
      const derby = (qa.includes('man_utd') && qb.includes('liverpool')) || (qa.includes('liverpool') && qb.includes('man_utd'));
      const shared = D().interests.find((x) => qa.includes(x) && qb.includes(x));
      if (derby && api.rand(s).chance(0.5)) {
        api.say(s, 'day', 's2.day.hang.derby', v);
        addBond(s, api, a, b, -1);
        return true;
      }
      const line = shared ? 's2.day.hang.' + shared : api.related(s, a, b, 'rival') ? 's2.day.hang.rival' : 's2.day.hang.plain' + api.rand(s).int(1, 3);
      api.say(s, 'day', line, v);
      addBond(s, api, a, b, 1 + (shared ? 1 : 0) + (HANG_BONUS.some((t) => api.related(s, a, b, t)) ? 1 : 0));
    } else if (id === 'train') {
      const good = goodCoach(s, api, api.flaw(s, a), b);
      trainUp(s, api, a, good ? 2 : 1, b);
      if (b) addBond(s, api, a, b, 1);
    } else if (id === 'care') {
      // 護理師一次照顧兩晚的份，也能讓重傷的人脫離危險；其他人照顧，重傷的人還是要送診所或等護理師。
      const m = api.member(s, a);
      const nurse = api.perk(s, b) === 'heal';
      m.injuredFor -= nurse ? 2 : 1;
      if (nurse) m.critical = 0;
      else if (m.critical) m.injuredFor = Math.max(1, m.injuredFor);
      if (m.injuredFor <= 0) {
        m.status = 'active';
        m.injuredFor = 0;
        m.critical = 0;
        api.say(s, 'gain', 's2.day.log.careHealed', { name: v.other, other: v.name });
      } else api.say(s, 'day', 's2.day.log.care', { name: v.other, other: v.name, n: m.injuredFor });
      addBond(s, api, a, b, 1);
    } else if (id === 'neighbours') {
      const q = api.person(s, a).quirks;
      const n = 1 + (api.category(s, a) === 'social' || ['mahjong', 'choir', 'tea'].some((x) => q.includes(x)) ? 1 : 0);
      s.support = Math.min(100, s.support + n);
      const m = api.member(s, a);
      m.threat = Math.max(0, (m.threat || 0) - 3);
      api.say(s, 'day', 's2.day.log.neighbours', Object.assign({ n }, v));
    } else if (id === 'scout') {
      // 在目標附近晃來晃去會被拍到：威脅評分 +5。
      s.scout = { by: a, night: s.night };
      const m = api.member(s, a);
      m.threat = Math.min(100, (m.threat || 0) + SCOUT_THREAT);
      api.say(s, 'day', 's2.day.log.scout', Object.assign({ n: SCOUT_THREAT }, v));
    } else if (id === 'party') {
      const ppl = housed(s);
      s.lastParty = s.night;
      s.heat = clamp(s.heat + PARTY_HEAT, 0, 100);
      api.say(s, 'day', 's2.day.log.party', { n: ppl.length, heat: PARTY_HEAT });
      for (const x of ppl) for (const y of ppl) {
        if (x >= y) continue;
        const qx = api.person(s, x).quirks, qy = api.person(s, y).quirks;
        const derby = (qx.includes('man_utd') && qy.includes('liverpool')) || (qx.includes('liverpool') && qy.includes('man_utd'));
        if (derby && api.rand(s).chance(0.5)) { api.say(s, 'warn', 's2.day.log.partyDerby', { name: api.name(s, x), other: api.name(s, y) }); addBond(s, api, x, y, -1); }
        else addBond(s, api, x, y, 1);
      }
    }
    return true;
  }

  const gifts = (s, api, id) => (api.member(s, id) && api.member(s, id).gifts) || [];
  // 今天做了幾件事；兩件以上，晚上就會累。
  const TIRED = 2;
  function busy(s, ids) {
    s.day.busy = s.day.busy || {};
    for (const x of ids) if (x) s.day.busy[x] = (s.day.busy[x] || 0) + 1;
  }
  const busyOf = (s, id) => (s.day && s.day.busy && s.day.busy[id]) || 0;
  const tired = (s, id) => busyOf(s, id) >= TIRED;

  E.days = { FRIEND, RIVAL, TIRED, slotName, begin, answer, check, canPick, act, bond, goodCoach, progress, gifts, addBond, force, busyOf, tired };
})(window.ECHO = window.ECHO || {});
