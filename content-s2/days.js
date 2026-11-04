// 第二季的白天：早上、中午、傍晚三個時段（晚上才出去行動）。
// 每個時段可以安排一件事：一起混、練習克服弱點、照顧傷員、幫街坊、踩點、開派對。
// 每天早上可能發生一件隊友之間的事（events）：有的要選怎麼處理，有的會佔掉一個時段。
// 規則在 js/engine/days.js；文字都在 content-s2/days-locales.js（key 是 s2.day.* 和 s2.dev.*）。
(function (E) {
  const S2 = (E.s2 = E.s2 || {});
  const n = (en, tc, sc) => ({ en, tc, sc: sc || tc });

  // 白天的安排。people：要選幾個人（train 的第二個人是教練，可以不選）。
  // daily：一天只能做一次；evening：只能在傍晚；every：隔幾天才能再做一次。
  const activities = [
    { id: 'hang', people: 2 },
    { id: 'train', people: 1, coach: true, daily: true },
    { id: 'care', people: 2, daily: true },
    { id: 'neighbours', people: 1, daily: true },
    { id: 'scout', people: 1, daily: true },
    { id: 'party', people: 0, evening: true, every: 3 },
  ];

  // 兩個人都有的小習慣：一起混的時候多加一點交情，也有自己的一句話（s2.day.hang.<id>）。
  const interests = ['liverpool', 'man_utd', 'cantonese', 'mahjong', 'tea', 'gamer', 'choir', 'marathon', 'dogs_love', 'cyclist', 'knitting', 'birdwatcher', 'night_shift', 'smoker'];

  // 練得掉的弱點：need 要練幾次；coach 是誰教得最好（專長、特質、類別），好教練一次算兩次。
  // solo 為 false 的弱點一定要有人陪著練（有前科要律師處理）。
  const training = {
    acrophobia: { need: 4, coach: { perks: ['climb', 'rooftops'], cats: ['physical'] } },
    dark: { need: 4, coach: { traits: ['calm', 'nightowl'] } },
    no_sense: { need: 4, coach: { perks: ['getaway', 'building_access'], traits: ['memory', 'driver'] } },
    allergic: { need: 4, coach: { perks: ['heal'] } },
    honest: { need: 4, coach: { perks: ['disguise'], traits: ['silver'] } },
    nervous: { need: 5, coach: { traits: ['calm'] } },
    phone: { need: 5, coach: { traits: ['careful'] } },
    clumsy: { need: 5, coach: { perks: ['lockpick'], traits: ['nimble'] } },
    hothead: { need: 5, coach: { traits: ['calm', 'silver'] } },
    loudmouth: { need: 5, coach: { traits: ['careful', 'unremarkable'] } },
    bad_knees: { need: 5, coach: { perks: ['heal', 'sprint'] } },
    record: { need: 5, solo: false, coach: { perks: ['bail'] } },
  };

  // 天賦：隊友事件送的特殊能力，像特質一樣是一張卡。kind／effect 和特質的卡一樣由引擎實作。
  const gifts = {
    sergei: {
      kind: 'active', effect: 'sergei',
      name: n('Call Sergei', '召喚謝爾蓋', '召唤谢尔盖'),
      desc: n("Wrench's little drone buzzes the patrol: alert −15, and +15% success for the whole team on this stage.", '扳手的小無人機飛去鬧巡邏隊：警戒 −15，這一關全隊成功率 +15%。', '扳手的小无人机飞去闹巡逻队：警戒 −15，这一关全队成功率 +15%。'),
      tac: n('Card: send Sergei at a guard or camera within 6 squares (walls do not stop it). Guards within 2 squares of it watch it for 2 turns; cameras there switch off (1 AP).', '卡：讓謝爾蓋飛去六格內的守衛或攝影機（牆擋不住它）。附近兩格的守衛盯著它看兩回合，攝影機關機兩回合（1 點）。', '卡：让谢尔盖飞去六格内的守卫或摄像头（墙挡不住它）。附近两格的守卫盯着它看两回合，摄像头关机两回合（1 点）。'),
    },
    quietstep: {
      kind: 'passive', effect: 'quietstep',
      name: n('Soft steps', '無聲的腳步', '无声的脚步'),
      desc: n("Darcy's lesson: every action raises 2 less alert.", 'Darcy 教的：每個動作少 2 點警戒。', 'Darcy 教的：每个动作少 2 点警戒。'),
      tac: n('Never makes a sound, and guards and cameras have to come 1 square closer to notice.', '做什麼都不會發出聲音；守衛和攝影機要再近一格才會發現。', '做什么都不会发出声音；守卫和摄像头要再近一格才会发现。'),
    },
  };

  // ===== 隊友事件 =====
  // who(q) 回傳事件裡的人（[name, other]），沒有合適的人就回傳 null。q 由引擎提供（見 js/engine/days.js 的 query）。
  // once：整輪只發生一次；from：第幾晚起才會發生；weight：權重。
  // choices：slot 會佔掉一個時段；p 是成功的機率（有 p 的話，成功用 ok、失敗用 bad，沒有的話用 fx）。
  // 效果（引擎照順序執行）：['bond', i, j, n] 交情、['bondAll', i, n] 和在家的每個人、['hurt', i, 晚數] 受傷、
  // ['support', n]、['heat', n]、['threat', i, n]、['gift', i, 天賦]、['train', i, n] 練弱點、['quirk', i, 舊, 新] 換小習慣。
  // 文字：s2.dev.<id>.title／text／<選項>，結果是 s2.dev.<id>.<選項>Done（或 Ok／Bad）。
  const club = (q, id) => (q.quirks(id).includes('liverpool') ? 'liverpool' : q.quirks(id).includes('man_utd') ? 'man_utd' : null);
  const events = [
    { id: 'match', weight: 3,
      who: (q) => q.pair(q.up, (a, b) => club(q, a) && club(q, a) === club(q, b)),
      vars: (q, [a]) => ({ club: q.quirkName(club(q, a)) }),
      choices: [{ id: 'go', slot: true, fx: [['bond', 0, 1, 2], ['heat', 1]] }, { id: 'skip', fx: [['bond', 0, 1, 1]] }] },
    { id: 'derby', weight: 3,
      who: (q) => {
        const reds = q.home.filter((x) => club(q, x) === 'man_utd');
        const kop = q.home.filter((x) => club(q, x) === 'liverpool');
        return reds.length && kop.length ? [reds[0], kop[0]] : null;
      },
      choices: [{ id: 'step', slot: true, p: 0.7, ok: [['bond', 0, 1, 1]], bad: [['hurt', 1, 1], ['bond', 0, 1, -2]] },
        { id: 'leave', fx: [['hurt', 1, 2], ['bond', 0, 1, -3]] }] },
    { id: 'wrench', weight: 2, once: true, from: 3,
      who: (q) => { const x = q.best(q.home.filter((id) => !q.gifted(id)), (id) => q.skill(id, 'hack') * 2 + (q.cat(id) === 'hacker' ? 3 : 0)); return x ? [x] : null; },
      choices: [{ id: 'take', slot: true, fx: [['gift', 0, 'sergei']] }, { id: 'pass', fx: [] }] },
    { id: 'darcy', weight: 2, once: true, from: 4,
      who: (q) => { const x = q.best(q.home.filter((id) => !q.gifted(id)), (id) => q.skill(id, 'physical') * 2 + (q.cat(id) === 'physical' ? 3 : 0)); return x ? [x] : null; },
      choices: [{ id: 'learn', slot: true, fx: [['gift', 0, 'quietstep']] }, { id: 'pass', fx: [] }] },
    { id: 'birthday', weight: 2,
      who: (q) => { if (q.home.length < 2) return null; const a = q.pick(q.home); return [a, q.pick(q.home.filter((x) => x !== a))]; },
      choices: [{ id: 'party', slot: true, fx: [['bondAll', 0, 1], ['heat', 2]] }, { id: 'cake', fx: [['bond', 0, 1, 1]] }] },
    { id: 'exes', weight: 3,
      who: (q) => q.pair(q.home, (a, b) => q.rel(a, b, 'ex')),
      choices: [{ id: 'talk', slot: true, p: 0.6, ok: [['bond', 0, 1, 2]], bad: [['bond', 0, 1, -1]] }, { id: 'leave', fx: [] }] },
    { id: 'soup', weight: 1, perDistrict: true,
      who: (q) => (q.home.length ? [q.pick(q.home)] : null),
      choices: [{ id: 'thanks', fx: [['support', 2]] }] },
    { id: 'dog', weight: 3,
      who: (q) => { const x = q.home.find((id) => q.quirks(id).includes('dogs_fear')); return x ? [x] : null; },
      choices: [{ id: 'befriend', slot: true, fx: [['quirk', 0, 'dogs_fear', 'dogs_love']] }, { id: 'shoo', fx: [] }] },
    { id: 'cook', weight: 2,
      who: (q) => (q.home.length >= 2 ? [q.pick(q.home)] : null),
      choices: [{ id: 'eat', fx: [['bondAll', 0, 1]] }] },
    { id: 'chores', weight: 2,
      who: (q) => q.pair(q.home, (a, b) => !q.rel(a, b, 'friend') && !q.rel(a, b, 'family')),
      choices: [{ id: 'rota', slot: true, fx: [['bond', 0, 1, 1]] }, { id: 'ignore', fx: [['bond', 0, 1, -1]] }] },
    { id: 'knock', weight: 3, minHeat: 35,
      who: (q) => { const x = q.best(q.up, (id) => q.skill(id, 'social') + (q.cat(id) === 'social' ? 2 : 0)); return x ? [x] : null; },
      choices: [{ id: 'talk', p: 0.75, ok: [['heat', -5]], bad: [['heat', 5], ['threat', 0, 10]] }, { id: 'hide', slot: true, fx: [] }] },
    { id: 'mentor', weight: 3,
      who: (q) => {
        const vet = q.best(q.up.filter((id) => q.wins(id) >= 2), (id) => q.wins(id));
        const pupil = vet && q.pick(q.home.filter((id) => id !== vet && q.trainable(id)));
        return vet && pupil ? [vet, pupil] : null;
      },
      vars: (q, [, b]) => ({ flaw: q.flawName(b) }),
      choices: [{ id: 'teach', slot: true, fx: [['train', 1, 2], ['bond', 0, 1, 1]] }, { id: 'later', fx: [] }] },
    { id: 'canal', weight: 2,
      who: (q) => { const x = q.home.find((id) => q.flaw(id) === 'phone'); return x ? [x] : null; },
      choices: [{ id: 'oops', fx: [['train', 0, 1]] }] },
    { id: 'yumcha', weight: 3,
      who: (q) => q.pair(q.up, (a, b) => q.quirks(a).includes('cantonese') && q.quirks(b).includes('cantonese')),
      choices: [{ id: 'go', slot: true, fx: [['bond', 0, 1, 2], ['support', 1]] }, { id: 'skip', fx: [] }] },
    { id: 'nightjob', weight: 1,
      who: (q) => { const x = q.pick(q.up.filter((id) => !q.quirks(id).includes('night_shift') && q.quirks(id).length <= 2)); return x ? [x] : null; },
      choices: [{ id: 'take', slot: true, fx: [['quirk', 0, null, 'night_shift']] }, { id: 'skip', fx: [] }] },
  ];

  S2.days = { SLOTS: ['morning', 'noon', 'evening'], activities, interests, training, gifts, events };
})(window.ECHO = window.ECHO || {});
