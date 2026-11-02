// 第二季的路人生成器。
// 每個路人由（世界種子, 行政區, 編號）決定：同樣的輸入永遠產生同一個人，生成順序不影響結果。
// 人物資料只存 id 和索引，不存翻譯好的文字；顯示時才組出三語文字，所以可以隨時切換語言。
// 一個人由七層組成：職業、兩個特質、弱點、兩個小習慣、稀有度、關係（見 relations）、傷疤（加入隊伍後才會有）。
(function (E) {
  const data = () => E.s2.people;
  const LANGS = ['en', 'tc', 'sc'];
  const RARE_CHANCE = 0.05;
  const FLAW_CHANCE = 0.8;

  // 各類職業的基礎能力：hack 駭入、physical 身體、social 社交，0–3。
  const BASE_SKILLS = {
    hacker: { hack: 2, physical: 0, social: 1 },
    physical: { hack: 0, physical: 2, social: 1 },
    social: { hack: 0, physical: 1, social: 2 },
    specialist: { hack: 1, physical: 1, social: 1 },
  };

  function generate(worldSeed, district, index) {
    const d = data();
    const place = d.districts[district];
    if (!place) throw new Error('unknown district: ' + district);
    const r = E.rng.derive(worldSeed, district, index);

    const heritage = r.weighted(place.heritage);
    const names = d.heritages[heritage];
    const occupation = r.chance(RARE_CHANCE)
      ? r.pick(d.rares)
      : r.weighted(d.occupations, (o) => (o.districts[district] || 1) * (o.tier === 'uncommon' ? 0.4 : 1));
    const flaw = r.chance(FLAW_CHANCE) ? r.pick(d.flaws) : null;
    const traits = r.shuffle(d.traits).slice(0, 2).map((t) => t.id);
    // 兩個小習慣不重複，也不會同時是曼聯和利物浦球迷。
    const first = r.pick(d.quirks);
    const second = r.pick(d.quirks.filter((q) => q.id !== first.id && q.id !== first.rival));
    const quirks = [first.id, second.id];

    const skills = Object.assign({}, BASE_SKILLS[occupation.category]);
    const boost = r.pick(['hack', 'physical', 'social']);
    skills[boost] = Math.min(3, skills[boost] + 1);

    const age = r.int(occupation.age[0], occupation.age[1]);
    let threat = r.int(5, 35) + (flaw && flaw.threat || 0) + (age < 25 ? 10 : 0) + (occupation.threat || 0)
      + (first.threat || 0) + (second.threat || 0);
    if (occupation.perk === 'unsuspicious') threat = Math.min(threat, 10);
    if (occupation.threatCap !== undefined) threat = Math.min(threat, occupation.threatCap);

    return {
      id: district + '-' + index,
      district,
      heritage,
      given: r.int(0, names.given.length - 1),
      family: r.int(0, names.family.length - 1),
      age,
      occupation: occupation.id,
      rare: !!occupation.rare,
      traits,
      flaw: flaw ? flaw.id : null,
      quirks,
      secret: r.int(0, d.secrets.length - 1),
      problem: r.pick(d.problems).id,
      skills,
      threat: Math.max(0, Math.min(100, threat)),
    };
  }

  // 三語姓名：{ en, tc, sc }。
  // 第一季的老朋友有固定的名字（fixedName）。
  function name(p) {
    if (p.fixedName) return p.fixedName;
    const h = data().heritages[p.heritage];
    const g = h.given[p.given];
    const f = h.family[p.family];
    const out = {};
    for (const l of LANGS) {
      if (h.order === 'family-first') out[l] = l === 'en' ? f.en + ' ' + g.en : f[l] + g[l];
      else out[l] = l === 'en' ? g.en + ' ' + f.en : g[l] + (l === 'tc' ? '・' : '·') + f[l];
    }
    return out;
  }

  const byId = (list, id) => list.find((x) => x.id === id);
  const occupationOf = (p) => byId(data().occupations, p.occupation) || byId(data().rares, p.occupation);
  const traitsOf = (p) => p.traits.map((id) => byId(data().traits, id));
  const flawOf = (p) => (p.flaw ? byId(data().flaws, p.flaw) : data().noFlaw);
  const quirksOf = (p) => p.quirks.map((id) => byId(data().quirks, id));
  const perkOf = (p) => data().perks[occupationOf(p).perk];
  // common 普通、uncommon 少見、rare 稀有、special 第一季的老朋友
  const tierOf = (p) => (p.special ? 'special' : p.rare ? 'rare' : occupationOf(p).tier || 'common');

  // 麻煩的句子：把 {name} 換成各語言的姓名。
  function problemText(p) {
    const nm = name(p);
    const text = byId(data().problems, p.problem).text;
    const out = {};
    for (const l of LANGS) out[l] = text[l].split('{name}').join(nm[l]);
    return out;
  }

  // 一批路人之間的關係：每個人最多兩條，關係是雙向的。
  // indices 是同一區的編號清單，例如這一輪街上會出現的所有人。回傳 { 路人 id: [{ other, type }] }。
  function relations(worldSeed, district, indices) {
    const out = {};
    const count = (id) => (out[id] || []).length;
    for (const i of indices) {
      const r = E.rng.derive(worldSeed, district, 'rel', i);
      if (!r.chance(0.35)) continue;
      const j = r.pick(indices.filter((x) => x !== i));
      const type = r.weighted({ family: 3, coworker: 3, ex: 2, rival: 2 });
      const a = district + '-' + i, b = district + '-' + j;
      if (j === undefined || count(a) >= 2 || count(b) >= 2 || (out[a] || []).some((x) => x.other === b)) continue;
      (out[a] = out[a] || []).push({ other: b, type });
      (out[b] = out[b] || []).push({ other: a, type });
    }
    return out;
  }

  // Profiler 檔案：回傳一般的輸出行，交給介面翻譯顯示。who 讓人物卡知道要畫誰。
  function profile(p) {
    const L = (k, v) => ({ c: 'prof', k, v, who: p.id });
    const perk = perkOf(p);
    const [a, b] = traitsOf(p);
    const [q1, q2] = quirksOf(p);
    return [
      L('s2.prof.head', { name: { l: name(p) }, age: p.age, job: { l: occupationOf(p).name } }),
      L('s2.prof.perk', { perk: { l: perk.name }, desc: { l: perk.desc } }),
      L('s2.prof.traits', { a: { l: a.name }, b: { l: b.name }, flaw: { l: flawOf(p).name } }),
      L('s2.prof.quirks', { a: { l: q1.name }, b: { l: q2.name } }),
      L('s2.prof.secret', { secret: { l: data().secrets[p.secret] } }),
      L('s2.prof.threat', { n: p.threat }),
    ];
  }

  E.people = {
    generate,
    name,
    profile,
    problemText,
    relations,
    occupationOf,
    traitsOf,
    flawOf,
    quirksOf,
    perkOf,
    tierOf,
    // 一個行政區的一批路人，例如街上同時能看到的人。
    crowd(worldSeed, district, from, count) {
      const out = [];
      for (let i = 0; i < count; i++) out.push(generate(worldSeed, district, from + i));
      return out;
    },
  };
})(window.ECHO = window.ECHO || {});
