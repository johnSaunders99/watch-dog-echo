// 第二季《宵禁》的整個戰役：五個行政區，一區一區解放。
// 康登是起點，西敏是最後一區；中間三區（唐人街與蘇豪、狗島、羅瑟希德）的順序由玩家決定。
// 每一區都有自己的民心和晚上數：民心到 100、而且這一區的主線任務完成，就算解放；晚上用完還沒解放，宵禁就永久化（長夜）。
// 白天分成早上、中午、傍晚三個時段（js/engine/days.js）：一起混、練弱點、照顧傷員、幫街坊、踩點；也在街上掃描路人、管理隊伍、決定今晚的行動。
// 晚上派人走一串關卡；主線任務分成兩段（先潛入，再打主要目標），中間可以喘口氣。
// 每一關挑「解法 × 隊員」執行，成功率由能力、專長、特質、弱點、小習慣、關係和傷疤一起決定。
// 警戒累積到 30、60 會讓所有動作變難，武裝無人機也會開火；到 100 就有人被捕。重傷沒人照顧，可能撐不過這一夜。
// 行動有三種形態：一般的直線關卡、限時（只有幾步可以用）、分頭（主力和佯攻兩條線同時進行）。
// 獅心防務會反擊：突襲安全屋、全城停電、宵禁提前。
// 主線任務用文字冒險的方式插進來（content-s2/scenes/），跳過劇情時就照一般行動進行。
// 所有狀態都在一個可以直接存檔的物件裡；亂數由（世界種子, 第幾步）決定，同一串操作永遠得到同樣的結果。
// 這裡不放任何台詞：文字都在 content-s2/ 和語言檔裡。
(function (E) {
  const people = () => E.s2.people;
  const content = () => E.s2.ops;

  // 行政區：順序、每區的晚上數、每區的主線任務、第一次出現主線任務的晚上。
  const ORDER = ['camden', 'soho', 'isle_of_dogs', 'rotherhithe', 'westminster'];
  const ACT2 = ['soho', 'isle_of_dogs', 'rotherhithe'];
  const NIGHTS = { camden: 12, soho: 11, isle_of_dogs: 11, rotherhithe: 11, westminster: 10 };
  const MAIN = { camden: 'm2', soho: 'm3', isle_of_dogs: 'm4', rotherhithe: 'm5', westminster: 'm7' };
  const MAIN_NIGHT = 2;       // 每一區從第二晚起才有主線任務
  const M7_SUPPORT = 40;      // 西敏的民心要到這裡，斷電才有意義
  const STREET_SIZE = 6;
  const STREET_STEP = 3;      // 每過一晚，街上換掉三個人
  const VOLUNTEERS = 1000;    // 開場自願者的編號
  const HELPERS = 2000;       // 「叫人」叫來的路人的編號
  const MAX_KEEP = 3;         // 街上最多保留幾個人（保留的人不會離開，今晚可以去招募）
  const BANDWIDTH = 4;
  const MAX_SQUAD = 3;
  const MAX_SPLIT = 4;        // 分頭行動最多四個人
  const MAX_EXPANDS = 2;      // 安全屋最多擴充兩次
  const LOW_NIGHTS = 4;       // 避風頭要離開幾晚
  const CALL_IN_HEAT = 5;     // 叫外圍成員來支援的熱度代價
  const WANTED = 80;          // 威脅評分到這裡，白天也可能被抓
  const RETIRE_WINS = 3;      // 成功幾次才能退休傳承
  const SERIOUS = 0.35;       // 受傷時傷得重的機率（警戒 60 以上再加 0.25）
  const CRITICAL_MORNINGS = 2; // 重傷沒人照顧，接下來幾個早上可能撐不過去
  const DEATH_CHANCE = 0.3;   // 每個這樣的早上撐不過去的機率
  const CLINIC_HEAT = 8;      // 送去地下診所的熱度代價
  const HUNTED_CHANCE = 0.35; // 名單上的隊員每個早上被上門抓走的機率
  const TAC_BONUS = 5;        // 親自指揮（戰術地圖）成功時多給的民心
  const TIRED_RISK = 0.1;     // 白天做了兩件事的人，晚上的失敗率
  const LANGS = ['en', 'tc', 'sc'];

  // ===== 小工具 =====
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round2 = (v) => Math.round(v * 100) / 100;
  const indexOf = (id) => Number(String(id).split('-').pop());
  const districtOf = (id) => String(id).slice(0, String(id).lastIndexOf('-'));
  const rank = (d) => ORDER.indexOf(d); // 第幾區：越後面越難

  // 同一輪裡不會有兩個人同名：撞名的話換一個姓。
  function person(s, id) {
    if (!s.people[id]) {
      const p = E.people.generate(s.seed, districtOf(id), indexOf(id));
      const taken = new Set(Object.values(s.people).map((x) => E.people.name(x).en));
      const families = people().heritages[p.heritage].family.length;
      for (let i = 0; i < families && taken.has(E.people.name(p).en); i++) p.family = (p.family + 1) % families;
      s.people[id] = p;
    }
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

  const member = (s, id) => E.roster.get(s.roster, id);
  // 自己的兩個特質，加上退休前輩傳下來的那一個。
  function traitIds(s, id) {
    const m = member(s, id);
    return person(s, id).traits.concat(m && m.inherited ? [m.inherited.trait] : []);
  }
  const hasTrait = (s, id, t) => traitIds(s, id).includes(t);
  const hasQuirk = (s, id, q) => person(s, id).quirks.includes(q);
  const flawOf = (s, id) => E.people.flawOf(person(s, id));
  const perkId = (s, id) => E.people.occupationOf(person(s, id)).perk;
  const categoryOf = (s, id) => E.people.occupationOf(person(s, id)).category;
  const scarsOf = (s, id) => (member(s, id) && member(s, id).scars) || [];
  const tonight = (s, type) => !!s.tonight && s.tonight.type === type;
  const giftsOf = (s, id) => (member(s, id) && member(s, id).gifts) || [];
  // 改一個人的資料（練掉弱點、換小習慣）：存檔讀回來之後，路人表和隊伍裡是兩份，兩份都要改。
  function setPerson(s, id, fn) {
    fn(person(s, id));
    const m = member(s, id);
    if (m && m.person !== s.people[id]) fn(m.person);
  }

  // 外圍網路裡有沒有某種專長的人（被動效果）。
  function networkWith(s, perk) {
    const m = s.roster.members.find((x) => x.status === 'network' && perkId(s, x.person.id) === perk);
    return m ? m.person.id : null;
  }

  // 床位：基本 6 張，每次擴充 +2，安全屋裡有建築工人再 +1。
  // 康登解放後，安全屋再多兩張床。
  function syncBeds(s) {
    const builder = E.roster.housed(s.roster).some((m) => m.person.occupation === 'builder');
    s.roster.capacity = E.roster.BASE_CAPACITY + s.expands * 2 + (builder ? 1 : 0) + (s.perks.beds ? 2 : 0);
  }

  // ===== 關係 =====
  function relationsOf(s, id) {
    return (s.relations[id] || []).map((r) => ({ other: r.other, type: r.type }));
  }
  const related = (s, a, b, type) => relationsOf(s, a).some((r) => r.other === b && r.type === type);

  // ===== 開新的一輪 =====
  function create(seed, opts = {}) {
    const s = {
      v: 3, seed: String(seed), night: 1, dnight: 1, phase: 'start', district: 'camden', visited: ['camden'], liberated: [],
      support: 0, heat: 10, towers: 4, expands: 0, raids: 0, step: 0, helperCount: 0,
      roster: E.roster.create({ ironman: !!opts.ironman }),
      people: {}, relations: {}, bonds: {}, scanned: {}, owed: {}, mainPart: {},
      volunteers: [], featured: null, pick: null, op: null, queue: [], event: null, react: null, result: null, ended: null,
      tonight: null, legacy: null, perks: {}, mains: {}, storyOff: {}, told: {}, ally: null, list: null, endLines: null,
      log: [], stats: { ops: 0, wins: 0, recruited: [], lost: [], retired: [], dead: [], arrests: 0 },
    };

    // 開場的四個自願者：保證有駭客、身體、社交各一，第四個隨機。稀有人物留給玩家在街上發現。
    const used = new Set();
    for (const want of ['hacker', 'physical', 'social', null]) {
      for (let i = VOLUNTEERS; i < VOLUNTEERS + 300; i++) {
        if (used.has(i)) continue;
        const p = person(s, 'camden-' + i);
        if (!p.rare && (!want || E.people.occupationOf(p).category === want)) { used.add(i); s.volunteers.push(p.id); break; }
      }
    }
    meetDistrict(s, 'camden');

    // 第一季的結局決定這個世界：stay 留下、seal 封存、wildfire 燎原、recaptured 回收。
    s.world = WORLDS.includes(opts.world) ? opts.world : 'stay';
    if (s.world === 'seal') s.heat = 15;
    // 主角是第一個自願者（一定是駭客）。主線任務一「熄燈」用文字冒險的方式玩，結束後才挑第二個人。
    // skipStory 是給測試用的：整輪都不插入文字冒險，主線任務都照一般行動進行。
    s.hero = s.volunteers[0];
    s.noStory = !!opts.skipStory || !E.engine || !E.s2.missions;
    if (s.noStory) startPick(s);
    else beginStory(s, 'm1');
    return s;
  }

  // 第一次來到一個區：決定這區的稀有人物（前三晚一定會在街上出現），算好街上的人之間的關係。
  function meetDistrict(s, d) {
    s.featured = null;
    for (let i = 100; i < 1000; i++) {
      if (person(s, d + '-' + i).rare) { s.featured = d + '-' + i; break; }
      delete s.people[d + '-' + i];
    }
    const pool = [];
    for (let i = 0; i < NIGHTS[d] * STREET_STEP + STREET_SIZE; i++) pool.push(i);
    if (s.featured) pool.push(indexOf(s.featured));
    Object.assign(s.relations, E.people.relations(s.seed, d, pool));
  }

  const WORLDS = ['stay', 'seal', 'wildfire', 'recaptured'];

  // ===== 主線任務（文字冒險） =====
  // 文字冒險沿用第一季的場景引擎，狀態另外放在 s.story，輸出放在 s.storyLog。
  // 每個任務在 E.s2.missions 登記起點；打完時場景會設定 flags[任務 + 'done']。
  // 打完之後先停在劇情畫面，讓玩家讀完最後幾行，按下繼續（storyFinish）才結算。
  // 要組隊出門的主線任務；m1（開場）和 m6（名單與三方會談）是過場，不用組隊。
  const SQUAD_MISSIONS = ['m2', 'm3', 'm4', 'm5', 'm7', 'm8'];
  function beginStory(s, id, flags, exposure) {
    const st = E.state.create();
    st.scene = E.s2.missions[id].start;
    st.actor = 'player';
    st.exposure = exposure || 0;
    Object.assign(st.flags, { world: s.world, night: s.dnight || s.night }, flags);
    s.story = st;
    s.storyId = id;
    s.storyDone = false;
    const p = person(s, s.hero);
    s.storyLog = [{ c: 'prof', k: 's2.hero.intro', who: s.hero, v: { name: nameOf(s, s.hero), job: { l: E.people.occupationOf(p).name }, age: p.age, n: member(s, s.hero) ? member(s, s.hero).threat : p.threat } }]
      .concat(E.engine.enter(st));
    s.phase = 'story';
  }

  // 執行一個文字冒險指令。cmd 是 E.parser.parse 的結果；回傳新增的輸出行。
  function storyCommand(s, cmd, input) {
    if (s.phase !== 'story' || s.storyDone || !cmd) return [];
    const id = s.storyId || 'm1';
    const out = [input || { c: 'input', raw: cmd.raw }].concat(E.engine.exec(cmd, s.story));
    if (s.story.flags[id + 'done']) s.storyDone = true;
    else if (SQUAD_MISSIONS.includes(id) && s.story.exposure >= 100) {
      // 警戒滿了：撤退，任務留到之後的晚上再打。
      out.push({ c: 'warn', k: 's2.abort.1' }, { c: 'bagley', k: 's2.abort.2' });
      s.storyDone = 'abort';
    }
    s.storyLog.push(...out);
    if (s.storyLog.length > 400) s.storyLog.splice(0, s.storyLog.length - 400);
    return out;
  }

  function storyFinish(s) {
    if (s.phase !== 'story' || !s.storyDone) return false;
    const id = s.storyId || 'm1';
    if (id === 'm1') finishM1(s);
    else if (id === 'm6') finishM6(s, s.story.flags);
    else finishMission(s, s.storyDone === 'abort');
    return true;
  }

  // 任務一的結果帶進夜間循環：被看到臉，主角的威脅評分上升；警戒越高，起始熱度越高。
  function finishM1(s, skipped) {
    if (!skipped) {
      const f = s.story.flags;
      s.heroBonus = (f.spotted ? 20 : 0) + (f.kicked ? 3 : 0);
      s.heat = clamp(s.heat + Math.round((s.story.exposure || 0) / 5), 0, 60);
    }
    clearStory(s);
    startPick(s);
  }

  function clearStory(s) {
    s.story = null;
    s.storyLog = null;
    s.storyId = null;
    s.storyDone = false;
  }

  // 跳過任務一就直接挑人；跳過任務六，照預設（不結盟、燒掉名單）進西敏；
  // 跳過要組隊的任務，這一次改用一般關卡進行，之後這個任務也不會再用文字冒險的方式出現。
  function skipStory(s) {
    if (s.phase !== 'story') return false;
    const id = s.storyId || 'm1';
    if (id === 'm1') finishM1(s, true);
    else if (id === 'm6') finishM6(s, {});
    else {
      s.storyOff[id] = true;
      clearStory(s);
      s.phase = 'op';
      startStages(s);
    }
    return true;
  }

  // ===== 主線任務：每一區一個，西敏有兩個（斷電、空域控制中心） =====
  // 回傳這一區還沒完成的主線任務；西敏的斷電要民心夠，空域控制中心要等斷電之後的下一晚。
  function mainNow(s) {
    if (s.district === 'westminster') {
      if (s.mains.m7 !== 'done') return s.support >= M7_SUPPORT ? 'm7' : null;
      return s.mains.m8 !== 'done' && s.dnight > s.m7night ? 'm8' : null;
    }
    const id = MAIN[s.district];
    return s.mains[id] === 'done' ? null : id;
  }
  const heroAlive = (s) => !!member(s, s.hero) && !['lost', 'retired', 'dead'].includes(member(s, s.hero).status);
  const storyable = (s, id) => !s.noStory && !s.storyOff[id] && heroAlive(s) && !!E.s2.missions[id];
  // 舊的介面和測試用：康登的主線任務二還在不在。
  const mainPending = (s) => s.district === 'camden' && mainNow(s) === 'm2' && storyable(s, 'm2');

  function joinNames(list) {
    const out = {};
    for (const l of LANGS) {
      const ns = list.map((x) => x[l]);
      out[l] = l === 'en' ? (ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1] : ns.join('')) : ns.join('、');
    }
    return { l: out };
  }

  // 要組隊的主線任務：隊友的類別和專長決定每一關有哪些額外解法（flags.team）。
  // 劇情裡的警戒從這次行動的起始警戒開始算，打完直接當成行動的警戒結算。
  // 任務裡會遇到的路人（收留你們的人、被救的外送員）在這裡先生成好。
  function beginMission(s) {
    const id = s.op.main;
    const team = membersOf(s).filter((x) => x !== s.hero && !s.op.taken[x])
      .map((x) => ({ id: x, cat: categoryOf(s, x), perk: perkId(s, x), traits: traitIds(s, x), name: nameOf(s, x) }));
    // 任務三要救的是一個外送員：往後找到第一個外送員，把威脅評分設成劇情裡的 91。
    let extra = person(s, s.district + '-' + (HELPERS + s.helperCount++));
    if (id === 'm3') {
      for (let i = 0; i < 200 && extra.occupation !== 'courier'; i++) {
        delete s.people[extra.id];
        extra = person(s, s.district + '-' + (HELPERS + s.helperCount++));
      }
      extra.threat = 91;
    }
    beginStory(s, id, {
      team, names: joinNames(team.map((m) => m.name.l)), extraId: extra.id, extraName: nameOf(s, extra.id),
      ally: s.ally, list: s.list && s.list.choice, listed: s.list && s.list.listed ? nameOf(s, s.list.listed) : null,
      liberated: s.liberated.length, piece: (s.pieces || 0) + 1,
    }, s.op.alert);
  }

  function finishMission(s, aborted) {
    s.op.alert = clamp(s.story.exposure, 0, 100);
    s.op.storyFlags = s.story.flags;
    clearStory(s);
    s.phase = 'op';
    if (aborted) {
      say(s, 'bad', 's2.log.mainAbort');
      return finish(s, 'retreat');
    }
    return finish(s, 'win');
  }

  // 主線任務完成時的獎勵。f 是劇情的旗標（跳過劇情時是空的）。回傳額外的民心和熱度。
  function mainReward(s, id, f) {
    const out = { support: 0, heat: 0 };
    s.mains[id] = 'done';
    const owe = (pid, key) => {
      s.owed[pid] = 'helper';
      say(s, 'gain', key, { name: nameOf(s, pid) });
    };
    if (id === 'm2') {
      s.towers--;
      say(s, 'gain', 's2.log.towerDown', { n: s.towers });
      say(s, f.lightsOut ? 'gain' : 'ok', f.lightsOut ? 's2.log.m2.dark' : 's2.log.m2.quiet');
      if (f.lightsOut) { out.support += 10; out.heat += 5; } else out.heat -= 5;
      if (f.shelter) owe(f.extraId, 's2.log.m2.shelter');
    }
    if (id === 'm3') {
      joinSpecial(s, 'homan');
      owe(f.extraId || person(s, s.district + '-' + (HELPERS + s.helperCount++)).id, 's2.log.m3.rider');
    }
    if (id === 'm4') joinSpecial(s, 'maya');
    if (id === 'm5') {
      joinSpecial(s, 'eileen');
      if (f.hiveDown) { out.support += 10; say(s, 'gain', 's2.log.m5.hive'); }
    }
    if (ACT2.includes(s.district)) {
      s.pieces = (s.pieces || 0) + 1;
      say(s, 'gain', 's2.log.piece', { n: s.pieces });
    }
    if (id === 'm7') {
      s.m7night = s.dnight;
      say(s, 'gain', 's2.log.m7.dark');
    }
    if (id === 'm8') s.finale = { freedEcho: !!f.freedEcho };
    return out;
  }

  // 第一季的老朋友：完成某些主線任務之後加入（資料在 content-s2/people.js 的 specials）。
  function joinSpecial(s, key) {
    const id = 'special-' + key;
    if (member(s, id)) return;
    const d = people().specials[key];
    s.people[id] = Object.assign({ id, district: s.district, special: key, rare: false, secret: 0, problem: people().problems[0].id }, JSON.parse(JSON.stringify(d.person)));
    recruitPerson(s, id);
  }

  // ===== 第三幕開場：名單到齊、三方會談 =====
  // 名單上出現一名隊員（主角以外威脅評分最高的人）。任務六裡決定名單怎麼處理、跟誰結盟。
  function beginAct3(s) {
    const pool = s.roster.members.filter((m) => m.person.id !== s.hero && !['lost', 'dead', 'retired'].includes(m.status));
    const listed = (pool.length ? pool : s.roster.members).slice().sort((a, b) => (b.threat || 0) - (a.threat || 0))[0];
    s.list = { listed: listed ? listed.person.id : null, choice: null };
    say(s, 'night', 's2.log.act3');
    if (s.noStory || !E.s2.missions.m6) return finishM6(s, {});
    beginStory(s, 'm6', { listed: listed ? nameOf(s, listed.person.id) : null, liberated: s.liberated.length });
  }

  // 名單：燒掉（名單上的隊員安全了）、公開（西敏的民心從 20 開始，熱度 +10，但那名隊員會被追捕）、
  // 留著談判（交給盟友；那名隊員也會被追捕）。盟友：hale 黑爾、cassie 卡西、kahn 坎恩，或誰都不選。
  function finishM6(s, f) {
    const choice = ['burn', 'publish', 'trade'].includes(f.listChoice) ? f.listChoice : 'burn';
    s.list.choice = choice;
    s.ally = ['hale', 'cassie', 'kahn'].includes(f.ally) ? f.ally : null;
    const m = s.list.listed && member(s, s.list.listed);
    if (m) {
      if (choice === 'burn') m.threat = Math.min(m.threat, 30);
      else { m.hunted = true; m.threat = Math.max(m.threat, 85); }
    }
    clearStory(s);
    say(s, 'gain', 's2.log.list.' + choice, { name: s.list.listed ? nameOf(s, s.list.listed) : { l: { en: '-', tc: '-', sc: '-' } } });
    say(s, 'gain', s.ally ? 's2.log.ally.' + s.ally : 's2.log.ally.none');
    enterDistrict(s, 'westminster');
    if (choice === 'publish') {
      s.support = 20;
      s.heat = clamp(s.heat + 10, 0, 100);
    }
  }

  // ===== 換區 =====
  // 解放一區：拿到這一區的好處。中間三區還沒打完就讓玩家選下一區；三區都解放了，就進第三幕。
  const PERK = { camden: 'beds', soho: 'supply', isle_of_dogs: 'insider', rotherhithe: 'tunnels' };
  function liberate(s) {
    const d = s.district;
    s.liberated.push(d);
    s.perks[PERK[d]] = true;
    syncBeds(s);
    say(s, 'gain', 's2.log.liberated', { district: { l: people().districts[d].name } });
    say(s, 'gain', 's2.perk.' + PERK[d]);
    s.travel = ACT2.filter((x) => !s.liberated.includes(x));
    if (s.travel.length) s.phase = 'travel';
    else beginAct3(s);
    return true;
  }

  function travel(s, d) {
    if (s.phase !== 'travel' || !(s.travel || []).includes(d)) return false;
    enterDistrict(s, d);
    return true;
  }

  // 搬到新的一區：民心從零開始、四座塔、熱度減半（但越後面的區起點越高）。
  function enterDistrict(s, d) {
    s.district = d;
    s.dnight = 1;
    s.support = 0;
    s.towers = 4;
    s.heat = Math.max(10 + 5 * rank(d), Math.round(s.heat / 2));
    s.tonight = null;
    s.raids = 0;
    s.lastRaid = null;
    s.travel = null;
    if (!s.visited.includes(d)) s.visited.push(d);
    meetDistrict(s, d);
    for (const m of s.roster.members) if (m.threat) m.threat = Math.max(0, m.threat - 10);
    s.phase = 'day';
    say(s, 'night', 's2.log.district', { district: { l: people().districts[d].name } });
    say(s, 'night', 's2.log.night', { n: s.dnight });
    say(s, 'bagley', 's2.bagley.arrive.' + d);
    E.days.begin(s, dayApi, true);
  }

  // 結局：西敏的空域控制中心打下來時，依盟友決定。長夜（curfew、wiped）是壞結局。
  const ENDING = { hale: 'cage', cassie: 'wild', kahn: 'deal' };
  const endingFor = (s) => ENDING[s.ally] || 'dawn';

  // 結局的尾聲：名單怎麼處理、名單上的隊員有沒有撐到最後、第一季的世界。
  function epilogue(s, kind) {
    const out = [];
    if (['curfew', 'wiped'].includes(kind)) return out;
    if (s.list && s.list.choice) out.push({ k: 's2.epi.list.' + s.list.choice });
    const m = s.list && s.list.listed && member(s, s.list.listed);
    if (m) out.push({ k: ['lost', 'dead', 'arrested'].includes(m.status) ? 's2.epi.listed.lost' : 's2.epi.listed.saved', v: { name: nameOf(s, m.person.id) } });
    if (s.world === 'recaptured') out.push({ k: s.finale && s.finale.freedEcho ? 's2.epi.echo.freed' : 's2.epi.echo.left' });
    else out.push({ k: 's2.epi.world.' + s.world });
    return out;
  }

  function startPick(s) {
    s.phase = 'start';
    say(s, 'bagley', 's2.bagley.intro1');
    say(s, 'bagley', 's2.bagley.intro2');
  }

  // 加入隊伍：有空床就住進安全屋，沒有就先加入外圍網路。
  function recruitPerson(s, id) {
    if (member(s, id)) return false;
    const status = E.roster.canRecruit(s.roster) ? 'active' : 'network';
    E.roster.recruit(s.roster, person(s, id), s.night, status);
    const m = member(s, id);
    Object.assign(m, { scars: [], wins: 0, threat: person(s, id).threat });
    s.stats.recruited.push(id);
    delete s.owed[id];
    if (s.keep) delete s.keep[id];
    say(s, 'gain', status === 'active' ? 's2.log.joined' : 's2.log.network', { name: nameOf(s, id) });
    if (s.legacy && !person(s, id).traits.includes(s.legacy.trait)) {
      m.inherited = s.legacy;
      say(s, 'gain', 's2.log.inherit', { name: nameOf(s, id), from: nameOf(s, s.legacy.from), card: { l: traitCard(s.legacy.trait).name } });
      s.legacy = null;
    }
    syncBeds(s);
    return true;
  }
  const traitCard = (t) => people().traits.find((x) => x.id === t).card;

  // 開場挑兩個人：主角一定在隊上，所以只要再挑一個。
  function pickVolunteers(s, ids) {
    const team = s.hero ? [s.hero].concat(ids.filter((id) => id !== s.hero)) : ids;
    if (s.phase !== 'start' || team.length !== 2 || !team.every((id) => s.volunteers.includes(id))) return false;
    team.forEach((id) => recruitPerson(s, id));
    if (s.hero && s.heroBonus) member(s, s.hero).threat = Math.min(100, member(s, s.hero).threat + s.heroBonus);
    s.phase = 'day';
    say(s, 'night', 's2.log.night', { n: s.night });
    say(s, 'bagley', 's2.bagley.first');
    E.days.begin(s, dayApi, true);
    return true;
  }

  // ===== 白天：街上的人 =====
  // 每過一晚換掉三個人（每個人在街上待兩晚）；稀有人物前三晚都在。保留的人不會離開，排在最前面。
  // 掃描只是看看檔案；要保留（最多三個人），今晚的行動裡才會出現招募他們的任務。
  const keptHere = (s) => Object.keys(s.keep || {}).filter((id) => id.startsWith(s.district + '-') && !member(s, id) && !s.owed[id]);
  function street(s) {
    const from = (s.dnight - 1) * STREET_STEP;
    const ids = keptHere(s);
    const add = (id) => { if (!ids.includes(id)) ids.push(id); };
    for (let i = from; i < from + STREET_SIZE; i++) add(s.district + '-' + i);
    if (s.featured && s.dnight <= 3) {
      if (!ids.includes(s.featured)) ids.splice(Math.min(ids.length, keptHere(s).length + 2), 0, s.featured);
    }
    return ids.filter((id) => !member(s, id) && !s.owed[id]);
  }
  // 這個人在街上待到第幾晚（保留的人一直都在：回傳 null）。
  function leavesAfter(s, id) {
    if (s.keep && s.keep[id]) return null;
    if (id === s.featured) return Math.max(3, Math.floor(indexOf(id) / STREET_STEP) + 1);
    return Math.floor(indexOf(id) / STREET_STEP) + 1;
  }

  function scan(s, id) {
    if (s.phase !== 'day' || s.scanned[id]) return;
    s.scanned[id] = true;
  }

  // 保留／不保留：只有掃描過、還在街上的人才能保留。
  const kept = (s, id) => !!(s.keep && s.keep[id]);
  function keep(s, id, on = true) {
    if (s.phase !== 'day' || !s.scanned[id] || !street(s).includes(id)) return false;
    s.keep = s.keep || {};
    if (!on) { delete s.keep[id]; return true; }
    if (kept(s, id) || keptHere(s).length >= MAX_KEEP) return false;
    s.keep[id] = true;
    return true;
  }

  function recruitOwed(s, id) {
    if (s.phase !== 'day' || !s.owed[id]) return false;
    return recruitPerson(s, id);
  }

  // ===== 白天：管理隊伍 =====
  // 回家：從安全屋搬回自己家，變成外圍成員。
  function sendHome(s, id) {
    if (s.phase !== 'day' || !E.roster.sendHome(s.roster, id)) return false;
    say(s, 'ok', 's2.log.home', { name: nameOf(s, id) });
    syncBeds(s);
    return true;
  }
  // 叫回：外圍成員搬回安全屋。
  function callBack(s, id) {
    if (s.phase !== 'day' || !E.roster.callBack(s.roster, id)) return false;
    say(s, 'ok', 's2.log.callBack', { name: nameOf(s, id) });
    syncBeds(s);
    return true;
  }
  // 避風頭：離開倫敦幾晚，威脅評分大降，熱度也退一點。
  // 重傷的人走不了，只能送診所。
  function layLow(s, id) {
    if (s.phase !== 'day' || (member(s, id) && member(s, id).critical) || !E.roster.layLow(s.roster, id, LOW_NIGHTS)) return false;
    const m = member(s, id);
    m.threat = Math.max(0, m.threat - 30);
    s.heat = Math.max(0, s.heat - 5);
    say(s, 'ok', 's2.log.lowkey', { name: nameOf(s, id), n: LOW_NIGHTS });
    syncBeds(s);
    return true;
  }
  const canRetire = (s, id) => !!member(s, id) && member(s, id).wins >= RETIRE_WINS && ['active', 'injured', 'network'].includes(member(s, id).status);
  // 退休：老手永久離隊，把一張自己的招式卡傳給下一個加入的人。
  function retire(s, id, trait) {
    if (s.phase !== 'day' || !canRetire(s, id) || !person(s, id).traits.includes(trait)) return false;
    E.roster.retire(s.roster, id);
    s.legacy = { trait, from: id };
    s.stats.retired.push(id);
    say(s, 'gain', 's2.log.retired', { name: nameOf(s, id), card: { l: traitCard(trait).name } });
    syncBeds(s);
    return true;
  }

  // ===== 今晚的行動 =====
  function ops(s) {
    if (tonight(s, 'raid')) return [Object.assign({ key: 'raid', op: 'raid' }, info(s, { op: 'raid' }))];
    const list = [];
    // 每一區從第二晚起有主線任務。康登的主線任務二就是第一座塔，打完之前不開放一般的拆塔行動。
    const main = mainNow(s);
    if (main && s.dnight >= MAIN_NIGHT) list.push({ key: 'main', op: 'main', main, story: storyable(s, main) });
    if (s.towers > 0 && main !== 'm2') list.push({ key: 'tower', op: 'tower' });
    list.push({ key: 'broadcast', op: 'broadcast' });
    if (s.expands < MAX_EXPANDS) list.push({ key: 'expand', op: 'expand' });
    for (const m of s.roster.members) {
      if (m.status === 'arrested') list.push({ key: 'rescue:' + m.person.id, op: 'rescue', target: m.person.id, left: E.roster.TRANSFER_AFTER - (s.night - m.since) });
    }
    for (const id of street(s)) if (kept(s, id)) list.push({ key: 'recruit:' + id, op: 'recruit', target: id });
    return list.map((e) => Object.assign(e, info(s, e)));
  }

  function info(s, e) {
    const C = content();
    const def = e.op === 'recruit' ? C.recruitOp : e.op === 'main' ? C.main[e.main] : C.ops[e.op];
    // 主線任務分兩段：還沒打過第一段就從潛入開始；第一段打完撤退過的話，下次直接從第二段開始。
    const part = e.op === 'main' ? (s.mainPart[e.main] || 0) : null;
    let stages = e.op === 'recruit' ? C.recruit[people().problems.find((p) => p.id === person(s, e.target).problem).mission]
      : def.split ? def.lanes.main : part === 0 ? def.approach : def.stages;
    const names = e.target ? { name: E.people.name(person(s, e.target)) } : {};
    // 家人已經在隊上：家人幫忙說話，第一關不用打。
    const family = e.target && relationsOf(s, e.target).find((r) => r.type === 'family' && member(s, r.other) && member(s, r.other).status === 'active');
    if (family && stages.length > 2) stages = stages.slice(1);
    return {
      kind: def.kind,
      name: fill(def.name, names),
      desc: e.op === 'recruit' ? E.people.problemText(person(s, e.target)) : fill(def.desc, names),
      stages,
      decoy: def.split ? def.lanes.decoy : null,
      split: !!def.split,
      timer: def.timer || null,
      reward: def.reward,
      family: family ? family.other : null,
      main: e.main || null,
      story: !!e.story,
      part,
      approachName: part === 0 ? def.approachName : null,
      later: part === 0 ? def.stages : null,
    };
  }

  const eventWaiting = (s) => !!(s.day && s.day.event);
  function pickOp(s, key) {
    if (s.phase !== 'day' || eventWaiting(s) || !ops(s).some((e) => e.key === key)) return false;
    s.pick = key;
    s.phase = 'squad';
    return true;
  }

  function cancel(s) {
    if (s.phase === 'squad') { s.pick = null; s.phase = 'day'; }
  }

  const picked = (s) => ops(s).find((x) => x.key === s.pick) || null;

  // 檢查一支隊伍能不能出發：人數、狀態、外圍名額、分頭行動的主力、死對頭。
  function squadCheck(s, ids, lanes = {}) {
    const e = picked(s);
    if (!ids.length) return { ok: false, reason: 's2.squad.empty' };
    if (ids.length > (e && e.split ? MAX_SPLIT : MAX_SQUAD)) return { ok: false, reason: e && e.split ? 's2.squad.full4' : 's2.squad.full' };
    if (!ids.every((id) => member(s, id) && ['active', 'network'].includes(member(s, id).status))) return { ok: false, reason: 's2.squad.unavailable' };
    if (ids.filter((id) => member(s, id).status === 'network').length > 1) return { ok: false, reason: 's2.squad.oneNetwork' };
    if (e && e.split && !ids.some((id) => (lanes[id] || 'main') === 'main')) return { ok: false, reason: 's2.squad.needMain' };
    if (e && e.story && !ids.includes(s.hero)) return { ok: false, reason: 's2.squad.needHero' };
    if (e && e.story && ids.length < 2) return { ok: false, reason: 's2.squad.needTwo' };
    return { ok: true };
  }

  // 起始警戒：區域熱度，加上有前科、上夜班、叫外圍支援、宵禁提前這類調整。
  function startAlert(s, ids) {
    let alert = s.heat + (tonight(s, 'early') ? 15 : 0);
    for (const id of ids) {
      alert += flawOf(s, id).startAlert || 0;
      for (const q of E.people.quirksOf(person(s, id))) alert += q.startAlert || 0;
      if (member(s, id) && member(s, id).status === 'network') alert += CALL_IN_HEAT;
    }
    return clamp(alert, 0, 90);
  }

  // ===== 晚上：行動 =====
  // 一次行動有一到兩條線：main 主力（打完就成功）、decoy 佯攻（每成功一次給主力一層掩護）。
  const membersOf = (s) => s.op.squad.concat(s.op.temp);
  const able = (s, id) => !s.op.hurt[id] && !s.op.away[id] && !s.op.stageAway[id] && !s.op.taken[id];
  const laneOf = (s, id) => s.op.laneOf[id] || 'main';
  const laneMembers = (s, lane) => membersOf(s).filter((id) => laneOf(s, id) === lane);
  const lanes = (s) => Object.keys(s.op.lanes);
  function stage(s, lane = 'main') {
    const L = s.op && s.op.lanes[lane];
    return L && L.i < L.stages.length ? content().stages[L.stages[L.i]] : null;
  }
  const spot = (s, lane) => lane + ':' + s.op.lanes[lane].i;
  const others = (s, id) => membersOf(s).filter((m) => m !== id);

  // mode 是 'tac' 時改用戰術地圖（js/engine/tactics.js）；沒有地圖的行動、文字冒險的主線任務照原本的方式。
  // 一次行動的狀態：警戒、頻寬、這次行動用過的卡、受傷和被抓的人……（出發和戰術教學共用）。
  function newOp(s, e, ids, laneMap = {}) {
    const called = ids.filter((id) => member(s, id).status === 'network');
    s.op = {
      key: e.key, op: e.op, main: e.main, kind: e.kind, target: e.target || null, name: e.name, reward: e.reward,
      lanes: Object.assign({ main: { stages: e.stages, i: 0 } }, e.split ? { decoy: { stages: e.decoy, i: 0 } } : {}),
      laneOf: {}, timer: e.timer, screen: 0,
      squad: ids.slice(), temp: [], called, alert: startAlert(s, ids), bw: BANDWIDTH + (s.perks.supply ? 1 : 0),
      used: {}, ghost: null, cover: null, force: null, boost: null, keycard: false, cab: false,
      revealed: {}, hurt: {}, away: {}, stageAway: {}, taken: {}, extraRisk: {}, sulk: {}, backdoor: {}, fired: {},
      part: e.op === 'main' ? e.part || 0 : null,
    };
    for (const id of ids) s.op.laneOf[id] = e.split ? laneMap[id] || 'main' : 'main';
    return called;
  }

  function launch(s, ids, laneMap = {}, mode) {
    if (s.phase !== 'squad' || !squadCheck(s, ids, laneMap).ok) return false;
    const e = picked(s);
    const called = newOp(s, e, ids, laneMap);
    s.pick = null;
    s.phase = 'op';
    say(s, 'op', 's2.log.opStart', { op: { l: e.name } });
    // 白天忙了一整天的人：今晚失敗率 +10%（戰術地圖上是第一回合少一個行動點，見 tactics.prepare）。
    for (const id of ids) {
      if (!E.days.tired(s, id)) continue;
      s.op.extraRisk[id] = (s.op.extraRisk[id] || 0) + TIRED_RISK;
      say(s, 'warn', 's2.log.tired', { name: nameOf(s, id) });
    }
    // 白天有人踩過點：起始警戒 −5，地圖上看得到巡邏路線，第一關的隱藏解法也先知道了。
    if (s.scout && s.scout.night === s.night) {
      s.op.scouted = true;
      say(s, 'gain', 's2.log.scouted', { name: nameOf(s, s.scout.by) });
      s.scout = null;
    }
    for (const id of called) {
      s.heat = clamp(s.heat + CALL_IN_HEAT, 0, 100);
      say(s, 'warn', 's2.log.calledIn', { name: nameOf(s, id) });
    }
    if (e.family) say(s, 'gain', 's2.log.familyHelp', { name: nameOf(s, e.family), target: nameOf(s, e.target) });
    if (e.story && e.part !== 0) {
      beginMission(s);
      return true;
    }
    const plan = mode === 'tac' && tacPlan(s, e);
    if (plan) {
      beginTac(s, e, plan, ids);
      return true;
    }
    startStages(s);
    return true;
  }

  // ===== 戰術地圖 =====
  // 這個行動用哪一張地圖（content-s2/maps.js 的 opMaps）；沒有的話回傳 null。
  function tacPlan(s, e) {
    const M = E.s2.opMaps;
    if (!E.tactics || !M || !e) return null;
    if (e.op === 'recruit') return M.recruit[people().problems.find((x) => x.id === person(s, e.target).problem).mission] || null;
    if (e.op === 'main') return (e.part === 0 ? M.approach && M.approach[e.main] : !e.story && M.main[e.main]) || null;
    return M[e.op] || null;
  }

  // 地圖上有被關的人：救援行動就是被捕的隊員，其他行動是一個路人（救出來之後可以招募）。
  // 外圍情報（酒保）或第一季「留下」的世界：一開始就看得到守衛的巡邏路線。
  function beginTac(s, e, plan, ids) {
    let escort = null;
    if (E.s2.maps[plan.map].rows.some((r) => r.includes('P'))) escort = e.op === 'rescue' ? e.target : person(s, s.district + '-' + (HELPERS + s.helperCount++)).id;
    s.op.mode = 'tac';
    const event = mapEvent(s, plan.map);
    s.op.tac = E.tactics.build({ map: plan.map, obj: plan.obj, ids, rank: rank(s.district), limit: e.timer, escort, event, rng: E.rng.derive(s.seed, 'mapev', s.step), intel: !!networkWith(s, 'gossip') || s.world === 'stay' || !!s.op.scouted });
    s.phase = 'tac';
    say(s, 'op', 'tac.log.start');
    if (event) say(s, 'warn', 'tac.ev.' + event + '.d');
    if (s.op.tac.intel && event !== 'echo') say(s, 'gain', networkWith(s, 'gossip') ? 'tac.log.intelGossip' : s.op.scouted ? 'tac.log.intelScout' : 'tac.log.intelEcho');
    E.tactics.prepare(s, tacApi);
  }

  // 這次潛入的特殊狀況（content-s2/maps.js 的 mapEvents）：一半的機會遇到一種，依地圖主題和第幾區挑。
  const MAP_EVENT_CHANCE = 0.5;
  function mapEvent(s, map) {
    const theme = E.s2.maps[map].theme || 'site';
    const list = (E.s2.mapEvents || []).filter((x) => x.themes.includes(theme) && (x.minRank || 0) <= rank(s.district));
    const r = rand(s);
    return list.length && r.chance(MAP_EVENT_CHANCE) ? r.pick(list).id : null;
  }

  // ===== 主線任務的中場 =====
  // 第一段（潛入）打完：先停下來，被抓的人留在原地，受的傷也帶著走，警戒也照算。
  // 玩家選怎麼喘口氣（重新集合：警戒再 −10；包紮：輕傷的人包好、頻寬 +1），再決定第二段怎麼打；也可以先撤退，下次直接從第二段開始。
  const PART_CHOICES = ['regroup', 'patch', 'retreat'];
  function interlude(s) {
    const op = s.op;
    s.mainPart[op.main] = 1;
    op.part = 1;
    op.mode = null;
    op.tac = null;
    s.queue = [];
    s.event = null;
    s.react = null;
    say(s, 'gain', 's2.log.partDone', { op: { l: op.name } });
    s.phase = 'interlude';
    return true;
  }

  // 第二段：主角還在的話用文字冒險；不然就照一般關卡或戰術地圖（mode 是 'tac'）。
  const partStory = (s) => !!s.op && storyable(s, s.op.main) && !s.op.taken[s.hero] && s.op.hurt[s.hero] !== 'serious';
  function nextPart(s, choice, mode) {
    if (s.phase !== 'interlude' || !PART_CHOICES.includes(choice)) return false;
    const op = s.op;
    s.phase = 'op';
    if (choice === 'retreat') {
      op.partRetreat = true;
      say(s, 'warn', 's2.log.partRetreat');
      return finish(s, 'retreat');
    }
    if (choice === 'regroup') {
      op.alert = Math.max(0, op.alert - 10);
      say(s, 'gain', 's2.log.regroup');
    } else {
      for (const id of Object.keys(op.hurt)) if (op.hurt[id] === 'light') delete op.hurt[id];
      op.bw++;
      say(s, 'gain', 's2.log.patch');
    }
    op.lanes = { main: { stages: content().main[op.main].stages, i: 0 } };
    const ids = op.squad.filter((id) => !op.taken[id]);
    if (!ids.some((id) => able(s, id))) return finish(s, 'retreat');
    if (partStory(s)) {
      beginMission(s);
      return true;
    }
    const plan = mode === 'tac' && E.tactics && E.s2.opMaps.main[op.main];
    if (plan) {
      beginTac(s, { op: 'main', target: null, timer: null }, plan, ids);
      return true;
    }
    startStages(s);
    return true;
  }

  // ===== 戰術教學 =====
  // 一份獨立的沙盒（不存檔，也不碰正在玩的這一輪）：開場的三個自願者（駭客、身體、社交）換成教學用的職業和特質，沒有弱點。
  // 被看到、被追上都不算數（practice），警戒也不會滿。
  function tutorial() {
    const T = E.s2.tutorial;
    const s = create('tutorial', { skipStory: true });
    const ids = s.volunteers.slice(0, 3);
    T.people.forEach((d, i) => Object.assign(person(s, ids[i]), { occupation: d.occupation, traits: d.traits.slice(), flaw: null, quirks: [] }));
    s.relations = {};
    pickVolunteers(s, [ids[1]]);
    recruitPerson(s, ids[2]);
    newOp(s, { key: 'tutorial', op: 'tutorial', kind: 'tutorial', name: T.name, reward: { support: 0 }, stages: [], timer: null }, ids);
    s.op.mode = 'tac';
    s.op.practice = true;
    s.op.tac = E.tactics.build({ map: T.map, ids, rank: 0 });
    s.op.tac.practice = true;
    s.phase = 'tac';
    s.tutorial = { step: 0, roles: {} };
    T.people.forEach((d, i) => { s.tutorial.roles[d.role] = ids[i]; });
    s.log = [];
    say(s, 'op', 'tac.log.start');
    E.tactics.prepare(s, tacApi);
    return s;
  }

  // 教學現在走到哪一步（做完的步驟自動往下走；目標、撤離這種大步驟做完了，前面沒做的就跳過）。教學結束回傳 null。
  function tutorialStep(s) {
    const T = E.s2.tutorial;
    const tut = s.tutorial;
    const t = s.op && s.op.tac;
    if (!tut) return null;
    if (!t) { tut.step = T.steps.length; return null; }
    const R = {};
    for (const role in tut.roles) R[role] = t.units.find((u) => u.id === tut.roles[role]);
    while (tut.step < T.steps.length) {
      const st = T.steps[tut.step];
      const later = T.steps.slice(tut.step + 1).some((x) => x.milestone && x.done(t, R, s));
      if (!st.done(t, R, s) && !later) break;
      tut.step++;
    }
    return T.steps[tut.step] || null;
  }

  // 玩家卡住了：跳過這一步（最後一步撤離不能跳）。
  function tutorialSkip(s) {
    if (!s.tutorial || s.tutorial.step >= E.s2.tutorial.steps.length - 1) return false;
    s.tutorial.step++;
    return true;
  }

  // 戰術地圖要用到的夜間引擎功能。
  const tacApi = {
    person, perk: perkId, category: categoryOf, traits: traitIds, name: nameOf, say, rand, addAlert,
    rival: (s, a, b) => related(s, a, b, 'rival'),
    friend: (s, a, b) => related(s, a, b, 'friend'),
    gifts: giftsOf,
    tired: (s, id) => E.days.tired(s, id),
    // 人脈廣：叫一個路人來幫忙。行動結束時沒被抓的話，可以直接招募（見 finish）。
    summon(s) {
      const p = person(s, s.district + '-' + (HELPERS + s.helperCount++));
      s.op.temp.push(p.id);
      return p.id;
    },
    flaw: (s, id) => flawOf(s, id).id,
    quirks: (s, id) => person(s, id).quirks,
    bw: (s) => s.op.bw,
    spend(s, n) { s.op.bw -= n; },
    hurt: (s, id) => !!s.op.hurt[id],
    wound(s, id) {
      const serious = rand(s).chance(SERIOUS + (s.op.alert >= 60 ? 0.25 : 0));
      s.op.hurt[id] = serious ? 'serious' : 'light';
      say(s, 'bad', serious ? 's2.log.hurtBad' : 's2.log.hurt', { name: nameOf(s, id) });
    },
    heal(s, id) { delete s.op.hurt[id]; },
    arrest(s, id) { arrest(s, id); },
    finish(s, outcome) {
      // 救出來的路人：之後可以招募。
      const t = s.op.tac;
      const e = t.escort && t.units.find((u) => u.escort);
      if (outcome === 'win' && e && e.out && t.escort !== s.op.target) {
        s.owed[t.escort] = 'helper';
        say(s, 'gain', 's2.log.helperOwed', { name: nameOf(s, t.escort) });
      }
      finish(s, outcome);
    },
    timeUp(s) {
      say(s, 'bad', s.op.op === 'raid' ? 's2.log.raidTime' : 's2.log.timeUp');
      finish(s, 'fail');
    },
  };

  // 白天引擎（js/engine/days.js）要用到的夜間引擎功能。
  const dayApi = {
    person, member, name: nameOf, say, rand, related, setPerson,
    flaw: (s, id) => flawOf(s, id).id, category: categoryOf, perk: perkId, traits: traitIds,
    // 白天受的傷（例如德比戰打起來）：在家的人休息幾晚；本來就受傷的人，休養的時間拉長。
    injure(s, id, nights) {
      const m = member(s, id);
      if (!m || !['active', 'injured'].includes(m.status)) return;
      if (m.status === 'active') E.roster.injure(s.roster, id, nights);
      else m.injuredFor = Math.max(m.injuredFor, nights);
      say(s, 'bad', 's2.day.log.hurt', { name: nameOf(s, id), n: nights });
    },
  };

  // 走一般關卡：外圍情報、Echo 的提示、會怯場的人，然後進第一關。
  function startStages(s) {
    const first = content().stages[s.op.lanes.main.stages[0]];
    const gossip = networkWith(s, 'gossip');
    if (s.op.scouted && first.hidden) s.op.revealed['main:0'] = true;
    else if (gossip && first.hidden) {
      s.op.revealed['main:0'] = true;
      say(s, 'gain', 's2.log.gossip', { name: nameOf(s, gossip) });
    } else if (s.world === 'stay' && first.hidden) {
      // 第一季「留下」的世界：Echo 會先看穿第一關的另一條路。
      s.op.revealed['main:0'] = true;
      say(s, 'card', 's2.log.echoHint');
    }
    for (const id of s.op.squad) {
      if (flawOf(s, id).event === 'freeze' && rand(s).chance(0.5)) s.queue.push({ type: 'freeze', who: id, choices: ['out', 'go'] });
    }
    for (const lane of lanes(s)) enterStage(s, lane);
  }

  // 每進入一關，檢查這條線上的人的弱點和小習慣會不會出包。
  function enterStage(s, lane) {
    const st = stage(s, lane);
    if (!st || s.phase !== 'op' && s.phase !== 'event') return;
    for (const id of laneMembers(s, lane)) delete s.op.stageAway[id];
    const L = s.op.lanes[lane];
    say(s, 'stage', lane === 'decoy' ? 's2.log.decoyStage' : 's2.log.stage', { i: L.i + 1, n: L.stages.length, stage: { l: st.name } });
    for (const id of laneMembers(s, lane)) {
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
    if (ms.some((a) => ms.some((b) => a < b && related(s, a, b, 'rival')))) out.push('feud');
    if (ms.some((a) => ms.some((b) => a < b && related(s, a, b, 'friend')))) out.push('friends');
    return out;
  }

  // 某條線目前這一關所有的解法，包括隱藏解法、偷來的門卡、外圍支援、稀有人物和默契組合帶來的解法。
  function approaches(s, lane = 'main') {
    const st = stage(s, lane);
    if (!st) return [];
    const sp = content().special;
    const list = st.approaches.slice();
    if (s.op.revealed[spot(s, lane)] && st.hidden) list.push(Object.assign({ hidden: true }, st.hidden));
    if (s.op.keycard && st.tags.includes('door')) list.push(sp.keycard);
    if (st.tags.includes('exit') && !s.op.cab && networkWith(s, 'getaway')) list.push(sp.network_cab);
    if (st.tags.includes('exit') && s.perks.tunnels) list.push(sp.tunnel); // 羅瑟希德解放後：走隧道撤離
    for (const id of laneMembers(s, lane)) {
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

  function tagsOf(s, a, lane) {
    return new Set((a.tags || []).concat(stage(s, lane).tags));
  }

  function riskOf(s, a, id) {
    if (a.sure) return 0;
    const lane = laneOf(s, id);
    const p = person(s, id);
    const needs = a.needs || {};
    const tags = tagsOf(s, a, lane);
    const perk = perkId(s, id);
    let r = a.risk === undefined ? 0.3 : a.risk;
    for (const k in needs.skill || {}) r -= 0.1 * Math.max(0, (p.skills[k] || 0) - needs.skill[k]);
    if (a.perkBonus && a.perkBonus[perk]) r += a.perkBonus[perk];
    if (needs.ability && perk === needs.ability) r -= 0.1;
    if (hasTrait(s, id, 'calm')) r -= 0.05;
    if (hasTrait(s, id, 'nightowl') && s.op.lanes[lane].i >= 2) r -= 0.15;
    const flaw = flawOf(s, id);
    r += flaw.risk || 0;
    for (const t in flaw.riskTags || {}) if (tags.has(t)) r += flaw.riskTags[t];
    for (const q of E.people.quirksOf(p)) for (const t in q.risk || {}) if (tags.has(t)) r += q.risk[t];
    const scars = scarsOf(s, id);
    if (scars.includes('inside')) r -= 0.1;
    if (scars.includes('veteran')) r -= 0.1;
    if (scars.includes('old_wound') && (tags.has('run') || tags.has('climb'))) r += 0.15;
    for (const o of membersOf(s)) {
      if (o === id) continue;
      if (related(s, id, o, 'coworker')) r -= 0.1;
      if (related(s, id, o, 'friend')) r -= 0.05; // 朋友同隊：互相照應
      if (related(s, id, o, 'ex')) r += 0.1;
      if (related(s, id, o, 'rival')) r += 0.1; // 死對頭同隊：兩個人互相扯後腿
    }
    if (combos(s).includes('derby')) r += 0.1;
    if (s.world === 'wildfire') r += 0.05; // 燎原：連獅心防務都有重建引擎
    r += 0.03 * rank(s.district);          // 越後面的區，獅心防務的部署越密
    if (perk === 'legacy' && tags.has('hack')) r -= 0.25;
    if (perk === 'rooftops' && tags.has('climb')) r -= 0.3;
    if (s.op.alert >= 60) r += 0.2;
    else if (s.op.alert >= 30) r += 0.1;
    if (s.op.boost === spot(s, lane)) r -= 0.15;
    if (lane === 'main' && s.op.screen > 0) r -= 0.15;
    r += s.op.extraRisk[id] || 0;
    return clamp(round2(r), 0.05, 0.95);
  }

  function exposureOf(s, a, id) {
    if (s.op.ghost === id) return 0;
    const lane = laneOf(s, id);
    const tags = tagsOf(s, a, lane);
    const perk = perkId(s, id);
    if (perk === 'legacy' && tags.has('hack')) return 0;
    let x = a.exposure === undefined ? 5 : a.exposure;
    if (perk === 'network_access' && tags.has('hack') && tags.has('office')) x = 0;
    x += flawOf(s, id).exposure || 0;
    if (giftsOf(s, id).includes('quietstep')) x -= 2; // Darcy 教的腳步
    if (combos(s).includes('cantonese_pair')) x -= 1;
    if (lane === 'main' && s.op.screen > 0) x = Math.floor(x / 2);
    return Math.max(0, x);
  }

  // 某個隊員能不能用某個解法；能的話附上失敗率、警戒和頻寬。
  function candidate(s, a, id) {
    if (a.only && a.only !== id) return null;
    if (!able(s, id)) return { id, ok: false, reason: 's2.need.out' };
    const needs = a.needs || {};
    const blocks = flawOf(s, id).blocks || [];
    if (tonight(s, 'blackout') && (a.tags || []).includes('hack')) return { id, ok: false, reason: 's2.need.blackout' };
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

  function options(s, lane = 'main') {
    return approaches(s, lane).map((a) => ({
      approach: a,
      candidates: laneMembers(s, lane).map((id) => candidate(s, a, id)).filter(Boolean),
    }));
  }

  // ===== 招式卡 =====
  function cards(s) {
    const out = [];
    for (const id of membersOf(s)) {
      for (const t of traitIds(s, id)) out.push(cardState(s, id, t, traitCard(t)));
      if (perkId(s, id) === 'take_over') out.push(cardState(s, id, 'take_over', { kind: 'active', effect: 'jam', name: people().perks.take_over.name, desc: people().perks.take_over.desc }));
      for (const g of giftsOf(s, id)) out.push(cardState(s, id, g, E.s2.days.gifts[g]));
    }
    return out;
  }

  function cardState(s, owner, cid, card) {
    const used = !!s.op.used[owner + ':' + cid];
    const lane = laneOf(s, owner);
    const st = stage(s, lane);
    let usable = card.kind === 'active' && !used && able(s, owner) && !s.op.sulk[owner] && !!st;
    if (usable) {
      if (card.effect === 'summon') usable = s.op.temp.length === 0;
      if (card.effect === 'reveal') usable = !!st.hidden && !s.op.revealed[spot(s, lane)];
      if (card.effect === 'pickpocket') usable = !s.op.keycard;
      if (card.effect === 'talkdown' || card.effect === 'jam') usable = s.op.alert > 0;
      if (card.effect === 'ghost') usable = s.op.ghost !== owner;
      if (card.effect === 'cover') usable = s.op.cover !== owner;
      if (card.effect === 'force') usable = s.op.force !== owner;
      if (card.effect === 'boost') usable = s.op.boost !== spot(s, lane);
      if (card.effect === 'sergei') usable = s.op.alert > 0 || s.op.boost !== spot(s, lane);
    }
    const inherited = !!(member(s, owner) && member(s, owner).inherited && member(s, owner).inherited.trait === cid);
    return { owner, id: cid, card, used, usable, inherited, sulking: !!s.op.sulk[owner] };
  }

  function useCard(s, owner, cid) {
    if (s.phase !== 'op') return false;
    const c = cards(s).find((x) => x.owner === owner && x.id === cid);
    if (!c || !c.usable) return false;
    s.op.used[owner + ':' + cid] = true;
    const lane = laneOf(s, owner);
    const v = { name: nameOf(s, owner) };
    switch (c.card.effect) {
      case 'summon': {
        const helper = person(s, s.district + '-' + (HELPERS + s.helperCount++));
        s.op.temp.push(helper.id);
        s.op.laneOf[helper.id] = lane;
        say(s, 'gain', 's2.card.summon', Object.assign(v, { helper: nameOf(s, helper.id), job: { l: E.people.occupationOf(helper).name } }));
        break;
      }
      case 'reveal': s.op.revealed[spot(s, lane)] = true; say(s, 'card', 's2.card.reveal', v); break;
      case 'ghost': s.op.ghost = owner; say(s, 'card', 's2.card.ghost', v); break;
      case 'talkdown': say(s, 'card', 's2.card.talkdown', v); addAlert(s, -15, owner); break;
      case 'pickpocket': s.op.keycard = true; say(s, 'card', 's2.card.pickpocket', v); break;
      case 'force': s.op.force = owner; say(s, 'card', 's2.card.force', v); break;
      case 'boost': s.op.boost = spot(s, lane); say(s, 'card', 's2.card.boost', v); break;
      case 'cover': s.op.cover = owner; say(s, 'card', 's2.card.cover', v); break;
      case 'jam': say(s, 'card', 's2.card.jam', v); addAlert(s, -30, owner); break;
      // 扳手送的小無人機：飛去鬧巡邏隊，警戒 −15，這一關全隊成功率 +15%。
      case 'sergei': say(s, 'card', 's2.card.sergei', v); s.op.boost = spot(s, lane); addAlert(s, -15, owner); break;
    }
    return true;
  }

  // ===== 手動駭入 =====
  // 駭入類的解法可以不擲骰，改玩訊號接線小遊戲：解開就一定成功、警戒減半；時間到就算失敗。
  // 題目大小看門檻，時間看這個人的駭入能力。
  const hackable = (a) => !!a && !a.sure && (a.tags || []).includes('hack');
  function puzzleSpec(s, aid, id) {
    if (!s.op) return null;
    const a = approaches(s, laneOf(s, id)).find((x) => x.id === aid);
    const c = a && candidate(s, a, id);
    if (!hackable(a) || !c || !c.ok) return null;
    const req = (a.needs && a.needs.skill && a.needs.skill.hack) || 1;
    const size = req >= 2 ? 5 : 4;
    let seconds = (size === 5 ? 35 : 25) + 5 * Math.max(0, (person(s, id).skills.hack || 0) - req);
    if (perkId(s, id) === 'legacy') seconds += 15;
    if (hasQuirk(s, id, 'gamer')) seconds += 5;
    return { size, seconds, seed: [s.seed, 'hack', s.step, aid, id].join(':'), exposure: Math.floor(c.exposure / 2) };
  }

  // ===== 執行一個動作 =====
  // manual 是手動駭入的結果：{ solved: true/false }。沒有的話就照成功率擲骰。
  function act(s, aid, id, manual) {
    if (s.phase !== 'op' || !membersOf(s).includes(id)) return false;
    const a = approaches(s, laneOf(s, id)).find((x) => x.id === aid);
    const c = a && candidate(s, a, id);
    if (!c || !c.ok) return false;
    const byHand = !!manual && hackable(a);
    if (s.op.timer !== null) s.op.timer--;
    s.op.bw -= bandwidthCost(s, a, id, true);
    if (a.id === 'network_cab') s.op.cab = true;
    if (laneOf(s, id) === 'main' && s.op.screen > 0) s.op.screen--;
    const success = a.sure || (byHand ? !!manual.solved : rand(s).next() >= c.risk);
    const exposure = byHand && manual.solved ? Math.floor(c.exposure / 2) : c.exposure;
    if (byHand) say(s, manual.solved ? 'card' : 'bad', manual.solved ? 's2.log.hackSolved' : 's2.log.hackFailed', { name: nameOf(s, id) });
    if (s.op.ghost === id) s.op.ghost = null;
    if (s.op.force === id && (a.tags || []).includes('physical')) s.op.force = null;
    if (success) succeed(s, a, id, exposure);
    else if (s.op.cover === id) {
      s.op.cover = null;
      say(s, 'ok', 's2.card.coverSaved', { name: nameOf(s, id) });
    } else {
      // 冷靜：同隊任何一個冷靜的人，都可以把這次失敗改判成功。
      const calm = membersOf(s).find((m) => able(s, m) && hasTrait(s, m, 'calm') && !s.op.used[m + ':calm'] && !s.op.sulk[m]);
      if (calm) {
        s.react = { type: 'reroll', owner: calm, who: id, approach: a, exposure };
        s.phase = 'react';
        return true;
      }
      fail(s, a, id, exposure);
    }
    timeCheck(s);
    return true;
  }

  // 限時行動：步數用完還沒完成，就算失敗。
  function timeCheck(s) {
    if ((s.phase === 'op' || s.phase === 'event') && s.op && s.op.timer !== null && s.op.timer <= 0) {
      say(s, 'bad', s.op.op === 'raid' ? 's2.log.raidTime' : 's2.log.timeUp');
      s.phase = 'op';
      finish(s, 'fail');
    }
  }

  function succeed(s, a, id, exposure) {
    say(s, 'ok', 's2.raw', raw(fill(a.ok, { name: E.people.name(person(s, id)) })));
    addAlert(s, exposure, id);
    if (s.phase !== 'op' && s.phase !== 'event') return true;
    const lane = laneOf(s, id);
    const L = s.op.lanes[lane];
    L.i++;
    if (lane === 'decoy') {
      s.op.screen = Math.min(2, s.op.screen + 1);
      say(s, 'gain', 's2.log.screen', { name: nameOf(s, id), n: s.op.screen });
      if (L.i >= L.stages.length) say(s, 'gain', 's2.log.decoyDone');
      else enterStage(s, 'decoy');
      return true;
    }
    if (L.i >= L.stages.length) return finish(s, 'win');
    enterStage(s, 'main');
    return true;
  }

  const FAIL_LINES = ['hack', 'physical', 'social', 'hands'];
  function fail(s, a, id, exposure) {
    const kind = FAIL_LINES.find((t) => (a.tags || []).includes(t)) || 'other';
    say(s, 'bad', 's2.fail.' + kind, { name: nameOf(s, id) });
    addAlert(s, exposure + (a.fail === undefined ? 10 : a.fail), id);
    if (s.phase !== 'op' && s.phase !== 'event') return;
    // 警戒 30 以上，武裝無人機會開火：任何失敗都可能受傷；60 以上更危險，也更容易傷得重。
    const drones = s.op.alert >= 60 ? 0.3 : s.op.alert >= 30 ? 0.12 : 0;
    const r = rand(s);
    if (!s.op.hurt[id] && r.chance(Math.max(a.injure || 0, drones))) {
      const serious = r.chance(SERIOUS + (s.op.alert >= 60 ? 0.25 : 0));
      s.op.hurt[id] = serious ? 'serious' : 'light';
      say(s, 'bad', serious ? 's2.log.hurtBad' : 's2.log.hurt', { name: nameOf(s, id) });
    }
    if (!laneMembers(s, 'main').some((m) => able(s, m))) finish(s, 'retreat');
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
      timeCheck(s);
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
    // 停電的晚上，無人機的感測器也受影響：增加的警戒減半。
    if (amount > 0 && tonight(s, 'blackout')) amount = Math.ceil(amount / 2);
    // 回收：Echo 被困在守夜人裡，無人機學得更快。
    if (amount > 0 && s.world === 'recaptured') amount += 1;
    const before = op.alert;
    op.alert = clamp(before + amount, 0, op.practice ? 90 : 100); // 教學關的警戒不會滿
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
    if (s.op) s.op.taken[id] = true;
    s.stats.arrests++;
    say(s, 'bad', 's2.log.arrested', { name: nameOf(s, id) });
    if (!member(s, id)) return; // 叫來幫忙的路人
    E.roster.arrest(s.roster, id, s.night);
    const m = member(s, id);
    if (m.status === 'lost') s.stats.lost.push(id);
    // 外圍的律師可以拖延移送。
    const lawyer = networkWith(s, 'bail');
    if (lawyer && m.status === 'arrested') {
      m.since += 2;
      say(s, 'gain', 's2.log.bail', { name: nameOf(s, lawyer), other: nameOf(s, id) });
    }
    // 被捕者的家人會找上門來幫忙。
    for (const r of relationsOf(s, id)) {
      if (r.type === 'family' && !member(s, r.other)) {
        s.owed[r.other] = 'family';
        say(s, 'gain', 's2.log.familyCome', { name: nameOf(s, r.other), other: nameOf(s, id) });
      }
    }
    syncBeds(s);
  }

  function retreat(s) {
    if (s.phase !== 'op' && s.phase !== 'tac') return false;
    say(s, 'warn', 's2.log.retreat');
    return finish(s, 'retreat');
  }

  // 安全屋被攻破：抓走一個人，優先是留在屋裡的人。
  function raidLost(s, squad) {
    say(s, 'bad', 's2.log.raidLost');
    const inside = E.roster.housed(s.roster).map((m) => m.person.id).filter((id) => !(s.op && s.op.taken[id]));
    const pool = inside.filter((id) => !squad.includes(id));
    const list = pool.length ? pool : inside;
    if (list.length) arrest(s, rand(s).pick(list));
    return 15;
  }

  // ===== 結算 =====
  function finish(s, outcome) {
    const op = s.op;
    if (outcome === 'win' && op.op === 'main' && op.part === 0) return interlude(s);
    const res = { outcome, op: op.op, name: op.name, alert: op.alert, support: 0, heat: 0, beds: 0 };
    s.stats.ops++;
    s.queue = [];
    s.event = null;
    if (outcome === 'win') {
      s.stats.wins++;
      let support = op.reward.support || 0;
      if (op.op === 'broadcast') {
        if (membersOf(s).concat(E.roster.network(s.roster).map((m) => m.person.id)).some((m) => perkId(s, m) === 'pirate_radio')) {
          support *= 2;
          say(s, 'gain', 's2.log.radio');
        }
        for (const perk of ['press', 'broadcast']) {
          const who = networkWith(s, perk);
          if (who) { support += 5; say(s, 'gain', 's2.log.amplify', { name: nameOf(s, who) }); }
        }
      }
      if (op.op === 'tower') { s.towers--; say(s, 'gain', 's2.log.towerDown', { n: s.towers }); }
      if (op.op === 'main') {
        delete s.mainPart[op.main];
        const extra = mainReward(s, op.main, op.storyFlags || {});
        support += extra.support;
        res.heat += extra.heat;
        res.main = op.main;
      }
      if (op.op === 'expand') { s.expands++; res.beds = 2; syncBeds(s); say(s, 'gain', 's2.log.beds'); }
      if (op.op === 'raid') { res.heat -= 10; say(s, 'gain', 's2.log.raidWin'); }
      if (op.op === 'rescue' && E.roster.rescue(s.roster, op.target)) {
        member(s, op.target).scars.push('inside');
        say(s, 'gain', 's2.log.rescued', { name: nameOf(s, op.target) });
      }
      if (op.op === 'recruit') recruitPerson(s, op.target);
      for (const id of op.squad) {
        const m = member(s, id);
        m.wins = (m.wins || 0) + 1;
        if (m.wins === RETIRE_WINS && !m.scars.includes('veteran')) { m.scars.push('veteran'); say(s, 'gain', 's2.log.veteran', { name: nameOf(s, id) }); }
      }
      for (const id of membersOf(s)) {
        if (flawOf(s, id).event === 'brag' && !op.taken[id]) {
          support += 5;
          res.heat += 10;
          say(s, 'warn', 's2.ev.brag', { name: nameOf(s, id) });
        }
      }
      // 親自指揮成功，民心多 5。
      if (op.mode === 'tac' && !op.practice) { support += TAC_BONUS; say(s, 'gain', 's2.log.tacBonus', { n: TAC_BONUS }); }
      res.support = support;
      res.heat += Math.round(op.alert / 5);
      s.support = Math.min(100, s.support + support);
      if (support) say(s, 'gain', 's2.log.support', { n: support });
    } else {
      res.heat += (op.partRetreat ? 3 : 10) + Math.round(op.alert / 10); // 中場撤退：沒有被追著跑，熱度只加一點
      if (op.op === 'raid') res.heat += raidLost(s, op.squad);
    }
    // 出過任務的人，威脅評分會上升；失敗的話升得更多。
    for (const id of op.squad) {
      const m = member(s, id);
      // 戰術地圖：從頭到尾沒被看到的人，威脅評分不會上升。
      if (op.mode === 'tac' && !op.tac.spotted[id] && !op.taken[id]) continue;
      if (m && !op.taken[id]) m.threat = Math.min(100, m.threat + 3 + Math.round(op.alert / 10) + (outcome === 'win' ? 0 : 5));
    }
    // 輕傷休一兩晚；重傷休三晚，而且沒有護理師照顧的話，接下來兩個早上都可能撐不過去。
    const nurse = hasNurse(s);
    for (const id in op.hurt) {
      const m = member(s, id);
      if (!m || op.taken[id] || m.status !== 'active') continue;
      const serious = op.hurt[id] === 'serious';
      E.roster.injure(s.roster, id, (serious ? 3 : 2) - (nurse ? 1 : 0));
      if (serious && !nurse) {
        m.critical = CRITICAL_MORNINGS;
        say(s, 'bad', 's2.log.critical', { name: nameOf(s, id) });
      }
      if (rand(s).chance(serious ? 0.7 : 0.3) && !m.scars.includes('old_wound')) {
        m.scars.push('old_wound');
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

  const hasNurse = (s) => s.roster.members.some((m) => ['active', 'network'].includes(m.status) && perkId(s, m.person.id) === 'heal');

  // 地下診所：重傷的人送去治療，離開三晚，保住一條命，但診所裡人多嘴雜，熱度 +8。
  function clinic(s, id) {
    const m = member(s, id);
    if (s.phase !== 'day' || !m || !['injured', 'network'].includes(m.status) || !m.critical) return false;
    m.critical = 0;
    m.status = 'away';
    m.awayFor = 3;
    s.heat = clamp(s.heat + CLINIC_HEAT, 0, 100);
    say(s, 'ok', 's2.log.clinic', { name: nameOf(s, id) });
    syncBeds(s);
    return true;
  }

  // 今晚不出門：讓受傷的人休息，熱度也會退一點。突襲的晚上不出來應戰，安全屋就會被攻破。
  function rest(s) {
    if (s.phase !== 'day' || eventWaiting(s)) return false;
    const res = { outcome: 'rest', support: 0, heat: 0, beds: 0 };
    if (tonight(s, 'raid')) {
      res.outcome = 'fail';
      res.op = 'raid';
      res.name = content().ops.raid.name;
      res.heat = raidLost(s, []);
      s.heat = clamp(s.heat + res.heat, 0, 100);
    } else say(s, 'night', 's2.log.rest');
    s.result = res;
    s.phase = 'result';
    return true;
  }

  // ===== 天亮了 =====
  function nextDay(s) {
    if (s.phase !== 'result') return false;
    // 空域控制中心打下來了：結局。
    if (s.result && s.result.main === 'm8') return end(s, endingFor(s));
    s.night++;
    s.dnight++;
    s.result = null;
    s.tonight = null;
    // 重傷的人：有護理師就沒事；沒有的話，每個早上都可能撐不過去。
    // 送回外圍的人也一樣危險；只有送去診所（避風頭狀態）才安全。
    for (const m of s.roster.members) {
      if (!m.critical || !['injured', 'network', 'active'].includes(m.status)) continue;
      if (hasNurse(s)) { m.critical = 0; say(s, 'gain', 's2.log.nurseSaved', { name: nameOf(s, m.person.id) }); }
      else if (rand(s).chance(DEATH_CHANCE)) {
        m.status = 'dead';
        m.critical = 0;
        s.stats.dead.push(m.person.id);
        say(s, 'bad', 's2.log.died', { name: nameOf(s, m.person.id) });
      } else m.critical--;
    }
    for (const ev of E.roster.tickNight(s.roster, s.night)) {
      if (ev.type === 'healed') say(s, 'gain', 's2.log.healed', { name: nameOf(s, ev.id) });
      if (ev.type === 'returned') say(s, 'gain', 's2.log.returned', { name: nameOf(s, ev.id) });
      if (ev.type === 'transferred') { s.stats.lost.push(ev.id); say(s, 'bad', 's2.log.transferred', { name: nameOf(s, ev.id) }); }
    }
    syncBeds(s);
    for (const m of s.roster.members) if (m.threat) m.threat = Math.max(0, m.threat - 2);
    s.heat = Math.max(0, s.heat - 5 - (networkWith(s, 'unsuspicious') ? 3 : 0));
    if (!s.roster.members.some((m) => ['active', 'injured', 'network', 'away'].includes(m.status)) && !Object.keys(s.owed).length) return end(s, 'wiped');
    // 民心滿了，而且這一區的主線任務完成：解放。西敏只能靠空域控制中心結束。
    if (s.support >= 100 && s.district !== 'westminster' && !mainNow(s)) return liberate(s);
    if (s.dnight > NIGHTS[s.district]) return end(s, 'curfew');
    s.phase = 'day';
    say(s, 'night', 's2.log.night', { n: s.dnight });

    // 名單上的隊員：獅心防務會照著名單上門抓人，除非這個人去避風頭了。
    for (const m of E.roster.active(s.roster)) {
      if (m.hunted && rand(s).chance(HUNTED_CHANCE)) {
        say(s, 'bad', 's2.log.hunted', { name: nameOf(s, m.person.id) });
        arrest(s, m.person.id);
      }
    }
    // 威脅評分太高的人，白天在檢查站也可能被攔下。
    for (const m of E.roster.active(s.roster)) {
      if (m.threat >= WANTED && rand(s).chance((m.threat - 70) / 60)) {
        say(s, 'bad', 's2.log.checkpoint', { name: nameOf(s, m.person.id) });
        arrest(s, m.person.id);
      }
    }

    // 獅心防務的反擊：康登從第三晚起、其他區從第二晚起。越後面的區越頻繁；狗島的內應線可以先看到部署。
    const r = rand(s);
    const counterChance = 0.4 + 0.04 * rank(s.district) - (s.perks.insider ? 0.15 : 0);
    if (s.dnight >= (s.district === 'camden' ? 3 : 2) && r.chance(counterChance)) {
      const pool = ['blackout', 'early'];
      if (s.raids < 2 && E.roster.active(s.roster).length >= 1 && s.lastRaid !== s.dnight - 1) pool.push('raid', 'raid');
      const type = r.pick(pool);
      s.tonight = { type };
      if (type === 'raid') { s.raids++; s.lastRaid = s.dnight; }
      say(s, 'warn', 's2.counter.' + type);
      E.days.begin(s, dayApi);
      return true;
    }
    const held = s.roster.members.find((m) => m.status === 'arrested');
    const critical = s.roster.members.find((m) => m.status === 'injured' && m.critical);
    const main = mainNow(s);
    if (critical) say(s, 'bagley', 's2.bagley.critical', { name: nameOf(s, critical.person.id) });
    // 主線任務第一次出現的那個早上，Bagley 會提一下。
    else if (main && s.dnight >= MAIN_NIGHT && !s.told[main]) { s.told[main] = true; say(s, 'bagley', 's2.bagley.' + main); }
    else if (s.support >= 100 && main) say(s, 'bagley', 's2.bagley.needMain');
    else if (held) say(s, 'bagley', 's2.bagley.held', { name: nameOf(s, held.person.id), n: E.roster.TRANSFER_AFTER - (s.night - held.since) });
    else if (E.roster.active(s.roster).some((m) => m.threat >= WANTED)) say(s, 'bagley', 's2.bagley.wanted');
    else if (s.heat >= 40) say(s, 'bagley', 's2.bagley.heat');
    else say(s, 'bagley', 's2.bagley.d' + r.int(1, 5));
    E.days.begin(s, dayApi);
    return true;
  }

  function end(s, kind) {
    s.ended = kind;
    s.endLines = epilogue(s, kind);
    s.phase = 'end';
    return true;
  }

  E.night = {
    ORDER, ACT2, NIGHTS, BANDWIDTH, MAX_SQUAD, MAX_SPLIT, WANTED, RETIRE_WINS, LOW_NIGHTS, CALL_IN_HEAT,
    nightsIn: (s) => NIGHTS[s.district],
    create, person, relationsOf, traitIds, pickVolunteers,
    MAX_KEEP, street, scan, keep, kept, leavesAfter, recruitOwed, sendHome, callBack, layLow, retire, canRetire,
    ops, pickOp, cancel, picked, squadCheck, startAlert, combosFor, launch, rest,
    stage, options, combos, cards, useCard, act, react, answer, retreat, nextDay,
    networkWith, puzzleSpec, hackable, clinic, travel, mainNow,
    // 白天
    dayCheck: (s, act, ids) => E.days.check(s, dayApi, act, ids),
    dayCanPick: (s, act, i, id) => E.days.canPick(s, dayApi, act, i, id),
    dayAct: (s, act, ids) => E.days.act(s, dayApi, act, ids),
    dayAnswer: (s, choice) => E.days.answer(s, dayApi, choice),
    dayForce: (s, id) => E.days.force(s, dayApi, id),
    bondUp: (s, a, b, d) => E.days.addBond(s, dayApi, a, b, d),
    bond: (s, a, b) => E.days.bond(s, dayApi, a, b),
    goodCoach: (s, flaw, id) => E.days.goodCoach(s, dayApi, flaw, id),
    trainProgress: (s, id) => E.days.progress(s, dayApi, id),
    gifts: giftsOf,
    tired: (s, id) => E.days.tired(s, id),
    busy: (s, id) => E.days.busyOf(s, id),
    // 戰術地圖
    tutorial, tutorialStep, tutorialSkip,
    tacPlan: (s) => !!tacPlan(s, picked(s)),
    // 主線任務的中場
    nextPart, partStory,
    partTac: (s) => !!s.op && !partStory(s) && !!E.tactics && !!E.s2.opMaps.main[s.op.main],
    tacMove: (s, id, x, y) => E.tactics.move(s, tacApi, id, x, y),
    tacUse: (s, id, ab, x, y) => E.tactics.use(s, tacApi, id, ab, x, y),
    tacEnd: (s) => E.tactics.endTurn(s, tacApi),
    tacReach: (s, id) => E.tactics.reach(s, tacApi, id),
    tacRisky: (s, id) => E.tactics.risky(s, tacApi, id),
    tacAbilities: (s, id) => E.tactics.abilities(s, tacApi, id),
    tacCaps: (s, id) => E.tactics.caps(s, tacApi, id),
    tacCards: (s, id) => E.tactics.cards(s, tacApi, id),
    tacVision: (s) => E.tactics.vision(s),
    tacUndo: (s) => E.tactics.undo(s),
    WORLDS, MAIN_NIGHT, storyCommand, storyFinish, skipStory, mainPending,
    members: (s) => (s.op ? membersOf(s) : []),
    laneOf: (s, id) => (s.op ? laneOf(s, id) : 'main'),
    able: (s, id) => !!s.op && able(s, id),
  };
})(window.ECHO = window.ECHO || {});
