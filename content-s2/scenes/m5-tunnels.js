// 第二季主線任務五：隧道（羅瑟希德）。
// 獅心防務的無人機巢蓋在舊隧道的正上方。艾琳・沃什手上有祖母的筆記本，記著整個隧道網路。
// 艾琳家門口 → 隧道入口的鐵柵（隊友打開，或繞去教堂地下室）→ 淹水的岔路（照筆記本走就不用涉水）
// → 無人機巢（拿名單；可以順便讓整座巢的無人機降落）→ 艾琳帶路出去 → 艾琳的廚房。
(function (E) {
  const { L, alertUp, help } = E.s2.kit;
  const HELP = {
    grate: [
      ['pick', (m) => m.perk === 'lockpick', 0],
      ['lift', (m) => m.perk === 'heavy_lift', 0],
      ['force', (m) => m.cat === 'physical', 2],
    ],
    hive: [
      ['takeover', (m) => m.perk === 'take_over', 0],
      ['legacy', (m) => m.perk === 'legacy', 0],
      ['land', (m) => m.cat === 'hacker', 3],
    ],
  };
  const { helper, teamEntity } = E.s2.kit.kit('m5', HELP);
  const world = (s) => s.flags.world || 'stay';
  const EILEEN = ['eileen', 'walsh', 'mrs walsh', '艾琳', '沃什', '艾琳太太'];

  // ===== 艾琳家門口 =====
  E.registerScene({
    id: 's2.m5.door',
    location: 's2.loc.m5door',
    art: 'rotherhithe',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('title', 'm5.title'),
      L('sys', 'm5.s.1', { n: s.flags.night }),
      L('narr', 'm5.s.2'),
      L('narr', 'm5.s.3'),
      L('quote', 'm5.s.4'),
      L('bagley', 'm5.s.5'),
      L('prof', 'm2.s.team', { names: s.flags.names }),
      L('dim', 'm5.s.hint'),
    ],
    look: [L('narr', 'm5.s.look')],
    implicit: { talk: 'eileen', go: 'tunnels' },
    entities: {
      eileen: {
        aliases: EILEEN,
        look: { lines: [L('narr', 'm5.eileen.look')] },
        scan: { lines: [L('prof', 'm5.eileen.scan'), L('quote', 'm5.eileen.scanned')] },
        talk: {
          lines: [L('quote', 'm5.eileen.hi')],
          topics: {
            hive: { aliases: ['hive', 'drones', 'pump', '巢', '無人機', '无人机', '泵站'], lines: [L('quote', 'm5.eileen.hive.1'), L('quote', 'm5.eileen.hive.2')] },
            notebook: { aliases: ['notebook', 'grandmother', 'tunnels', '筆記本', '笔记本', '祖母', '隧道'], lines: [L('quote', 'm5.eileen.book.1'), L('quote', 'm5.eileen.book.2')] },
            echo: { aliases: ['echo', 'ai', 'machine', '機器', '机器'], lines: (s) => [L('quote', 'm5.eileen.echo.' + world(s))] },
            help: {
              aliases: ['help', 'come', 'join', 'yes', 'please', '幫', '帮', '一起', '拜託', '拜托', '請', '请'],
              lines: [L('quote', 'm5.eileen.yes.1'), L('narr', 'm5.eileen.yes.2')],
              effects: { flags: { eileen: true } },
            },
          },
        },
      },
      van: {
        aliases: ['van', 'grey van', 'corner', '廂型車', '面包车', '灰色廂型車', '灰色面包车'],
        look: { lines: [L('narr', 'm5.van.look')] },
        scan: { lines: [L('prof', 'm5.van.scan'), L('quote', 'm5.van.eileen')] },
      },
      tunnels: {
        aliases: ['tunnels', 'tunnel', 'go', 'shaft', '隧道', '豎井', '竖井', '出發', '出发'],
        look: { lines: [L('narr', 'm5.tunnels.far')] },
        go: { requires: (s) => s.flags.eileen, fail: [L('dim', 'm5.tunnels.need')], lines: [L('narr', 'm5.tunnels.go')], goto: 's2.m5.grate' },
      },
    },
    suggest(s) {
      const out = [['talk', 'eileen', 'hive'], ['talk', 'eileen', 'notebook']];
      if (!s.flags.eileen) out.push(['talk', 'eileen', 'help']);
      else out.push(['go', 'tunnels']);
      out.push(['scan', 'van']);
      return out;
    },
  });

  // ===== 隧道入口：鐵柵 =====
  const TUNNELS = 's2.m5.tunnels';
  E.registerScene({
    id: 's2.m5.grate',
    location: 's2.loc.m5grate',
    art: 'tunnels',
    anyoneHacks: true,
    bandwidth: 3,
    help,
    enter: [L('narr', 'm5.g.1'), L('quote', 'm5.g.2')],
    look: [L('narr', 'm5.g.look')],
    implicit: { talk: 'team' },
    entities: {
      team: teamEntity('grate', { goto: TUNNELS }),
      grate: {
        aliases: ['grate', 'gate', 'lock', 'padlock', '鐵柵', '铁栅', '柵欄', '栅栏', '鎖', '锁', '掛鎖', '挂锁'],
        look: { lines: [L('narr', 'm5.grate.look')] },
        hack: { lines: [L('dim', 'm5.grate.hack')] },
        jump: { lines: [L('dim', 'm5.grate.climb')] },
      },
      church: {
        aliases: ['church', 'crypt', 'other way', '教堂', '地下室', '另一條路', '另一条路'],
        look: { lines: [L('narr', 'm5.church.look')] },
        go: { lines: [L('narr', 'm5.church.go'), alertUp(6)], effects: { exposure: 6 }, goto: TUNNELS },
      },
    },
    suggest(s) {
      const out = [];
      if (helper(s, 'grate')) out.push(['talk', 'team']);
      out.push(['go', 'church'], ['look', 'grate']);
      return out;
    },
  });

  // ===== 淹水的岔路 =====
  E.registerScene({
    id: TUNNELS,
    location: 's2.loc.m5tunnels',
    art: 'tunnels',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm5.t.1'), L('narr', 'm5.t.2'), L('quote', 'm5.t.3')],
    look: [L('narr', 'm5.t.look')],
    implicit: { read: 'notebook', go: 'passage' },
    entities: {
      notebook: {
        aliases: ['notebook', 'book', 'map', 'route', '筆記本', '笔记本', '地圖', '地图', '路線', '路线'],
        look: { lines: [L('narr', 'm5.book.look')] },
        read: { id: 'm5.route', lines: [L('quote', 'm5.book.read.1'), L('narr', 'm5.book.read.2')], effects: { flags: { route: true } } },
      },
      inscription: {
        aliases: ['inscription', 'wall', 'bricks', '1843', '刻字', '牆', '墙', '磚', '砖'],
        look: { lines: [L('narr', 'm5.wall.look')] },
      },
      passage: {
        aliases: ['passage', 'left', 'water', 'on', 'ahead', '通道', '左邊', '左边', '水', '往前', '前面'],
        look: { lines: [L('narr', 'm5.passage.look')] },
        go: {
          lines: (s) => (s.flags.route ? [L('narr', 'm5.passage.dry')] : [L('warn', 'm5.passage.wet'), alertUp(6)]),
          effects: (s) => ({ exposure: s.flags.route ? 0 : 6 }),
          goto: 's2.m5.hive',
        },
      },
    },
    suggest: (s) => (s.flags.route ? [['go', 'passage'], ['look', 'inscription']] : [['read', 'notebook'], ['look', 'inscription'], ['go', 'passage']]),
  });

  // ===== 無人機巢 =====
  const grounded = (s) => !!s.flags.hiveDown;
  E.registerScene({
    id: 's2.m5.hive',
    location: 's2.loc.m5hive',
    art: 'station',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm5.h.1'), L('narr', 'm5.h.2'), L('bagley', 'm5.h.3')],
    look: [L('narr', 'm5.h.look')],
    implicit: { talk: 'team', go: 'back' },
    entities: {
      team: teamEntity('hive', { done: grounded, effects: () => ({ flags: { hiveDown: true } }), after: () => landing() }),
      server: {
        aliases: ['server', 'list', 'terminal', 'data', '伺服器', '服务器', '名單', '名单', '終端', '终端', '資料', '数据'],
        look: { lines: [L('narr', 'm5.server.look')] },
        hack: { requires: (s) => !s.flags.data, fail: [L('dim', 'err.done')], cost: 1, exposure: 4, lines: (s) => [L('narr', 'm5.server.hack'), L('gain', 'm5.piece', { n: s.flags.piece })], effects: { flags: { data: true } } },
      },
      hive: {
        aliases: ['hive', 'drones', 'racks', 'docks', '巢', '無人機', '无人机', '機架', '机架'],
        look: { lines: (s) => [L('narr', grounded(s) ? 'm5.hive.down' : 'm5.hive.look')] },
        scan: { lines: [L('prof', 'm5.hive.scan')] },
        hack: { requires: (s) => !grounded(s), fail: [L('dim', 'err.done')], cost: 2, exposure: 6, lines: [L('narr', 'm5.hive.hack')], effects: { flags: { hiveDown: true } }, after: () => landing() },
      },
      back: {
        aliases: ['back', 'out', 'leave', 'tunnel', '回去', '出去', '離開', '离开', '隧道'],
        go: { requires: (s) => s.flags.data, fail: [L('dim', 'm5.back.need')], lines: [L('quote', 'm5.back.eileen'), L('narr', 'm5.back.go')], goto: 's2.m5.end' },
      },
    },
    suggest(s) {
      const out = [];
      if (!s.flags.data) out.push(['hack', 'server']);
      if (!grounded(s)) {
        if (helper(s, 'hive')) out.push(['talk', 'team']);
        out.push(['hack', 'hive']);
      }
      if (s.flags.data) out.push(['go', 'back']);
      return out;
    },
  });
  // 整座巢的無人機降落：這次任務的高潮。
  const landing = () => [L('moment', 'm5.land.1'), L('narr', 'm5.land.2'), L('quote', 'm5.land.3')];

  // ===== 艾琳的廚房 =====
  E.registerScene({
    id: 's2.m5.end',
    location: 's2.loc.m5end',
    art: 'kitchen',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm5.e.1'), L('narr', grounded(s) ? 'm5.e.down' : 'm5.e.quiet'), L('quote', 'm5.e.2'), L('bagley', 'm5.e.3'), L('dim', 'm5.e.hint')],
    look: [L('narr', 'm5.e.look')],
    implicit: { talk: 'eileen' },
    entities: {
      eileen: {
        aliases: EILEEN.concat(['bagley', '貝格利', '贝格利']),
        talk: { id: 'm5.end', lines: [L('quote', 'm5.e.join'), L('bagley', 'm5.e.b')], effects: { flags: { m5done: true } } },
      },
    },
    suggest: () => [['talk', 'eileen']],
  });

  E.s2.missions.m5 = { start: 's2.m5.door' };
})(window.ECHO = window.ECHO || {});
