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
  // desc 是快速結算的效果，tac 是戰術地圖上的效果。
  const gifts = {
    // 扳手自己改的工程無人機：負責拆東西和搬重物，不是拿來引開人的。
    sergei: {
      kind: 'active', effect: 'sergei',
      name: n('Sergei', '謝爾蓋', '谢尔盖'),
      desc: n("Wrench's custom construction drone does the heavy work: +15% success for the whole team on this stage, and this person can try physical approaches without the strength for them.", '扳手自己改的工程無人機包辦粗活：這一關全隊成功率 +15%，這個人也能試需要力氣的解法。', '扳手自己改的工程无人机包办粗活：这一关全队成功率 +15%，这个人也能试需要力气的解法。'),
      tac: n('Card: send Sergei to a locked door or a stretch of fence within 6 squares (walls do not stop it). It takes it apart without a sound (1 AP).', '卡：派謝爾蓋去六格內上鎖的門或一段圍欄（牆擋不住它），不出聲地拆掉（1 點）。', '卡：派谢尔盖去六格内上锁的门或一段围栏（墙挡不住它），不出声地拆掉（1 点）。'),
    },
    quietstep: {
      kind: 'passive', effect: 'quietstep',
      name: n('Soft steps', '無聲的腳步', '无声的脚步'),
      desc: n("Darcy's lesson: every action raises 2 less alert.", 'Darcy 教的：每個動作少 2 點警戒。', 'Darcy 教的：每个动作少 2 点警戒。'),
      tac: n('Never makes a sound, and guards and cameras have to come 1 square closer to notice.', '做什麼都不會發出聲音；守衛和攝影機要再近一格才會發現。', '做什么都不会发出声音；守卫和摄像头要再近一格才会发现。'),
    },
    // 扳手的第二件禮物：謝爾蓋拆得了門，拆不了無人機。一次行動只能用一次，而且很大聲。
    hammer: {
      kind: 'active', effect: 'hammer',
      name: n("Wrench's Hammer", '扳手的鐵鎚', '扳手的铁锤'),
      desc: n('Smash first, ask later: alert −10, and this person can try physical approaches without the strength for them.', '先砸再說：警戒 −10，這個人也能試需要力氣的解法。', '先砸再说：警戒 −10，这个人也能试需要力气的解法。'),
      tac: n('Card: smash a guard from any side, or a drone, on the next square. Noise carries 3 squares (1 AP).', '卡：砸倒旁邊的守衛（正面也行）或無人機。聲音傳 3 格（1 點）。', '卡：砸倒旁边的守卫（正面也行）或无人机。声音传 3 格（1 点）。'),
    },
    // Darcy 的偵察無人機：看得遠，必要的時候自爆放短距離電磁脈衝。
    eagle: {
      kind: 'active', effect: 'eagle',
      name: n('Eagle Drone', '老鷹無人機', '老鹰无人机'),
      desc: n("Darcy's scout drone goes on ahead: the first stage's hidden approach is known from the start. Card: it self-destructs for alert −15, and +15% success for the whole team on this stage.", 'Darcy 的偵察無人機先飛出去：第一關的隱藏解法一開始就知道。卡：讓它自爆，警戒 −15，這一關全隊成功率 +15%。', 'Darcy 的侦察无人机先飞出去：第一关的隐藏解法一开始就知道。卡：让它自爆，警戒 −15，这一关全队成功率 +15%。'),
      tac: n('Patrol routes are visible while this person is on the map. Card: fly it to an enemy within 6 squares and self-destruct: a short-range EMP knocks out guards, dogs, cameras and drones within 2 squares for 2 turns (1 AP).', '這個人在地圖上時看得到巡邏路線。卡：飛去六格內的敵人再自爆，短距離電磁脈衝讓兩格內的守衛、狗、攝影機、無人機停擺兩回合（1 點）。', '这个人在地图上时看得到巡逻路线。卡：飞去六格内的敌人再自爆，短距离电磁脉冲让两格内的守卫、狗、摄像头、无人机停摆两回合（1 点）。'),
    },
    focus: {
      kind: 'active', effect: 'focus',
      name: n('Focus', '專注', '专注'),
      desc: n("Aiden's lesson: this person's next action is 30% more likely to work.", '艾登教的：這個人下一個動作的成功率 +30%。', '艾登教的：这个人下一个动作的成功率 +30%。'),
      tac: n('Card: time seems to slow down. +2 AP this turn (free).', '卡：時間像是慢了下來，這一回合多 2 點行動點（不花行動點）。', '卡：时间像是慢了下来，这一回合多 2 点行动点（不花行动点）。'),
    },
    blackout: {
      kind: 'active', effect: 'blackout',
      name: n('Blackout', '大停電', '大停电'),
      desc: n("Aiden's old trick: alert −25, but heat +5, because everyone knows someone touched the grid.", '艾登的老把戲：警戒 −25，但全區都知道有人動過電網，熱度 +5。', '艾登的老把戏：警戒 −25，但全区都知道有人动过电网，热度 +5。'),
      tac: n('Card: every camera and drone on the map goes down for 3 turns, and every guard and dog stands still for 1 turn. Heat +5 (1 AP).', '卡：全圖的攝影機和無人機停擺三回合，守衛和狗愣住一回合。熱度 +5（1 點）。', '卡：全图的摄像头和无人机停摆三回合，守卫和狗愣住一回合。热度 +5（1 点）。'),
    },
    mask: {
      kind: 'active', effect: 'mask',
      name: n('Second Face', '第二張臉', '第二张脸'),
      desc: n('The mask from behind the blue door: this person\'s next action raises no alert.', '藍色的門後面拿到的面具：這個人下一個動作不增加警戒。', '蓝色的门后面拿到的面具：这个人下一个动作不增加警戒。'),
      tac: n('Card: for 3 turns guards only notice this person up close, and cannot make an arrest (1 AP).', '卡：三回合內守衛要貼身才認得出來，也抓不了人（1 點）。', '卡：三回合内守卫要贴身才认得出来，也抓不了人（1 点）。'),
    },
    baton: {
      kind: 'active', effect: 'baton',
      name: n('Baton Pass', '接力', '接力'),
      desc: n('Hand over mid-move: +15% success for the whole team on this stage.', '動作做到一半交給隊友：這一關全隊成功率 +15%。', '动作做到一半交给队友：这一关全队成功率 +15%。'),
      tac: n('Card: hand all your remaining AP, plus 1, to a teammate within 2 squares (free).', '卡：把剩下的行動點全交給兩格內的隊友，再多 1 點（不花行動點）。', '卡：把剩下的行动点全交给两格内的队友，再多 1 点（不花行动点）。'),
    },
  };

  // ===== 隊友事件 =====
  // who(q) 回傳事件裡的人（[name, other]），沒有合適的人就回傳 null。q 由引擎提供（見 js/engine/days.js 的 query）。
  // once：整輪只發生一次；from：第幾晚起才會發生；after：要先發生過哪一件事；weight：權重。
  // cameo：事件卡上的頭像（客串角色，見 js/ui/art.js）；sound：跳出來時的音效（預設客串角色是 cameo，其他是 event）。
  // choices：slot 會佔掉一個時段；p 是成功的機率（有 p 的話，成功用 ok、失敗用 bad，沒有的話用 fx）。
  // 效果（引擎照順序執行）：['bond', i, j, n] 交情、['bondAll', i, n] 和在家的每個人、['hurt', i, 晚數] 受傷、
  // ['support', n]、['heat', n]、['threat', i, n]、['gift', i, 天賦]、['train', i, n] 練弱點、['quirk', i, 舊, 新] 換小習慣、
  // ['send'] 介紹一個路人來（不用出任務就能加入）、['tap', 晚數] 這幾晚比較不會被反擊、['rest'] 大家去睡（白天的時段全沒了）、['hour'] 今天多一個時段。
  // 文字：s2.dev.<id>.title／text／<選項>，結果是 s2.dev.<id>.<選項>Done（或 Ok／Bad）。
  const club = (q, id) => (q.quirks(id).includes('liverpool') ? 'liverpool' : q.quirks(id).includes('man_utd') ? 'man_utd' : null);
  // 教技能：挑還沒有這個天賦、最適合的人；天賦越多的人越後面，大家輪流學。
  const teach = (gift, score) => (q) => { const x = q.best(q.home.filter((id) => q.lacks(id, gift)), (id) => score(q, id) - 4 * q.gifts(id)); return x ? [x] : null; };
  const hacker = (q, id) => q.skill(id, 'hack') * 2 + (q.cat(id) === 'hacker' ? 3 : 0);
  const fit = (q, id) => q.skill(id, 'physical') * 2 + (q.cat(id) === 'physical' ? 3 : 0);
  const talker = (q, id) => q.skill(id, 'social') * 2 + (q.cat(id) === 'social' ? 3 : 0);
  const anyone = (q) => (q.home.length ? [q.pick(q.home)] : null);
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
    { id: 'wrench', cameo: 'wrench', weight: 2, once: true, from: 3,
      who: teach('sergei', hacker),
      choices: [{ id: 'take', slot: true, fx: [['gift', 0, 'sergei']] }, { id: 'pass', fx: [] }] },
    { id: 'darcy', cameo: 'darcy', weight: 2, once: true, from: 4,
      who: teach('quietstep', fit),
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

    // ----- 看門狗的客人：每個人可以有好幾件事，教的東西都不一樣 -----
    { id: 'wrench_tv', cameo: 'wrench', weight: 2, once: true, from: 6, after: 'wrench',
      who: anyone,
      choices: [{ id: 'thanks', fx: [['heat', -8]] }] },
    { id: 'wrench_hammer', cameo: 'wrench', weight: 2, once: true, from: 9, after: 'wrench',
      who: teach('hammer', fit),
      choices: [{ id: 'take', slot: true, fx: [['gift', 0, 'hammer']] }, { id: 'pass', fx: [] }] },
    { id: 'darcy_eagle', cameo: 'darcy', weight: 2, once: true, from: 7, after: 'darcy',
      who: teach('eagle', (q, id) => q.skill(id, 'hack') + q.skill(id, 'physical')),
      choices: [{ id: 'take', slot: true, fx: [['gift', 0, 'eagle']] }, { id: 'pass', fx: [] }] },
    { id: 'aiden_focus', cameo: 'aiden', weight: 2, once: true, from: 8,
      who: teach('focus', hacker),
      choices: [{ id: 'learn', slot: true, fx: [['gift', 0, 'focus']] }, { id: 'pass', fx: [] }] },
    { id: 'aiden_blackout', cameo: 'aiden', weight: 2, once: true, from: 14, after: 'aiden_focus',
      who: teach('blackout', hacker),
      choices: [{ id: 'learn', slot: true, fx: [['gift', 0, 'blackout']] }, { id: 'pass', fx: [] }] },
    { id: 'marcus', cameo: 'marcus', weight: 2, once: true, from: 8,
      who: anyone,
      choices: [{ id: 'yes', fx: [['send']] }, { id: 'no', fx: [] }] },

    // ----- 白天的奇遇 -----
    { id: 'blue_door', cameo: 'bluedoor', sound: 'dream', weight: 2, once: true, from: 6,
      who: teach('mask', talker),
      choices: [{ id: 'enter', slot: true, fx: [['gift', 0, 'mask']] }, { id: 'leave', fx: [] }] },
    { id: 'cafe', weight: 2,
      who: (q) => q.pair(q.home, (a, b) => !q.rel(a, b, 'rival')),
      choices: [{ id: 'stay', slot: true, fx: [['bond', 0, 1, 2], ['threat', 0, -3], ['threat', 1, -3]] }, { id: 'go', fx: [] }] },
    { id: 'cat', cameo: 'cat', weight: 1, from: 5,
      who: anyone,
      choices: [{ id: 'sleep', fx: [['rest']] }, { id: 'ignore', fx: [] }] },
    { id: 'calling', cameo: 'card', weight: 2, perDistrict: true, from: 3,
      who: (q) => { const x = q.mainOpen && q.best(q.up, (id) => talker(q, id)); return x ? [x] : null; },
      choices: [{ id: 'send', slot: true, fx: [['support', 6], ['heat', 8]] }, { id: 'no', fx: [] }] },
    { id: 'rank', weight: 3, once: true,
      who: (q) => q.pair(q.up, (a, b) => q.rel(a, b, 'friend') && q.lacks(a, 'baton')),
      choices: [{ id: 'ok', fx: [['bond', 0, 1, 1], ['gift', 0, 'baton']] }] },
    { id: 'fortune', cameo: 'tarot', weight: 1, perDistrict: true, from: 4,
      who: anyone,
      choices: [{ id: 'listen', fx: [['tap', 2]] }, { id: 'pass', fx: [] }] },
    { id: 'dark_hour', cameo: 'moon', sound: 'dream', weight: 2, once: true, from: 5,
      who: anyone,
      choices: [{ id: 'use', fx: [['hour']] }] },
    { id: 'white_dog', cameo: 'dog', weight: 2, once: true, from: 4,
      who: (q) => { const x = q.pick(q.up.filter((id) => !q.quirks(id).includes('dogs_love') && !q.quirks(id).includes('dogs_fear') && q.quirks(id).length <= 2)); return x ? [x] : null; },
      choices: [{ id: 'stay', slot: true, fx: [['quirk', 0, null, 'dogs_love']] }, { id: 'go', fx: [] }] },
    { id: 'midnight_tv', cameo: 'tv', sound: 'dream', weight: 2, from: 4,
      who: (q) => q.pair(q.home, (a, b) => q.trainable(b) && !q.rel(a, b, 'rival')),
      choices: [{ id: 'tell', slot: true, fx: [['bond', 0, 1, 1], ['train', 1, 2]] }, { id: 'keep', fx: [] }] },
    { id: 'beef_bowl', weight: 2, perDistrict: true,
      who: (q) => (q.up.length ? [q.pick(q.up)] : null),
      choices: [{ id: 'try', slot: true, p: 0.5, ok: [['support', 3], ['bondAll', 0, 1]], bad: [['hurt', 0, 1]] }, { id: 'pass', fx: [] }] },
    { id: 'bear', cameo: 'bear', weight: 1, once: true, from: 4,
      who: anyone,
      choices: [{ id: 'take', fx: [['heat', -4], ['support', 2]] }] },
  ];

  S2.days = { SLOTS: ['morning', 'noon', 'evening'], activities, interests, training, gifts, events };
})(window.ECHO = window.ECHO || {});
