// 自動測試：不需要瀏覽器，也不需要安裝任何套件。
//   node tools/check.js                  跑全部檢查
//   node tools/check.js --show zh-Hant   另外印出某一條第一季路線的完整文字
//   node tools/check.js --samples 3      另外印出每個行政區 3 個隨機路人的三語檔案，給人看文字品質
// 第三季的測試在 tools/check-s3.js，這裡會一起跑。
// 任何一項失敗，結束碼就不是 0（GitHub Actions 會因此標成失敗）。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const show = arg('--show');
const samples = Number(arg('--samples') || 0);

// ===== 在 Node 裡模擬瀏覽器 =====
// 第一季和第二季各自一個沙盒，跟真正的兩個頁面一樣互不干擾（第二季有自己一份引擎用的通用文字）。
// 兩個沙盒共用同一個 localStorage，就像同一個網域下的兩個頁面。
const storage = new Map();
function sandbox(list) {
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
  const tables = {};
  for (const f of list) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
    if (f.endsWith('i18n.js')) {
      const reg = ctx.ECHO.i18n.register;
      ctx.ECHO.i18n.register = (code, table) => { tables[code] = Object.assign(tables[code] || {}, table); reg(code, table); };
    }
  }
  return { E: ctx.ECHO, tables, ctx };
}

// 第一季：照 index.html 的順序載入（介面相關的檔案除外）。
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/ui\/|main\.js/.test(f));
// 第二季：照 s2.html 的順序載入。介面只載入頭像、戰術地圖和音效（都不碰畫面）。
const s2html = fs.readFileSync(path.join(root, 's2.html'), 'utf8');
const S2_SCRIPTS = [...s2html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1])
  .filter((f) => !/ui\//.test(f) || f.endsWith('faces.js') || f.endsWith('ui/tactics.js') || f.endsWith('ui/sfx.js'));
const S1 = sandbox(scripts);
const S2 = sandbox(S2_SCRIPTS);
let E = S1.E; // 第一季的段落用第一季的沙盒；第二季的段落開始前換成 S2

let problems = 0;
const fail = (msg) => { problems++; console.log('FAIL', msg); };
const section = (title) => console.log(`\n## ${title}`);
const render = (entries) => entries.filter((e) => e.c !== 'pause' && e.k).map((e) => E.i18n.t(e.k, e.v));
const unresolved = (text) => text.includes('⟦') || /\{\w+\}/.test(text);
// 目標清單（建議指令上面的「目標」）：打每一條路線時，每一步的目標和「怎麼做」都要翻得出來，而且一定有一項還沒完成。
const goalScenes = new Set();
function checkGoals(label, st) {
  if (!st || !st.scene || !E.scenes[st.scene] || !E.scenes[st.scene].goals) return;
  const list = E.engine.goals(st);
  goalScenes.add(st.scene);
  const text = list.flatMap((g) => [E.i18n.t(g.k, g.v)].concat(g.how ? [E.i18n.t(g.how)] : [])).join('\n');
  if (unresolved(text)) fail(`${label}: unresolved goal text in ${st.scene}: ${(text.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`);
  if (!list.some((g) => !g.note && !g.done) && !st.ended) fail(`${label}: every goal in ${st.scene} is already done, so the goal line is empty`);
}

// ===== 1. 三語文本：每個頁面三種語言的 key 一樣多，用到的 key 都有定義 =====
section('三語文本');
// 動作的 id（id: 'mem.plan'）和進度查詢（s.fired['...']）不是文字 key。
const KEY = /(?<!id: |fired\[)['"]((?:ui|hud|loc|err|items|lang|help|fx|scan|boot|room|recall|ev|message|desk|note|graffiti|laptop|photo|camera|van|radio|maya|attack|desync|mem|mem1|mem2|mem3|cw|ch3|fin|end|wait|talk|switch|actor|co|cameo|chip|s2|m1|m2|tac)\.[\w.]+)['"]/g;
// topics 為 true 時，對話話題也要有顯示用的 key（第二季的建議按鈕會顯示話題名稱）。
function checkTexts(label, page, htmlText, sources, families = {}, topics = false) {
  const { E: PE, tables } = page;
  const codes = Object.keys(tables);
  const all = new Set(codes.flatMap((c) => Object.keys(tables[c])));
  for (const c of codes) for (const k of all) if (!(k in tables[c])) fail(`${label} ${c} missing ${k}`);
  const used = new Set();
  for (const m of htmlText.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) used.add(m[1]);
  for (const f of sources) for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(KEY)) used.add(m[1]);
  for (const sc of Object.values(PE.scenes)) {
    used.add(sc.location);
    for (const [id, ent] of Object.entries(sc.entities)) {
      used.add('ent.' + id);
      if (topics) for (const act of Object.values(ent)) if (act && act.topics) for (const tp of Object.keys(act.topics)) used.add('topic.' + tp);
    }
  }
  for (const v of Object.keys(PE.commands)) used.add('verb.' + v);
  // 場景 id（goto: 's2.m1.alley'）長得像 key，但不是文字。
  for (const id of Object.keys(PE.scenes)) used.delete(id);
  for (const [prefix, list] of Object.entries(families)) {
    used.delete(prefix);
    for (const x of list) used.add(prefix + x);
  }
  for (const k of used) if (!k.endsWith('.') && !all.has(k)) fail(`${label} key used but not defined: ${k}`);
  console.log(`${label}: ${all.size} keys × ${codes.length} languages`);
}
// 第二季介面用字串拼出來的 key（例如 's2.p.cat.' + 類別），逐一列出來檢查。
const INFO = ['support', 'heat', 'towers', 'beds', 'threat', 'gear', 'heal', 'tap', 'intel', 'bonds'];
const families = {
  's2.p.tier.': ['common', 'uncommon', 'rare', 'special'],
  's2.p.cat.': ['hacker', 'physical', 'social', 'specialist'],
  's2.p.status.': ['active', 'injured', 'arrested', 'lost', 'network', 'away', 'retired', 'dead'],
  's2.p.': ['hack', 'physical', 'social'],
  's2.op.': ['main', 'decoy'],
  's2.op.kind.': ['active', 'react', 'passive'],
  's2.op.alert.': ['0', '30', '60'],
  's2.squad.lane.': ['main', 'decoy'],
  's2.counter.': ['raid', 'blackout', 'early', 'raid.title', 'blackout.title', 'early.title'],
  's2.day.kind.': ['district', 'rescue', 'recruit', 'base', 'defense', 'main', 'job'],
  's2.day.rw.': ['cool', 'wipe', 'heal', 'gear', 'tap', 'intel'],
  // 點得開的說明（畫面上的 data-k 和 infoLink）
  's2.info.': INFO.flatMap((k) => [k + '.t', k + '.d']),
  's2.res.': ['win', 'fail', 'retreat', 'rest'],
  's2.fail.': ['hack', 'physical', 'social', 'hands', 'other'],
  's2.bagley.d': ['1', '2', '3', '4', '5'],
  's2.end.': ['curfew.title', 'curfew.text', 'wiped.title', 'wiped.text', 'dawn.title', 'dawn.text', 'cage.title', 'cage.text', 'wild.title', 'wild.text', 'deal.title', 'deal.text'],
  's2.react.': ['reroll.title', 'reroll.use', 'reroll.skip', 'escape.title', 'escape.use', 'escape.skip'],
  's2.ev.': ['freeze.title', 'freeze.text', 'freeze.out', 'freeze.go', 'freeze.outDone', 'freeze.goDone',
    'phone.title', 'phone.text', 'phone.take', 'phone.risk'],
  's2.world.': ['stay', 'seal', 'wildfire', 'recaptured', 'stay.d', 'seal.d', 'wildfire.d', 'recaptured.d'],
  'm1.screen.': ['stay', 'seal', 'wildfire', 'recaptured', 'stay.b', 'seal.b', 'wildfire.b', 'recaptured.b'],
  'm1.b.clock.': ['1', '2'],
  'm2.brief.': ['hacker', 'physical', 'social', 'specialist'],
  'm2.twist.': ['stay', 'seal', 'wildfire', 'recaptured', 'stay.b', 'seal.b', 'wildfire.b', 'recaptured.b'],
  'm2.e.car.': ['1', '2'],
  'm2.fence.': ['pass', 'pick', 'keys', 'talk', 'climb'],
  'm2.yard.': ['takeover', 'loop', 'busk', 'throw', 'call'],
  'm2.box.': ['legacy', 'open'],
  'm2.street.': ['cab', 'teacher', 'jam', 'lead', 'chat'],
  // 戰役：換區、名單、盟友、結局的尾聲
  's2.log.list.': ['burn', 'publish', 'trade'],
  's2.log.ally.': ['hale', 'cassie', 'kahn', 'none'],
  's2.perk.': ['beds', 'supply', 'insider', 'tunnels'],
  's2.bagley.arrive.': ['soho', 'isle_of_dogs', 'rotherhithe', 'westminster'],
  's2.bagley.': ['m2', 'm3', 'm4', 'm5', 'm7', 'm8'],
  's2.dist.': ['soho.d', 'isle_of_dogs.d', 'rotherhithe.d'],
  's2.epi.list.': ['burn', 'publish', 'trade'],
  's2.epi.world.': ['stay', 'seal', 'wildfire'],
  // 主線任務三到八：依世界、盟友、隊友解法拼出來的 key
  'm3.homan.echo.': ['stay', 'seal', 'wildfire', 'recaptured'],
  'm3.door.': ['deliver', 'talk', 'climb'],
  'm3.van.': ['pick', 'crack', 'force'],
  'm4.hale.echo.': ['stay', 'seal', 'wildfire', 'recaptured'],
  'm4.maya.echo.': ['stay', 'seal', 'wildfire', 'recaptured'],
  'm4.q.3.': ['stay', 'seal', 'wildfire', 'recaptured'],
  'm4.gate.': ['badge', 'disguise', 'pose', 'lift'],
  'm4.out.': ['cab', 'memory', 'stairs', 'alarm'],
  'm4.o.lock.': ['1', '2'],
  'm5.eileen.echo.': ['stay', 'seal', 'wildfire', 'recaptured'],
  'm5.grate.': ['pick', 'lift', 'force'],
  'm5.hive.': ['takeover', 'legacy', 'land'],
  'm6.hale.': ['offer.1', 'offer.2', 'list.burn', 'list.publish', 'list.trade'],
  'm6.cassie.': ['offer.1', 'offer.2', 'list.burn', 'list.publish', 'list.trade'],
  'm6.kahn.': ['offer.1', 'offer.2', 'list.burn', 'list.publish', 'list.trade'],
  'm6.kahn.echo.': ['stay', 'seal', 'wildfire', 'recaptured'],
  'm6.a.': ['hale', 'cassie', 'kahn', 'none'],
  'm7.ally.': ['hale', 'cassie', 'kahn', 'none'],
  'm7.how.': ['hale', 'cassie', 'kahn', 'none'],
  'm7.gate.': ['pass', 'badge', 'talk', 'climb'],
  'm7.out.': ['cab', 'lead', 'chat'],
  'm8.ally.': ['hale', 'cassie', 'kahn', 'none'],
  'm8.hast.echo.': ['stay', 'seal', 'wildfire', 'recaptured'],
  'm8.door.': ['badge', 'disguise', 'talk', 'climb'],
  'm8.hall.': ['takeover', 'legacy', 'loop', 'throw'],
  'm8.end.': ['cage.1', 'cage.2', 'wild.1', 'wild.2', 'deal.1', 'deal.2', 'dawn.1', 'dawn.2'],
  'm8.dawn.': ['cage', 'wild', 'deal', 'dawn'],
  'm8.last.': ['cage', 'wild', 'deal', 'dawn'],
  // 戰術地圖
  'tac.obj.': ['box', 'terminal', 'antenna', 'prisoner', 'files', 'person', 'crate', 'wall'],
  'tac.ab.': ['hack', 'climb', 'takedown', 'talk', 'disguise', 'unlock', 'force', 'heal', 'cab', 'sergei', 'hammer', 'eagle', 'focus', 'blackout', 'mask', 'baton', 'move', 'select', 'lockDoor', 'hackDoor', 'hackCam', 'hackDrone'],
  'tac.cap.': ['sergei', 'hammer', 'eagle', 'focus', 'blackout', 'mask', 'baton'],
  'tac.log.obj.': ['box', 'terminal', 'antenna', 'prisoner', 'files', 'person', 'crate', 'wall'],
  'tac.log.spotted.': ['guard', 'cam', 'drone'],
  'tac.log.unlock.': ['lockpick', 'master_keys', 'site_pass', 'building_access'],
  'tac.guide.': ['you', 'guard', 'cam', 'drone', 'door', 'fence', 'hide', 'dark', 'exit', 'objective', 'vision', 'route', 'badge', 'you.d', 'guard.d', 'cam.d', 'drone.d', 'door.d', 'fence.d', 'hide.d', 'dark.d', 'exit.d', 'objective.d', 'vision.d', 'route.d', 'badge.d', 'noise', 'noise.d'],
  'tac.leg.': ['wall', 'dark', 'fence', 'door', 'hide', 'exit', 'guard', 'cam', 'drone', 'vision', 'wall.d', 'dark.d', 'fence.d', 'door.d', 'hide.d', 'exit.d', 'guard.d', 'cam.d', 'drone.d', 'vision.d'],
  // 白天：時段、安排、選人、做不到的原因、一起混的句子、隊友事件；主線任務的中場；地圖上的特殊狀況
  's2.day.slot.': S2.E.s2.days.SLOTS.concat(['night']),
  's2.day.act.': S2.E.s2.days.activities.flatMap((a) => [a.id, a.id + '.d']),
  's2.day.pick.': S2.E.s2.days.activities.filter((a) => a.people).map((a) => a.id),
  's2.day.role.': ['person', 'trainee', 'coach', 'patient', 'carer'],
  's2.day.need.': ['slots', 'event', 'daily', 'evening', 'party', 'crowd', 'people', 'flaw', 'injured', 'coach'],
  's2.day.hang.': S2.E.s2.days.interests.concat(['derby', 'rival']),
  's2.day.hang.plain': ['1', '2', '3'],
  's2.dev.': S2.E.s2.days.events.flatMap((ev) => ['title', 'text'].concat(ev.choices.flatMap((c) => [c.id].concat(c.p !== undefined ? [c.id + 'Ok', c.id + 'Bad'] : [c.id + 'Done']))).map((k) => ev.id + '.' + k)),
  's2.inter.': ['regroup', 'patch', 'regroup.d', 'patch.d'],
  's2.inter.b.': Object.keys(S2.E.s2.ops.main),
  'tac.ev.': S2.E.s2.mapEvents.flatMap((x) => [x.id, x.id + '.d', x.id + '.q']),
  // 教學關：每一步的說明、完成之後的重點
  'tac.tut.step.': S2.E.s2.tutorial.steps.map((x) => x.id),
  'tac.tut.tip.': S2.E.s2.tutorial.tips,
};
for (const m of (s2html + fs.readFileSync(path.join(root, 'js/ui/s2.js'), 'utf8')).matchAll(/data-k="(\w+)"|infoLink\('(\w+)'/g)) {
  if (!INFO.includes(m[1] || m[2])) fail(`S2 info link ${m[1] || m[2]} has no explanation`);
}
checkTexts('S1', S1, html, ['js/main.js', 'js/ui/terminal.js', ...scripts.filter((f) => !f.includes('locales'))]);
// 第二季借用第一季的指令別名（content/commands.js），但每個場景都有自己的說明，用不到第一季的預設說明。
checkTexts('S2', S2, s2html, ['js/ui/s2.js', ...S2_SCRIPTS.filter((f) => !f.includes('locales') && f !== 'content/commands.js')], families, true);

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
    checkGoals(run.name, s);
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

// ===== 3. 第二季資料表（以下都在第二季的沙盒裡） =====
E = S2.E;
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
})(E.s2, 's2');
for (const [id, h] of Object.entries(P.heritages)) if (h.given.length < 4 || h.family.length < 4) fail(`heritage ${id}: too few names`);
for (const [id, d] of Object.entries(P.districts)) for (const h of Object.keys(d.heritage)) if (!P.heritages[h]) fail(`district ${id}: unknown heritage ${h}`);
for (const o of P.occupations.concat(P.rares)) {
  if (!P.perks[o.perk]) fail(`occupation ${o.id}: unknown perk ${o.perk}`);
  for (const d of Object.keys(o.districts || {})) if (!P.districts[d]) fail(`occupation ${o.id}: unknown district ${d}`);
}
for (const p of P.problems) for (const l of ['en', 'tc', 'sc']) if (!p.text[l].includes('{name}')) fail(`problem ${p.id}: ${l} has no {name}`);
for (const s of P.secrets) for (const l of ['en', 'tc', 'sc']) if (/[{}]/.test(s[l])) fail('secret has a placeholder: ' + s.en);
for (const x of P.traits) if (!x.card || !['active', 'react', 'passive'].includes(x.card.kind)) fail(`trait ${x.id}: missing card`);
for (const x of P.flaws.concat(P.quirks)) if (!x.desc) fail(`${x.id}: missing effect description`);
// 行動：每一個解法都要有成功句（含 {name}），每個行動引用的關卡都要存在。
const OPS = E.s2.ops;
const okLines = [];
for (const [id, st] of Object.entries(OPS.stages)) for (const a of st.approaches.concat(st.hidden ? [st.hidden] : [])) okLines.push([id + '.' + a.id, a]);
for (const [id, a] of Object.entries(OPS.special)) okLines.push(['special.' + id, a]);
for (const [where, a] of okLines) for (const l of ['en', 'tc', 'sc']) if (!a.ok || !a.ok[l].includes('{name}')) fail(`${where}: ${l} success line has no {name}`);
const stageLists = Object.values(OPS.ops).flatMap((o) => (o.split ? [o.lanes.main, o.lanes.decoy] : [o.stages]));
for (const [id, j] of Object.entries(OPS.jobs)) {
  for (const k of Object.keys(j.reward)) if (!['support', 'cool', 'wipe', 'heal', 'gear', 'tap', 'intel'].includes(k)) fail(`job ${id}: unknown reward ${k}`);
  if (!E.s2.opMaps.jobs[id]) fail(`job ${id}: no map`);
}
for (const list of stageLists.concat(Object.values(OPS.recruit), Object.values(OPS.jobs).map((j) => j.stages))) {
  for (const id of list) if (!OPS.stages[id]) fail(`unknown stage ${id}`);
}
for (const p of P.problems) if (!OPS.recruit[p.mission]) fail(`problem ${p.id}: no recruit mission ${p.mission}`);
console.log(`${Object.keys(P.heritages).length} heritages, ${P.occupations.length} jobs + ${P.rares.length} rare, ${P.traits.length} traits, ${P.flaws.length} flaws, ${P.quirks.length} quirks, ${P.secrets.length} secrets, ${P.problems.length} problems, ${Object.keys(OPS.stages).length} stages`);

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
    if (p.traits[0] === p.traits[1] || p.quirks[0] === p.quirks[1]) fail(`${p.id}: duplicate trait or quirk`);
    const face = E.faces.of(p);
    if (!face.startsWith('<svg') || face.includes('undefined')) fail(`${p.id}: broken avatar`);
    for (const lang of LANGS) {
      E.i18n.set(lang);
      const text = render(E.people.profile(p)).join('\n') + E.i18n.pick(E.people.problemText(p));
      if (unresolved(text)) fail(`${p.id} (${lang}): unresolved text: ${text}`);
    }
  }
  if (ids.size !== people.length) fail(`${district}: duplicate ids`);
  const kinds = Object.keys(heritage).length;
  if (kinds < 5) fail(`${district}: only ${kinds} heritages in 200 people`);
  if (!people.some((p) => p.rare)) fail(`${district}: no rare people in 200`);
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

// ===== 7b. 夜間行動（原型）：讓機器人把整輪打完 =====
section('夜間行動');
{
  const N = E.night;
  // 整個戰役跑一遍：五個行政區、主線任務（照一般關卡進行）、換區、結局。
  // smart 為 true 時像玩家一樣優先打主線、拆塔、救人，派最穩的人，威脅太高就避風頭、重傷就送診所、老手就退休；否則隨便亂選。
  // 兩種機器人都會用到外圍網路、分頭行動和手動駭入（解開與否隨機）。
  // 白天的安排：聰明的機器人先照顧傷員、練弱點、幫街坊、踩點；亂來的機器人隨便挑，也常常什麼都不做。
  function dayPlan(s, bot, smart) {
    const pool = s.roster.members.filter((m) => ['active', 'injured', 'network'].includes(m.status)).map((m) => m.person.id);
    const can = (act, i) => pool.filter((id) => N.dayCanPick(s, act, i, id));
    for (let k = 0; k < 4 && E.days.slotName(s); k++) {
      if (!smart && bot.chance(0.3)) break;
      const tries = smart ? ['care', 'train', 'neighbours', 'scout', 'party', 'hang'] : bot.shuffle(['care', 'train', 'neighbours', 'scout', 'party', 'hang']);
      let did = false;
      for (const act of tries) {
        let ids = [];
        if (act === 'hang') ids = bot.shuffle(can('hang', 0)).slice(0, 2);
        else if (act === 'train') {
          const a = bot.pick(can('train', 0));
          const coach = a && can('train', 1).find((c) => c !== a && N.goodCoach(s, N.person(s, a).flaw, c));
          ids = a ? (coach ? [a, coach] : [a]) : [];
        } else if (act === 'care') {
          const a = bot.pick(can('care', 0));
          const b = can('care', 1).find((c) => c !== a);
          ids = a && b ? [a, b] : [];
        } else if (act !== 'party') ids = [bot.pick(can(act, 0))].filter(Boolean);
        if (N.dayAct(s, act, ids)) { did = true; break; }
      }
      if (!did) break;
    }
  }
  function play(seed, smart) {
    const s = N.create(seed, { skipStory: true, world: N.WORLDS[E.rng.hash(seed) % 4] });
    const bot = E.rng.create('bot:' + seed);
    N.pickVolunteers(s, s.volunteers.slice(0, 2));
    // 今晚的機會：用得上的時候才挑（熱度高就放假線索、評分高就洗評分、有人重傷就搶藥、打主線之前先偷部署圖），其他的排在插播後面。
    const jobRank = (e) => {
      const ms = s.roster.members.filter((m) => ['active', 'injured', 'network'].includes(m.status));
      if (e.job === 'trail') return s.heat >= 40 ? 1.2 : 4;
      if (e.job === 'erase') return ms.some((m) => m.threat >= 50) ? 1.2 : 4;
      if (e.job === 'meds') return ms.some((m) => m.critical) || ms.filter((m) => m.status === 'injured').length >= 2 ? 1.2 : 3.5;
      if (e.job === 'intel') return 1.4;
      return 3.5;
    };
    const rank = (e, team) => (e.op === 'job' ? jobRank(e) : { raid: 0, rescue: 0, recruit: team < 3 ? 1 : 5, main: 1.5, expand: 6, tower: 2, broadcast: 3 }[e.op]);
    const seenStatus = new Set();
    const allLog = new Set();
    let logged = 0;
    for (let guard = 0; s.phase !== 'end'; guard++) {
      for (const e of s.log.slice(Math.max(0, s.log.length - (s.log.length < 300 ? s.log.length - logged : 60)))) allLog.add(e.k);
      logged = s.log.length;
      if (guard > 20000) { fail(`${seed}: run never ended (stuck in ${s.phase})`); break; }
      for (const m of s.roster.members) seenStatus.add(m.status);
      if (s.phase === 'day' && s.day && s.day.event) { N.dayAnswer(s, bot.pick(s.day.event.choices)); continue; }
      if (s.phase === 'day') {
        N.street(s).forEach((id) => { N.scan(s, id); N.keep(s, id); });
        Object.keys(s.owed).forEach((id) => N.recruitOwed(s, id));
        let retiredToday = false;
        for (const m of s.roster.members.slice()) {
          const id = m.person.id;
          if (m.critical && (smart || bot.chance(0.5))) N.clinic(s, id);
          else if (N.canRetire(s, id) && !retiredToday && (smart ? E.roster.housed(s.roster).length >= 5 : bot.chance(0.3))) { N.retire(s, id, bot.pick(m.person.traits)); retiredToday = true; }
          else if (m.status === 'active' && (smart ? m.threat >= N.WANTED : bot.chance(0.05))) N.layLow(s, id);
          else if (m.status === 'active' && !smart && bot.chance(0.05)) N.sendHome(s, id);
          else if (m.status === 'network' && E.roster.canRecruit(s.roster) && (smart || bot.chance(0.3))) N.callBack(s, id);
        }
        dayPlan(s, bot, smart);
        const active = s.roster.members.filter((m) => m.status === 'active').map((m) => m.person.id);
        const network = s.roster.members.filter((m) => m.status === 'network').map((m) => m.person.id);
        const ops = N.ops(s);
        const e = smart ? ops.slice().sort((a, b) => rank(a, active.length) - rank(b, active.length))[0] : bot.pick(ops);
        let squad = smart ? active.slice(0, e.split ? 4 : 3) : bot.shuffle(active).slice(0, bot.int(1, e.split ? 4 : 3));
        if (network.length && squad.length < 3 && bot.chance(0.3)) squad.push(bot.pick(network));
        const lanes = {};
        squad.forEach((id, i) => { lanes[id] = e.split && i >= Math.ceil(squad.length / 2) ? 'decoy' : 'main'; });
        N.pickOp(s, e.key);
        while (squad.length && !N.squadCheck(s, squad, lanes).ok) squad.pop();
        if (!squad.length) { N.cancel(s); N.rest(s); continue; }
        if (!N.launch(s, squad, lanes)) fail(`${seed}: launch refused`);
      } else if (s.phase === 'event') N.answer(s, bot.pick(s.event.choices));
      else if (s.phase === 'react') N.react(s, bot.chance(0.7));
      else if (s.phase === 'op') {
        const usable = N.cards(s).filter((c) => c.usable);
        if (usable.length && bot.chance(smart ? 0.5 : 0.3)) { const c = bot.pick(usable); if (!N.useCard(s, c.owner, c.id)) fail(`${seed}: usable card refused`); continue; }
        const moves = [];
        for (const lane of Object.keys(s.op.lanes)) for (const o of N.options(s, lane)) for (const c of o.candidates) if (c.ok) moves.push([o.approach.id, c.id, c.risk, lane, o.approach]);
        const main = moves.filter((m) => m[3] === 'main');
        if (!main.length) { N.retreat(s); continue; }
        moves.sort((a, b) => a[2] - b[2]);
        // 有佯攻可以做的時候，先做佯攻幫主力鋪路。
        const decoy = moves.filter((m) => m[3] === 'decoy');
        const m = decoy.length && bot.chance(0.6) ? decoy[0] : smart || bot.chance(0.5) ? moves.find((x) => x[3] === 'main') : bot.pick(moves);
        const manual = N.hackable(m[4]) && bot.chance(0.4) ? { solved: bot.chance(smart ? 0.8 : 0.5) } : undefined;
        if (manual && !N.puzzleSpec(s, m[0], m[1])) fail(`${seed}: hack approach without a puzzle`);
        if (!N.act(s, m[0], m[1], manual)) { fail(`${seed}: offered move refused`); N.retreat(s); }
      } else if (s.phase === 'result') N.nextDay(s);
      else if (s.phase === 'interlude') N.nextPart(s, smart ? 'regroup' : bot.pick(['regroup', 'patch', 'retreat']));
      else if (s.phase === 'travel') N.travel(s, smart ? s.travel[0] : bot.pick(s.travel));
      else { fail(`${seed}: unknown phase ${s.phase}`); break; }
    }
    s.seenStatus = [...seenStatus];
    s.allLog = [...allLog];
    return s;
  }

  const ends = {};
  let nights = 0, freed = 0, won = 0;
  const WINS = ['dawn', 'cage', 'wild', 'deal'];
  const RUNS = 80;
  const statuses = new Set();
  const opsSeen = new Set();
  for (let i = 0; i < RUNS; i++) {
    const s = play('night-' + i, i % 2 === 0);
    s.seenStatus.forEach((x) => statuses.add(x));
    delete s.seenStatus;
    s.allLog.forEach((k) => opsSeen.add(k));
    ends[(i % 2 ? 'random ' : 'smart ') + s.ended] = (ends[(i % 2 ? 'random ' : 'smart ') + s.ended] || 0) + 1;
    if (i % 2 === 0) { nights += s.night; freed += s.liberated.length; if (WINS.includes(s.ended)) won++; }
    delete s.allLog;
    for (const ev of E.s2.days.events) {
      const seen = (s.devLast || {})[ev.id], before = (s.devLast || {})[ev.after];
      if (ev.after && seen !== undefined && !(before < seen)) fail(`night-${i}: ${ev.id} happened before ${ev.after}`);
    }
    for (const lang of LANGS) {
      E.i18n.set(lang);
      for (const e of s.log) {
        const text = E.i18n.t(e.k, e.v);
        if (unresolved(text)) { fail(`night-${i} (${lang}): ${text}`); break; }
      }
    }
    if (JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s)) fail(`night-${i}: state does not survive a save`);
  }
  if (JSON.stringify(play('replay', true)) !== JSON.stringify(play('replay', true))) fail('the same choices gave a different run');
  // 每一種新機制，八十輪裡至少要真的發生過一次。
  for (const st of ['active', 'injured', 'arrested', 'network', 'away', 'retired', 'dead']) if (!statuses.has(st)) fail(`no run ever had a member ${st}`);
  for (const k of ['s2.counter.raid', 's2.log.screen', 's2.log.hackSolved', 's2.log.retired', 's2.log.inherit', 's2.log.liberated', 's2.log.hurtBad', 's2.log.critical', 's2.log.died', 's2.log.clinic', 's2.log.act3',
    's2.log.partDone', 's2.log.partRetreat', 's2.day.log.friends', 's2.day.log.overcame', 's2.day.log.gift', 's2.day.log.careHealed', 's2.log.scouted',
    's2.log.job.cool', 's2.log.job.wipe', 's2.log.job.intel', 's2.log.planned', 's2.log.job.tap', 's2.log.tapOn', 's2.log.job.gear', 's2.log.gearUsed']) if (!opsSeen.has(k)) fail(`no run ever logged ${k}`);
  // 限時行動：步數用完還沒打完就失敗（機器人很少真的用完，所以直接測）。
  {
    const s = N.create('timed', { skipStory: true });
    N.pickVolunteers(s, s.volunteers.slice(0, 2));
    E.roster.arrest(s.roster, s.volunteers[1], s.night);
    N.pickOp(s, 'rescue:' + s.volunteers[1]);
    N.launch(s, [s.hero]);
    s.op.timer = 1;
    const o = N.options(s).find((x) => x.candidates.some((c) => c.ok));
    N.act(s, o.approach.id, s.hero);
    if (s.phase !== 'result' || s.result.outcome !== 'fail' || !s.log.some((e) => e.k === 's2.log.timeUp')) fail('a timed operation did not fail when it ran out of moves');
  }

  // 手動駭入的題目：每一題一開始都沒接通，照路線轉好就一定接得通。
  let broken = 0;
  for (let i = 0; i < 500; i++) {
    const pz = E.puzzle.generate('pz-' + i, 4 + (i % 2));
    if (E.puzzle.solved(pz)) broken++;
    for (const k in pz.solution) pz.cells[k].rot = pz.solution[k];
    if (!E.puzzle.solved(pz)) broken++;
  }
  if (broken) fail(`${broken} hack puzzles were already solved or unsolvable`);
  if (won < RUNS / 2 * 0.25) fail(`balance: a sensible player only wins ${won}/${RUNS / 2} campaigns`);
  if (won > RUNS / 2 * 0.85) fail(`balance: a sensible player wins ${won}/${RUNS / 2} campaigns, too easy`);
  console.log(Object.entries(ends).sort().map(([k, v]) => `${k} ${v}`).join(', '));
  console.log(`sensible player: ${won}/${RUNS / 2} campaigns won, ${(freed / (RUNS / 2)).toFixed(1)} districts freed, ${(nights / (RUNS / 2)).toFixed(1)} nights on average`);
}

// ===== 7c. 主線任務一「熄燈」：用打字把文字冒險打完 =====
section('主線任務一');
{
  const N = E.night;
  // zh-Hant：完美潛入（弄暗路燈、躲進熱氣）。zh-Hans：什麼都不管，被看到、還拖到門被撞開。en：踢販賣機，其他照規矩。
  const ROUTES = {
    'zh-Hant': ['讀取手機', '問 Bagley 為什麼是我', '跟 Bagley 說好', '拿外套', '看窗外', '前往後門',
      '駭入路燈', '前往通風口', '等待', '前往後門', '看螢幕', '拿硬碟', '前往運煤口', '跟 Bagley 說話'],
    'zh-Hans': ['说明', '读取手机', '问 Bagley 你是谁', '跟 Bagley 说好', '前往后门', '扫描无人机', '前往后门',
      '查看屏幕', '拿硬盘', '看照片', '扫描照片', '跟 Bagley 说话'],
    en: ['look', 'read phone', 'ask bagley who are you', 'go back door', 'tell bagley yes', 'hit vending machine', 'go back door',
      'hack streetlight', 'go vent', 'go door', 'look screen', 'take drive', 'go hatch', 'talk bagley'],
  };
  const EXPECT = {
    'zh-Hant': { exposure: 3, spotted: false, bonus: 0 },
    'zh-Hans': { exposure: 50, spotted: true, bonus: 20 },
    en: { exposure: 3, spotted: false, bonus: 3 },
  };
  for (const world of N.WORLDS) {
    for (const lang of LANGS) {
      E.i18n.set(lang);
      const s = N.create('m1-' + world, { world });
      if (s.phase !== 'story') { fail(`m1 ${lang}: did not start in story mode`); continue; }
      for (const text of ROUTES[lang]) {
        if (s.phase !== 'story') break;
        N.storyCommand(s, E.parser.parse(text, E.scenes[s.story.scene], s.story), { c: 'input', raw: text });
        for (const c of E.engine.suggestions(s.story || {})) if (c[1] && !E.scenes[s.story.scene].entities[c[1]]) fail(`m1: suggestion targets missing ${c[1]}`);
        if (!s.storyDone) checkGoals(`m1 ${lang}/${world}`, s.story);
      }
      const x = EXPECT[lang];
      // 打完之後停在劇情畫面，按下繼續才進入挑人（繼續之後劇情就清掉了，所以先拿出來）。
      const st = s.story, storyLog = s.storyLog;
      if (!s.storyDone || s.phase !== 'story' || !N.storyFinish(s)) { fail(`m1 ${lang}/${world}: still in ${st.scene} after the route`); continue; }
      if (s.phase !== 'start') { fail(`m1 ${lang}/${world}: continue did not lead to the volunteer pick`); continue; }
      if (st.exposure !== x.exposure || !!st.flags.spotted !== x.spotted || (s.heroBonus || 0) !== x.bonus) {
        fail(`m1 ${lang}/${world}: exposure ${st.exposure}, spotted ${st.flags.spotted}, bonus ${s.heroBonus}`);
      }
      const text = render(storyLog).join('\n');
      if (unresolved(text)) fail(`m1 ${lang}/${world}: unresolved ${(text.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`);
      if (!storyLog.some((e) => e.k === 'm1.screen.' + world)) fail(`m1 ${lang}/${world}: the safe house screen never showed the ${world} line`);
      if (show === 'm1-' + lang && world === 'stay') console.log(text);
      // 主角一定在隊上，只要再挑一個人。
      if (!N.pickVolunteers(s, [s.volunteers[2]]) || s.roster.members.length !== 2 || !E.roster.get(s.roster, s.hero)) fail(`m1 ${lang}: hero pick failed`);
      else if (E.roster.get(s.roster, s.hero).threat !== N.person(s, s.hero).threat + x.bonus && E.roster.get(s.roster, s.hero).threat !== 100) fail(`m1 ${lang}: hero threat bonus not applied`);
    }
  }
  const skipped = N.create('m1-skip');
  if (!N.skipStory(skipped) || skipped.phase !== 'start') fail('m1: skipping the story failed');
  console.log(`3 routes × ${N.WORLDS.length} worlds, clean / spotted / burst paths, hero pick`);
}

// ===== 7d. 主線任務二到八：每個任務用三種語言、四種世界各打一遍 =====
section('主線任務二到八');
{
  const N = E.night;
  const MAINS = { camden: 'm2', soho: 'm3', isle_of_dogs: 'm4', rotherhithe: 'm5' };
  const calm = (s) => { for (const m of s.roster.members) m.threat = 0; s.tonight = null; if (s.day) s.day.event = null; };
  // 開一輪、跳過任務一，挑一個隊友，一路「解放」到指定的區（經過的區直接算完成），停在那一區的第二晚。
  // 中間三區打完之後會進第三幕（任務六）；要去西敏就先跳過任務六。
  function reach(seed, world, district, pick) {
    const s = N.create(seed, { world });
    N.skipStory(s);
    N.pickVolunteers(s, [s.volunteers[pick]]);
    while (s.district !== district) {
      s.mains[MAINS[s.district]] = 'done';
      s.support = 100;
      s.result = { outcome: 'rest' };
      s.phase = 'result';
      calm(s);
      N.nextDay(s);
      if (s.phase === 'travel') N.travel(s, s.travel.includes(district) ? district : s.travel[0]);
      else if (s.phase === 'story' && s.storyId === 'm6') {
        if (district === 'act3') return s;
        N.skipStory(s);
      }
    }
    calm(s);
    N.rest(s);
    calm(s);
    N.nextDay(s);
    calm(s);
    return s;
  }
  const say = (s, text) => N.storyCommand(s, E.parser.parse(text, E.scenes[s.story.scene], s.story), { c: 'input', raw: text });
  // 打一個要組隊的主線任務：回傳劇情旗標和劇情紀錄；打不完就回傳 null。
  // 主線任務分兩段：這裡只測第二段（劇情），第一段在下面另外測，所以先當作第一段已經打完。
  function play(s, id, cmds, label) {
    s.mainPart[id] = 1;
    const e = N.ops(s).find((x) => x.key === 'main');
    if (!e || e.main !== id || !e.story || e.kind !== 'main') { fail(`${label}: no ${id} main mission offered`); return null; }
    N.pickOp(s, 'main');
    const other = s.roster.members.find((m) => m.person.id !== s.hero && m.status === 'active');
    if (N.squadCheck(s, [other.person.id]).reason !== 's2.squad.needHero') fail(`${label}: a squad without the hero was allowed`);
    if (N.squadCheck(s, [s.hero]).reason !== 's2.squad.needTwo') fail(`${label}: the hero alone was allowed`);
    if (!N.launch(s, [s.hero, other.person.id]) || s.phase !== 'story' || s.storyId !== id) { fail(`${label}: did not start the story`); return null; }
    for (const text of cmds) {
      if (s.storyDone) break;
      say(s, text);
      for (const c of E.engine.suggestions(s.story)) {
        if (c[1] && !E.engine.visibleEntities(E.scenes[s.story.scene], s.story).includes(c[1])) fail(`${label}: ${s.story.scene} suggests a hidden or missing ${c[1]}`);
      }
      if (!s.storyDone) checkGoals(label, s.story);
    }
    if (s.storyDone !== true) { fail(`${label}: stuck in ${s.story.scene} (done: ${s.storyDone})`); return null; }
    const flags = s.story.flags, log = s.storyLog;
    const text = render(log).join('\n');
    if (unresolved(text)) fail(`${label}: unresolved ${(text.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`);
    if (show === label) console.log(text);
    if (!N.storyFinish(s) || s.phase !== 'result' || s.result.outcome !== 'win') { fail(`${label}: did not finish as a win`); return null; }
    if (s.mains[id] !== 'done') fail(`${label}: ${id} not marked done`);
    if (unresolved(render(s.log).join('\n'))) fail(`${label}: unresolved text in the night log`);
    return { flags, log };
  }
  const ROUTES = {
    m2: {
      'zh-Hant': { pick: 1, cmds: ['跟隊友說話', '掃描監控塔', '看招牌', '前往工地', '翻越圍欄', '跟隊友說話', '前往塔', '駭入控制箱', '駭入整條街的路燈', '前往開著的門', '跟 Bagley 說話'],
        expect: (f) => f.lightsOut && f.shelter && !f.chased },
      'zh-Hans': { pick: 2, cmds: ['看海报', '前往工地', '扫描警卫', '跟警卫说话', '躲到集装箱后面', '等待', '前往塔', '入侵控制箱', '入侵摄像头', '入侵巡逻车', '看窗外', '跟 Bagley 说话'],
        expect: (f) => !f.lightsOut && f.guardFriend && !f.shelter },
      en: { pick: 3, cmds: ['help', 'go site', 'hack card reader', 'go tower', 'hack control box', 'hack every streetlight', 'look', 'scan patrol car', 'wait', 'talk bagley'],
        expect: (f) => f.lightsOut && f.chased },
    },
    m3: {
      'zh-Hant': { pick: 1, cmds: ['掃描外送平台', '前往金鳳茶樓', '問浩文人在哪裡', '跟浩文說一起去', '前往停車場', '駭入入口柵欄', '讀取終端', '駭入廂型車', '前往出口', '跟浩文說話', '跟浩文說話'],
        expect: (f) => f.homan && f.report && f.freed },
      'zh-Hans': { pick: 2, cmds: ['看灯笼', '前往金凤茶楼', '跟浩文说话', '问浩文分数', '问浩文人在哪里', '前往停车场', '前往楼梯', '入侵面包车', '前往出口', '入侵无人机', '跟浩文说话'],
        expect: (f) => !f.homan && f.freed },
      en: { pick: 3, cmds: ['go teahouse', 'ask ho-man where', 'ask ho-man to come', 'go car park', 'look', 'scan guards', 'look stairs', 'look barrier', 'wait', 'hack van', 'read terminal', 'go exit', 'talk ho-man', 'talk ho-man'],
        expect: (f) => f.homan && f.freed && f.inside },
    },
    m4: {
      'zh-Hant': { pick: 1, cmds: ['跟黑爾博士說話', '問黑爾博士名單', '問瑪雅這一年', '前往員工入口', '拿訪客證', '查看第七號機櫃', '跟瑪雅說話', '跟黑爾博士說話', '跟瑪雅說話'],
        expect: (f) => f.badge && f.haleStayed && f.piece2 },
      'zh-Hans': { pick: 2, cmds: ['跟黑尔博士说话', '前往员工入口', '入侵闸机', '入侵终端', '入侵防火门', '跟玛雅说话'],
        expect: (f) => !f.badge && !f.haleStayed && f.piece2 },
      en: { pick: 3, cmds: ['talk hale', 'ask hale about echo', 'go entrance', 'hack turnstiles', 'hack terminal', 'look', 'wait', 'wait', 'talk maya'],
        expect: (f) => f.piece2 && f.lock >= 3 },
    },
    m5: {
      'zh-Hant': { pick: 1, cmds: ['問艾琳筆記本', '跟艾琳說一起去', '前往隧道', '前往教堂地下室', '讀取筆記本', '前往前面的通道', '駭入巢的伺服器', '駭入無人機巢', '前往回去的路', '跟艾琳說話'],
        expect: (f) => f.route && f.hiveDown && f.data },
      'zh-Hans': { pick: 2, cmds: ['跟艾琳说一起去', '前往隧道', '前往教堂', '前往通道', '入侵服务器', '前往回去', '跟艾琳说话'],
        expect: (f) => !f.route && !f.hiveDown && f.data },
      en: { pick: 3, cmds: ['ask eileen about the hive', 'ask eileen to come', 'go tunnels', 'go church', 'read notebook', 'go passage', 'hack server', 'go back', 'talk eileen'],
        expect: (f) => f.route && f.data },
    },
  };
  const DISTRICT = { m2: 'camden', m3: 'soho', m4: 'isle_of_dogs', m5: 'rotherhithe' };
  const JOIN = { m3: 'special-homan', m4: 'special-maya', m5: 'special-eileen' };
  for (const id of ['m2', 'm3', 'm4', 'm5']) {
    for (const world of N.WORLDS) {
      for (const lang of LANGS) {
        E.i18n.set(lang);
        const r = ROUTES[id][lang];
        const label = id + '-' + lang + (world === 'stay' ? '' : '-' + world);
        const s = reach(label, world, DISTRICT[id], r.pick);
        const support = s.support, towers = s.towers;
        const out = play(s, id, r.cmds, label);
        if (!out) continue;
        if (!r.expect(out.flags)) fail(`${label}: unexpected flags ${JSON.stringify(Object.keys(out.flags).filter((k) => out.flags[k] === true))}`);
        if (id === 'm2' && (s.towers !== towers - 1 || s.support - support < (out.flags.lightsOut ? 30 : 20))) fail(`${label}: towers ${s.towers}, support +${s.support - support}`);
        if (id === 'm2' && !!s.owed[out.flags.extraId] !== !!out.flags.shelter) fail(`${label}: shelter recruit`);
        if (JOIN[id] && !E.roster.get(s.roster, JOIN[id])) fail(`${label}: ${JOIN[id]} did not join`);
        if (id === 'm3' && (!s.owed[out.flags.extraId] || N.person(s, out.flags.extraId).occupation !== 'courier')) fail(`${label}: the rescued rider is not a recruitable courier`);
        if (id !== 'm2' && s.pieces !== 1) fail(`${label}: List pieces ${s.pieces}`);
        if (id === 'm4' && !out.log.some((e) => e.k === 'm4.q.3.' + world)) fail(`${label}: the quiet room never showed the ${world} line`);
      }
    }
  }

  // 任務六：名單、三方會談。燒掉的話名單上的隊員安全；公開的話西敏民心從 20 開始、那名隊員被追捕。
  const M6 = {
    'zh-Hant': { cmds: ['跟 Bagley 說燒掉', '前往倫敦眼', '問黑爾條件', '問卡西條件', '問坎恩條件', '問坎恩為什麼', '跟 Bagley 說誰都不選', '跟 Bagley 說話'], list: 'burn', ally: null },
    'zh-Hans': { cmds: ['前往伦敦眼', '跟 Bagley 说公开', '前往伦敦眼', '问卡西名单', '跟 Bagley 说跟卡西结盟', '跟 Bagley 说话'], list: 'publish', ally: 'cassie' },
    en: { cmds: ['look', 'tell bagley to keep it to bargain', 'go eye', 'ask kahn about the offer', 'ask kahn why', 'tell bagley kahn', 'talk bagley'], list: 'trade', ally: 'kahn' },
  };
  for (const world of N.WORLDS) {
    for (const lang of LANGS) {
      E.i18n.set(lang);
      const label = 'm6-' + lang + (world === 'stay' ? '' : '-' + world);
      const s = reach(label, world, 'act3', 2);
      if (s.phase !== 'story' || s.storyId !== 'm6') { fail(`${label}: act 3 did not open with the meeting`); continue; }
      for (const text of M6[lang].cmds) if (!s.storyDone) say(s, text);
      if (s.storyDone !== true) { fail(`${label}: stuck in ${s.story.scene}`); continue; }
      const text = render(s.storyLog).join('\n');
      if (unresolved(text)) fail(`${label}: unresolved ${(text.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`);
      if (show === label) console.log(text);
      const listed = s.list.listed;
      N.storyFinish(s);
      const x = M6[lang];
      if (s.list.choice !== x.list || s.ally !== x.ally || s.district !== 'westminster' || s.phase !== 'day') fail(`${label}: list ${s.list.choice}, ally ${s.ally}, ${s.district}/${s.phase}`);
      const m = E.roster.get(s.roster, listed);
      if (!m || !!m.hunted !== (x.list !== 'burn')) fail(`${label}: listed member hunted ${m && m.hunted}`);
      if (x.list === 'publish' && s.support !== 20) fail(`${label}: publishing should start Westminster at 20 support`);
    }
  }

  // 任務七、八：西敏。民心到 40 才能斷電，斷電的下一晚才能打空域控制中心；打完就是結局。
  const M7 = {
    'zh-Hant': ['查看國會大廈', '前往變電站', '駭入大門', '駭入電網控制台', '駭入巡邏車', '跟 Bagley 說話'],
    'zh-Hans': ['前往变电站', '入侵大门', '跟值班工程师说话', '入侵控制台', '去安全屋', '跟 Bagley 说话'],
    en: ['go substation', 'hack gate', 'hack console', 'look balconies', 'go away', 'talk bagley'],
  };
  const M8 = {
    'zh-Hant': ['前往地堡入口', '駭入防爆門', '駭入武裝無人機', '前往控制中心', '問黑斯廷斯秩序', '跟主機裡的 Echo 說話', '駭入主控台', '跟 Bagley 說話'],
    'zh-Hans': ['前往地堡', '入侵防爆门', '前往控制中心', '入侵主控台', '跟 Bagley 说话'],
    en: ['go bunker', 'hack blast door', 'hack turrets', 'go control', 'talk echo', 'hack console', 'talk bagley'],
  };
  const ALLIES = [null, 'hale', 'cassie', 'kahn'];
  const ENDING = { null: 'dawn', hale: 'cage', cassie: 'wild', kahn: 'deal' };
  N.WORLDS.forEach((world, wi) => {
    for (const lang of LANGS) {
      E.i18n.set(lang);
      const label = 'm7-' + lang + (world === 'stay' ? '' : '-' + world);
      const s = reach(label, world, 'westminster', 1);
      const ally = ALLIES[(wi + LANGS.indexOf(lang)) % 4];
      s.ally = ally;
      if (N.ops(s).some((e) => e.key === 'main')) fail(`${label}: blackout offered before Westminster support reached 40`);
      s.support = 40;
      if (!play(s, 'm7', M7[lang], label)) continue;
      calm(s);
      N.nextDay(s);
      calm(s);
      const label8 = 'm8-' + lang + (world === 'stay' ? '' : '-' + world);
      const out = play(s, 'm8', M8[lang], label8);
      if (!out) continue;
      if (world === 'recaptured' && lang !== 'zh-Hans' && !s.finale.freedEcho) fail(`${label8}: Echo was not freed`);
      N.nextDay(s);
      if (s.phase !== 'end' || s.ended !== ENDING[ally]) fail(`${label8}: ended ${s.ended}, expected ${ENDING[ally]}`);
      const epi = render(s.endLines || []).join('\n');
      if (!s.endLines || !s.endLines.length || unresolved(epi)) fail(`${label8}: epilogue ${epi}`);
      for (const l of LANGS) {
        E.i18n.set(l);
        if (unresolved(E.i18n.t('s2.end.' + s.ended + '.title') + E.i18n.t('s2.end.' + s.ended + '.text'))) fail(`${label8}: ending text missing in ${l}`);
      }
    }
  });

  // 警戒滿了就撤退：任務還在，之後可以再打。
  const hot = reach('main-abort', 'stay', 'camden', 1);
  hot.mainPart.m2 = 1;
  N.pickOp(hot, 'main');
  N.launch(hot, [hot.hero, hot.roster.members.find((m) => m.person.id !== hot.hero).person.id]);
  hot.story.exposure = 98;
  for (const text of ['go site', 'wait', 'wait', 'wait']) say(hot, text);
  if (hot.storyDone !== 'abort' || !N.storyFinish(hot) || hot.result.outcome !== 'retreat' || hot.towers !== 4 || hot.mains.m2 || hot.mainPart.m2 !== 1) fail('main: a full alert did not abort the mission cleanly');

  // 跳過劇情：改用一般關卡打這一次，之後這個任務也不會再用文字冒險的方式出現。
  const skip = reach('main-skip', 'seal', 'soho', 2);
  skip.mainPart.m3 = 1;
  N.pickOp(skip, 'main');
  N.launch(skip, [skip.hero, skip.roster.members.find((m) => m.person.id !== skip.hero).person.id]);
  if (!N.skipStory(skip) || !['op', 'event'].includes(skip.phase) || !skip.op || skip.op.lanes.main.stages[0] !== E.s2.ops.main.m3.stages[0] || !skip.storyOff.m3) fail('main: skipping did not fall back to the normal operation');

  // 主角過世的話，主線任務改用一般關卡進行。
  const gone = reach('main-gone', 'wildfire', 'camden', 1);
  E.roster.get(gone.roster, gone.hero).status = 'dead';
  const g2 = N.ops(gone).find((e) => e.key === 'main');
  if (!g2 || g2.story) fail('main: without the hero the main mission should be a normal operation');

  // 第一晚不開放主線任務，也不開放一般的拆塔（第一座塔就是主線任務二）。
  const first = N.create('first-night', {});
  N.skipStory(first);
  N.pickVolunteers(first, [first.volunteers[1]]);
  if (N.ops(first).some((e) => e.key === 'main' || e.key === 'tower')) fail('main: tower or main mission open on night 1');

  // 重傷：沒有護理師的話，接下來兩個早上可能撐不過去；送診所就安全了。
  const hurt = N.create('critical', { skipStory: true });
  N.pickVolunteers(hurt, hurt.volunteers.slice(0, 2));
  const victim = E.roster.get(hurt.roster, hurt.volunteers[1]);
  E.roster.injure(hurt.roster, victim.person.id, 3);
  victim.critical = 2;
  if (N.layLow(hurt, victim.person.id)) fail('critical: a critically injured member was allowed to lie low');
  if (!N.clinic(hurt, victim.person.id) || victim.status !== 'away' || victim.critical) fail('critical: the clinic did not take the patient');
  let deaths = 0;
  for (let i = 0; i < 40; i++) {
    const d = N.create('dying-' + i, { skipStory: true });
    N.pickVolunteers(d, d.volunteers.slice(0, 2));
    const m = E.roster.get(d.roster, d.volunteers[1]);
    E.roster.injure(d.roster, m.person.id, 3);
    m.critical = 2;
    for (let n = 0; n < 2; n++) { d.result = { outcome: 'rest' }; d.phase = 'result'; N.nextDay(d); }
    if (m.status === 'dead') deaths++;
  }
  if (deaths < 10 || deaths > 30) fail(`critical: ${deaths}/40 untreated critical injuries were fatal`);
  // 主線任務分兩段：第一段（潛入）打完到中場，第二段進劇情，劇情的警戒從中場的警戒算起；中場撤退的話進度保留，下次直接從第二段開始。
  const toInterlude = (label) => {
    for (let i = 0; i < 30; i++) {
      const s = reach(label + '-' + i, 'stay', 'camden', 1);
      const e = N.ops(s).find((x) => x.key === 'main');
      if (!e || e.part !== 0 || !e.story || e.stages.join() !== E.s2.ops.main.m2.approach.join() || !e.approachName) { fail(`${label}: the main mission does not start at part 1`); return null; }
      N.pickOp(s, 'main');
      N.launch(s, s.roster.members.filter((m) => m.status === 'active').map((m) => m.person.id).slice(0, 3));
      for (let g = 0; g < 60 && ['op', 'event', 'react'].includes(s.phase); g++) {
        if (s.phase === 'event') { N.answer(s, s.event.choices[0]); continue; }
        if (s.phase === 'react') { N.react(s, true); continue; }
        const o = N.options(s).flatMap((x) => x.candidates.filter((c) => c.ok).map((c) => [x.approach.id, c.id, c.risk])).sort((a, b) => a[2] - b[2])[0];
        if (!o) { N.retreat(s); break; }
        N.act(s, o[0], o[1]);
      }
      if (s.phase === 'interlude') return s;
    }
    fail(`${label}: part 1 never reached the interlude`);
    return null;
  };
  const c1 = toInterlude('chain-story');
  if (c1) {
    if (c1.mainPart.m2 !== 1 || !N.partStory(c1)) fail('chain: the interlude does not lead into the story');
    const alert = c1.op.alert;
    N.nextPart(c1, 'regroup');
    if (c1.phase !== 'story' || c1.storyId !== 'm2' || c1.story.exposure !== Math.max(0, alert - 10)) fail(`chain: part 2 did not start the story with alert ${alert - 10} (${c1.phase}, ${c1.story && c1.story.exposure})`);
  }
  const c2 = toInterlude('chain-retreat');
  if (c2) {
    N.nextPart(c2, 'retreat');
    if (c2.phase !== 'result' || c2.result.outcome !== 'retreat' || c2.mainPart.m2 !== 1 || c2.mains.m2) fail('chain: retreating at the interlude lost the progress');
    calm(c2);
    N.nextDay(c2);
    calm(c2);
    const e = N.ops(c2).find((x) => x.key === 'main');
    if (!e || e.part !== 1) fail('chain: the next night does not start at part 2');
    else {
      N.pickOp(c2, 'main');
      N.launch(c2, [c2.hero, c2.roster.members.find((m) => m.person.id !== c2.hero && m.status === 'active').person.id]);
      if (c2.phase !== 'story') fail('chain: part 2 after a retreat did not go straight into the story');
    }
  }
  console.log(`m2–m5: 3 routes × ${N.WORLDS.length} worlds each, m6: list × ally, m7–m8: 4 endings, abort, skip, no hero, critical (${deaths}/40 fatal), two parts with an interlude`);
}

// ===== 7e. 戰術地圖：每張圖都打得完、各類別的能力、隨機操作不會出錯 =====
section('戰術地圖');
{
  const N = E.night;
  const TT = E.tactics;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // 找一個符合條件的路人（用來組出指定類別、專長、特質的隊伍）。
  function find(s, test, from = 3000) {
    for (let i = from; i < from + 3000; i++) {
      const id = 'camden-' + i;
      const p = N.person(s, id);
      if (test(p)) return id;
      delete s.people[id];
    }
    return null;
  }
  function squadFor(seed, tests) {
    const s = N.create(seed, { skipStory: true });
    N.pickVolunteers(s, [s.volunteers[1]]);
    s.mains.m2 = 'done';
    s.dnight = 2;
    const ids = [s.hero];
    let from = 3000;
    for (const test of tests) {
      const id = find(s, test, from);
      from = Number(id.split('-')[1]) + 1;
      s.owed[id] = 'helper';
      N.recruitOwed(s, id);
      E.roster.get(s.roster, id).status = 'active';
      ids.push(id);
    }
    s.roster.members.forEach((m) => { m.threat = 0; });
    return { s, ids };
  }
  const job = (o) => (p) => p.occupation === o;

  // 1. 能力來自類別、專長、特質、弱點
  {
    const { s, ids } = squadFor('caps', [job('locksmith'), job('nurse'), job('cabbie'), job('busker'), (p) => p.traits.includes('fast'), (p) => p.flaw === 'acrophobia' && E.people.occupationOf(p).category === 'physical', (p) => p.flaw === 'bad_knees']);
    N.pickOp(s, 'tower');
    N.launch(s, ids.slice(0, 3), {}, 'tac');
    const cap = (id) => N.tacCaps(s, id);
    const [hero, lock, nurse, cab, busk, fast, acro, knees] = ids;
    if (!cap(hero).hack) fail('tac: the hacker hero cannot hack');
    if (!cap(lock).unlock) fail('tac: the locksmith cannot pick locks');
    if (!cap(nurse).heal) fail('tac: the nurse cannot heal');
    if (!cap(cab).cab) fail('tac: the cab driver cannot call a car');
    if (!cap(busk).talk || cap(busk).talkRange < 4) fail('tac: the busker cannot distract from range');
    if (cap(fast).move < 4) fail('tac: fast runners do not move further');
    if (cap(acro).climb) fail('tac: someone afraid of heights can climb');
    if (cap(knees).move > 2 + (N.traitIds(s, knees).includes('fast') ? 1 : 0) + (N.person(s, knees).quirks.includes('marathon') ? 1 : 0)) fail('tac: bad knees do not slow anyone down');
    const phys = ids.find((id) => E.people.occupationOf(N.person(s, id)).category === 'physical' && N.person(s, id).flaw !== 'acrophobia' && N.person(s, id).flaw !== 'bad_knees');
    if (phys && (!cap(phys).climb || !cap(phys).takedown)) fail('tac: a physical member cannot climb or take down');
  }

  // 撤回：沒有被看到、沒有擲骰的移動可以撤回，撤回之後跟動作前一模一樣。
  {
    const { s, ids } = squadFor('undo', [job('builder')]);
    N.pickOp(s, 'tower');
    N.launch(s, ids, {}, 'tac');
    const before = JSON.stringify(s.op) + s.log.length;
    const k = Object.keys(N.tacReach(s, ids[1])).find((x) => !N.tacRisky(s, ids[1]).includes(x));
    const [x, y] = k.split(',').map(Number);
    if (!N.tacMove(s, ids[1], x, y) || !s.op.tac.undo) fail('tac: a safe move could not be undone');
    else if (!N.tacUndo(s) || JSON.stringify(s.op) + s.log.length !== before) fail('tac: undo did not restore the map');
  }

  // 2. 沒有敵人的時候，每張圖都打得完：開門、翻牆、完成目標、帶被救的人出去、撤離。
  function ghost(s) {
    const t = s.op.tac;
    t.foes = [];
    t.spawns = []; // 也不要增援
    const tile = (x, y) => TT.tile(t, x, y);
    for (let turn = 0; turn < 60 && s.phase === 'tac'; turn++) {
      for (const u of t.units.slice()) {
        for (let guard = 0; guard < 6 && s.phase === 'tac' && !u.out && !u.taken && u.ap > 0; guard++) {
          const before = JSON.stringify(t.units) + t.map.join('') + JSON.stringify(t.objs);
          const abs = N.tacAbilities(s, u.id);
          const use = abs.find((a) => a.id === 'use');
          if (use) { N.tacUse(s, u.id, 'use', use.targets[0][0], use.targets[0][1]); continue; }
          // 目標：最近的未完成目標旁邊；都完成了就去撤離點。被救的人直接去撤離點。
          const left = TT.objsLeft(t);
          const goals = new Set();
          if (left && !u.escort) for (const o of t.objs) if (!o.done) for (const [dx, dy] of DIRS) goals.add((o.x + dx) + ',' + (o.y + dy));
          if (!goals.size) for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (tile(x, y) === 'X') goals.add(x + ',' + y);
          const canClimb = !!N.tacCaps(s, u.id).climb;
          const prev = { [u.x + ',' + u.y]: null };
          const q = [[u.x, u.y]];
          let end = null;
          while (q.length) {
            const [x, y] = q.shift();
            if (goals.has(x + ',' + y)) { end = [x, y]; break; }
            for (const [dx, dy] of DIRS) {
              const nx = x + dx, ny = y + dy, k = nx + ',' + ny, c = tile(nx, ny);
              const ok = '.,dXSHE'.includes(c) || (c === 'D' && !u.escort) || (c === '=' && canClimb);
              if (prev[k] !== undefined || !ok) continue;
              prev[k] = [x, y];
              q.push([nx, ny]);
            }
          }
          if (!end) break;
          const steps = [];
          for (let cur = end; cur && !(cur[0] === u.x && cur[1] === u.y); cur = prev[cur[0] + ',' + cur[1]]) steps.unshift(cur);
          const block = steps.findIndex(([x, y]) => tile(x, y) === 'D' || tile(x, y) === '=');
          const reach = N.tacReach(s, u.id);
          if (block === 0) {
            const [bx, by] = steps[0];
            const a = abs.find((x) => ['unlock', 'force', 'hack', 'climb'].includes(x.id) && x.targets.some(([tx, ty]) => tx === bx && ty === by));
            if (a) N.tacUse(s, u.id, a.id, bx, by);
          } else {
            const walk = (block < 0 ? steps : steps.slice(0, block)).filter(([x, y]) => reach[x + ',' + y] !== undefined);
            const dest = walk[walk.length - 1];
            if (dest) N.tacMove(s, u.id, dest[0], dest[1]);
          }
          if (s.phase !== 'tac' || before === JSON.stringify(t.units) + t.map.join('') + JSON.stringify(t.objs)) break;
        }
      }
      if (s.phase === 'tac') N.tacEnd(s);
    }
    return s.phase === 'result' ? s.result.outcome : s.phase;
  }
  const PLANS = [['tower', 'site'], ['broadcast', 'office'], ['rescue', 'compound'], ['raid', 'safehouse']];
  for (const [op, map] of PLANS) {
    for (const team of [[], [job('builder')], [job('bartender'), job('nurse')]]) {
      const label = `tac ${map} (${team.length + 1})`;
      const { s, ids } = squadFor('ghost-' + op + team.length, team);
      if (op === 'rescue') { const m = s.roster.members.find((x) => x.person.id === s.volunteers[1]); E.roster.arrest(s.roster, m.person.id, s.night); }
      if (op === 'raid') s.tonight = { type: 'raid' };
      const e = N.ops(s).find((x) => x.op === op);
      if (!e) { fail(`${label}: no ${op} operation offered`); continue; }
      N.pickOp(s, e.key);
      if (!N.tacPlan(s)) { fail(`${label}: no map`); continue; }
      const squad = ids.filter((id) => E.roster.get(s.roster, id).status === 'active');
      N.launch(s, squad, {}, 'tac');
      if (!TT.reachable(s.op.tac)) fail(`${label}: objectives or exit unreachable`);
      const out = ghost(s);
      if (out !== 'win') fail(`${label}: a squad with no enemies ended in ${out}`);
      if (unresolved(render(s.log).join('\n'))) fail(`${label}: unresolved text in the log`);
    }
  }
  // 街區：招募任務（找回東西、保護、找人）用的地圖。
  for (const team of [[], [job('builder')], [job('bartender'), job('nurse')]]) {
    const label = `tac street (${team.length + 1})`;
    const { s, ids } = squadFor('ghost-street' + team.length, team);
    const onStreet = (x) => ['recover', 'protect', 'search'].includes(E.s2.people.problems.find((p) => p.id === N.person(s, x).problem).mission);
    const id = N.street(s).find(onStreet);
    if (!id) { fail(`${label}: nobody on the street needs a street mission`); continue; }
    N.scan(s, id);
    N.keep(s, id);
    const e = N.ops(s).find((x) => x.op === 'recruit' && x.target === id);
    N.pickOp(s, e.key);
    N.launch(s, ids, {}, 'tac');
    const want = E.s2.opMaps.recruit[E.s2.people.problems.find((p) => p.id === N.person(s, id).problem).mission].map;
    if (!s.op.tac || s.op.tac.mapId !== want) { fail(`${label}: the mission did not use the ${want} map`); continue; }
    if (!TT.reachable(s.op.tac)) fail(`${label}: objectives or exit unreachable`);
    const out = ghost(s);
    if (out !== 'win') fail(`${label}: a squad with no enemies ended in ${out}`);
  }
  // 聲音：畫面上怎麼說，這裡就怎麼測。傳得到的守衛走到出聲的那一格查看（兩個人聽到也一樣），不會跟著人走，查完就回去巡邏；
  // 聽不到的守衛、狗、無人機都不理；聲音本身不加警戒（撞門的 +5 是撞門的代價）。動作的選單會寫聲音傳幾格。
  {
    const { s, ids } = squadFor('noise', []);
    const [hero] = ids;
    Object.assign(N.person(s, hero), { flaw: null, quirks: [], traits: [] });
    N.pickOp(s, 'tower');
    N.launch(s, ids, {}, 'tac');
    const t = s.op.tac;
    const u = t.units[0];
    t.event = null;
    t.spawns = [];
    Object.assign(u, { x: 4, y: 3 });
    const mk = (id, kind, x, y) => ({ id, kind, x, y, face: [1, 0], route: [[x, y]], ri: 0, state: 'patrol', timer: 0, target: null, down: false });
    t.foes = [mk('near1', 'guard', 8, 4), mk('near2', 'guard', 7, 5), mk('far', 'guard', 12, 8), mk('dog', 'dog', 8, 2), mk('drone', 'drone', 7, 2)];
    const foe = (id) => s.op.tac.foes.find((x) => x.id === id);
    const force = () => N.tacAbilities(s, hero).find((a) => a.id === 'force');
    if (TT.tile(t, 5, 3) !== 'D' || !force()) fail('noise: no door to force on the site map');
    else {
      if (force().noise !== 5) fail(`noise: forcing a door by hand carries ${force().noise} squares`);
      t.event = 'rain';
      if (force().noise !== 4) fail('noise: rain did not cover the sound');
      N.person(s, hero).flaw = 'loudmouth';
      if (force().noise !== 6) fail('noise: a loudmouth is not louder');
      N.person(s, hero).flaw = null;
      t.event = null;
      s.op.alert = 0;
      N.tacUse(s, hero, 'force', 5, 3);
      if (s.op.alert !== 5) fail(`noise: alert ${s.op.alert} after forcing a door unseen`);
      for (const id of ['near1', 'near2']) if (foe(id).state !== 'alert' || foe(id).target.join() !== '4,3') fail(`noise: ${id} did not head for the noise`);
      for (const id of ['far', 'dog', 'drone']) if (foe(id).state !== 'patrol') fail(`noise: ${id} reacted`);
      Object.assign(s.op.tac.units[0], { x: 2, y: 9 }); // 人走了，躲到別的地方
      let turns = 0;
      for (; turns < 10 && s.phase === 'tac' && ['near1', 'near2'].some((id) => foe(id).state === 'alert'); turns++) {
        for (const id of ['near1', 'near2']) if (foe(id).state === 'alert' && foe(id).target.join() !== '4,3') fail(`noise: ${id} followed the person instead of checking the spot`);
        N.tacEnd(s);
      }
      if (s.phase !== 'tac' || turns > 7 || ['near1', 'near2'].some((id) => foe(id).state !== 'patrol')) fail(`noise: guards still searching after ${turns} turns (${s.phase})`);
      if (Math.abs(foe('near1').x - 4) + Math.abs(foe('near1').y - 3) > 2) fail('noise: a guard never got to the spot');
    }
  }
  // 特殊狀況在快速結算也有效果，而且畫面上寫的和實際算的一樣。
  {
    const seen = new Set();
    for (let i = 0; i < 60; i++) {
      const { s, ids } = squadFor('quick-ev-' + i, []);
      s.district = 'rotherhithe';
      s.towers = 4;
      N.pickOp(s, 'tower');
      N.launch(s, ids);
      if (s.op.event) {
        seen.add(s.op.event);
        if (!s.log.some((e) => e.k === 'tac.ev.' + s.op.event + '.q')) fail(`quick event ${s.op.event}: not announced`);
      }
    }
    const site = E.s2.mapEvents.filter((x) => x.themes.includes('site')).map((x) => x.id);
    for (const id of site) if (!seen.has(id)) fail(`quick event ${id}: never rolled in 60 quick operations`);
    if (seen.size === 0) fail('quick events: none ever happened');
    // 每一種的效果：和沒有特殊狀況的同一步比。
    for (const ev of E.s2.mapEvents) {
      const q = ev.quick;
      if (!q) { fail(`event ${ev.id}: no quick effect`); continue; }
      const { s, ids } = squadFor('quick-fx-' + ev.id, []);
      N.pickOp(s, 'tower');
      N.launch(s, ids);
      s.op.event = null;
      s.op.alert = 0;
      if (q.stage !== undefined) s.op.lanes.main.i = q.stage;
      const read = () => N.options(s).flatMap((o) => o.candidates.filter((c) => c.ok && !o.approach.sure).map((c) => [o.approach.id, c.risk, c.exposure]));
      const before = read();
      s.op.event = ev.id;
      const after = read();
      const moved = before.some((b, i) => b[1] !== after[i][1] || b[2] !== after[i][2]);
      if ((q.risk || q.exposure) && !moved && Object.keys(q.risk || {}).every((k) => ['all', 'patrol', 'climb', 'run'].includes(k))) fail(`quick event ${ev.id}: changed nothing on a stage it should touch`);
    }
  }
  // 地圖的操作：點下去會發生的事不能出乎意料。
  {
    const UI = E.tacUI;
    const tap = (s, x, y) => UI.click(s, { act: 'tacTile', x, y });
    const go = (seed, tests, op, prep) => {
      const r = squadFor(seed, tests);
      if (prep) prep(r.s);
      N.pickOp(r.s, op);
      N.launch(r.s, r.ids, {}, 'tac');
      const t = r.s.op.tac;
      t.foes = [];
      t.spawns = [];
      t.event = null;
      UI.reset();
      return Object.assign(r, { t });
    };
    // 1. 突襲時開著的門：駭客走得到也鎖得了。點一下只跳選單，不動手；再點一次就走過去，門還是開著的。
    {
      const { s, ids, t } = go('feel-door', [], 'raid', (x) => { x.tonight = { type: 'raid' }; });
      const u = t.units[0];
      Object.assign(u, { x: 10, y: 7, ap: 2 });
      const bw = s.op.bw;
      UI.click(s, { act: 'tacSel', id: ids[0] });
      tap(s, 11, 8);
      const pop = UI.state().pop;
      if (!pop || pop.items[0].ab !== 'move' || !pop.items.some((a) => a.ab === 'hack')) fail('feel: an open door the hacker can reach did not ask what to do');
      if (TT.tile(t, 11, 8) !== 'd' || u.ap !== 2 || s.op.bw !== bw) fail('feel: one tap on an open door already did something');
      const page = UI.render(s, { alertStatus: () => 's2.op.alert.0' });
      if (unresolved(page) || !page.includes(E.i18n.t('tac.ab.move')) || !page.includes(E.i18n.t('tac.ab.lockDoor'))) fail('feel: the menu does not say walk or lock');
      tap(s, 11, 8);
      if (u.x !== 11 || u.y !== 8 || TT.tile(t, 11, 8) !== 'd' || s.op.bw !== bw) fail(`feel: a second tap did not walk through the door (${u.x},${u.y})`);
      N.tacUndo(s);
      // 走不到的開著的門：鎖門一樣要先問。
      Object.assign(s.op.tac.units[0], { x: 10, y: 6 });
      tap(s, 6, 6);
      if (TT.tile(s.op.tac, 6, 6) !== 'd' || !UI.state().pop || UI.state().pop.items[0].ab !== 'hack') fail('feel: a far open door locked on one tap');
      UI.click(s, { act: 'tacClose' });
      Object.assign(s.op.tac.units[0], { x: 10, y: 7 });
      // 2. 真的選了鎖門也可以撤回：駭入只加一點固定的警戒。
      const alert = s.op.alert;
      tap(s, 11, 8);
      UI.click(s, { act: 'tacPick', ab: 'hack', x: '11', y: '8' });
      if (TT.tile(s.op.tac, 11, 8) !== 'D' || s.op.bw !== bw - 1) fail('feel: picking the lock from the menu did not lock the door');
      if (!s.op.tac.undo || !N.tacUndo(s)) fail('feel: a hack cannot be undone');
      else if (TT.tile(s.op.tac, 11, 8) !== 'd' || s.op.bw !== bw || s.op.alert !== alert || s.op.tac.units[0].ap !== 2) fail('feel: undoing a hack did not put everything back');
    }
    // 3. 只有一件事可以做、但聲音很大：先跳選單；普通的目標照樣一點就做。
    {
      const { s, ids, t } = go('feel-loud', [job('bartender')], 'tower');
      Object.assign(N.person(s, ids[1]), { flaw: null, quirks: [], traits: [] });
      const u = t.units.find((x) => x.id === ids[1]);
      Object.assign(u, { x: 4, y: 3, ap: 2 });
      UI.click(s, { act: 'tacSel', id: ids[1] });
      tap(s, 5, 3);
      if (TT.tile(t, 5, 3) !== 'D' || !UI.state().pop) fail('feel: forcing a door went off without showing the noise');
      else if (!UI.render(s, { alertStatus: () => 's2.op.alert.0' }).includes(E.i18n.t('tac.costNoise', { n: 5 }))) fail('feel: the menu does not show how far the noise carries');
      UI.click(s, { act: 'tacClose' });
      // 4. 走不到的地板：有回應。
      tap(s, 12, 2);
      if (!UI.state().tip || UI.state().tip.k !== 'tac.far') fail('feel: tapping a square out of reach gave no answer');
    }
    // 5. 急救的人點到受傷的隊友：可以急救，也可以換人。
    {
      const { s, ids, t } = go('feel-heal', [job('nurse')], 'tower');
      const [hero, nurse] = ids;
      const a = t.units.find((x) => x.id === nurse), b = t.units.find((x) => x.id === hero);
      Object.assign(a, { x: 2, y: 2, ap: 2 });
      Object.assign(b, { x: 3, y: 2, ap: 2 });
      s.op.hurt[hero] = 'light';
      UI.click(s, { act: 'tacSel', id: nurse });
      tap(s, 3, 2);
      const pop = UI.state().pop;
      if (!pop || !pop.items.some((x) => x.ab === 'heal') || !pop.items.some((x) => x.ab === 'select')) fail('feel: a medic could not choose between healing and selecting');
      else {
        if (unresolved(UI.render(s, { alertStatus: () => 's2.op.alert.0' }))) fail('feel: unresolved text in the heal menu');
        UI.click(s, { act: 'tacPick', ab: 'select', id: hero, x: '3', y: '2' });
        if (UI.state().sel !== hero || s.op.hurt[hero] !== 'light') fail('feel: picking a teammate healed them or did not select them');
      }
    }
    UI.reset();
  }
  // 今晚的機會：每一件都有地圖，目標的種類和限時的回合數照 opMaps.jobs，沒有敵人的時候都打得完。
  for (const [id, plan] of Object.entries(E.s2.opMaps.jobs)) {
    const label = `tac job ${id}`;
    const { s, ids } = squadFor('ghost-job-' + id, [job('builder')]);
    s.jobs = [{ id, district: s.district, until: s.dnight }];
    if (!N.pickOp(s, 'job:' + id) || !N.tacPlan(s)) { fail(`${label}: no map`); continue; }
    N.launch(s, ids, {}, 'tac');
    const t = s.op.tac;
    if (!t || t.mapId !== plan.map) { fail(`${label}: did not use the ${plan.map} map`); continue; }
    if (plan.obj && !t.objs.some((o) => o.kind === plan.obj)) fail(`${label}: no ${plan.obj} objective`);
    if (E.s2.ops.jobs[id].timer && t.limit !== (plan.turns || E.s2.ops.jobs[id].timer)) fail(`${label}: ${t.limit} turns instead of ${plan.turns}`);
    if (!TT.reachable(t)) fail(`${label}: objectives or exit unreachable`);
    const out = ghost(s);
    if (out !== 'win') fail(`${label}: a squad with no enemies ended in ${out}`);
    if (unresolved(render(s.log).join('\n'))) fail(`${label}: unresolved text in the log`);
  }
  // 每張地圖配上每一種會出現的特殊狀況：沒有敵人的時候都打得完（散場人潮、清潔推車擺的藏身處不能擋路）。
  let evMaps = 0;
  for (const map of Object.keys(E.s2.maps).filter((m) => !['training', 'safehouse'].includes(m))) {
    const theme = E.s2.maps[map].theme;
    for (const ev of [null].concat(E.s2.mapEvents.filter((x) => x.themes.includes(theme)).map((x) => x.id))) {
      const label = `tac ${map}${ev ? ' + ' + ev : ''}`;
      const { s, ids } = squadFor('every-' + map + (ev || ''), [job('builder')]);
      N.pickOp(s, 'tower');
      N.launch(s, ids, {}, 'tac');
      const obj = map === 'site' ? 'box' : 'terminal';
      s.op.tac = TT.build({ map, obj, ids, rank: 3, event: ev, rng: E.rng.create(label), escort: N.person(s, 'camden-2999').id });
      if (ev && s.op.tac.event !== ev) fail(`${label}: the event was not applied`);
      if (!TT.reachable(s.op.tac)) fail(`${label}: objectives or exit unreachable`);
      const out = ghost(s);
      if (out !== 'win') fail(`${label}: a squad with no enemies ended in ${out}`);
      evMaps++;
    }
  }
  // 特殊狀況真的有效果：大霧少看一格、停電演練攝影機關著、換班時守衛聚著聊、加派警犬、加強巡邏、Echo 的低語。
  {
    const plain = TT.build({ map: 'street', ids: ['a'], rank: 3 });
    const foggy = TT.build({ map: 'street', ids: ['a'], rank: 3, event: 'fog' });
    const sight = (t) => Object.values(TT.vision({ op: { tac: t } })).reduce((n, c) => n + c.length, 0);
    if (sight(foggy) >= sight(plain)) fail('tac events: fog does not shorten sight');
    if (TT.build({ map: 'office', ids: ['a'], rank: 3, event: 'drill' }).foes.some((f) => f.kind === 'cam' && !(f.off > 0))) fail('tac events: the drill left a camera on');
    if (!TT.build({ map: 'compound', ids: ['a'], rank: 0, event: 'echo' }).intel) fail('tac events: Echo did not show the routes');
    const dogs = (t) => t.foes.filter((f) => f.kind === 'dog').length;
    if (dogs(TT.build({ map: 'office', ids: ['a'], rank: 3, event: 'kennel' })) !== 1) fail('tac events: no extra dog');
    const drones = (t) => t.foes.filter((f) => f.kind === 'drone').length;
    if (drones(TT.build({ map: 'office', ids: ['a'], rank: 3, event: 'sweep' })) !== drones(TT.build({ map: 'office', ids: ['a'], rank: 3 })) + 1) fail('tac events: no extra drone');
    const { s, ids } = squadFor('ev-shift', []);
    N.pickOp(s, 'tower');
    N.launch(s, ids, {}, 'tac');
    s.op.tac = TT.build({ map: 'site', obj: 'box', ids, rank: 3, event: 'shift' });
    for (let i = 0; i < 3 && s.phase === 'tac'; i++) N.tacEnd(s);
    if (s.phase === 'tac' && !s.log.some((e) => e.k === 'tac.log.ev.shift')) fail('tac events: the shift change never happened');
  }
  // 主線任務分兩段：第一段用潛入的地圖（沒有目標，只要穿過去）→ 中場 → 第二段用主要目標的地圖。
  {
    const { s, ids } = squadFor('chain-tac', [job('builder')]);
    delete s.mains.m2;
    N.pickOp(s, 'main');
    N.launch(s, ids, {}, 'tac');
    if (!s.op.tac || s.op.tac.mapId !== E.s2.opMaps.approach.m2.map || s.op.tac.objs.length) fail('chain: part 1 did not use the approach map without objectives');
    const out1 = ghost(s);
    if (s.phase !== 'interlude' || s.mainPart.m2 !== 1) fail(`chain: part 1 ended in ${out1}, not the interlude`);
    else {
      N.nextPart(s, 'patch', 'tac');
      if (!s.op.tac || s.op.tac.mapId !== E.s2.opMaps.main.m2.map) fail('chain: part 2 did not use the main map');
      const out2 = ghost(s);
      if (out2 !== 'win' || s.mains.m2 !== 'done' || s.mainPart.m2) fail(`chain: part 2 ended in ${out2}`);
      if (s.towers !== 3) fail('chain: winning both parts did not take the tower down');
    }
  }
  // 撤離點離出發點夠遠：完成目標之後不能在門口直接溜走。
  for (const id of Object.keys(E.s2.maps).filter((m) => m !== 'training')) {
    const t = TT.build({ map: id, ids: ['a'], rank: 0 });
    const cells = (c) => t.map.flatMap((r, y) => [...r].map((v, x) => (v === c ? [x, y] : null)).filter(Boolean));
    const far = Math.min(...cells('X').flatMap(([x, y]) => cells('S').map(([sx, sy]) => Math.abs(x - sx) + Math.abs(y - sy))));
    if (far < 10) fail(`tac ${id}: the exit is only ${far} squares from the start`);
  }

  // 3. 教學關：照 Bagley 每一步說的做，一步一步走到撤離；被追上不算數，正在玩的那一輪完全不受影響。
  {
    const real = N.create('tut-real', { skipStory: true });
    const before = JSON.stringify(real);
    const s = N.tutorial();
    const R = s.tutorial.roles;
    const steps = E.s2.tutorial.steps;
    // 走路的距離（不能穿過牆、圍欄、上鎖的門）
    const walk = (t, from, goal) => {
      const d = { [goal[0] + ',' + goal[1]]: 0 };
      const q = [goal];
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
          if (d[k] !== undefined || !'.,dXSHE'.includes(TT.tile(t, nx, ny))) continue;
          d[k] = d[x + ',' + y] + 1;
          q.push([nx, ny]);
        }
      }
      return d[from[0] + ',' + from[1]] === undefined ? 99 : d[from[0] + ',' + from[1]];
    };
    const order = [];
    for (let k = 0; k < 200 && s.phase === 'tac'; k++) {
      const st = N.tutorialStep(s);
      if (!st) break;
      if (order[order.length - 1] !== st.id) order.push(st.id);
      if (st.id === 'end') { N.tacEnd(s); continue; }
      const t = s.op.tac;
      const marks = st.mark ? st.mark(t) : [];
      const who = st.who ? [R[st.who]] : TT.live(t).map((u) => u.id);
      let did = false;
      // 這一步要動手的人：標記的地方能用能力就用，不能就往標記走近一點；都動不了就結束回合。
      for (const id of who) {
        const u = t.units.find((x) => x.id === id);
        if (!u || u.out || u.taken || u.ap <= 0) continue;
        const a = st.id === 'exit' ? null : N.tacAbilities(s, id).find((x) => x.targets.some(([tx, ty]) => marks.some((m) => m[0] === tx && m[1] === ty)));
        if (a) {
          const [tx, ty] = a.targets.find(([x, y]) => marks.some((m) => m[0] === x && m[1] === y));
          did = N.tacUse(s, id, a.id, tx, ty);
          break;
        }
        let best = null, bd = walk(t, [u.x, u.y], marks[0]);
        for (const key of Object.keys(N.tacReach(s, id))) {
          const p = key.split(',').map(Number);
          const dd = walk(t, p, marks[0]);
          if (dd < bd) { bd = dd; best = p; }
        }
        if (best) { did = N.tacMove(s, id, best[0], best[1]); break; }
      }
      if (!did) N.tacEnd(s);
    }
    if (s.phase !== 'result' || s.result.outcome !== 'win') fail(`tutorial: following the steps ended in ${s.phase === 'result' ? s.result.outcome : s.phase}`);
    if (order.join(' ') !== steps.map((x) => x.id).join(' ')) fail(`tutorial: steps came in the wrong order: ${order.join(' ')}`);
    if (s.log.some((e) => e.k === 's2.log.arrested')) fail('tutorial: someone was arrested in the simulation');
    if (N.tutorialStep(s) !== null) fail('tutorial: still shows a step after the end');
    if (JSON.stringify(real) !== before) fail('tutorial: starting the tutorial changed the real run');
    if (unresolved(render(s.log).join('\n'))) fail('tutorial: unresolved text in the log');
    // 被守衛追上：只是警告，不會被捕；警戒也不會滿。
    const s2 = N.tutorial();
    const t2 = s2.op.tac;
    const g = t2.foes.find((f) => f.kind === 'guard');
    const u = t2.units[0];
    g.x = u.x + 1; g.y = u.y; g.state = 'alert'; g.target = [u.x, u.y]; g.route = [[g.x, g.y]];
    N.tacEnd(s2);
    if (t2.units.some((x) => x.taken) || !s2.log.some((e) => e.k === 'tac.log.practice')) fail('tutorial: a guard catching someone in the simulation arrests them');
    s2.op.alert = 85;
    N.tacUse(s2, u.id, 'hack', 5, 0);
    for (const f of t2.foes) if (f.kind === 'cam') f.off = 0;
    for (let i = 0; i < 4; i++) N.tacEnd(s2);
    if (s2.phase !== 'tac' || s2.op.alert >= 100) fail('tutorial: the alert can fill up in the simulation');
    if (!N.tutorialSkip(s2)) fail('tutorial: a step cannot be skipped');
    console.log(`tutorial: ${order.length} steps followed to the exit`);
  }
  // 天賦：每一張卡在地圖上做的事，和說明寫的一樣。
  {
    const { s, ids } = squadFor('gift-map', [job('builder')]);
    const [hero, builder] = ids;
    E.roster.get(s.roster, hero).gifts = ['sergei', 'hammer', 'eagle', 'focus', 'blackout', 'mask', 'baton'];
    E.roster.get(s.roster, builder).gifts = ['quietstep'];
    Object.assign(N.person(s, hero), { flaw: null, quirks: [], traits: [] });
    N.pickOp(s, 'tower');
    N.launch(s, ids, {}, 'tac');
    const t = s.op.tac;
    t.event = null;
    t.spawns = [];
    const u = t.units.find((x) => x.id === hero), b = t.units.find((x) => x.id === builder);
    const mk = (id, kind, x, y) => ({ id, kind, x, y, face: [1, 0], route: [[x, y]], ri: 0, state: 'patrol', timer: 0, target: null, down: false, off: 0, loop: 0 });
    const foe = (id) => t.foes.find((x) => x.id === id);
    const can = (ab) => N.tacAbilities(s, hero).some((x) => x.id === ab);
    if (!t.intel) fail('gift: the Eagle Drone does not show patrol routes');
    if (!N.tacCaps(s, builder).quiet) fail('gift: soft steps still make a sound');
    for (const g of ['sergei', 'hammer', 'eagle', 'focus', 'blackout', 'mask', 'baton']) if (!N.tacCards(s, hero).some((c) => c.ab === g)) fail(`gift: ${g} is not on the card row`);
    Object.assign(u, { x: 3, y: 3, ap: 6 });
    Object.assign(b, { x: 2, y: 4, ap: 2 });
    t.foes = [mk('near', 'guard', 8, 4)];
    s.op.alert = 0;
    // 謝爾蓋：工程無人機，隔著牆拆門，不出聲、不引開任何人。
    if (TT.tile(t, 5, 3) !== 'D' || !N.tacUse(s, hero, 'sergei', 5, 3)) fail('gift: Sergei did not go to the door');
    if (TT.tile(t, 5, 3) !== 'd' || s.op.alert !== 0 || foe('near').state !== 'patrol') fail('gift: Sergei was not a quiet demolition');
    if (can('sergei')) fail('gift: Sergei can be sent twice');
    delete t.used['sergei:' + hero];
    if (!N.tacUse(s, hero, 'sergei', 5, 2) || TT.tile(t, 5, 2) !== '.') fail('gift: Sergei did not take the fence apart');
    // 鐵鎚：正面砸倒守衛、砸掉無人機，每次行動一次，聲音傳 3 格。
    t.foes = [Object.assign(mk('front', 'guard', u.x + 1, u.y), { face: [-1, 0] }), mk('ear', 'guard', u.x + 3, u.y)];
    const ham = N.tacAbilities(s, hero).find((x) => x.id === 'hammer');
    if (!ham || ham.noise !== 3) fail('gift: the hammer is not offered, or is not loud');
    else if (!N.tacUse(s, hero, 'hammer', u.x + 1, u.y) || !foe('front').down) fail('gift: the hammer did not drop a guard head-on');
    if (foe('ear').state !== 'alert') fail('gift: nobody heard the hammer');
    if (can('hammer')) fail('gift: the hammer can be used twice');
    delete t.used['hammer:' + hero];
    t.foes = [mk('rd', 'drone', u.x + 1, u.y)];
    if (!N.tacUse(s, hero, 'hammer', u.x + 1, u.y) || !foe('rd').down) fail('gift: the hammer did not smash a drone');
    // 老鷹無人機：自爆，兩格內的守衛、狗、攝影機、無人機都停擺兩回合。
    t.foes = [mk('g', 'guard', 7, 3), mk('c', 'cam', 8, 3), mk('r', 'drone', 7, 4), mk('d', 'dog', 8, 4), mk('far', 'guard', 12, 8)];
    if (!N.tacUse(s, hero, 'eagle', 7, 3)) fail('gift: the Eagle Drone could not reach an enemy');
    if (foe('g').state !== 'distracted' || foe('g').timer !== 2 || foe('c').off !== 2 || foe('r').loop !== 2 || foe('d').state !== 'distracted') fail('gift: the EMP missed something in range');
    if (foe('far').state !== 'patrol') fail('gift: the EMP reached too far');
    if (can('eagle')) fail('gift: the Eagle Drone can go off twice');
    // 專注
    const ap = u.ap;
    N.tacUse(s, hero, 'focus', u.x, u.y);
    if (u.ap !== ap + 2) fail('gift: Focus did not give 2 AP');
    // 大停電：全圖，有代價，撤回不了。
    const heat = s.heat;
    t.foes = [mk('c2', 'cam', 13, 1), mk('r2', 'drone', 12, 2), mk('g2', 'guard', 12, 8)];
    N.tacUse(s, hero, 'blackout', u.x, u.y);
    if (foe('c2').off !== 3 || foe('r2').loop !== 3 || foe('g2').state !== 'distracted' || s.heat !== heat + 5) fail('gift: Blackout did not hit the whole map at its price');
    if (t.undo) fail('gift: Blackout can be undone');
    // 第二張臉
    N.tacUse(s, hero, 'mask', u.x, u.y);
    if (u.disguise !== 3) fail('gift: Second Face did not disguise');
    // 接力
    const left = u.ap, had = b.ap;
    if (!N.tacUse(s, hero, 'baton', b.x, b.y) || b.ap !== had + left + 1 || u.ap !== 0) fail('gift: Baton Pass did not hand over the AP');
    if (unresolved(render(s.log).join('\n'))) fail('gift: unresolved text in the log');
  }
  // 快速結算：同一張卡的效果。
  for (const g of ['sergei', 'hammer', 'eagle', 'focus', 'blackout', 'mask', 'baton']) {
    const { s, ids } = squadFor('gift-quick-' + g, [job('builder')]);
    const [hero] = ids;
    E.roster.get(s.roster, hero).gifts = [g];
    N.pickOp(s, 'tower');
    N.launch(s, ids);
    s.op.alert = 40;
    const heat = s.heat;
    const o = N.options(s).find((x) => x.candidates.some((c) => c.id === hero && c.ok && c.risk > 0.1));
    const before = o && o.candidates.find((c) => c.id === hero);
    if (!N.useCard(s, hero, g)) { fail(`gift ${g}: card refused in a quick operation`); continue; }
    const after = o && N.options(s).find((x) => x.approach.id === o.approach.id).candidates.find((c) => c.id === hero);
    if (g === 'sergei' && (s.op.alert !== 40 || !s.op.boost || s.op.force !== hero)) fail('gift sergei: should help the stage, not lower the alert');
    if (g === 'hammer' && (s.op.alert !== 30 || s.op.force !== hero)) fail('gift hammer: alert -10 and physical approaches');
    if (g === 'eagle' && (s.op.alert !== 25 || !s.op.boost)) fail('gift eagle: alert -15 and a boost');
    if (g === 'eagle' && !s.op.revealed['main:0']) fail('gift eagle: no scouting in a quick operation');
    if (g === 'blackout' && (s.op.alert !== 15 || s.heat !== heat + 5)) fail('gift blackout: alert -25 for heat +5');
    if (g === 'mask' && s.op.ghost !== hero) fail('gift mask: the next action should raise no alert');
    if (g === 'baton' && !s.op.boost) fail('gift baton: no boost');
    if (g === 'focus' && before && after.risk >= before.risk) fail('gift focus: the next action is no safer');
    if (unresolved(render(s.log).join('\n'))) fail(`gift ${g}: unresolved text`);
  }
  // 朋友：守衛追上主角時，旁邊的朋友把人拉開。Darcy 教的腳步：聲音和視線。
  {
    const { s, ids } = squadFor('gift-friend', [job('builder')]);
    const [hero, builder] = ids;
    N.pickOp(s, 'tower');
    N.launch(s, ids, {}, 'tac');
    const t = s.op.tac;
    const u = t.units.find((x) => x.id === hero);
    N.bondUp(s, hero, builder, 5);
    const b = t.units.find((x) => x.id === builder);
    b.x = u.x; b.y = u.y + 1;
    const f2 = t.foes.find((x) => x.kind === 'guard');
    f2.x = u.x + 1; f2.y = u.y; f2.state = 'alert'; f2.target = [u.x, u.y]; f2.route = [[f2.x, f2.y]];
    N.tacEnd(s);
    if (u.taken || !s.log.some((e) => e.k === 'tac.log.friend')) fail('gift: a friend next to the hero did not pull them away');
    console.log('gifts: Sergei, Eagle Drone, Focus, Blackout, Second Face, Baton Pass on maps and in quick operations; friends pull each other away');
  }
  // 2b. 招式卡、稀有人物的王牌、小習慣、守衛犬：每一張卡在地圖上真的有用。
  {
    const launchTac = (seed, tests, op = 'tower') => {
      const r = squadFor(seed, tests);
      N.pickOp(r.s, op);
      N.launch(r.s, r.ids.slice(0, 3), {}, 'tac');
      if (r.s.phase !== 'tac') fail(`${seed}: did not start a tactical map`);
      return r;
    };
    const has = (s, id, ab) => N.tacAbilities(s, id).find((a) => a.id === ab);
    // 叫人：多一個人上場，叫來的人不能撤回，平安撤離後可以免費招募。
    {
      const { s, ids } = launchTac('card-summon', [(p) => p.traits.includes('connected')]);
      const id = ids[1];
      const a = has(s, id, 'summon');
      if (!a) fail('tac: someone who knows everyone has no summon card');
      else {
        N.tacUse(s, id, 'summon', a.targets[0][0], a.targets[0][1]);
        const h = s.op.tac.units.find((u) => u.helper);
        if (!h || !s.op.temp.includes(h.id)) fail('tac: summon did not bring anyone in');
        else {
          if (s.op.tac.undo) fail('tac: a summon can be undone (free recruit)');
          if (has(s, id, 'summon')) fail('tac: summon can be used twice');
          if (N.tacCards(s, h.id).some((c) => c.ab === 'summon')) fail('tac: a summoned helper can summon again');
          const out = ghost(s);
          if (out === 'win' && s.owed[h.id] !== 'helper') fail('tac: a summoned helper who got out cannot be recruited');
        }
      }
    }
    // 順手牽羊：從背後摸走門卡，全隊都能安靜開門；毛線針也能開門（兩個行動點）。
    {
      const { s, ids } = launchTac('card-lift', [(p) => p.traits.includes('nimble') && p.flaw !== 'clumsy', (p) => p.quirks.includes('knitting') && !['lockpick', 'master_keys', 'site_pass', 'building_access'].includes(E.people.occupationOf(p).perk)]);
      const t = s.op.tac;
      const [, nimble, knit] = ids;
      const u = t.units.find((x) => x.id === nimble);
      const g = t.foes.find((f) => f.kind === 'guard');
      // 把守衛放在這個人旁邊，背對著
      g.x = u.x + 1; g.y = u.y; g.face = [1, 0]; g.state = 'patrol';
      const a = has(s, nimble, 'lift');
      if (!a) fail('tac: nimble hands cannot lift a keycard from behind');
      else {
        N.tacUse(s, nimble, 'lift', g.x, g.y);
        if (!t.keycard) fail('tac: lifting did not give the team a keycard');
        if (!ids.slice(0, 3).every((id) => N.tacCaps(s, id).unlock)) fail('tac: the keycard does not let everyone open doors');
      }
      t.keycard = false;
      if (!N.tacCaps(s, knit).needles) fail('tac: knitting needles do not pick locks');
    }
    // 守衛犬：藏身處也聞得到；愛狗的人不會被叫，還能摸摸頭讓狗安靜；怕狗的人遠一格就被聞到。
    {
      const { s, ids } = launchTac('card-dog', [(p) => p.quirks.includes('dogs_love') && !p.quirks.includes('dogs_fear'), (p) => p.quirks.includes('dogs_fear') && !p.quirks.includes('dogs_love')]);
      const t = s.op.tac;
      const [hero, lover, scared] = ids;
      const dog = { id: 'k9', kind: 'dog', x: 8, y: 4, face: [1, 0], route: [[8, 4]], ri: 0, state: 'patrol', timer: 0, target: null, down: false };
      t.foes = [dog];
      t.spawns = [];
      const put = (id, x, y) => { const u = t.units.find((v) => v.id === id); u.x = x; u.y = y; };
      // 怕狗的人躲在兩格外的藏身處（10,4）：狗照樣聞得到。
      put(hero, 1, 5); put(lover, 1, 7); put(scared, 10, 4);
      N.tacEnd(s);
      if (s.phase === 'tac' && dog.state !== 'alert') fail('tac: a dog did not smell someone in a hiding spot');
      // 愛狗的人站在狗旁邊：狗不叫。
      dog.state = 'patrol'; dog.target = null; t.seen = {};
      put(scared, 1, 6); put(lover, 8, 5);
      N.tacEnd(s);
      if (s.phase === 'tac' && dog.state === 'alert') fail('tac: a dog barked at a dog person');
      if (s.phase === 'tac') {
        if (!has(s, lover, 'pet')) fail('tac: a dog person cannot pat a dog');
        else {
          N.tacUse(s, lover, 'pet', 8, 4);
          if (!dog.friend) fail('tac: patting a dog does not quiet it');
        }
      }
    }
    // 稀有人物：信鴿遠端完成目標、地下電台讓全區守衛分心、COBOL 遠端駭目標、跑酷翻牆不花行動點。
    {
      const { s, ids } = launchTac('card-rare', [job('pigeon'), job('radio')]);
      const t = s.op.tac;
      const [, pigeon, radio] = ids;
      const a = has(s, pigeon, 'pigeon');
      if (!a) fail('tac: the pigeon keeper has no pigeon');
      else {
        const [px, py] = a.targets[0];
        N.tacUse(s, pigeon, 'pigeon', px, py);
        if (!t.objs.find((o) => o.x === px && o.y === py).done) fail('tac: the pigeon did not complete the objective');
      }
      if (!has(s, radio, 'radio')) fail('tac: the pirate radio host cannot go on air');
      else {
        N.tacUse(s, radio, 'radio', t.units.find((u) => u.id === radio).x, t.units.find((u) => u.id === radio).y);
        if (t.foes.some((f) => f.kind === 'guard' && !f.down && f.state !== 'distracted')) fail('tac: the radio show did not distract every guard');
      }
    }
    {
      const { s, ids } = launchTac('card-cobol', [job('cobol'), job('parkour')]);
      const [, cobol, runner] = ids;
      if (!N.tacCaps(s, cobol).remote) fail('tac: the COBOL engineer cannot hack objectives remotely');
      const c = N.tacCaps(s, runner);
      if (c.climbCost !== 0 || c.move < 5) fail('tac: the free-runner does not vault for free or move further');
    }
    // 樂天：打氣讓兩格內的隊友多一個行動點；謹慎：留後路（腳下變藏身處）。出發時三個人都擠在出發點旁邊。
    {
      const { s, ids } = launchTac('card-boost', [(p) => p.traits.includes('cheerful'), (p) => p.traits.includes('careful') && !p.traits.includes('cheerful')]);
      const t = s.op.tac;
      const [, cheer, careful] = ids;
      const at = (id) => t.units.find((u) => u.id === id);
      const total = () => t.units.reduce((n, u) => n + u.ap, 0);
      const a = has(s, cheer, 'boost');
      if (!a) fail('tac: a cheerful member cannot give a pep talk');
      else {
        const before = total();
        N.tacUse(s, cheer, 'boost', at(cheer).x, at(cheer).y);
        if (total() <= before) fail('tac: a pep talk did not give anyone an extra action point');
      }
      const cv = has(s, careful, 'cover');
      if (cv) {
        N.tacUse(s, careful, 'cover', at(careful).x, at(careful).y);
        if (TT.tile(t, at(careful).x, at(careful).y) !== 'H') fail('tac: the back-up plan did not make a hiding spot');
      }
    }
  }

  // 街上的人：掃描只是看檔案，保留（最多三個人）才會出現招募任務；保留的人不會離開，沒保留的人會換掉。
  {
    const s = N.create('keep', { skipStory: true });
    N.pickVolunteers(s, s.volunteers.slice(0, 2));
    const st = N.street(s);
    st.forEach((id) => N.scan(s, id));
    if (N.ops(s).some((e) => e.op === 'recruit')) fail('street: scanning alone adds recruit missions');
    if (N.keep(s, st[0]) !== true || !N.ops(s).some((e) => e.target === st[0])) fail('street: keeping someone does not add their recruit mission');
    st.slice(1).forEach((id) => N.keep(s, id));
    if (st.filter((id) => N.kept(s, id)).length !== N.MAX_KEEP) fail('street: the number of people kept is not capped');
    const gone = st.find((id) => !N.kept(s, id) && id !== s.featured);
    s.dnight += 3;
    if (!N.street(s).includes(st[0])) fail('street: a kept person left the street');
    if (N.street(s).includes(gone)) fail('street: someone who was not kept stayed on the street');
    N.keep(s, st[0], false);
    if (N.street(s).includes(st[0])) fail('street: letting someone go did not send them on');
  }
  // 死對頭可以同隊（只是會扣分），組隊畫面顯示「死對頭同隊」。
  {
    const s = N.create('feud', { skipStory: true });
    N.pickVolunteers(s, s.volunteers.slice(0, 2));
    const [a, b] = N.street(s);
    s.relations[a] = [{ other: b, type: 'rival' }];
    s.relations[b] = [{ other: a, type: 'rival' }];
    for (const id of [a, b]) { s.owed[id] = 'helper'; N.recruitOwed(s, id); E.roster.get(s.roster, id).status = 'active'; }
    N.pickOp(s, N.ops(s).find((e) => e.op === 'broadcast').key);
    if (!N.squadCheck(s, [a, b]).ok) fail('squad: rivals still cannot go out together');
    if (!N.combosFor(s, [a, b]).includes('feud')) fail('squad: rivals on one team do not show as bad blood');
    N.cancel(s);
  }
  // 弱點約六成五、嚴重的弱點比較少見；球迷比其他小習慣少。
  {
    const n = 4000;
    let flaw = 0, fans = 0, severe = 0, mild = 0;
    for (let i = 0; i < n; i++) {
      const p = E.people.generate('rate', 'soho', i);
      if (p.flaw) flaw++;
      if (p.flaw === 'record') severe++;
      if (p.flaw === 'allergic') mild++;
      if (p.quirks.some((q) => q === 'man_utd' || q === 'liverpool')) fans++;
    }
    if (Math.abs(flaw / n - 0.65) > 0.04) fail(`people: ${Math.round(flaw / n * 100)}% have a flaw (expected about 65%)`);
    if (severe >= mild) fail('people: severe flaws are not rarer than mild ones');
    if (fans / n > 0.16) fail(`people: ${Math.round(fans / n * 100)}% are football fans (too many derbies)`);
    for (const f of E.s2.people.flaws) if (![1, 2, 3].includes(f.level)) fail(`people: flaw ${f.id} has no severity level`);
    for (const x of E.s2.people.flaws.concat(E.s2.people.quirks)) if (!x.tac) fail(`people: ${x.id} has no map effect text`);
    for (const tr of E.s2.people.traits) if (!tr.card.tac) fail(`people: trait ${tr.id} has no map effect text`);
    for (const k in E.s2.people.perks) if (!E.s2.people.perks[k].tac) fail(`people: perk ${k} has no map effect text`);
  }
  // 招募任務和主線任務（跳過劇情時）也有地圖。
  for (const m of new Set(Object.values(E.s2.opMaps.recruit).concat(Object.values(E.s2.opMaps.main), Object.values(E.s2.opMaps.approach), Object.values(E.s2.opMaps.jobs)).map((x) => x.map))) if (!E.s2.maps[m]) fail(`tac: missing map ${m}`);
  for (const m of Object.keys(E.s2.maps)) if (!TT.reachable(TT.build({ map: m, ids: ['camden-1000'], rank: 4 }))) fail(`tac: ${m} has an unreachable objective or exit`);

  // 3. 隨機操作：各種行動、各種隊伍，跑完不會出錯，狀態可以存檔。
  let runs = 0, wins = 0;
  for (let i = 0; i < 160; i++) {
    const s = N.create('tac-rand-' + i, { skipStory: true });
    N.pickVolunteers(s, s.volunteers.slice(0, 2));
    for (const id of N.street(s).slice(0, 3)) { s.owed[id] = 'helper'; N.recruitOwed(s, id); }
    s.dnight = 2;
    if (i % 3) s.mains.m2 = 'done';
    N.street(s).forEach((id) => { N.scan(s, id); N.keep(s, id); });
    if (i % 4 === 0) E.roster.arrest(s.roster, s.roster.members[1].person.id, s.night);
    if (i % 7 === 0) s.tonight = { type: 'raid' };
    s.roster.members.forEach((m) => { m.threat = 0; });
    const bot = E.rng.create('tac-bot:' + i);
    const e = bot.pick(N.ops(s));
    N.pickOp(s, e.key);
    if (!N.tacPlan(s)) { N.cancel(s); continue; }
    const squad = s.roster.members.filter((m) => m.status === 'active').map((m) => m.person.id).slice(0, 3);
    if (!N.launch(s, squad, {}, 'tac') || s.phase !== 'tac') { fail(`tac-rand-${i}: did not start`); continue; }
    runs++;
    for (let g = 0; g < 400 && ['tac', 'react', 'interlude'].includes(s.phase); g++) {
      if (s.phase === 'react') { N.react(s, bot.chance(0.5)); continue; }
      // 主線任務的中場：喘口氣，第二段也親自潛入。
      if (s.phase === 'interlude') { N.nextPart(s, bot.pick(['regroup', 'patch']), 'tac'); continue; }
      const t = s.op.tac;
      const us = t.units.filter((u) => !u.out && !u.taken && u.ap > 0);
      if (!us.length || bot.chance(0.08)) { N.tacEnd(s); continue; }
      const u = bot.pick(us);
      const abs = N.tacAbilities(s, u.id);
      if (abs.length && bot.chance(0.5)) {
        const a = bot.pick(abs);
        const [x, y] = bot.pick(a.targets);
        if (!N.tacUse(s, u.id, a.id, x, y)) fail(`tac-rand-${i}: offered ability ${a.id} refused`);
      } else {
        const keys = Object.keys(N.tacReach(s, u.id));
        if (!keys.length) { u.ap = 0; continue; }
        const [x, y] = bot.pick(keys).split(',').map(Number);
        if (!N.tacMove(s, u.id, x, y)) fail(`tac-rand-${i}: offered move refused`);
      }
    }
    if (s.phase === 'tac') N.retreat(s);
    if (s.phase !== 'result') fail(`tac-rand-${i}: ended in ${s.phase}`);
    else if (s.result.outcome === 'win') wins++;
    if (JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s)) fail(`tac-rand-${i}: state does not survive a save`);
    for (const lang of LANGS) {
      E.i18n.set(lang);
      const text = render(s.log).join('\n');
      if (unresolved(text)) { fail(`tac-rand-${i} (${lang}): ${(text.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`); break; }
    }
  }
  console.log(`noise rules, map taps, abilities by category / perk / trait / flaw, ${PLANS.length + 1} maps × 3 squads cleared with no enemies, ${Object.keys(E.s2.opMaps.jobs).length} opportunity maps cleared, ${evMaps} map × event pairs cleared, two-part main mission on maps, ${runs} random operations (${wins} won)`);
}

// ===== 7f. 白天：三個時段、交情、練弱點、照顧、幫街坊、踩點、派對、每一件隊友事件 =====
section('白天');
{
  const N = E.night;
  // 開一輪，再招幾個符合條件的人進來。
  function team(seed, tests = []) {
    const s = N.create(seed, { skipStory: true });
    N.pickVolunteers(s, [s.volunteers[1]]);
    const ids = [s.hero, s.volunteers[1]];
    let from = 3000;
    for (const test of tests) {
      let id = null;
      for (let i = from; i < from + 3000 && !id; i++) {
        const x = 'camden-' + i;
        if (test(N.person(s, x)) && !ids.includes(x)) { id = x; from = i + 1; } else delete s.people[x];
      }
      s.owed[id] = 'helper';
      N.recruitOwed(s, id);
      E.roster.get(s.roster, id).status = 'active';
      ids.push(id);
    }
    return { s, ids };
  }
  const rel = (s, a, b, type) => N.relationsOf(s, a).some((r) => r.other === b && r.type === type);
  const job = (o) => (p) => p.occupation === o;
  const text = (s) => { for (const l of LANGS) { E.i18n.set(l); const x = render(s.log).join('\n'); if (unresolved(x)) return x; } return null; };
  // 1. 三個時段：做完三件事就不能再做；一天一次的事；早上的事沒處理什麼都不能做。
  {
    const { s, ids } = team('day-slots');
    const [a, b] = ids;
    if (!N.dayAct(s, 'neighbours', [a])) fail('day: could not help the neighbours');
    if (N.dayCheck(s, 'neighbours', [b]).reason !== 's2.day.need.daily') fail('day: helping the neighbours twice in a day was allowed');
    if (!N.dayAct(s, 'hang', [a, b]) || !N.dayAct(s, 'hang', [a, b])) fail('day: could not fill the day');
    if (N.dayAct(s, 'hang', [a, b]) || N.dayCheck(s, 'hang', [a, b]).reason !== 's2.day.need.slots') fail('day: a fourth thing was allowed');
    s.day.slot = 0;
    s.day.event = { id: 'cook', who: [a], v: {}, choices: ['eat'] };
    if (N.dayCheck(s, 'hang', [a, b]).reason !== 's2.day.need.event' || N.pickOp(s, N.ops(s)[0].key) || N.rest(s)) fail('day: things could be done before dealing with the morning');
    if (!N.dayAnswer(s, 'eat') || s.day.event) fail('day: could not answer the morning event');
    if (N.dayCheck(s, 'party', []).reason !== 's2.day.need.evening') fail('day: a party before the evening was allowed');
  }
  // 2. 交情：一起混到 3 變成朋友（雙向、同隊有「好朋友」組合、成功率較高），掉到 −3 變成死對頭，回到 0 就和好。
  {
    const { s, ids } = team('day-bonds');
    const [a, b] = ids;
    for (let n = 0; n < 6 && !rel(s, a, b, 'friend'); n++) { s.day.slot = 0; N.dayAct(s, 'hang', [a, b]); }
    if (!rel(s, a, b, 'friend') || !rel(s, b, a, 'friend')) fail('day: hanging out never made friends');
    if (!N.combosFor(s, [a, b]).includes('friends')) fail('day: two friends do not get the combo');
    N.bondUp(s, a, b, -8);
    if (rel(s, a, b, 'friend') || !rel(s, a, b, 'rival')) fail('day: falling out badly did not make rivals');
    N.bondUp(s, a, b, 5);
    if (rel(s, a, b, 'rival')) fail('day: rivals never made up');
    if (!s.log.some((e) => e.k === 's2.day.log.friends') || !s.log.some((e) => e.k === 's2.day.log.rivals') || !s.log.some((e) => e.k === 's2.day.log.madeUp')) fail('day: bond changes were not logged');
  }
  // 3. 練弱點：一天一次；懼高的人跟消防員練兩天（好教練一次算兩次）就沒了，存檔讀回來之後兩份資料都改了；有前科一定要律師。
  {
    const { s, ids } = team('day-train', [(p) => p.flaw === 'acrophobia', job('firefighter'), (p) => p.flaw === 'nervous', (p) => p.flaw === 'record']);
    const [, , pupil, coach, nervous, record] = ids;
    const c = JSON.parse(JSON.stringify(s));
    if (!N.goodCoach(c, 'acrophobia', coach)) fail('day: a firefighter is not a good coach for heights');
    if (!N.dayAct(c, 'train', [pupil, coach])) fail('day: could not train with a coach');
    if (N.dayCheck(c, 'train', [pupil, coach]).reason !== 's2.day.need.daily') fail('day: training twice in a day was allowed');
    c.day.did = {};
    N.dayAct(c, 'train', [pupil, coach]);
    if (N.person(c, pupil).flaw !== null || E.roster.get(c.roster, pupil).person.flaw !== null) fail('day: a weakness trained away came back after a save');
    if (!(E.roster.get(c.roster, pupil).overcame || []).includes('acrophobia')) fail('day: the weakness that was overcome is not recorded');
    const need = E.s2.days.training.nervous.need;
    for (let i = 0; i < need; i++) { s.day.slot = 0; s.day.did = {}; N.dayAct(s, 'train', [nervous]); }
    if (N.person(s, nervous).flaw !== null) fail(`day: ${need} sessions alone did not get over nerves`);
    s.day.did = {};
    if (N.dayCheck(s, 'train', [record]).reason !== 's2.day.need.coach') fail('day: a record was trained away without a lawyer');
  }
  // 4. 照顧傷員：一般人一次少休一晚，重傷的人只有護理師救得回來；一天一次。
  {
    const { s, ids } = team('day-care', [job('nurse')]);
    const [a, b, nurse] = ids;
    E.roster.injure(s.roster, a, 3);
    E.roster.get(s.roster, a).critical = 2;
    if (!N.dayAct(s, 'care', [a, b]) || E.roster.get(s.roster, a).injuredFor !== 2 || !E.roster.get(s.roster, a).critical) fail('day: an ordinary carer got someone out of danger');
    if (N.dayCheck(s, 'care', [a, nurse]).reason !== 's2.day.need.daily') fail('day: caring twice in a day was allowed');
    s.day.did = {};
    if (!N.dayAct(s, 'care', [a, nurse]) || E.roster.get(s.roster, a).status !== 'active' || E.roster.get(s.roster, a).critical) fail('day: the nurse did not get them back on their feet');
  }
  // 5. 幫街坊、踩點、派對
  {
    const { s, ids } = team('day-misc', [job('busker'), (p) => true]);
    const before = s.support;
    N.dayAct(s, 'neighbours', [ids[2]]);
    if (s.support !== before + 2) fail(`day: a social type helping the neighbours gave ${s.support - before} support`);
    N.dayAct(s, 'scout', [ids[1]]);
    s.mains.m2 = 'done';
    const start = N.startAlert(s, [ids[0]]);
    N.pickOp(s, 'broadcast');
    N.launch(s, [ids[0], ids[1]]);
    if (!s.op.scouted || !s.op.revealed['main:0'] || E.roster.get(s.roster, ids[1]).threat < 5) fail(`day: scouting did not help tonight, or cost nothing (start ${start}, alert ${s.op.alert})`);
    const p = team('day-party', [(x) => true, (x) => true]).s;
    p.day.slot = 2;
    const heat = p.heat;
    if (!N.dayAct(p, 'party', []) || p.heat !== heat + 3) fail('day: the party did not happen in the evening');
    p.night++; p.day.slot = 2; p.day.did = {};
    if (N.dayCheck(p, 'party', []).reason !== 's2.day.need.party') fail('day: two parties in a row were allowed');
  }
  // 6. 每一件隊友事件：人湊齊了就會發生；每個選項都打得完、三語都翻得出來；幾個重要的效果真的發生。
  {
    const { s, ids } = team('day-events', [() => true, () => true, () => true, () => true, () => true]);
    const [hero, , a, b, c, d, e] = ids;
    const set = (id, k, v) => { N.person(s, id)[k] = v; };
    set(a, 'quirks', ['liverpool', 'cantonese']);
    set(b, 'quirks', ['liverpool', 'cantonese']);
    set(c, 'quirks', ['man_utd', 'dogs_fear']);
    set(d, 'quirks', ['tea', 'gamer']);
    set(d, 'flaw', 'phone');
    set(e, 'flaw', 'nervous');
    s.relations[d] = [{ other: e, type: 'ex' }];
    s.relations[e] = [{ other: d, type: 'ex' }];
    E.roster.get(s.roster, hero).wins = 2;
    s.heat = 40;
    s.night = 6;
    s.dnight = 6;
    N.bondUp(s, a, b, 5);
    let n = 0;
    for (const ev of E.s2.days.events) {
      for (const ch of ev.choices) {
        for (const seed of ch.p !== undefined ? [0, 1, 2, 3, 4, 5] : [0]) {
          const c2 = JSON.parse(JSON.stringify(s));
          c2.step += seed * 7;
          if (!N.dayForce(c2, ev.id)) { fail(`day event ${ev.id}: never happens even with the right people`); break; }
          const who = c2.day.event.who;
          if (!N.dayAnswer(c2, ch.id) || c2.day.event) fail(`day event ${ev.id}: choice ${ch.id} did not resolve`);
          if (ch.slot && c2.day.slot !== 1) fail(`day event ${ev.id}: choice ${ch.id} did not take up part of the day`);
          const bad = text(c2);
          if (bad) fail(`day event ${ev.id}.${ch.id}: unresolved ${(bad.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`);
          if (ev.id === 'wrench' && ch.id === 'take' && !(E.roster.get(c2.roster, who[0]).gifts || []).includes('sergei')) fail('day event wrench: no Sergei');
          if (ev.id === 'darcy' && ch.id === 'learn' && !(E.roster.get(c2.roster, who[0]).gifts || []).includes('quietstep')) fail('day event darcy: no soft steps');
          const taught = { wrench_hammer: 'hammer', darcy_eagle: 'eagle', aiden_focus: 'focus', aiden_blackout: 'blackout', blue_door: 'mask', rank: 'baton' }[ev.id];
          if (taught && (ch.slot || ev.id === 'rank') && !(E.roster.get(c2.roster, who[0]).gifts || []).includes(taught)) fail(`day event ${ev.id}: nobody learned ${taught}`);
          if (ev.id === 'dark_hour' && (c2.day.spare !== 1 || !N.dayAct(c2, 'hang', [hero, a]) || c2.day.slot !== 0 || c2.day.spare)) fail('day event dark_hour: no extra part of the day');
          if (ev.id === 'white_dog' && ch.id === 'stay' && !N.person(c2, who[0]).quirks.includes('dogs_love')) fail('day event white_dog: no dog person');
          if (ev.id === 'midnight_tv' && ch.id === 'tell' && !(E.roster.get(c2.roster, who[1]).train || {})[N.person(c2, who[1]).flaw]) fail('day event midnight_tv: no progress on the weakness');
          if (ev.id === 'bear' && c2.heat >= s.heat) fail('day event bear: the heat did not go down');
          if (ev.id === 'wrench_tv' && c2.heat >= s.heat) fail('day event wrench_tv: the heat did not go down');
          if (ev.id === 'marcus' && ch.id === 'yes' && Object.keys(c2.owed).length !== Object.keys(s.owed).length + 1) fail('day event marcus: nobody was sent');
          if (ev.id === 'fortune' && ch.id === 'listen' && c2.tap !== c2.night + 2) fail('day event fortune: no warning of counter-attacks');
          if (ev.id === 'cat' && ch.id === 'sleep' && (c2.day.slot !== E.s2.days.SLOTS.length || E.days.busyOf(c2, hero) !== 0)) fail('day event cat: the day went on');
          if (ev.id === 'dog' && ch.id === 'befriend' && (N.person(c2, who[0]).quirks.includes('dogs_fear') || !N.person(c2, who[0]).quirks.includes('dogs_love'))) fail('day event dog: still afraid of dogs');
          if (ev.id === 'derby' && ch.id === 'leave' && E.roster.get(c2.roster, who[1]).status !== 'injured') fail('day event derby: nobody got hurt in the fight');
          if (ev.id === 'nightjob' && ch.id === 'take' && !N.person(c2, who[0]).quirks.includes('night_shift')) fail('day event nightjob: no night-work permit');
          if (ev.id === 'canal' && (E.roster.get(c2.roster, who[0]).train || {}).phone !== 1) fail('day event canal: no progress on the phone habit');
          n++;
        }
      }
    }
    E.i18n.set('zh-Hant');
    for (const ev of E.s2.days.events) {
      if (ev.after && !E.s2.days.events.some((x) => x.id === ev.after)) fail(`day event ${ev.id}: comes after an unknown event`);
      if (ev.cameo && S2.ctx.ECHO.art === undefined && !/^[a-z]+$/.test(ev.cameo)) fail(`day event ${ev.id}: bad portrait id`);
    }
    const artSrc = fs.readFileSync(path.join(root, 'js/ui/art.js'), 'utf8');
    for (const id of new Set(E.s2.days.events.map((x) => x.cameo).filter(Boolean))) if (!new RegExp('\\b' + id + ': \\(\\) =>').test(artSrc)) fail(`day event portrait ${id} is not drawn`);
    console.log(`slots, bonds (friends, rivals, making up), training, care, neighbours, scouting, parties, ${E.s2.days.events.length} teammate events (${n} outcomes), every cameo with a portrait`);
  }
}

// ===== 7d. 音效 =====
section('音效');
{
  // 假的 AudioContext：不出聲音，但和真的一樣會在數值不合法時丟出錯誤（指數滑音不能到 0）。
  const param = () => ({
    value: 0,
    setValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error('bad value'); },
    cancelScheduledValues() {},
    exponentialRampToValueAtTime(v, t) { if (!(v > 0) || !Number.isFinite(t)) throw new Error('exponential ramp to ' + v); },
    linearRampToValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error('bad ramp'); },
    setTargetAtTime(v, t, c) { if (!Number.isFinite(v) || !(c > 0)) throw new Error('bad target'); },
  });
  let nodes = 0;
  const node = (fields = []) => {
    nodes++;
    const n = { connect: (x) => x, start() {}, stop() {} };
    for (const k of fields) n[k] = param();
    return n;
  };
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
  S2.ctx.AudioContext = FakeAudio;
  S2.ctx.setTimeout = () => 0;
  S2.ctx.clearTimeout = () => {};
  const X = S2.E.sfx;
  storage.delete('watchdogs-echo.muted');
  X.unlock();
  // sfx 裡的 try/catch 會把錯誤吞掉：直接換掉 console 看不到，所以用 render 以外的方式檢查——把 play 的錯誤攤開。
  const names = X.names;
  if (names.length < 25) fail(`sfx: only ${names.length} sounds`);
  for (const name of names) {
    const before = nodes;
    for (let i = 0; i < 12; i++) X.play(name); // 有隨機的部分，多放幾次
    if (nodes === before) fail(`sfx ${name}: built nothing (an error was swallowed?)`);
  }
  for (const mood of ['day', 'city', 'tac', null]) X.ambient(mood, 0.8);
  // 程式裡用到的聲音都要存在。
  const used = new Set();
  for (const file of ['js/ui/s2.js', 'js/ui/tactics.js', 'js/ui/fx.js', 'js/ui/terminal.js', 'js/main.js']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const m of text.matchAll(/sfx\.play\(([^)]*)\)/g)) for (const q of m[1].matchAll(/'(\w+)'/g)) used.add(q[1]);
    for (const m of text.matchAll(/\/, '(\w+)'\],?$/gm)) used.add(m[1]);
  }
  for (const ev of S2.E.s2.days.events) if (ev.sound) used.add(ev.sound);
  for (const name of used) if (!names.includes(name)) fail(`sfx: ${name} is used but not defined`);
  console.log(`${names.length} sounds built without errors, ${used.size} used in the game, ambient moods`);
}

// ===== 7e. 今晚的機會 =====
section('今晚的機會');
{
  const N = E.night;
  const J = E.s2.ops.jobs;
  // 開一輪，再多招三個人（機會的好處有的只給沒出門的人看得出來）。
  function start(seed) {
    const s = N.create(seed, { skipStory: true });
    N.pickVolunteers(s, [s.volunteers[1]]);
    for (const id of N.street(s).slice(0, 3)) { s.owed[id] = 'helper'; N.recruitOwed(s, id); E.roster.get(s.roster, id).status = 'active'; }
    for (const m of s.roster.members) { m.threat = 0; m.person.flaw = null; N.person(s, m.person.id).flaw = null; }
    return s;
  }
  // 一般關卡從頭打到尾：每一步挑最穩的人和解法；中場就重新集合。
  function runOp(s) {
    for (let g = 0; g < 300 && ['op', 'event', 'react', 'interlude'].includes(s.phase); g++) {
      if (s.phase === 'event') { N.answer(s, s.event.choices[0]); continue; }
      if (s.phase === 'react') { N.react(s, true); continue; }
      if (s.phase === 'interlude') { N.nextPart(s, 'regroup'); continue; }
      const moves = [];
      for (const lane of Object.keys(s.op.lanes)) for (const o of N.options(s, lane)) for (const c of o.candidates) if (c.ok) moves.push([o.approach.id, c.id, c.risk]);
      if (!moves.length) { N.retreat(s); break; }
      moves.sort((a, b) => a[2] - b[2]);
      N.act(s, moves[0][0], moves[0][1]);
    }
    return s;
  }
  // 打到贏為止：每次換一個亂數（狀態可以直接複製）。prep 在出發前改狀態。
  function win(s, key, prep, squad) {
    for (let k = 0; k < 40; k++) {
      const c = JSON.parse(JSON.stringify(s));
      c.step += k * 13;
      if (prep) prep(c);
      if (!N.pickOp(c, key)) return null;
      const team = squad || c.roster.members.filter((m) => m.status === 'active').map((m) => m.person.id).slice(0, 3);
      if (!N.launch(c, team)) return null;
      runOp(c);
      if (c.phase === 'result' && c.result.outcome === 'win') return c;
    }
    return null;
  }
  const force = (id) => (c) => { c.jobs = [{ id, district: c.district, until: c.dnight }]; };
  const text = (s) => { for (const l of LANGS) { E.i18n.set(l); const x = render(s.log).join('\n'); if (unresolved(x)) return x; } return null; };

  // 1. 每天早上有兩件，出現在今晚的行動裡；同一個種子永遠一樣；抽機會不會動到其他亂數。
  {
    const s = start('jobs-offer');
    if (s.jobs.length !== N.JOBS || new Set(s.jobs.map((j) => j.id)).size !== N.JOBS) fail(`jobs: ${s.jobs.length} opportunities on the first day`);
    for (const j of s.jobs) {
      const e = N.ops(s).find((x) => x.key === 'job:' + j.id);
      if (!e || e.kind !== 'job' || e.stages.join() !== J[j.id].stages.join() || e.jobLeft !== N.JOB_NIGHTS) fail(`jobs: ${j.id} is not offered properly`);
    }
    if (JSON.stringify(start('jobs-offer').jobs) !== JSON.stringify(s.jobs)) fail('jobs: the same seed gave different opportunities');
    const step = s.step;
    s.jobs = [];
    N.refreshJobs(s);
    if (s.step !== step) fail('jobs: rolling the opportunities used up the main dice');
  }
  // 2. 出現的條件：沒人評分高就沒有洗評分、熱度低就沒有假線索、主線還沒開就沒有部署圖、康登沒有護送。
  {
    const s = start('jobs-need');
    const seen = new Set();
    const calm = new Set();
    for (let d = 1; d <= 40; d++) {
      s.dnight = d;
      s.jobs = [];
      s.heat = 10;
      s.roster.members.forEach((m) => { m.threat = 0; });
      s.mains.m2 = d % 2 ? 'done' : undefined;
      N.refreshJobs(s);
      s.jobs.forEach((j) => calm.add(j.id));
      if (s.jobs.some((j) => j.id === 'intel') && (d < N.MAIN_NIGHT || s.mains.m2 === 'done')) fail('jobs: a plan for a main mission that is not on');
      s.jobs = [];
      s.heat = 50;
      s.roster.members[0].threat = 40;
      N.refreshJobs(s);
      s.jobs.forEach((j) => seen.add(j.id));
    }
    for (const id of ['erase', 'trail']) if (calm.has(id)) fail(`jobs: ${id} turned up when nobody needed it`);
    for (const id of ['erase', 'trail', 'intel', 'convoy', 'meds', 'mural', 'tap']) if (!seen.has(id)) fail(`jobs: ${id} never turned up in 40 days`);
    if (seen.has('evac') || calm.has('evac')) fail('jobs: an evacuation in Camden');
  }
  // 3. 留兩晚就沒了；出發過一次（撤退也算）就沒了。
  {
    const s = start('jobs-expire');
    const first = s.jobs[0];
    s.result = { outcome: 'rest' };
    s.phase = 'result';
    for (let d = 0; d < N.JOB_NIGHTS; d++) { s.phase = 'result'; s.result = { outcome: 'rest' }; N.nextDay(s); if (s.day) s.day.event = null; s.tonight = null; }
    if (s.jobs.some((j) => j.until < s.dnight) || s.jobs.some((j) => j.id === first.id && j.until === first.until)) fail('jobs: an opportunity outstayed its nights');
    s.jobs = [{ id: 'mural', district: s.district, until: s.dnight + 1 }];
    N.pickOp(s, 'job:mural');
    N.launch(s, [s.hero]);
    N.retreat(s);
    if (s.jobs.length || N.ops(s).some((e) => e.op === 'job')) fail('jobs: an opportunity was still there after the team went');
  }
  // 4. 每一件都打得完，好處也照說明給。
  {
    const s = start('jobs-win');
    s.dnight = 2;
    const [a, b, c, d, e] = s.roster.members.map((m) => m.person.id);
    const squad = [a, b, c];
    const done = {};
    // 器材：兩份，之後每次出門自動帶一份。
    done.convoy = win(s, 'job:convoy', force('convoy'), squad);
    if (done.convoy) {
      const w = done.convoy;
      if (w.gear !== 2) fail(`jobs convoy: ${w.gear} gear`);
      w.phase = 'day'; w.result = null;
      // 隊上沒有人會駭入：器材留到下次。
      const idle = JSON.parse(JSON.stringify(w));
      for (const id of squad) N.person(idle, id).skills.hack = 0;
      N.pickOp(idle, 'broadcast');
      if (N.gearGoes(idle, squad, false)) fail('jobs convoy: a squad with no hacker would take the gear');
      N.launch(idle, squad);
      if (idle.gear !== 2 || idle.op.bw !== N.BANDWIDTH || idle.log.some((x) => x.k === 's2.log.gearUsed')) fail('jobs convoy: gear was spent on a squad with no hacker');
      N.pickOp(w, 'broadcast');
      N.launch(w, squad);
      if (w.gear !== 1 || w.op.bw !== N.BANDWIDTH + 1 || !w.log.some((x) => x.k === 's2.log.gearUsed')) fail('jobs convoy: the gear did not go out with the next operation');
    }
    // 洗評分：沒出門的人也洗掉。
    done.erase = win(s, 'job:erase', (w) => { force('erase')(w); w.roster.members.forEach((m) => { m.threat = 40; }); }, squad);
    if (done.erase && E.roster.get(done.erase.roster, d).threat !== 40 - J.erase.reward.wipe) fail(`jobs erase: threat ${E.roster.get(done.erase.roster, d).threat} instead of ${40 - J.erase.reward.wipe}`);
    // 搶藥：在家養傷的人早一晚好，重傷的也脫離危險。
    done.meds = win(s, 'job:meds', (w) => { force('meds')(w); E.roster.injure(w.roster, e, 3); E.roster.get(w.roster, e).critical = 2; }, squad);
    if (done.meds) {
      const m = E.roster.get(done.meds.roster, e);
      if (m.injuredFor !== 2 || m.critical) fail(`jobs meds: injured ${m.injuredFor} nights, critical ${m.critical}`);
      if (done.meds.result.support < J.meds.reward.support) fail('jobs meds: no support');
    }
    done.mural = win(s, 'job:mural', force('mural'), squad);
    if (done.mural && done.mural.result.support < J.mural.reward.support) fail('jobs mural: no support');
    // 假線索：熱度 −15（行動本身的警戒照算）。
    done.trail = win(s, 'job:trail', (w) => { force('trail')(w); w.heat = 40; }, squad);
    if (done.trail && done.trail.result.heat !== Math.round(done.trail.result.alert / 5) - J.trail.reward.cool) fail(`jobs trail: heat ${done.trail.result.heat}`);
    // 監聽：接下來三個早上比較不會被反擊。
    done.tap = win(s, 'job:tap', force('tap'), squad);
    if (done.tap && done.tap.tap !== done.tap.night + J.tap.reward.tap) fail('jobs tap: not listening for the right nights');
    done.evac = win(s, 'job:evac', force('evac'), squad);
    if (done.evac && done.evac.result.heat >= Math.round(done.evac.result.alert / 5)) fail('jobs evac: heat did not go down');
    // 部署圖：這一區的主線任務每一段起始警戒 −10、知道另一條路，打完主線就用掉了。
    done.intel = win(s, 'job:intel', force('intel'), squad);
    if (done.intel) {
      const w = done.intel;
      if (w.intel !== 'm2') fail(`jobs intel: a plan for ${w.intel}`);
      w.phase = 'day'; w.result = null; w.heat = 30;
      const main = N.ops(w).find((x) => x.key === 'main');
      if (!main || !main.planned) fail('jobs intel: the main mission does not show the plan');
      N.pickOp(w, 'main');
      const planned = N.startAlert(w, squad);
      w.intel = null;
      if (N.startAlert(w, squad) - planned !== 10) fail('jobs intel: the plan did not lower the starting alert by 10');
      N.cancel(w);
      w.intel = 'm2';
      const m = win(w, 'main', null, squad);
      if (!m) fail('jobs intel: could not win the main mission');
      else {
        if (m.intel !== null) fail('jobs intel: the plan was still there after the main mission');
        if (m.log.filter((x) => x.k === 's2.log.planned').length < 1) fail('jobs intel: the plan was never used');
      }
      w.intel = 'm2';
      N.pickOp(w, 'main');
      N.launch(w, squad, {}, 'tac');
      if (!w.op.tac || !w.op.tac.intel || !w.log.some((x) => x.k === 'tac.log.intelPlan')) fail('jobs intel: patrol routes not visible on the map');
    }
    for (const id of Object.keys(J)) {
      if (!done[id]) { fail(`jobs ${id}: never won in 40 tries`); continue; }
      const bad = text(done[id]);
      if (bad) fail(`jobs ${id}: unresolved ${(bad.match(/⟦[^⟧]+⟧|\{\w+\}/g) || []).join(' ')}`);
    }
  }
  // 5. 監聽的時候，反擊真的比較少。
  {
    let open = 0, tapped = 0;
    for (let i = 0; i < 150; i++) {
      for (const tap of [false, true]) {
        const s = start('jobs-tap-' + i);
        s.dnight = 4;
        s.night = 4;
        if (tap) s.tap = 6;
        s.phase = 'result';
        s.result = { outcome: 'rest' };
        N.nextDay(s);
        if (s.tonight) { if (tap) tapped++; else open++; }
        if (tap && !s.log.some((x) => x.k === 's2.log.tapOn')) fail('jobs tap: no word from the radio');
      }
    }
    if (tapped >= open * 0.75) fail(`jobs tap: ${tapped} counter-attacks while listening, ${open} without`);
  }
  E.i18n.set('zh-Hant');
  console.log(`${Object.keys(J).length} opportunities: offered, conditions, expiry, one try only, rewards (gear, scores, medicine, heat, radio tap, main mission plan)`);
}

// ===== 7f. 第三季《零時差》：測試寫在 tools/check-s3.js =====
require('./check-s3.js')({ sandbox, fail, section, storage, root });

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

// ===== 目標清單：第一章、第二章（第一季）和主線任務一、二（第二季）的每個場景都打到過，而且翻得出來 =====
section('目標清單');
{
  const want = ['present.chinatown.street', 'present.chinatown.teahouse', 'memory.homan.hub', 'memory.homan.embankment', 'memory.homan.flat',
    's2.m1.laundrette', 's2.m1.alley', 's2.m1.basement', 's2.m1.canal',
    's2.m2.street', 's2.m2.fence', 's2.m2.yard', 's2.m2.tower', 's2.m2.escape', 's2.m2.home'];
  for (const id of want) if (!goalScenes.has(id)) fail(`goals: ${id} has no goal list, or no route reached it`);
  console.log(`${goalScenes.size} scenes with goals checked after every command`);
}

console.log(`\n${problems ? problems + ' problem(s)' : 'All checks passed'}`);
process.exit(problems ? 1 : 0);
