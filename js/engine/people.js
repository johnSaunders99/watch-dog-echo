// 第二季的路人生成器。
// 每個路人由（世界種子, 行政區, 編號）決定：同樣的輸入永遠產生同一個人，生成順序不影響結果。
// 人物資料只存 id 和索引，不存翻譯好的文字；顯示時才組出三語文字，所以可以隨時切換語言。
(function (E) {
  const data = () => E.s2.people;
  const LANGS = ['en', 'tc', 'sc'];

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
    const occupation = r.weighted(d.occupations, (o) => o.districts[district] || 1);
    const flaw = r.pick(d.flaws);

    const skills = Object.assign({}, BASE_SKILLS[occupation.category]);
    const boost = r.pick(['hack', 'physical', 'social']);
    skills[boost] = Math.min(3, skills[boost] + 1);

    const age = r.int(occupation.age[0], occupation.age[1]);
    let threat = r.int(5, 35) + (flaw.threat || 0) + (age < 25 ? 10 : 0);
    if (occupation.perk === 'unsuspicious') threat = Math.min(threat, 10);

    return {
      id: district + '-' + index,
      district,
      heritage,
      given: r.int(0, names.given.length - 1),
      family: r.int(0, names.family.length - 1),
      age,
      occupation: occupation.id,
      trait: r.pick(d.traits).id,
      flaw: flaw.id,
      secret: r.int(0, d.secrets.length - 1),
      problem: r.pick(d.problems).id,
      skills,
      threat: Math.max(0, Math.min(100, threat)),
    };
  }

  // 三語姓名：{ en, tc, sc }。
  function name(p) {
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
  const occupationOf = (p) => byId(data().occupations, p.occupation);
  const traitOf = (p) => byId(data().traits, p.trait);
  const flawOf = (p) => byId(data().flaws, p.flaw);
  const perkOf = (p) => data().perks[occupationOf(p).perk];

  // 麻煩的句子：把 {name} 換成各語言的姓名。
  function problemText(p) {
    const nm = name(p);
    const text = byId(data().problems, p.problem).text;
    const out = {};
    for (const l of LANGS) out[l] = text[l].split('{name}').join(nm[l]);
    return out;
  }

  // Profiler 檔案：回傳一般的輸出行，交給介面翻譯顯示。who 讓人物卡知道要畫誰。
  function profile(p) {
    const L = (k, v) => ({ c: 'prof', k, v, who: p.id });
    const perk = perkOf(p);
    return [
      L('s2.prof.head', { name: { l: name(p) }, age: p.age, job: { l: occupationOf(p).name } }),
      L('s2.prof.perk', { perk: { l: perk.name }, desc: { l: perk.desc } }),
      L('s2.prof.traits', { trait: { l: traitOf(p).name }, flaw: { l: flawOf(p).name } }),
      L('s2.prof.secret', { secret: { l: data().secrets[p.secret] } }),
      L('s2.prof.threat', { n: p.threat }),
    ];
  }

  E.people = {
    generate,
    name,
    profile,
    problemText,
    occupationOf,
    traitOf,
    flawOf,
    perkOf,
    // 一個行政區的一批路人，例如街上同時能看到的人。
    crowd(worldSeed, district, from, count) {
      const out = [];
      for (let i = 0; i < count; i++) out.push(generate(worldSeed, district, from + i));
      return out;
    },
  };
})(window.ECHO = window.ECHO || {});
