// 第二季主線任務四：內應（狗島）。
// 黑爾博士（靜域）願意帶你們進大樓，拿走獅心防務「名單」的一份。安排這次會面的人，是瑪雅。
// 雨夜的後巷（見黑爾和瑪雅）→ 員工入口 → 靜室（第七號機櫃空著；拿到名單）→ 封鎖中的走廊 → 河邊的清晨。
// 黑爾的訪客證可以直接進門，但會留下紀錄；撤離時黑爾可以留下來替你們重設警報。
(function (E) {
  const { L, alertUp, help } = E.s2.kit;
  const HELP = {
    gate: [
      ['badge', (m) => m.perk === 'network_access', 0],
      ['disguise', (m) => m.perk === 'disguise', 0],
      ['pose', (m) => m.cat === 'social', 2],
      ['lift', (m) => m.cat === 'physical', 3],
    ],
    out: [
      ['cab', (m) => m.perk === 'getaway', 0],
      ['memory', (m) => (m.traits || []).includes('memory'), 0],
      ['stairs', (m) => m.cat === 'physical', 3],
      ['alarm', (m) => m.cat === 'social', 3],
    ],
  };
  const { helper, teamEntity } = E.s2.kit.kit('m4', HELP);
  const world = (s) => s.flags.world || 'stay';

  // ===== 雨夜的後巷：黑爾和瑪雅 =====
  E.registerScene({
    id: 's2.m4.alley',
    location: 's2.loc.m4alley',
    art: 'alley',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('title', 'm4.title'),
      L('sys', 'm4.s.1', { n: s.flags.night }),
      L('narr', 'm4.s.2'),
      L('narr', 'm4.s.3'),
      L('moment', 'm4.s.4'),
      L('quote', 'm4.s.5'),
      L('prof', 'm2.s.team', { names: s.flags.names }),
      L('dim', 'm4.s.hint'),
    ],
    look: [L('narr', 'm4.s.look')],
    implicit: { talk: 'hale', go: 'entrance' },
    entities: {
      hale: {
        aliases: ['hale', 'doctor', 'dr hale', 'owen', '黑爾', '黑尔', '黑爾博士', '黑尔博士', '博士'],
        look: { lines: [L('narr', 'm4.hale.look')] },
        scan: { lines: [L('prof', 'm4.hale.scan')] },
        talk: {
          lines: [L('quote', 'm4.hale.hi')],
          effects: { flags: { metHale: true } },
          topics: {
            why: { aliases: ['why', 'help', '為什麼', '为什么', '幫', '帮'], lines: [L('quote', 'm4.hale.why.1'), L('quote', 'm4.hale.why.2')], effects: { flags: { metHale: true } } },
            list: { aliases: ['list', 'prediction', '名單', '名单', '預測', '预测'], lines: [L('quote', 'm4.hale.list.1'), L('quote', 'm4.hale.list.2')], effects: { flags: { metHale: true } } },
            cage: { aliases: ['cage', 'after', 'plan', 'want', '籠子', '笼子', '之後', '之后', '想要'], lines: [L('quote', 'm4.hale.cage.1'), L('bagley', 'm4.hale.cage.2')], effects: { flags: { metHale: true } } },
            echo: { aliases: ['echo', 'ai', 'echo-7'], lines: (s) => [L('quote', 'm4.hale.echo.' + world(s))], effects: { flags: { metHale: true } } },
          },
        },
      },
      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
        look: { lines: [L('narr', 'm4.maya.look')] },
        scan: { lines: [L('prof', 'm4.maya.scan')] },
        talk: {
          lines: [L('quote', 'm4.maya.hi'), L('bagley', 'm4.maya.b')],
          topics: {
            where: { aliases: ['where', 'year', 'hiding', '哪裡', '哪里', '這一年', '这一年', '躲'], lines: [L('quote', 'm4.maya.where')] },
            echo: { aliases: ['echo', 'ai'], lines: (s) => [L('quote', 'm4.maya.echo.' + world(s))] },
          },
        },
      },
      stillwater: {
        aliases: ['tower', 'building', 'stillwater', '大樓', '大楼', '靜域', '静域'],
        look: { lines: [L('narr', 'm4.tower.look')] },
        scan: { lines: [L('prof', 'm4.tower.scan')] },
      },
      entrance: {
        aliases: ['entrance', 'door', 'staff entrance', 'in', '入口', '員工入口', '员工入口', '門', '门', '進去', '进去'],
        look: { lines: [L('narr', 'm4.entrance.far')] },
        go: { requires: (s) => s.flags.metHale, fail: [L('dim', 'm4.entrance.wait')], lines: [L('narr', 'm4.entrance.go')], goto: 's2.m4.gate' },
      },
    },
    suggest(s) {
      const out = [];
      if (!s.flags.metHale) out.push(['talk', 'hale']);
      out.push(['talk', 'hale', 'list'], ['talk', 'hale', 'cage'], ['talk', 'maya', 'where']);
      if (s.flags.metHale) out.push(['go', 'entrance']);
      return out;
    },
  });

  // ===== 員工入口：訪客證、隊友，或自己駭閘門 =====
  const QUIET = 's2.m4.quiet';
  E.registerScene({
    id: 's2.m4.gate',
    location: 's2.loc.m4gate',
    art: 'dock',
    anyoneHacks: true,
    bandwidth: 3,
    help,
    enter: [L('narr', 'm4.g.1'), L('warn', 'm4.g.2'), L('quote', 'm4.g.3')],
    look: [L('narr', 'm4.g.look')],
    implicit: { talk: 'team' },
    entities: {
      team: teamEntity('gate', { goto: QUIET }),
      badge: {
        aliases: ['badge', 'pass', 'visitor pass', 'card', '訪客證', '访客证', '證件', '证件', '卡'],
        look: { lines: [L('narr', 'm4.badge.look')] },
        take: { lines: [L('narr', 'm4.badge.use'), alertUp(8)], effects: { exposure: 8, flags: { badge: true } }, goto: QUIET },
      },
      turnstile: {
        aliases: ['turnstile', 'gate', 'gates', 'reader', '閘門', '闸门', '閘機', '闸机', '讀卡機', '读卡器'],
        look: { lines: [L('narr', 'm4.turn.look')] },
        hack: { cost: 1, exposure: 5, lines: [L('narr', 'm4.turn.hack')], goto: QUIET },
      },
      guard: {
        aliases: ['guard', 'security', 'desk', '警衛', '警卫', '保全', '保安', '櫃台', '柜台'],
        look: { lines: [L('narr', 'm4.guard.look')] },
        scan: { lines: [L('prof', 'm4.guard.scan')] },
      },
    },
    suggest(s) {
      const out = [];
      if (helper(s, 'gate')) out.push(['talk', 'team']);
      out.push(['take', 'badge'], ['hack', 'turnstile']);
      return out;
    },
  });

  // ===== 靜室：空的第七號機櫃，名單的一份 =====
  E.registerScene({
    id: QUIET,
    location: 's2.loc.m4quiet',
    art: 'server',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm4.q.1'), L('moment', 'm4.q.2'), L('narr', 'm4.q.3.' + world(s)), L('quote', 'm4.q.4')],
    look: [L('narr', 'm4.q.look')],
    implicit: { talk: 'maya' },
    entities: {
      cabinet: {
        aliases: ['rack', 'cabinet', 'seven', 'echo-7', 'empty', '機櫃', '机柜', '第七號', '第七号', '空機櫃', '空机柜'],
        look: { lines: (s) => [L('narr', 'm4.q.3.' + world(s))] },
        scan: { lines: [L('prof', 'm4.rack.scan')] },
      },
      terminal: {
        aliases: ['terminal', 'list', 'server', 'console', '終端', '终端', '名單', '名单', '伺服器', '服务器'],
        look: { lines: [L('narr', 'm4.term.look')] },
        hack: { requires: (s) => !s.flags.piece2, fail: [L('dim', 'err.done')], cost: 1, exposure: 4, lines: (s) => [L('narr', 'm4.term.hack'), L('gain', 'm4.piece', { n: s.flags.piece }), L('warn', 'm4.alarm')], effects: { flags: { piece2: true } }, goto: 's2.m4.out' },
      },
      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
        talk: { requires: (s) => !s.flags.piece2, fail: [L('dim', 'err.done')], lines: (s) => [L('quote', 'm4.maya.hack.1'), L('narr', 'm4.maya.hack.2'), L('gain', 'm4.piece', { n: s.flags.piece }), L('warn', 'm4.alarm')], effects: { flags: { piece2: true } }, goto: 's2.m4.out' },
      },
      hale: {
        aliases: ['hale', 'doctor', '黑爾', '黑尔', '博士'],
        talk: { lines: [L('quote', 'm4.q.hale')] },
      },
      window: {
        aliases: ['window', 'view', 'canary wharf', '窗', '窗外', '金絲雀碼頭', '金丝雀码头'],
        look: { lines: [L('narr', 'm4.q.window')] },
      },
    },
    suggest: () => [['look', 'cabinet'], ['talk', 'maya'], ['hack', 'terminal']],
  });

  // ===== 封鎖中的走廊：三個動作之內，防火門就會全部關上 =====
  const HOME = 's2.m4.end';
  E.registerScene({
    id: 's2.m4.out',
    location: 's2.loc.m4out',
    art: 'station',
    anyoneHacks: true,
    help,
    enter: [L('warn', 'm4.o.1'), L('bagley', 'm4.o.2')],
    look: [L('narr', 'm4.o.look')],
    implicit: { talk: 'team' },
    onTurn(s) {
      if (s.scene !== 's2.m4.out') return [];
      s.flags.lock = (s.flags.lock || 0) + 1;
      return s.flags.lock < 3 ? [L('warn', 'm4.o.lock.' + s.flags.lock)] : [];
    },
    events: [{
      id: 'm4.sealed', when: (s) => s.flags.lock >= 3,
      lines: [L('warn', 'm4.o.sealed.1'), L('narr', 'm4.o.sealed.2'), alertUp(20)],
      effects: { exposure: 20 },
      goto: HOME,
    }],
    entities: {
      team: teamEntity('out', { goto: HOME }),
      hale: {
        aliases: ['hale', 'doctor', '黑爾', '黑尔', '博士'],
        talk: { lines: [L('quote', 'm4.o.hale.1'), L('narr', 'm4.o.hale.2')], effects: { flags: { haleStayed: true } }, goto: HOME },
      },
      firedoor: {
        aliases: ['door', 'fire door', 'doors', '防火門', '防火门', '門', '门'],
        look: { lines: [L('narr', 'm4.door.look')] },
        hack: { cost: 1, exposure: 3, lines: [L('narr', 'm4.door.hack')], goto: HOME },
      },
    },
    suggest(s) {
      const out = [];
      if (helper(s, 'out')) out.push(['talk', 'team']);
      out.push(['hack', 'firedoor'], ['talk', 'hale']);
      return out;
    },
  });

  // ===== 河邊的清晨：瑪雅加入 =====
  E.registerScene({
    id: HOME,
    location: 's2.loc.m4end',
    art: 'embankment',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm4.e.1'), L('narr', s.flags.haleStayed ? 'm4.e.stayed' : s.flags.badge ? 'm4.e.badge' : 'm4.e.clean'), L('quote', 'm4.e.2'), L('bagley', 'm4.e.3'), L('dim', 'm4.e.hint')],
    look: [L('narr', 'm4.e.look')],
    implicit: { talk: 'maya' },
    entities: {
      maya: {
        aliases: ['maya', 'okafor', 'bagley', '瑪雅', '玛雅', '貝格利', '贝格利'],
        talk: { id: 'm4.end', lines: [L('quote', 'm4.e.join'), L('bagley', 'm4.e.b')], effects: { flags: { m4done: true } } },
      },
    },
    suggest: () => [['talk', 'maya']],
  });

  E.s2.missions.m4 = { start: 's2.m4.alley' };
})(window.ECHO = window.ECHO || {});
