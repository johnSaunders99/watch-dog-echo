// 第三季《零時差》的資料表：武器、敵人、可駭入的設施、漏洞（升級）、裝備、房間狀況、區段、事件、永久強化。
// 這裡只有數字和 id，沒有任何文字；名稱和說明在 content-s3/locales.js，key 由 id 組出來（例如 s3.ex.chain.n）。
// 規則在 js/s3/sim.js（戰鬥）、js/s3/gen.js（房間生成）、js/s3/run.js（一整趟的流程）。
(function (E) {
  const S3 = (E.s3 = E.s3 || {});

  // ===== 武器 =====
  // dmg 每發傷害、rate 每秒幾發、mag 彈匣、reload 換彈秒數、speed 子彈速度、spread 散布（弧度）、pellets 一次幾顆、
  // range 射程、noise 槍聲傳多遠、sneak 打到還沒發現你的敵人時的傷害倍率、stunEvery 每幾發電擊一次。
  const weapons = {
    pistol: { dmg: 10, rate: 4.2, mag: 12, reload: 1.1, speed: 950, spread: 0.03, pellets: 1, range: 900, noise: 420, sneak: 2 },
    taser: { dmg: 8.5, rate: 3.3, mag: 9, reload: 1.2, speed: 900, spread: 0.02, pellets: 1, range: 800, noise: 260, sneak: 2, stunEvery: 3, stun: 0.8 },
    shotgun: { dmg: 6.5, rate: 1.35, mag: 5, reload: 1.5, speed: 860, spread: 0.24, pellets: 6, range: 430, noise: 520, sneak: 2, knock: 130 },
    nailgun: { dmg: 5, rate: 8, mag: 30, reload: 1.6, speed: 880, spread: 0.07, pellets: 1, range: 760, noise: 300, sneak: 2, pierce: 1 },
    silenced: { dmg: 11, rate: 3.4, mag: 10, reload: 1.1, speed: 950, spread: 0.02, pellets: 1, range: 900, noise: 0, sneak: 3 },
  };
  // 職業分類決定武器；少數職業有自己的。
  const weaponByCategory = { hacker: 'taser', physical: 'shotgun', social: 'silenced', specialist: 'pistol' };
  const weaponByJob = { builder: 'nailgun', locksmith: 'nailgun', drone_op: 'pistol', parkour: 'pistol' };

  // ===== 能力值 =====
  // addStats 裡的能力用加的，其他用乘的（每疊一層再乘一次）。
  const baseStats = {
    maxHp: 80, speed: 250, bwMax: 4, bwRegen: 0.4, hackRange: 480, focusMax: 100, focusRegen: 5,
    dashCd: 1.2, dashCharges: 1, dashLen: 1, dmgMul: 1, fireMul: 1, magMul: 1, reloadMul: 1, spreadMul: 1,
    critChance: 0.03, critMul: 2, dmgTaken: 1, dataMul: 1, detectMul: 1, noiseMul: 1, aoeMul: 1, aoeDmg: 1,
    burnMul: 1, stunMul: 1, hijackMul: 1, meleeDmg: 20, pierce: 0, bounce: 0, priceMul: 1, houndDmg: 1,
  };
  const addStats = ['maxHp', 'bwMax', 'dashCharges', 'critChance', 'pierce', 'bounce', 'meleeDmg'];

  // 第二季路人的特質、弱點、小習慣，在第三季的效果。mods 改能力值、flags 是 sim 裡會看的開關。
  const traitFx = {
    calm: { mods: { focusMax: 1.3 } },
    fast: { mods: { speed: 1.08 } },
    connected: { mods: { priceMul: 0.8 } },
    memory: { flags: { reroll: 1 } },
    unremarkable: { mods: { detectMul: 0.7 } },
    silver: { mods: { dataMul: 1.15 } },
    nightowl: { flags: { nightowl: 1 } },
    nimble: { mods: { reloadMul: 0.7 } },
    strong: { mods: { meleeDmg: 12 } },
    driver: { mods: { dashCd: 0.85 } },
    cheerful: { flags: { roomHeal: 1 } },
    careful: { flags: { guard: 1 } },
  };
  const flawFx = {
    acrophobia: { mods: { dashLen: 0.85 } },
    loudmouth: { mods: { noiseMul: 1.5 }, flags: { loud: 1 } },
    record: { mods: { detectMul: 1.3 } },
    bad_knees: { mods: { dashCd: 1.25 } },
    nervous: { mods: { spreadMul: 1.6 } },
    no_sense: { flags: { lost: 1 } },
    dark: { mods: { focusMax: 0.75 } },
    phone: { mods: { bwRegen: 0.85 } },
    clumsy: { mods: { reloadMul: 1.3 } },
    honest: { mods: { priceMul: 1.2 } },
    hothead: { mods: { dmgMul: 1.1, dmgTaken: 1.1 } },
    allergic: { flags: { sneeze: 1 } },
  };
  const quirkFx = {
    dogs_fear: { mods: { houndDmg: 1.25 } },
    dogs_love: { flags: { dogfriend: 1 } },
    gamer: { mods: { critChance: 0.05 } },
    marathon: { mods: { speed: 1.04 } },
    ex_army: { mods: { dmgMul: 1.05 } },
    night_shift: { mods: { detectMul: 0.9 } },
    cyclist: { mods: { dashCd: 0.95 } },
    tea: { mods: { focusRegen: 1.15 } },
    knitting: { mods: { meleeDmg: 4 } },
    birdwatcher: { flags: { birds: 1 } },
    mahjong: { mods: { dataMul: 1.05 } },
  };

  // 職業專長（第二季的 perk）在這一季的效果。這是「誰都可以上場」的重點：每個職業打起來不一樣。
  // nurse、bail、lockpick 是全隊的效果，由 js/s3/run.js 處理；其他由 js/s3/sim.js 處理。
  const jobFx = {
    backdoor: { flags: { freeFirst: 1 } },
    network_access: { flags: { netAccess: 1 } },
    broadcast: { mods: { dataMul: 1.2 } },
    botnet: { mods: { hijackMul: 1.3 }, flags: { birds: 1 } },
    site_pass: { flags: { hardhat: 1 } },
    building_access: { mods: { dashCd: 0.75 } },
    heavy_lift: { mods: { meleeDmg: 20 } },
    climb: { mods: { maxHp: 20 }, flags: { fireproof: 1 } },
    sprint: { mods: { speed: 1.12 } },
    river_route: { flags: { driver: 1 } },
    bail: { flags: { bail: 1 } },
    press: { flags: { press: 1, profiler: 1 } },
    gossip: { mods: { detectMul: 0.75 } },
    smooth_talk: { mods: { priceMul: 0.75 } },
    distraction: { flags: { busker: 1 } },
    disguise: { flags: { disguise: 1 } },
    heal: { flags: { nurse: 1 } },
    lockpick: { flags: { lockpick: 1 } },
    getaway: { flags: { getaway: 1 } },
    unsuspicious: { mods: { detectMul: 0.5 } },
    take_over: { mods: { hijackMul: 2 } },
    pigeon_post: { mods: { dataMul: 1.15 }, flags: { magnet: 1 } },
    legacy: { flags: { legacy: 1 } },
    pirate_radio: { mods: { stunMul: 1.3 }, flags: { worm: 1 } },
    master_keys: { flags: { keys: 1 } },
    rooftops: { mods: { dashCharges: 1 } },
  };

  // ===== 漏洞（升級）=====
  // rar：c 常見、u 少見、r 稀有。tag：net 網路、shock 電擊、blast 爆破、puppet 傀儡、gun 槍、body 身體。max 最多疊幾層。
  const X = (id, rar, tag, max, mods, flags) => ({ id, rar, tag, max, mods: mods || {}, flags: flags || {} });
  const exploits = [
    X('overclock', 'c', 'net', 3, { bwMax: 1 }),
    X('fiber', 'c', 'net', 3, { bwRegen: 1.25 }),
    X('antenna', 'c', 'net', 2, { hackRange: 1.25 }),
    X('backdoor', 'u', 'net', 1, null, { backdoor: 1 }),
    X('botfarm', 'u', 'net', 2, null, { refund: 1 }),
    X('ransom', 'c', 'net', 2, null, { ransom: 1 }),
    X('jailbreak', 'r', 'net', 1, null, { jailbreak: 1 }),
    X('profiler', 'u', 'net', 1, null, { profiler: 1 }),
    X('miner', 'c', 'net', 2, { dataMul: 1.25 }),
    X('hoard', 'r', 'net', 1, null, { hoard: 1 }),

    X('chain', 'u', 'shock', 2, null, { chain: 1 }),
    X('conductor', 'c', 'shock', 2, { stunMul: 1.3 }),
    X('shortcircuit', 'u', 'shock', 2, null, { vuln: 1 }),
    X('worm', 'r', 'shock', 1, null, { worm: 1 }),
    X('static', 'u', 'shock', 1, null, { shockdash: 1 }),
    X('recycle', 'u', 'shock', 1, null, { recycle: 1 }),

    X('bigbang', 'c', 'blast', 2, { aoeMul: 1.2, aoeDmg: 1.2 }),
    X('incendiary', 'u', 'blast', 2, null, { incend: 1 }),
    X('thermal', 'c', 'blast', 2, { burnMul: 1.5 }),

    X('puppet', 'u', 'puppet', 2, { hijackMul: 1.6 }),
    X('salvage', 'r', 'puppet', 1, null, { salvage: 1 }),

    X('hollow', 'c', 'gun', 3, { dmgMul: 1.15 }),
    X('rapid', 'c', 'gun', 3, { fireMul: 1.15 }),
    X('extmag', 'c', 'gun', 2, { magMul: 1.4, reloadMul: 0.85 }),
    X('ricochet', 'u', 'gun', 1, { bounce: 1 }),
    X('pierce', 'u', 'gun', 1, { pierce: 1 }),
    X('shockrounds', 'u', 'gun', 1, null, { shockRounds: 1 }),
    X('crit', 'u', 'gun', 2, { critChance: 0.12 }),
    X('silencer', 'c', 'gun', 1, null, { silent: 1 }),
    X('executioner', 'u', 'gun', 1, null, { exec: 1 }),
    X('glasscannon', 'r', 'gun', 1, { dmgMul: 1.4, dmgTaken: 1.25 }),

    X('kevlar', 'c', 'body', 3, { maxHp: 20 }),
    X('adrenal', 'c', 'body', 2, { dashCd: 0.8 }),
    X('doubledash', 'u', 'body', 1, { dashCharges: 1 }),
    X('afterimage', 'u', 'body', 1, null, { decoy: 1 }),
    X('plating', 'u', 'body', 2, { dmgTaken: 0.88 }),
    X('scavenger', 'c', 'body', 2, null, { lifesteal: 1 }),
    X('secondwind', 'r', 'body', 1, null, { revive: 1 }),
    X('deepfocus', 'u', 'body', 2, { focusMax: 1.4, focusRegen: 1.3 }),
    X('reflex', 'u', 'body', 1, null, { focusDmg: 1 }),
    X('medic', 'c', 'body', 2, null, { roomHeal: 1 }),
  ];
  // 抽漏洞時各稀有度的權重：一般房間、精英房間、首領、黑市。
  const rarityWeight = {
    fight: { c: 62, u: 30, r: 8 },
    elite: { c: 30, u: 50, r: 20 },
    boss: { c: 0, u: 50, r: 50 },
    shop: { c: 50, u: 38, r: 12 },
  };
  const price = { c: 40, u: 65, r: 100, gadget: 75, heal: 30, reroll: 15 };

  // ===== 裝備（Q、E 兩格）=====
  // cd 冷卻秒數。同一件再拿一次會升級（最多 3 級）：冷卻 −20%，效果變強。
  const gadgets = {
    eagle: { cd: 14, range: 520, r: 170, stun: 2.4, dmg: 15 },            // Darcy 的老鷹無人機：飛到游標處，電磁脈衝
    blackout: { cd: 28, dur: 5 },                                         // 艾登的大停電：全場敵人看不到你
    sergei: { cd: 12, range: 560, r: 95, dmg: 60, fuse: 0.7, crate: 10 }, // Wrench 的謝爾蓋：把貨箱丟到游標處
    hammer: { cd: 6, r: 105, arc: 1.25, dmg: 55, knock: 260, stun: 0.9 }, // Wrench 的鐵鎚
    mask: { cd: 18, dur: 4, mult: 3 },                                    // 第二張臉：隱形
    spider: { cd: 20, dur: 11, dmg: 7, rate: 5, sight: 420 },             // 蜘蛛機器人：自動砲塔
    lure: { cd: 10, range: 520, dur: 4.5, r: 330 },                       // 誘餌喇叭
    mine: { cd: 8, r: 120, stun: 2, dmg: 25, max: 3 },                    // 電擊地雷
  };
  // 職業分類的起始裝備和起始漏洞（各從裡面隨機一個）。
  const kits = {
    hacker: { gadget: ['eagle', 'mine'], exploit: ['chain', 'fiber', 'antenna', 'ransom'] },
    physical: { gadget: ['hammer', 'mine'], exploit: ['kevlar', 'adrenal', 'scavenger', 'static'] },
    social: { gadget: ['lure', 'mask'], exploit: ['silencer', 'afterimage', 'miner', 'profiler'] },
    specialist: { gadget: ['spider', 'sergei'], exploit: ['puppet', 'extmag', 'medic', 'thermal'] },
  };

  // ===== 敵人 =====
  // cost 佔用房間的威脅額度、data 掉多少資料、from 從第幾個房間開始出現（整趟算）、sight 看多遠、fov 視角的一半（弧度）。
  // human 可以被耳機尖嘯、可以被制伏；machine 是機器；fly 飛過牆；static 不會動。
  const enemies = {
    guard: { hp: 60, r: 15, speed: 150, cost: 2, data: 3, from: 1, sight: 340, fov: 0.62, human: true, dmg: 10 },
    rusher: { hp: 50, r: 15, speed: 225, cost: 2, data: 3, from: 1, sight: 300, fov: 0.7, human: true, dmg: 18 },
    drone: { hp: 34, r: 13, speed: 185, cost: 2, data: 3, from: 2, sight: 360, fov: 0.8, machine: true, fly: true, dmg: 8 },
    hound: { hp: 40, r: 13, speed: 300, cost: 2, data: 3, from: 3, sight: 280, fov: 0.9, machine: true, dmg: 15 },
    shield: { hp: 90, r: 17, speed: 96, cost: 3, data: 5, from: 4, sight: 320, fov: 0.62, human: true, dmg: 11 },
    turret: { hp: 80, r: 16, speed: 0, cost: 2, data: 4, from: 4, sight: 420, fov: 0.75, machine: true, static: true, dmg: 8 },
    sniper: { hp: 44, r: 14, speed: 120, cost: 3, data: 5, from: 5, sight: 700, fov: 0.45, human: true, dmg: 32 },
    bomber: { hp: 55, r: 15, speed: 130, cost: 3, data: 5, from: 6, sight: 340, fov: 0.62, human: true, dmg: 24 },
    jammer: { hp: 48, r: 14, speed: 140, cost: 3, data: 6, from: 7, sight: 320, fov: 0.62, human: true, dmg: 9, jam: 240 },
    heavy: { hp: 260, r: 21, speed: 86, cost: 6, data: 12, from: 9, sight: 360, fov: 0.62, human: true, dmg: 7, big: true },
  };
  // 精英的詞綴。
  const affixes = ['armored', 'firewall', 'volatile', 'swift'];

  // 首領：招式寫在 js/s3/sim.js。pylons 場上有幾座中繼器。
  const bosses = {
    bulldog: { hp: 1300, r: 34, speed: 120, data: 60, dmg: 14 },                          // 鎮暴隊長「鬥牛犬」：衝撞、盾牌
    carrier: { hp: 1400, r: 40, speed: 90, data: 80, dmg: 10, fly: true, pylons: 2 },     // 守夜人母機：放無人機、雷射
    keystone: { hp: 1500, r: 44, speed: 0, data: 120, dmg: 10, static: true, pylons: 3 }, // 基石核心：彈幕、砲塔
  };

  // ===== 可駭入的設施 =====
  // cost 花多少頻寬。solid：2 擋路也擋視線、3 矮掩體（擋路擋子彈，不擋視線）、0 不擋。
  const props = {
    junction: { hack: 'overload', cost: 2, solid: 3, fuse: 0.45, r: 150, dmg: 35, stun: 1.6 },
    vent: { hack: 'steam', cost: 1, solid: 0, r: 130, dur: 6, burn: 6 },
    barrel: { hack: 'ignite', cost: 1, solid: 3, r: 140, dmg: 60, self: 20, fire: 4, hp: 8 },
    car: { hack: 'drive', cost: 2, solid: 3, dmg: 110, self: 25, speed: 680, r: 120, blast: 50 },
    bollard: { hack: 'raise', cost: 1, solid: 0, dur: 8, cd: 4, dmg: 10, stun: 1 },
    camera: { hack: 'loop', cost: 1, solid: 0, sight: 330, fov: 0.55, mark: 10 },
    speaker: { hack: 'shriek', cost: 1, solid: 0, r: 380, dur: 4.5, cd: 9 },
    crate: { solid: 3 },
    pylon: { hack: 'breach', cost: 2, solid: 3, down: 9 },
  };
  // 駭敵人的動作和花費。
  const hacks = {
    distract: { cost: 1, dur: 4 },
    stun: { cost: 1, dur: 1.3 },
    dropShield: { cost: 2, dur: 6, stun: 1.4 },
    detonate: { cost: 3, r: 115, dmg: 70 },
    reboot: { cost: 1, dur: 3 },
    blind: { cost: 1, dur: 4.5 },
    hijack: { cost: 2, dur: 10 },
    hijackTurret: { cost: 3, dur: 12 },
    bossShield: { cost: 3, dur: 4, cd: 9 },
  };

  // ===== 房間的狀況（門上會寫）=====
  // w 出現的權重、threat 敵人額度的倍率、data 資料倍率，其他效果由 sim 看 id 處理。
  const mods = {
    fog: { w: 3 }, rain: { w: 3 }, shift: { w: 3 }, kennel: { w: 2, from: 3 },
    sweep: { w: 2, data: 1.3 }, dark: { w: 2 }, jam: { w: 2, data: 1.25 },
    supply: { w: 2 }, overtime: { w: 2, threat: 1.3, data: 1.5 },
  };

  // 小隊有三個人可以輪流上，所以敵人的傷害整體乘上這個倍率：一趟下來通常會有一兩個人被抓。
  // 2026-11-12 陷阱打到沒發現你的敵人會直接放倒、急救包會補場下的人、車變強之後，機器人的勝率從約六成升到八成；調到 2.1 回到約六成。
  const enemyDmg = 2.1;

  // ===== 區段 =====
  // rooms 首領前有幾個房間；budget 第一間和最後一間的威脅額度；scale 敵人血量和傷害的倍率；layouts 房間骨架；props 各種設施最少和最多幾個。
  const sectors = [
    { id: 'docks', district: 'isle_of_dogs', rooms: 5, budget: [13, 24], scale: 1, boss: 'bulldog',
      layouts: ['yard', 'lanes', 'pillars', 'halls'],
      props: { junction: [1, 3], vent: [0, 2], barrel: [2, 4], car: [0, 2], bollard: [0, 1], camera: [0, 1], speaker: [0, 1], crate: [4, 8] } },
    { id: 'offices', district: 'westminster', rooms: 6, budget: [26, 38], scale: 1.5, boss: 'carrier',
      layouts: ['rooms', 'halls', 'cross', 'pillars'],
      props: { junction: [2, 3], vent: [1, 3], barrel: [0, 2], car: [0, 0], bollard: [0, 2], camera: [1, 2], speaker: [1, 2], crate: [2, 5] } },
    { id: 'vault', district: 'isle_of_dogs', rooms: 6, budget: [36, 52], scale: 2.2, boss: 'keystone',
      layouts: ['pillars', 'cross', 'rooms', 'lanes'],
      props: { junction: [2, 4], vent: [1, 2], barrel: [1, 3], car: [0, 1], bollard: [1, 2], camera: [1, 2], speaker: [0, 1], crate: [2, 5] } },
  ];

  // ===== 事件 =====
  // once：一趟只會遇到一次。cameo：頭像（js/ui/art.js）。choices 的效果由 js/s3/run.js 處理。
  // roll：[累計機率, 效果, 文字後綴]，擲出來的數字小於哪一個的累計機率就是哪一個（最後一個一定是 1）。cost：要先付多少資料。
  const events = [
    { id: 'wrench', cameo: 'wrench', once: true, choices: [{ fx: { gadget: 'sergei' } }, { fx: { gadget: 'hammer' } }] },
    { id: 'darcy', cameo: 'darcy', once: true, choices: [{ fx: { gadget: 'eagle' } }, { fx: { data: 45 } }] },
    { id: 'aiden', cameo: 'aiden', once: true, choices: [{ fx: { exploit: 'deepfocus' } }, { fx: { gadget: 'blackout' } }] },
    { id: 'marcus', cameo: 'marcus', once: true, choices: [{ fx: { draft: 'u' } }, { fx: { data: 50 } }] },
    { id: 'bluedoor', cameo: 'bluedoor', once: true, choices: [{ fx: { gadget: 'mask' } }, { fx: { heal: 25 } }] },
    { id: 'cat', cameo: 'cat', once: true, choices: [{ fx: { heal: 30 } }, { fx: { maxBw: 1, hurt: 10 } }] },
    { id: 'tarot', cameo: 'tarot', once: true, choices: [{ roll: [[0.34, { maxHp: 15 }, 'a'], [0.67, { rerolls: 2 }, 'b'], [1, { data: 40 }, 'c']] }, { fx: {} }] },
    { id: 'vending', cameo: 'device', choices: [{ cost: 15, roll: [[0.5, { heal: 25 }, 'a'], [0.7, { data: 60 }, 'b'], [1, {}, 'c']] }, { fx: {} }] },
    { id: 'terminal', cameo: 'device', choices: [{ roll: [[0.6, { data: 55 }, 'a'], [1, { curse: 'sweep' }, 'b']] }, { fx: {} }] },
    { id: 'courier', cameo: 'crowd', choices: [{ fx: { hurt: 15, draft: 'u' } }, { fx: {} }] },
    { id: 'dealer', cameo: 'agent', choices: [{ fx: { maxHp: -15, draft: 'r' } }, { fx: {} }] },
    { id: 'bagley', cameo: 'bagley', choices: [{ roll: [[0.65, { recompile: 1 }, 'a'], [1, { recompile: -1 }, 'b']] }, { fx: {} }] },
  ];

  // ===== 永久強化（用殘響買）=====
  const perks = [
    { id: 'hp', max: 3, cost: [6, 10, 15] },
    { id: 'bw', max: 1, cost: [12] },
    { id: 'stash', max: 2, cost: [5, 9] },
    { id: 'reroll', max: 2, cost: [8, 14] },
    { id: 'bunks', max: 2, cost: [8, 14] },
    { id: 'kit', max: 1, cost: [10] },
    { id: 'focus', max: 1, cost: [8] },
    { id: 'insight', max: 1, cost: [20] },
  ];

  S3.data = {
    weapons, weaponByCategory, weaponByJob, baseStats, addStats, traitFx, flawFx, quirkFx, jobFx,
    exploits, rarityWeight, price, gadgets, kits, enemies, affixes, bosses, props, hacks, mods, sectors, events, perks, enemyDmg,
  };
})(window.ECHO = window.ECHO || {});
