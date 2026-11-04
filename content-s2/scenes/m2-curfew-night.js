// 第二季主線任務二：宵禁之夜。
// 第一次在宵禁裡正面行動：拆掉康登的第一座監控塔。主角（你）帶隊，隊友是這次行動挑的人。
// 大街 → 工地圍欄 → 工地空地（躲無人機）→ 塔下的控制箱（揭露威脅評分的來源，選擇只關攝影機或熄掉整條街）→ 撤離 → 備用安全屋。
// 每一關都有主角自己用手機駭入的辦法，但頻寬只有三格；隊友的類別和專長會開出不花頻寬的解法。
// 主線任務至少要帶一個隊友。隊友資料（flags.team）、名字清單、收留你們的路人，都由夜間引擎在任務開始時填好。
// 警戒從這次行動的起始警戒開始累積；滿 100 就撤退，塔留到下一晚。
// 隊友用 {name} 稱呼，不用代名詞；主角一律是「你」。
(function (E) {
  const { L, alertUp, team, help } = E.s2.kit;

  // ===== 隊友解法 =====
  // 每一關依序找第一個合適的隊友：[解法, 條件, 增加的警戒]。
  const HELP = {
    fence: [
      ['pass', (m) => m.perk === 'site_pass', 0],
      ['pick', (m) => m.perk === 'lockpick', 0],
      ['keys', (m) => m.perk === 'master_keys', 0],
      ['talk', (m) => m.cat === 'social', 0],
      ['climb', (m) => m.cat === 'physical', 2],
    ],
    yard: [
      ['takeover', (m) => m.perk === 'take_over', 0],
      ['loop', (m) => m.cat === 'hacker', 2],
      ['busk', (m) => m.perk === 'distraction', 2],
      ['throw', (m) => m.cat === 'physical', 3],
      ['call', (m) => m.cat === 'social', 2],
    ],
    box: [
      ['legacy', (m) => m.perk === 'legacy', 0],
      ['open', (m) => m.cat === 'hacker', 3],
    ],
    street: [
      ['cab', (m) => m.perk === 'getaway', 0],
      ['teacher', (m) => m.perk === 'unsuspicious', 0],
      ['jam', (m) => m.cat === 'hacker', 2],
      ['lead', (m) => m.cat === 'physical', 3],
      ['chat', (m) => m.cat === 'social', 3],
    ],
  };
  const { helper, assist, teamEntity } = E.s2.kit.kit('m2', HELP);

  // ===== 大街：出發前 =====
  E.registerScene({
    id: 's2.m2.street',
    location: 's2.loc.m2street',
    art: 'highstreet',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('title', 'm2.title'),
      L('sys', 'm2.s.1', { n: s.flags.night }),
      L('narr', 'm2.s.2'),
      L('narr', 'm2.s.3'),
      L('bagley', 'm2.s.4'),
      L('prof', 'm2.s.team', { names: s.flags.names }),
      L('dim', 'm2.s.hint'),
    ],
    look: [L('narr', 'm2.s.look')],
    implicit: { go: 'site', talk: 'team' },
    entities: {
      team: {
        aliases: ['team', 'crew', 'squad', 'everyone', 'friends', 'plan', '隊友', '队友', '大家', '夥伴', '伙伴', '同伴', '隊員', '队员', '計畫', '计划'],
        look: { lines: [L('narr', 'm2.team.look')] },
        talk: {
          id: 'm2.brief',
          lines: (s) => team(s).map((m) => L('narr', 'm2.brief.' + m.cat, { name: m.name })).concat(L('bagley', 'm2.brief.b')),
          effects: { flags: { briefed: true } },
        },
      },
      bagley: {
        aliases: ['bagley', 'phone', '貝格利', '贝格利', '手機', '手机'],
        talk: { lines: [L('bagley', 'm2.bagley.talk')] },
      },
      tower: {
        aliases: ['tower', 'mast', 'red light', 'eye', '塔', '監控塔', '监控塔', '紅燈', '红灯'],
        look: { lines: [L('narr', 'm2.tower.look')] },
        scan: { lines: [L('prof', 'm2.tower.scan.1'), L('bagley', 'm2.tower.scan.2')], effects: { flags: { scanned: true } } },
      },
      light: {
        aliases: ['light', 'lights', 'lamp', 'lamps', 'streetlight', 'streetlights', '路燈', '路灯', '燈', '灯'],
        look: { lines: [L('narr', 'm2.light.look')] },
        hack: { lines: [L('bagley', 'm2.light.hack')] },
      },
      poster: {
        aliases: ['poster', 'posters', 'wall', 'pig', '海報', '海报', '牆', '墙', '豬', '猪'],
        look: { lines: [L('narr', 'm2.poster.look')] },
      },
      sign: {
        aliases: ['sign', 'signs', 'boot', 'shop', 'shops', '招牌', '靴子', '店', '鞋店'],
        look: { lines: [L('narr', 'm2.sign.look')] },
      },
      site: {
        aliases: ['site', 'building site', 'market', 'fence', 'end', '工地', '市場', '市场', '圍欄', '围栏'],
        look: { lines: [L('narr', 'm2.tower.look')] },
        go: { lines: [L('narr', 'm2.s.go')], goto: 's2.m2.fence' },
      },
    },
    // 目標清單（畫面上的「目標」）：第一次玩的人知道現在要做什麼、為什麼。
    goals: (s) => [
      { k: 'm2.goal.brief', how: 'm2.goal.brief.how', done: !!s.flags.briefed, opt: true },
      { k: 'm2.goal.site', how: 'm2.goal.site.how', done: false },
    ],
    suggest(s) {
      const out = [];
      if (!s.flags.briefed) out.push(['talk', 'team']);
      if (!s.flags.scanned) out.push(['scan', 'tower']);
      out.push(['look', 'poster'], ['go', 'site']);
      return out;
    },
  });

  // ===== 工地圍欄：駭門禁、翻過去，或讓警衛自己開門 =====
  // 跟警衛聊開的話，今晚結束時會收到一句謝謝。
  const FENCE_HELP = { effects: (s, h) => (h.kind === 'talk' ? { flags: { guardFriend: true } } : {}), goto: 's2.m2.yard' };
  E.registerScene({
    id: 's2.m2.fence',
    location: 's2.loc.m2fence',
    art: 'dock',
    anyoneHacks: true,
    bandwidth: 3,
    help,
    enter: [L('narr', 'm2.f.1'), L('warn', 'm2.f.2'), L('bagley', 'm2.f.3')],
    look: [L('narr', 'm2.f.look')],
    implicit: { talk: 'team', wait: 'guard' },
    // 警衛每三個動作抬頭看一次。
    onTurn(s) {
      s.flags.glance = ((s.flags.glance || 0) + 1) % 3;
      if (s.flags.glance) return [];
      s.exposure = Math.min(100, s.exposure + 4);
      return [L('warn', 'm2.f.glance'), alertUp(4)];
    },
    entities: {
      team: teamEntity('fence', FENCE_HELP),
      gate: {
        aliases: ['gate', 'reader', 'card reader', 'lock', 'door', '門禁', '门禁', '讀卡機', '读卡机', '門', '门', '鎖', '锁'],
        look: { lines: [L('narr', 'm2.gate.look')] },
        hack: { cost: 1, exposure: 4, lines: [L('narr', 'm2.gate.hack')], goto: 's2.m2.yard' },
        go: { lines: [L('dim', 'm2.gate.locked')] },
      },
      fence: {
        aliases: ['fence', 'wire', 'barbed wire', 'wall', '圍欄', '围栏', '鐵皮', '铁皮', '刺網', '刺网', '牆', '墙'],
        look: { lines: [L('narr', 'm2.fence.look')] },
        jump: assist('fence', Object.assign({ only: ['climb'], fail: () => [L('dim', 'm2.fence.cant')] }, FENCE_HELP)),
      },
      guard: {
        aliases: ['guard', 'booth', 'man', '警衛', '警卫', '崗亭', '岗亭', '保全', '保安'],
        look: { lines: [L('narr', 'm2.guard.look')] },
        scan: { lines: [L('prof', 'm2.guard.scan')] },
        talk: assist('fence', Object.assign({ only: ['talk'], fail: () => [L('dim', 'm2.guard.nope')] }, FENCE_HELP)),
        attack: { lines: [L('bagley', 'm2.guard.attack')] },
        wait: { lines: [L('narr', 'm2.f.wait')] },
      },
    },
    goals: () => [{ k: 'm2.goal.fence', how: 'm2.goal.fence.how', done: false }],
    suggest(s) {
      const out = [];
      if (helper(s, 'fence')) out.push(['talk', 'team']);
      out.push(['hack', 'gate'], ['scan', 'guard']);
      return out;
    },
  });

  // ===== 工地空地：無人機每兩個動作掃一次 =====
  E.registerScene({
    id: 's2.m2.yard',
    location: 's2.loc.m2yard',
    art: 'site',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm2.y.1'), L('warn', 'm2.y.2'), L('bagley', 'm2.y.3')],
    look: [L('narr', 'm2.y.look')],
    implicit: { go: 'tower', talk: 'team', wait: 'drone' },
    onTurn(s) {
      if (s.flags.droneDown) return [];
      s.flags.sweep = ((s.flags.sweep || 0) + 1) % 2;
      if (s.flags.sweep) return [];
      if (s.flags.covered) return [L('narr', 'm2.y.sweepSafe')];
      s.exposure = Math.min(100, s.exposure + 6);
      return [L('warn', 'm2.y.sweep'), alertUp(6)];
    },
    entities: {
      team: teamEntity('yard', { done: (s) => s.flags.droneDown, effects: () => ({ flags: { droneDown: true } }) }),
      drone: {
        aliases: ['drone', 'nightwatch', 'searchlight', 'spotlight', '無人機', '无人机', '守夜人', '探照燈', '探照灯'],
        look: { lines: [L('narr', 'm2.ydrone.look')] },
        scan: { lines: [L('prof', 'm2.ydrone.scan')] },
        hack: { requires: (s) => !s.flags.droneDown, fail: [L('dim', 'm2.ydrone.done')], cost: 1, exposure: 3, lines: [L('narr', 'm2.ydrone.hack')], effects: { flags: { droneDown: true } } },
        wait: { lines: [L('narr', 'm2.y.wait')] },
      },
      container: {
        aliases: ['container', 'containers', 'cover', 'steel', 'rebar', '貨櫃', '货柜', '集裝箱', '集装箱', '鋼筋', '钢筋'],
        look: { lines: [L('narr', 'm2.container.look')] },
        go: { id: 'm2.cover', lines: [L('narr', 'm2.container.go')], effects: { flags: { covered: true } } },
      },
      tower: {
        aliases: ['tower', 'base', 'box', 'control box', '塔', '監控塔', '监控塔', '塔底', '控制箱'],
        look: { lines: [L('narr', 'm2.t.look')] },
        // 無人機看不到你們最好；躲在貨櫃後面等它掃過去也行；直接衝就會被照到。
        go: {
          lines: (s) => (s.flags.droneDown ? [L('narr', 'm2.cross.clean')]
            : s.flags.covered ? [L('narr', 'm2.cross.timed'), alertUp(4)] : [L('warn', 'm2.cross.rush'), alertUp(12)]),
          effects: (s) => ({ exposure: s.flags.droneDown ? 0 : s.flags.covered ? 4 : 12 }),
          goto: 's2.m2.tower',
        },
      },
    },
    goals: (s) => [
      { k: 'm2.goal.drone', how: 'm2.goal.drone.how', done: !!(s.flags.droneDown || s.flags.covered) },
      { k: 'm2.goal.tower', how: 'm2.goal.tower.how', done: false },
    ],
    suggest(s) {
      const out = [];
      if (!s.flags.droneDown) {
        if (helper(s, 'yard')) out.push(['talk', 'team']);
        out.push(['hack', 'drone']);
        if (!s.flags.covered) out.push(['go', 'container']);
      }
      out.push(['go', 'tower']);
      return out;
    },
  });

  // ===== 塔下：打開控制箱，看到威脅評分的來源，然後決定要關掉什麼 =====
  // 揭露的內容依第一季的結局不同。
  const reveal = (s) => {
    const w = s.flags.world || 'stay';
    return [
      L('prof', 'm2.reveal.1'), L('bagley', 'm2.reveal.2'), L('narr', 'm2.reveal.3'),
      L('quote', 'm2.twist.' + w), L('bagley', 'm2.twist.' + w + '.b'),
      L('bagley', 'm2.choice.1'), L('bagley', 'm2.choice.2'), L('dim', 'm2.choice.hint'),
    ];
  };
  const opened = (s) => !!s.flags.boxOpen;
  E.registerScene({
    id: 's2.m2.tower',
    location: 's2.loc.m2tower',
    art: 'site',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm2.t.1'), L('bagley', 'm2.t.2')],
    look: [L('narr', 'm2.t.look')],
    implicit: { talk: 'team' },
    entities: {
      team: teamEntity('box', { done: opened, effects: () => ({ flags: { boxOpen: true } }), after: reveal }),
      box: {
        aliases: ['box', 'control box', 'panel', 'port', 'screen', '控制箱', '箱子', '面板', '螢幕', '屏幕', '維修埠', '维修口'],
        look: { lines: (s) => [L('narr', opened(s) ? 'm2.box.looked' : 'm2.box.look')] },
        hack: { requires: (s) => !opened(s), fail: [L('dim', 'm2.box.done')], cost: 1, exposure: 5, lines: [L('narr', 'm2.box.hack')], effects: { flags: { boxOpen: true } }, after: reveal },
        scan: { lines: (s) => (opened(s) ? [L('prof', 'm2.reveal.1')] : [L('prof', 'm2.box.scan')]) },
      },
      cameras: {
        aliases: ['camera', 'cameras', 'cctv', 'quiet', '攝影機', '摄像头', '攝影', '鏡頭', '镜头', '安靜', '安静'],
        visible: opened,
        look: { lines: [L('narr', 'm2.cam.look')] },
        hack: { lines: [L('narr', 'm2.cam.hack.1'), L('narr', 'm2.cam.hack.2')], effects: { flags: { quiet: true } }, goto: 's2.m2.escape' },
      },
      grid: {
        aliases: ['grid', 'streetlights', 'street lights', 'every streetlight', 'lights', 'street', 'cable', '路燈', '路灯', '整條街', '整条街', '電纜', '电缆', '燈', '灯'],
        visible: opened,
        look: { lines: [L('narr', 'm2.grid.look')] },
        hack: {
          lines: [L('blackout', 'm2.out.1'), L('narr', 'm2.out.2'), L('narr', 'm2.out.3'), L('narr', 'm2.out.4'), L('narr', 'm2.out.5'), L('bagley', 'm2.out.6')],
          effects: { flags: { lightsOut: true } },
          goto: 's2.m2.escape',
        },
      },
      top: {
        aliases: ['top', 'up', 'eye', 'red light', '塔頂', '塔顶', '紅燈', '红灯', '眼睛'],
        look: { lines: [L('narr', 'm2.top.look')] },
      },
    },
    goals: (s) => [
      { k: 'm2.goal.box', how: 'm2.goal.box.how', done: opened(s) },
      { k: 'm2.goal.choose', how: 'm2.goal.choose.how', done: false },
    ],
    suggest(s) {
      if (opened(s)) return [['hack', 'cameras'], ['hack', 'grid']];
      const out = [];
      if (helper(s, 'box')) out.push(['talk', 'team']);
      out.push(['hack', 'box'], ['look', 'top']);
      return out;
    },
  });

  // ===== 撤離：巡邏車三個動作之內就會開到 =====
  const dark = (s) => !!s.flags.lightsOut;
  const HOME = 's2.m2.home';
  E.registerScene({
    id: 's2.m2.escape',
    location: 's2.loc.m2escape',
    art: (s) => (s.flags.lightsOut ? 'highstreet-dark' : 'highstreet'),
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', dark(s) ? 'm2.e.dark' : 'm2.e.quiet'), L('warn', 'm2.e.2'), L('bagley', dark(s) ? 'm2.e.3dark' : 'm2.e.3')],
    look: (s) => [L('narr', 'm2.e.look')].concat(dark(s) ? [L('narr', 'm2.e.lookDark')] : []),
    implicit: { go: 'canal', talk: 'team', wait: 'car' },
    onTurn(s) {
      if (s.scene !== 's2.m2.escape') return [];
      s.flags.car = (s.flags.car || 0) + 1;
      return s.flags.car < 3 ? [L('warn', 'm2.e.car.' + s.flags.car)] : [];
    },
    events: [
      {
        id: 'm2.caught',
        when: (s) => s.flags.car >= 3,
        lines: [L('warn', 'm2.e.caught.1'), L('narr', 'm2.e.caught.2'), alertUp(20)],
        effects: { exposure: 20, flags: { chased: true } },
        goto: HOME,
      },
    ],
    entities: {
      team: teamEntity('street', { goto: HOME }),
      car: {
        aliases: ['car', 'patrol', 'patrol car', 'van', 'police', '巡邏車', '巡逻车', '車', '车', '警車', '警车'],
        look: { lines: [L('narr', 'm2.car.look')] },
        scan: { lines: [L('prof', 'm2.car.scan')] },
        hack: { cost: 1, exposure: 2, lines: [L('narr', 'm2.car.hack'), L('narr', 'm2.e.walk')], goto: HOME },
        wait: { lines: [L('narr', 'm2.e.wait')] },
      },
      canal: {
        aliases: ['canal', 'towpath', 'path', 'home', 'safe house', 'back', '運河', '运河', '小路', '步道', '安全屋', '回去'],
        look: { lines: [L('narr', 'm2.canal.look')] },
        go: {
          lines: (s) => [L('narr', dark(s) ? 'm2.e.go.dark' : 'm2.e.go.quiet'), alertUp(dark(s) ? 4 : 8)],
          effects: (s) => ({ exposure: dark(s) ? 4 : 8 }),
          goto: HOME,
        },
      },
      // 熄燈之後，街上有人開門讓你們躲進去。這個人之後可以直接招募。
      opendoor: {
        aliases: ['door', 'open door', 'someone', 'window', '門', '门', '開著的門', '开着的门', '那個人', '那个人', '窗'],
        visible: dark,
        look: { lines: [L('narr', 'm2.odoor.look')] },
        go: {
          lines: (s) => [L('narr', 'm2.odoor.go.1', { name: s.flags.extraName }), L('narr', 'm2.odoor.go.2', { name: s.flags.extraName })],
          effects: { flags: { shelter: true } },
          goto: HOME,
        },
        talk: { lines: (s) => [L('narr', 'm2.odoor.talk', { name: s.flags.extraName })] },
      },
    },
    goals: (s) => [{ k: 'm2.goal.escape', how: dark(s) ? 'm2.goal.escape.howDark' : 'm2.goal.escape.how', done: false }],
    suggest(s) {
      const out = [];
      if (dark(s)) out.push(['go', 'opendoor']);
      if (helper(s, 'street')) out.push(['talk', 'team']);
      out.push(['hack', 'car'], ['go', 'canal']);
      return out;
    },
  });

  // ===== 備用安全屋：今晚的結尾 =====
  E.registerScene({
    id: 's2.m2.home',
    location: 's2.loc.m2home',
    art: 'flat',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('narr', 'm2.c.1'),
      L('narr', dark(s) ? 'm2.c.dark' : 'm2.c.quiet'),
      ...(s.flags.shelter ? [L('narr', 'm2.c.shelter', { name: s.flags.extraName })] : []),
      ...(s.flags.guardFriend ? [L('quote', 'm2.c.guard')] : []),
      L('bagley', 'm2.c.2'),
      L('bagley', 'm2.c.3'),
      L('dim', 'm2.c.hint'),
    ],
    look: [L('narr', 'm2.c.look')],
    implicit: { talk: 'bagley', read: 'bagley' },
    entities: {
      bagley: {
        aliases: ['bagley', 'phone', '貝格利', '贝格利', '手機', '手机'],
        talk: { id: 'm2.end', lines: (s) => [L('bagley', dark(s) ? 'm2.c.end' : 'm2.c.endQuiet')], effects: { flags: { m2done: true } } },
        read: { id: 'm2.end', lines: (s) => [L('bagley', dark(s) ? 'm2.c.end' : 'm2.c.endQuiet')], effects: { flags: { m2done: true } } },
      },
      window: {
        aliases: ['window', 'street', 'outside', 'camden', '窗', '窗戶', '窗户', '窗外', '大街', '康登', '卡姆登'],
        look: { lines: (s) => [L('narr', dark(s) ? 'm2.c.dark' : 'm2.c.quiet')] },
      },
    },
    goals: (s) => [{ k: 'm2.goal.end', how: 'm2.goal.end.how', done: !!s.flags.m2done }],
    suggest() {
      return [['talk', 'bagley'], ['look', 'window']];
    },
  });

  E.s2 = E.s2 || {};
  E.s2.missions = E.s2.missions || {};
  E.s2.missions.m2 = { start: 's2.m2.street' };
})(window.ECHO = window.ECHO || {});
