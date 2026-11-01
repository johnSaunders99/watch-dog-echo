// 自動測試：不需要瀏覽器，也不需要安裝任何套件。
//   node tools/check.js                  跑全部檢查
//   node tools/check.js --show zh-Hant   另外印出某一條第一季路線的完整文字
//   node tools/check.js --samples 3      另外印出每個行政區 3 個隨機路人的三語檔案，給人看文字品質
// 任何一項失敗，結束碼就不是 0（GitHub Actions 會因此標成失敗）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const show = arg('--show');
const samples = Number(arg('--samples') || 0);

// ===== 在 Node 裡模擬瀏覽器，載入遊戲腳本 =====
const storage = new Map();
const ctx = {
  console,
  document: { documentElement: {} },
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
};
ctx.window = ctx;
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });

// 第一季：照 index.html 的順序載入（介面相關的檔案除外）。
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/ui\/|main\.js/.test(f));
// 第二季的引擎與資料（還沒放進 index.html）。
const S2_SCRIPTS = ['js/engine/rng.js', 'js/engine/people.js', 'js/engine/roster.js', 'js/engine/mission.js',
  'content-s2/people.js', 'content-s2/locales.js'];

const tables = {};
let E;
for (const f of [...scripts, ...S2_SCRIPTS]) {
  load(f);
  if (f.endsWith('i18n.js')) {
    E = ctx.ECHO;
    const reg = E.i18n.register;
    E.i18n.register = (code, table) => { tables[code] = Object.assign(tables[code] || {}, table); reg(code, table); };
  }
}

let problems = 0;
const fail = (msg) => { problems++; console.log('FAIL', msg); };
const section = (title) => console.log(`\n## ${title}`);
const render = (entries) => entries.filter((e) => e.c !== 'pause').map((e) => E.i18n.t(e.k, e.v));
const unresolved = (text) => text.includes('⟦') || /\{\w+\}/.test(text);

// ===== 1. 三語文本 =====
section('三語文本');
const codes = Object.keys(tables);
const all = new Set(codes.flatMap((c) => Object.keys(tables[c])));
for (const c of codes) for (const k of all) if (!(k in tables[c])) fail(`${c} missing ${k}`);

const used = new Set();
for (const m of html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) used.add(m[1]);
const sources = ['js/main.js', 'js/ui/terminal.js', ...scripts.filter((f) => !f.includes('locales')), ...S2_SCRIPTS.filter((f) => !f.includes('locales'))];
for (const f of sources) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  // 動作的 id（id: 'mem.plan'）和進度查詢（s.fired['...']）不是文字 key。
  for (const m of src.matchAll(/(?<!id: |fired\[)['"]((?:ui|hud|loc|err|items|lang|help|fx|scan|boot|room|recall|ev|message|desk|note|graffiti|laptop|photo|camera|van|radio|maya|attack|desync|mem|mem1|mem2|mem3|cw|ch3|fin|end|wait|talk|switch|actor|co|cameo|chip|s2)\.[\w.]+)['"]/g)) used.add(m[1]);
}
for (const sc of Object.values(E.scenes)) for (const id of Object.keys(sc.entities)) used.add('ent.' + id);
for (const v of Object.keys(E.commands)) used.add('verb.' + v);
for (const k of used) if (!k.endsWith('.') && !all.has(k)) fail(`key used but not defined: ${k}`);
console.log(`${all.size} keys × ${codes.length} languages`);

// ===== 2. 第一季：四條路線打到四種結局 =====
section('第一季路線');
const PRO = {
  'zh-Hant': ['讀取訊息', '重建 瑪雅', '攻擊 筆電', '看', '看書桌', '讀便條', '駭入筆電', '掃描照片', '駭入 監視器', '掃描廂型車', '物品', '說明', '亂打一通', '重建瑪雅'],
  'zh-Hans': ['读取消息', '查看', '入侵 旧笔记本', '扫描 合影', '入侵监控', '扫描 面包车', '查看书桌', '读便签', '重建玛雅'],
  en: ['read message', 'hack laptop', 'hack camera', 'look desk', 'read note', 'recall maya'],
};
const MEM1 = {
  'zh-Hant': ['讀取手機', '駭入監視器', '看排水溝蓋', '前往裝卸區', '交談 外送員', '掃描外送員', '駭入螢幕', '前往', '看浩文', '看白板', '駭入 ECHO-7', '跟浩文說話', '離開'],
  'zh-Hans': ['读取手机', '前往装卸区', '入侵 保安的手机', '前往', '看浩文', '入侵机柜', '交谈 浩文', '离开'],
  en: ['attack', 'attack bin', 'go dock', "hack guard's phone", 'go', 'open box', 'hack echo-7', 'go', 'hack echo-7', 'talk to ho-man', 'leave'],
};
const CHINA = {
  'zh-Hant': ['看', '掃描機車', '掃描灰大衣', '掃描人群', '掃描人群', '前往茶樓', '駭入茶樓監視器',
    '交談 浩文', '駭入手機', '交談 浩文', '問浩文瑪雅', '問浩文關於匯款', '問 浩文 盒子', '問浩文帳號', '駭入平板', '駭入灰大衣'],
  'zh-Hans': ['入侵茶楼监控', '入侵平板', '扫描浩文', '入侵平板', '入侵灰大衣', '入侵手机', '交谈浩文',
    '问浩文汇款', '问 浩文 天气', '问浩文玛雅'],
  en: ['hack camera', 'hack phone', 'talk ho-man', 'ask ho-man about the money', 'hack tv', 'wait',
    'ask ho-man about his account', 'hack tablet', 'ask ho-man to join', 'hack grey coat', 'ask ho-man about maya'],
};
const MEM2 = {
  // 完美路線：同步率 85% 以上時注意到筆記本。
  'zh-Hant': ['重建浩文', '讀取手機', '回覆女兒', '交談 卡西', '問卡西瑪雅', '問卡西箱子', '掃描卡西', '拿箱子', '前往',
    '看瑪雅', '看老太太', '掃描老太太', '看排水口', '前往', '接電話', '問卡西瑪雅', '看曉晴'],
  'zh-Hans': ['重建浩文', '交谈 卡西', '拿箱子', '前往', '前往', '接电话', '看晓晴'],
  // 想拒絕那筆錢（崩塌）、對瑪雅大喊、沒看清楚就離開（崩塌）。
  en: ['recall ho-man', 'hack phone', 'talk cassie', 'tell cassie i refuse', 'talk cassie', 'take box', 'go',
    'talk maya', 'go', 'look maya', 'go', 'answer the phone', 'ask cassie about the machine', 'look at hiu-ching'],
};
const CH3 = {
  'zh-Hant': ['問 Bagley 守夜人', '問Bagley規則', '掃描 Bagley', '問卡西守夜人', '交談 卡西', '問卡西提議', '問 卡西 瑪雅', '問浩文艾琳', '問浩文女兒', '前往羅瑟希德', '切換 浩文', '前往羅瑟希德',
    '交談 艾琳', '問艾琳實話', '問艾琳筆記本', '問艾琳符號', '問 艾琳 ECHO', '駭入廂型車', '切換 ECHO', '駭入廂型車'],
  'zh-Hans': ['切换 浩文', '前往罗瑟希德', '问浩文艾琳', '前往罗瑟希德',
    '交谈 艾琳', '问艾琳 送货', '问艾琳实话', '问艾琳ECHO', '入侵面包车', '切换 ECHO', '入侵面包车'],
  en: ['talk cassie', 'ask ho-man about the old lady', 'go rotherhithe', 'switch ho-man', 'go rotherhithe',
    'hack van', 'switch echo', 'hack van', 'switch ho-man', 'talk eileen', 'ask eileen about the truth', 'ask eileen about echo'],
};
const MEM3 = {
  'zh-Hant': ['重建艾琳', '拿水壺', '讀筆記本', '交談 瑪雅', '問瑪雅 說教', '問瑪雅那台機器', '問瑪雅浩文', '前往',
    '前往第三個拱門', '跳下深井', '跟瑪雅說話', '前往鐵梯', '交談 瑪雅', '看活塞', '問瑪雅為什麼'],
  'zh-Hans': ['重建艾琳', '交谈 玛雅', '前往', '前往第一个拱门', '前往第三个拱门', '前往铁梯', '交谈 玛雅', '问玛雅为什么'],
  en: ['recall eileen', 'hack flip phone', 'talk maya', 'go', 'go first arch', 'go third arch', 'jump', 'go ladder',
    'talk maya', 'ask maya why'],
};
const FIN = {
  'zh-Hant': ['跳井', '切換 浩文', '拿防水布', '切換 艾琳', '前往隧道', '切換 ECHO', '跟瑪雅說話', '切換 浩文', '閂上鐵門', '看留下', '選擇 留下'],
  'zh-Hans': ['入侵无人机', '前往隧道', '交谈 玛雅', '选择 留下', '选择 封存'],
  'zh-Hans-wf': ['切换 浩文', '盖上防水布', '切换 艾琳', '前往隧道', '交谈 玛雅', '选择 燎原'],
  en: ['hack drone', 'go tunnel', 'hack switchboard', 'switch echo', 'hack switchboard', 'talk maya',
    'wait', 'look', 'look', 'look', 'look', 'look', 'look', 'look', 'look'],
};
const RUNS = [
  { name: 'zh-Hant', lang: 'zh-Hant', fin: 'zh-Hant', expect: { ending: 'stay', desyncs: 0, device: true, wildfire: true, notebook: true, evidence: true } },
  { name: 'zh-Hans', lang: 'zh-Hans', fin: 'zh-Hans', expect: { ending: 'seal', desyncs: 0, device: false, wildfire: false, notebook: false, evidence: false } },
  { name: 'zh-Hans-wf', lang: 'zh-Hans', fin: 'zh-Hans-wf', expect: { ending: 'wildfire', desyncs: 0 } },
  { name: 'en', lang: 'en', fin: 'en', expect: { ending: 'recaptured', desyncs: 6, device: false } },
];

for (const run of RUNS) {
  E.i18n.set(run.lang);
  const s = E.state.create();
  const lines = render(E.engine.enter(s));
  let desyncs = 0;
  const cmds = [PRO, MEM1, CHINA, MEM2, CH3, MEM3].flatMap((part) => part[run.lang]).concat(FIN[run.fin]);
  for (const text of cmds) {
    if (s.ended) break; // 回收路線會多打幾個指令等結局觸發
    const cmd = E.parser.parse(text, E.scenes[s.scene], s);
    lines.push(`> ${text}   [${cmd.verb || '?'} ${cmd.target || ''}]  @${s.scene} actor=${s.actor}` + (s.sync !== null ? ` sync=${s.sync}` : '') + ` bleed=${s.bleed} exp=${s.exposure}`);
    const out = E.engine.exec(cmd, s);
    if (out.some((e) => e.k === 'desync.1')) desyncs++;
    lines.push(...render(out));
    for (const c of E.engine.suggestions(s)) {
      if (c[1] && !E.scenes[s.scene].entities[c[1]] && !E.partyAliases[c[1]]) fail(`${run.name}: suggestion targets missing entity ${c[1]} in ${s.scene}`);
    }
  }
  const text = lines.join('\n');
  const x = run.expect;
  if (unresolved(text)) fail(`${run.name}: unresolved key or variable in output: ${(text.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`);
  if (s.flags.ending !== x.ending) fail(`${run.name}: ending=${s.flags.ending}, expected ${x.ending}`);
  if (desyncs !== x.desyncs) fail(`${run.name}: ${desyncs} desyncs, expected ${x.desyncs}`);
  for (const f of ['device', 'wildfire', 'notebook', 'evidence']) {
    const got = !!s.flags[f === 'wildfire' ? 'wildfireKnown' : f];
    if (f in x && got !== x[f]) fail(`${run.name}: ${f}=${got}, expected ${x[f]}`);
  }
  console.log(`${run.name}: ending ${s.flags.ending}, bleed ${s.bleed}, exposure ${s.exposure}, desyncs ${desyncs}`);
  if (show === run.name) console.log(text);
}

// 錄影用的章節跳轉路線都要能跑完，不能卡住。
for (const [name, route] of Object.entries(E.devRoutes)) {
  const s = E.state.create();
  for (const text of route) E.engine.exec(E.parser.parse(text, E.scenes[s.scene], s), s);
  if (s.ended) fail(`jump route ${name} ended the game early`);
}

const ps = E.state.create();
for (const [input, verb, target] of [['items', 'items', null], ['i', 'items', null], ['laptop', 'look', 'laptop'], ['look at the laptop', 'look', 'laptop'],
  ['看看筆電', 'look', 'laptop'], ['lang en', 'lang', null], ['HACK CAMERA', 'hack', 'camera'], ['switchboard', null, null]]) {
  const c = E.parser.parse(input, E.scenes['prologue.basement'], ps);
  if (c.verb !== verb || (c.target || null) !== target) fail(`parse "${input}" -> ${c.verb}/${c.target}, expected ${verb}/${target}`);
}

// ===== 3. 第二季資料表 =====
section('第二季資料表');
const P = E.s2.people;
// 每一個帶 en 的物件都必須同時有非空的 tc 與 sc。
(function walk(node, where) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.en === 'string') {
    for (const l of ['en', 'tc', 'sc']) if (typeof node[l] !== 'string' || !node[l].trim()) fail(`${where}: missing ${l}`);
    return;
  }
  for (const k of Object.keys(node)) walk(node[k], `${where}.${k}`);
})(P, 'people');
for (const [id, h] of Object.entries(P.heritages)) if (h.given.length < 4 || h.family.length < 4) fail(`heritage ${id}: too few names`);
for (const [id, d] of Object.entries(P.districts)) for (const h of Object.keys(d.heritage)) if (!P.heritages[h]) fail(`district ${id}: unknown heritage ${h}`);
for (const o of P.occupations) {
  if (!P.perks[o.perk]) fail(`occupation ${o.id}: unknown perk ${o.perk}`);
  for (const d of Object.keys(o.districts)) if (!P.districts[d]) fail(`occupation ${o.id}: unknown district ${d}`);
}
for (const p of P.problems) for (const l of ['en', 'tc', 'sc']) if (!p.text[l].includes('{name}')) fail(`problem ${p.id}: ${l} has no {name}`);
for (const s of P.secrets) for (const l of ['en', 'tc', 'sc']) if (/[{}]/.test(s[l])) fail('secret has a placeholder: ' + s.en);
console.log(`${Object.keys(P.heritages).length} heritages, ${P.occupations.length} jobs, ${P.traits.length} traits, ${P.flaws.length} flaws, ${P.secrets.length} secrets, ${P.problems.length} problems`);

// ===== 4. 亂數 =====
section('亂數');
{
  const a = E.rng.create('seed'), b = E.rng.create('seed');
  for (let i = 0; i < 100; i++) if (a.next() !== b.next()) { fail('same seed gave different numbers'); break; }
  const c = E.rng.create('seed');
  for (let i = 0; i < 10; i++) c.next();
  const saved = c.state;
  const expected = [c.next(), c.next(), c.next()];
  const d = E.rng.restore(saved);
  if (expected.some((v) => v !== d.next())) fail('restore() does not continue the same sequence');
  if (E.rng.derive('w', 'camden', 1).next() === E.rng.derive('w', 'camden', 2).next()) fail('derive() gave the same stream for different parts');
  const r = E.rng.create(42);
  let heads = 0;
  for (let i = 0; i < 10000; i++) if (r.chance(0.5)) heads++;
  if (Math.abs(heads - 5000) > 300) fail(`chance(0.5) is biased: ${heads}/10000`);
  console.log('reproducible, restorable, unbiased');
}

// ===== 5. 路人生成 =====
section('路人生成');
const WORLD = 'test-world';
const LANGS = ['zh-Hant', 'zh-Hans', 'en'];
for (const district of Object.keys(P.districts)) {
  const people = E.people.crowd(WORLD, district, 0, 200);
  const again = E.people.crowd(WORLD, district, 0, 200);
  if (JSON.stringify(people) !== JSON.stringify(again)) fail(`${district}: generation is not reproducible`);
  const ids = new Set();
  const heritage = {};
  for (const p of people) {
    ids.add(p.id);
    heritage[p.heritage] = (heritage[p.heritage] || 0) + 1;
    const nm = E.people.name(p);
    for (const l of ['en', 'tc', 'sc']) if (!nm[l]) fail(`${p.id}: empty ${l} name`);
    if (Object.values(p.skills).some((v) => v < 0 || v > 3)) fail(`${p.id}: skill out of range`);
    if (p.threat < 0 || p.threat > 100) fail(`${p.id}: threat out of range`);
    const job = E.people.occupationOf(p);
    if (p.age < job.age[0] || p.age > job.age[1]) fail(`${p.id}: age ${p.age} outside ${job.id} range`);
    for (const lang of LANGS) {
      E.i18n.set(lang);
      const text = render(E.people.profile(p)).join('\n') + E.i18n.pick(E.people.problemText(p));
      if (unresolved(text)) fail(`${p.id} (${lang}): unresolved text: ${text}`);
    }
  }
  if (ids.size !== people.length) fail(`${district}: duplicate ids`);
  const kinds = Object.keys(heritage).length;
  if (kinds < 5) fail(`${district}: only ${kinds} heritages in 200 people`);
  if (district === 'soho' && (heritage.hongkong || 0) + (heritage.mainland || 0) < 60) fail('soho: too few Chinese-heritage residents');
  console.log(`${district}: 200 people, ${kinds} heritages`);
}

if (samples > 0) {
  for (const district of Object.keys(P.districts)) {
    for (const p of E.people.crowd('sample-world', district, 0, samples)) {
      console.log(`\n--- ${p.id}`);
      for (const lang of LANGS) {
        E.i18n.set(lang);
        console.log(render(E.people.profile(p)).join('\n'));
        console.log('麻煩 / Problem: ' + E.i18n.pick(E.people.problemText(p)));
      }
    }
  }
}

// ===== 6. 隊伍 =====
section('隊伍');
{
  const crowd = E.people.crowd(WORLD, 'camden', 0, 10);
  const r = E.roster.create();
  for (let i = 0; i < 6; i++) if (!E.roster.recruit(r, crowd[i], 1)) fail('could not recruit within capacity');
  if (E.roster.recruit(r, crowd[6], 1)) fail('recruited beyond capacity');
  if (E.roster.recruit(r, crowd[0], 1)) fail('recruited the same person twice');

  E.roster.injure(r, crowd[0].id, 2);
  E.roster.tickNight(r, 2);
  if (E.roster.get(r, crowd[0].id).status !== 'injured') fail('healed too early');
  E.roster.tickNight(r, 3);
  if (E.roster.get(r, crowd[0].id).status !== 'active') fail('did not heal after 2 nights');

  E.roster.arrest(r, crowd[1].id, 5);
  E.roster.arrest(r, crowd[2].id, 5);
  if (!E.roster.canRecruit(r)) fail('arrested people should free their beds');
  E.roster.tickNight(r, 7);
  E.roster.rescue(r, crowd[1].id);
  const ev = E.roster.tickNight(r, 8);
  if (E.roster.get(r, crowd[1].id).status !== 'active') fail('rescue did not bring them back');
  if (E.roster.get(r, crowd[2].id).status !== 'lost' || !ev.some((e) => e.type === 'transferred')) fail('not transferred after 3 nights');

  const iron = E.roster.create({ ironman: true });
  E.roster.recruit(iron, crowd[0], 1);
  E.roster.arrest(iron, crowd[0].id, 2);
  if (E.roster.get(iron, crowd[0].id).status !== 'lost') fail('ironman arrest should be permanent');
  console.log('capacity, injury, arrest, rescue, transfer, ironman');
}

// ===== 7. 任務框架 =====
section('任務框架');
{
  const pool = E.people.crowd(WORLD, 'isle_of_dogs', 0, 400);
  const find = (fn, what) => { const p = pool.find(fn); if (!p) fail('no sample person: ' + what); return p; };
  const climb = { needs: { skill: { physical: 1 }, ability: 'climb' }, risk: 0.3, cost: { exposure: 0 } };
  const pass = { needs: { perk: 'site_pass' }, risk: 0 };
  const hack = { needs: { skill: { hack: 2 } }, risk: 0.2, cost: { bandwidth: 1, exposure: 4 } };

  const scared = find((p) => p.flaw === 'acrophobia' && p.skills.physical >= 1, 'acrophobic');
  if (E.mission.check(climb, scared).reason !== 's2.need.blocked') fail('acrophobia should block climbing');
  const builder = find((p) => p.occupation === 'builder', 'builder');
  const other = find((p) => p.occupation !== 'builder', 'non-builder');
  if (!E.mission.check(pass, builder).ok) fail('builder should have the site pass');
  if (E.mission.check(pass, other).reason !== 's2.need.perk') fail('non-builder should not have the site pass');
  const weak = find((p) => p.skills.hack < 2, 'non-hacker');
  if (E.mission.check(hack, weak).reason !== 's2.need.skill') fail('low hack skill should fail');

  const loud = find((p) => p.flaw === 'loudmouth' && p.skills.hack >= 2, 'loudmouth hacker');
  if (loud && E.mission.exposure(hack, loud) !== 6) fail('loudmouth should add 2 exposure');
  for (const p of pool) {
    const k = E.mission.risk(hack, p);
    if (k < 0 || k > 0.95) fail('risk out of range');
  }
  const hacker = find((p) => p.skills.hack >= 2, 'hacker');
  const r1 = E.mission.resolve(hack, hacker, E.rng.create('night-3'));
  const r2 = E.mission.resolve(hack, hacker, E.rng.create('night-3'));
  if (JSON.stringify(r1) !== JSON.stringify(r2)) fail('resolve() is not reproducible');
  const opts = E.mission.options({ approaches: [climb, pass, hack] }, pool.slice(0, 6));
  if (opts.length !== 3 || opts[0].candidates.length !== 6) fail('options() shape is wrong');
  console.log('requirements, flaws, perks, risk, exposure, reproducible results');
}

// ===== 8. 存檔 =====
section('存檔');
{
  storage.clear();
  const slot = E.save.slot('test.slot', 2, { 0: (d) => Object.assign({}, d, { a: 1 }), 1: (d) => Object.assign({}, d, { b: 2 }) });
  storage.set('test.slot', JSON.stringify({ old: true }));
  const migrated = slot.read();
  if (!migrated || migrated.old !== true || migrated.a !== 1 || migrated.b !== 2) fail('legacy save did not migrate: ' + JSON.stringify(migrated));
  slot.write({ x: 1 });
  if (slot.read().x !== 1) fail('round trip failed');
  storage.set('test.slot', JSON.stringify({ v: 9, data: {} }));
  if (slot.read() !== null) fail('a save from a newer version should not load');

  if (E.save.v1Ending() !== null) fail('v1Ending should be null without a save');
  E.save.write({ state: { ended: false, flags: {} } });
  if (E.save.v1Ending() !== null) fail('v1Ending should be null for an unfinished game');
  E.save.write({ state: { ended: true, flags: { ending: 'seal' } } });
  if (E.save.v1Ending() !== 'seal') fail('v1Ending did not read the ending');
  console.log('migration, versions, v1 ending import');
}

console.log(`\n${problems ? problems + ' problem(s)' : 'All checks passed'}`);
process.exit(problems ? 1 : 0);
