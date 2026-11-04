// 第二季主線任務一：熄燈。
// 宵禁第一晚，玩家是一個錯過宵禁、困在洗衣店的普通人。對街的 DedSec 安全屋正被獅心防務突襲，
// Bagley 透過手機找上了你：去地下室把它的核心硬碟帶出來。
// 洗衣店 → 後巷（避開無人機：弄暗路燈、躲進熱氣）→ 被抄的安全屋（拿硬碟、三回合內撤離）→ 運河邊。
// 結束時設定 m1done，由第二季介面接手，進入挑隊員的流程。
// 主角是隨機生成的路人，所以全部用「你」，不用名字和代名詞。
// 安全屋的螢幕依第一季的結局（flags.world）顯示不同的內容。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });
  const help = () => E.s2.storyHelp;

  E.registerScene({
    id: 's2.m1.laundrette',
    location: 's2.loc.laundrette',
    art: 'gerrard',
    anyoneHacks: true,
    help,
    enter: [
      L('title', 'm1.title'),
      L('sys', 'm1.l.1'),
      L('narr', 'm1.l.2'),
      L('warn', 'm1.l.3'),
      L('narr', 'm1.l.4'),
      L('bagley', 'm1.l.5'),
    ],
    look: [L('narr', 'm1.l.look')],
    implicit: { go: 'door', read: 'phone', talk: 'bagley' },
    entities: {
      phone: {
        aliases: ['phone', 'mobile', 'message', '手機', '电话', '手机', '電話', '訊息', '消息'],
        look: { id: 'm1.call', lines: [L('bagley', 'm1.phone.1'), L('bagley', 'm1.phone.2'), L('dim', 'm1.phone.hint')], effects: { flags: { called: true } } },
        read: { id: 'm1.call', lines: [L('bagley', 'm1.phone.1'), L('bagley', 'm1.phone.2'), L('dim', 'm1.phone.hint')], effects: { flags: { called: true } } },
      },
      bagley: {
        aliases: ['bagley', '貝格利', '贝格利'],
        talk: {
          lines: [L('bagley', 'm1.phone.1'), L('bagley', 'm1.phone.2'), L('dim', 'm1.phone.hint')],
          effects: { flags: { called: true } },
          topics: {
            who: { aliases: ['who', '你是誰', '你是谁', '誰', '谁'], lines: [L('bagley', 'm1.who')], effects: { flags: { called: true } } },
            whyme: { aliases: ['why', 'me', '為什麼', '为什么', '我'], lines: [L('bagley', 'm1.whyme')], effects: { flags: { called: true, askedWhy: true } } },
            yes: {
              aliases: ['yes', 'ok', 'okay', 'help', 'fine', '好', '幫', '帮', '答應', '答应', '願意', '愿意', '可以'],
              lines: [L('bagley', 'm1.yes.1'), L('bagley', 'm1.yes.2')],
              effects: { flags: { called: true, agreed: true } },
            },
            no: { aliases: ['no', 'refuse', '不要', '拒絕', '拒绝', '不'], lines: [L('bagley', 'm1.no')] },
          },
        },
      },
      window: {
        aliases: ['window', 'street', 'outside', 'building', '窗', '窗戶', '窗户', '對街', '对街', '紅磚樓', '红砖楼', '樓', '楼'],
        look: { lines: [L('narr', 'm1.window.1'), L('narr', 'm1.window.2')], effects: { flags: { sawRaid: true } } },
        scan: { lines: [L('prof', 'm1.window.scan.1'), L('prof', 'm1.window.scan.2')] },
      },
      drones: {
        aliases: ['drone', 'drones', 'nightwatch', '無人機', '无人机', '守夜人'],
        look: { lines: [L('narr', 'm1.drone.look')] },
        scan: { lines: [L('prof', 'm1.drone.scan.1'), L('prof', 'm1.drone.scan.2')] },
      },
      dryer: {
        aliases: ['dryer', 'dryers', 'clothes', 'hoodie', 'jacket', '烘衣機', '烘衣机', '衣服', '外套', '洗衣機', '洗衣机'],
        look: { lines: [L('narr', 'm1.dryer.look')] },
        take: { id: 'hoodie', once: true, lines: [L('narr', 'm1.dryer.take')], effects: { flags: { hood: true } }, repeat: [L('dim', 'm1.dryer.again')] },
      },
      vending: {
        aliases: ['vending', 'machine', '販賣機', '贩卖机', '自動販賣機', '自动贩卖机'],
        look: { lines: [L('narr', 'm1.vend.look')] },
        attack: { id: 'kick', once: true, lines: [L('narr', 'm1.vend.kick')], effects: { flags: { kicked: true } }, repeat: [L('dim', 'm1.vend.again')] },
      },
      door: {
        aliases: ['door', 'back', 'back door', 'out', 'outside', '後門', '后门', '門', '门', '出去', '外面'],
        look: { lines: [L('narr', 'm1.door.look')] },
        go: {
          requires: (s) => s.flags.agreed,
          fail: [L('dim', 'm1.door.no')],
          lines: [L('narr', 'm1.door.go')],
          goto: 's2.m1.alley',
        },
      },
    },
    // 目標清單（畫面上的「目標」）：第一次玩的人知道現在要做什麼、為什麼。
    goals: (s) => [
      { k: 'm1.goal.phone', how: 'm1.goal.phone.how', done: !!s.flags.called },
      { k: 'm1.goal.agree', how: 'm1.goal.agree.how', done: !!s.flags.agreed },
      { k: 'm1.goal.hood', how: 'm1.goal.hood.how', done: !!s.flags.hood, opt: true },
      { k: 'm1.goal.out', how: 'm1.goal.out.how', done: false },
    ],
    suggest(s) {
      const out = [];
      if (!s.flags.called) out.push(['read', 'phone']);
      else if (!s.flags.agreed) {
        if (!s.flags.askedWhy) out.push(['talk', 'bagley', 'whyme']);
        out.push(['talk', 'bagley', 'yes']);
      }
      if (!s.flags.sawRaid) out.push(['look', 'window']);
      out.push(['scan', 'drones']);
      if (!s.flags.hood) out.push(['take', 'dryer']);
      if (s.flags.agreed) out.push(['go', 'door']);
      return out;
    },
  });

  E.registerScene({
    id: 's2.m1.alley',
    location: 's2.loc.alley',
    art: 'arches',
    anyoneHacks: true,
    bandwidth: 2,
    help,
    enter: [L('narr', 'm1.a.1'), L('warn', 'm1.a.2'), L('bagley', 'm1.a.3')],
    look: [L('narr', 'm1.a.look')],
    implicit: { go: 'door', wait: 'drone' },
    // 無人機每三個動作掃一次巷子。
    onTurn(s) {
      s.flags.sweep = ((s.flags.sweep || 0) + 1) % 3;
      return s.flags.sweep === 0 ? [L('warn', 'm1.a.sweep')] : [];
    },
    entities: {
      light: {
        aliases: ['light', 'lamp', 'streetlight', '路燈', '路灯', '燈', '灯'],
        look: { lines: [L('narr', 'm1.light.look')] },
        hack: { once: true, cost: 1, exposure: 3, lines: [L('bagley', 'm1.light.hack.1'), L('narr', 'm1.light.hack.2')], effects: { flags: { dark: true } }, repeat: [L('dim', 'm1.light.again')] },
      },
      vent: {
        aliases: ['vent', 'steam', 'heat', '通風口', '通风口', '熱氣', '热气', '蒸氣', '蒸汽'],
        look: { lines: [L('narr', 'm1.vent.look')] },
        go: { id: 'hide', lines: [L('narr', 'm1.vent.hide')], effects: { flags: { hidden: true } } },
        take: { id: 'hide', lines: [L('narr', 'm1.vent.hide')], effects: { flags: { hidden: true } } },
      },
      drone: {
        aliases: ['drone', 'nightwatch', '無人機', '无人机', '守夜人', '探照燈', '探照灯'],
        look: { lines: [L('narr', 'm1.a.drone.look')] },
        scan: { lines: [L('prof', 'm1.a.drone.scan')] },
        hack: { lines: [L('bagley', 'm1.a.drone.hack')] },
        wait: { lines: [L('narr', 'm1.a.wait')] },
      },
      bins: {
        aliases: ['bin', 'bins', 'fox', '垃圾箱', '垃圾桶', '狐狸'],
        look: { lines: [L('narr', 'm1.bins.look')] },
      },
      door: {
        aliases: ['door', 'back door', 'building', 'basement', '後門', '后门', '門', '门', '樓', '楼', '地下室'],
        look: { lines: [L('narr', 'm1.door2.look')] },
        go: {
          // 路燈暗了、又躲在熱氣後面，無人機什麼都看不到；少一樣就會被記下來。外套能讓步態辨識認不出來。
          lines: (s) => [L(s.flags.dark && s.flags.hidden ? 'narr' : 'warn', s.flags.dark && s.flags.hidden ? 'm1.door2.clean' : s.flags.dark || s.flags.hidden ? 'm1.door2.half' : 'm1.door2.seen')],
          effects: (s) => {
            const clean = s.flags.dark && s.flags.hidden;
            const base = clean ? 0 : s.flags.dark || s.flags.hidden ? 10 : 25;
            return { exposure: Math.max(0, base - (s.flags.hood ? 5 : 0)), flags: { spotted: !clean } };
          },
          goto: 's2.m1.basement',
        },
      },
    },
    goals: (s) => [
      { k: 'm1.goal.sweep', note: true },
      { k: 'm1.goal.dark', how: 'm1.goal.dark.how', done: !!s.flags.dark },
      { k: 'm1.goal.hide', how: 'm1.goal.hide.how', done: !!s.flags.hidden },
      { k: 'm1.goal.door', how: 'm1.goal.door.how', done: false },
    ],
    suggest(s) {
      const out = [];
      if (!s.flags.dark) out.push(['hack', 'light']);
      if (!s.flags.hidden) out.push(['go', 'vent']);
      out.push(['scan', 'drone'], ['wait', 'drone'], ['go', 'door']);
      return out;
    },
  });

  E.registerScene({
    id: 's2.m1.basement',
    location: 's2.loc.safehouse',
    art: 'basement',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm1.b.1'), L('warn', 'm1.b.2'), L('bagley', 'm1.b.3')],
    look: [L('narr', 'm1.b.look')],
    implicit: { go: 'hatch', take: 'rack' },
    // 拿到硬碟之後，樓上的人在三個動作內就會衝下來。
    onTurn(s) {
      if (!s.flags.core || s.scene !== 's2.m1.basement') return [];
      s.flags.clock = (s.flags.clock || 0) + 1;
      return s.flags.clock < 3 ? [L('warn', 'm1.b.clock.' + s.flags.clock)] : [];
    },
    events: [
      {
        id: 'm1.burst',
        when: (s) => s.flags.core && s.flags.clock >= 3,
        lines: [L('warn', 'm1.b.burst.1'), L('narr', 'm1.b.burst.2')],
        effects: { exposure: 25, flags: { spotted: true } },
        goto: 's2.m1.canal',
      },
    ],
    entities: {
      rack: {
        aliases: ['rack', 'server', 'drive', 'core', 'disk', '機櫃', '机柜', '伺服器', '服务器', '硬碟', '硬盘', '核心', '綠燈', '绿灯'],
        look: { lines: [L('narr', 'm1.rack.look')] },
        take: { id: 'core', once: true, lines: [L('narr', 'm1.rack.take.1'), L('bagley', 'm1.rack.take.2'), L('warn', 'm1.rack.take.3')], effects: { flags: { core: true } }, repeat: [L('dim', 'm1.rack.again')] },
        hack: { lines: [L('bagley', 'm1.rack.hack')] },
      },
      wall: {
        aliases: ['wall', 'photos', 'photo', 'board', '牆', '墙', '照片', '名單', '名单'],
        look: { lines: [L('narr', 'm1.wall.look')] },
        scan: { lines: [L('prof', 'm1.wall.scan.1'), L('bagley', 'm1.wall.scan.2')] },
      },
      screen: {
        aliases: ['screen', 'monitor', 'terminal', 'computer', '螢幕', '屏幕', '終端', '终端', '電腦', '电脑'],
        look: { id: 'screen', lines: screenLines, effects: (s) => ({ flags: { sawScreen: true, hatchHint: (s.flags.world || 'stay') === 'stay' } }) },
        read: { id: 'screen', lines: screenLines, effects: (s) => ({ flags: { sawScreen: true, hatchHint: (s.flags.world || 'stay') === 'stay' } }) },
      },
      stairs: {
        aliases: ['stairs', 'upstairs', 'up', '樓梯', '楼梯', '樓上', '楼上'],
        look: { lines: [L('narr', 'm1.stairs.look')] },
        go: { lines: [L('dim', 'm1.stairs.go')] },
      },
      hatch: {
        aliases: ['hatch', 'coal', 'lid', 'cover', '鐵蓋', '铁盖', '運煤口', '运煤口', '蓋子', '盖子'],
        visible: (s) => s.flags.core || s.flags.hatchHint,
        look: { lines: [L('narr', 'm1.hatch.look')] },
        go: { requires: (s) => s.flags.core, fail: [L('bagley', 'm1.hatch.need')], lines: [L('narr', 'm1.hatch.go')], goto: 's2.m1.canal' },
      },
      mask: {
        aliases: ['mask', 'dedsec', 'graffiti', '面具', '塗鴉', '涂鸦'],
        look: { lines: [L('narr', 'm1.mask.look')] },
      },
    },
    goals: (s) => [
      { k: 'm1.goal.core', how: 'm1.goal.core.how', done: !!s.flags.core },
      { k: 'm1.goal.hatch', how: 'm1.goal.hatch.how', done: false },
    ],
    suggest(s) {
      const out = [];
      if (!s.flags.core) {
        out.push(['take', 'rack']);
        if (!s.flags.sawScreen) out.push(['look', 'screen']);
        out.push(['scan', 'wall']);
      } else out.push(['go', 'hatch']);
      return out;
    },
  });

  // 安全屋的螢幕：依第一季的結局顯示不同的東西。
  function screenLines(s) {
    const w = s.flags.world || 'stay';
    return [L('narr', 'm1.screen.look'), L('quote', 'm1.screen.' + w), L('bagley', 'm1.screen.' + w + '.b')];
  }

  E.registerScene({
    id: 's2.m1.canal',
    location: 's2.loc.canal',
    art: 'embankment',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm1.c.1'), L('warn', 'm1.c.2'), L('bagley', 'm1.c.3'), L('bagley', 'm1.c.4'), L('dim', 'm1.c.hint')],
    look: [L('narr', 'm1.c.look')],
    implicit: { talk: 'bagley', read: 'bagley' },
    entities: {
      bagley: {
        aliases: ['bagley', 'phone', 'list', '貝格利', '贝格利', '手機', '手机', '名單', '名单'],
        talk: { id: 'm1.end', lines: [L('bagley', 'm1.c.list')], effects: { flags: { m1done: true } } },
        read: { id: 'm1.end', lines: [L('bagley', 'm1.c.list')], effects: { flags: { m1done: true } } },
      },
      sky: {
        aliases: ['sky', 'drones', 'lights', '天空', '無人機', '无人机', '紅燈', '红灯'],
        look: { lines: [L('narr', 'm1.c.sky')] },
      },
      canal: {
        aliases: ['canal', 'water', 'swan', '運河', '运河', '水', '天鵝', '天鹅'],
        look: { lines: [L('narr', 'm1.c.canal')] },
      },
    },
    goals: (s) => [{ k: 'm1.goal.end', how: 'm1.goal.end.how', done: !!s.flags.m1done }],
    suggest() {
      return [['talk', 'bagley'], ['look', 'sky'], ['look', 'canal']];
    },
  });

  E.s2 = E.s2 || {};
  E.s2.missions = E.s2.missions || {};
  E.s2.missions.m1 = { start: 's2.m1.laundrette' };
})(window.ECHO = window.ECHO || {});
