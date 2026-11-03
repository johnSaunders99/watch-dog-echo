// 第二季主線任務七：斷電（西敏）。
// 把倫敦一區一區關掉，讓守夜人失去所有參考點，打開通往白廳的路。盟友（flags.ally）各有不同的幫法。
// 西敏橋 → 河邊的變電站 → 控制室（整張地圖一區一區暗下來）→ 黑暗的白廳街 → 安全屋。
(function (E) {
  const { L, alertUp, help } = E.s2.kit;
  const HELP = {
    gate: [
      ['pass', (m) => m.perk === 'site_pass', 0],
      ['badge', (m) => m.perk === 'network_access', 0],
      ['talk', (m) => m.cat === 'social', 2],
      ['climb', (m) => m.cat === 'physical', 3],
    ],
    out: [
      ['cab', (m) => m.perk === 'getaway', 0],
      ['lead', (m) => m.cat === 'physical', 3],
      ['chat', (m) => m.cat === 'social', 3],
    ],
  };
  const { helper, teamEntity } = E.s2.kit.kit('m7', HELP);
  const ally = (s) => s.flags.ally || 'none';

  // ===== 西敏橋 =====
  E.registerScene({
    id: 's2.m7.bridge',
    location: 's2.loc.m7bridge',
    art: 'embankment',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('title', 'm7.title'),
      L('sys', 'm7.s.1', { n: s.flags.night }),
      L('narr', 'm7.s.2'),
      L('bagley', 'm7.s.3'),
      L('bagley', 'm7.ally.' + ally(s)),
      L('prof', 'm2.s.team', { names: s.flags.names }),
      L('dim', 'm7.s.hint'),
    ],
    look: [L('narr', 'm7.s.look')],
    implicit: { go: 'substation' },
    entities: {
      parliament: {
        aliases: ['parliament', 'big ben', 'clock', 'tower', '國會', '国会', '大笨鐘', '大本钟', '鐘', '钟'],
        look: { lines: [L('narr', 'm7.parl.look')] },
        scan: { lines: [L('prof', 'm7.parl.scan')] },
      },
      river: {
        aliases: ['river', 'thames', 'water', '河', '泰晤士河', '河面'],
        look: { lines: [L('narr', 'm7.river.look')] },
      },
      substation: {
        aliases: ['substation', 'station', 'go', '變電站', '变电站', '出發', '出发'],
        look: { lines: [L('narr', 'm7.sub.far')] },
        go: { lines: [L('narr', 'm7.sub.go')], goto: 's2.m7.sub' },
      },
    },
    suggest: () => [['look', 'parliament'], ['look', 'river'], ['go', 'substation']],
  });

  // ===== 變電站的大門 =====
  const SWITCH = 's2.m7.switch';
  E.registerScene({
    id: 's2.m7.sub',
    location: 's2.loc.m7sub',
    art: 'station',
    anyoneHacks: true,
    bandwidth: 3,
    help,
    enter: [L('narr', 'm7.g.1'), L('warn', 'm7.g.2'), L('bagley', 'm7.g.3')],
    look: [L('narr', 'm7.g.look')],
    implicit: { talk: 'team' },
    onTurn(s) {
      s.flags.patrol = ((s.flags.patrol || 0) + 1) % 3;
      if (s.flags.patrol) return [];
      s.exposure = Math.min(100, s.exposure + 5);
      return [L('warn', 'm7.g.patrol'), alertUp(5)];
    },
    entities: {
      team: teamEntity('gate', { goto: SWITCH }),
      gate: {
        aliases: ['gate', 'door', 'lock', 'reader', '大門', '大门', '門', '门', '鎖', '锁'],
        look: { lines: [L('narr', 'm7.gate.look')] },
        hack: { cost: 1, exposure: 5, lines: [L('narr', 'm7.gate.hack')], goto: SWITCH },
      },
      drones: {
        aliases: ['drone', 'drones', 'guard', 'guards', '無人機', '无人机', '警衛', '警卫'],
        look: { lines: [L('narr', 'm7.drones.look')] },
        scan: { lines: [L('prof', 'm7.drones.scan')] },
      },
    },
    suggest(s) {
      const out = [];
      if (helper(s, 'gate')) out.push(['talk', 'team']);
      out.push(['hack', 'gate'], ['scan', 'drones']);
      return out;
    },
  });

  // ===== 控制室：整張地圖一區一區暗下來 =====
  E.registerScene({
    id: SWITCH,
    location: 's2.loc.m7switch',
    art: 'station',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm7.c.1'), L('narr', 'm7.c.2'), L('bagley', 'm7.how.' + ally(s))],
    look: [L('narr', 'm7.c.look')],
    implicit: { hack: 'board' },
    entities: {
      board: {
        aliases: ['board', 'console', 'map', 'breakers', 'grid', 'switch', 'london', '地圖', '地图', '開關', '开关', '電網', '电网', '倫敦', '伦敦', '控制台'],
        look: { lines: [L('narr', 'm7.board.look')] },
        hack: {
          lines: [
            L('mapout', 'm7.out.1'), L('narr', 'm7.out.camden'), L('narr', 'm7.out.soho'), L('narr', 'm7.out.iod'),
            L('narr', 'm7.out.rotherhithe'), L('narr', 'm7.out.westminster'), L('moment', 'm7.out.2'), L('bagley', 'm7.out.3'),
          ],
          goto: 's2.m7.street',
        },
      },
      engineer: {
        aliases: ['engineer', 'man', 'night shift', '工程師', '工程师', '值班'],
        look: { lines: [L('narr', 'm7.eng.look')] },
        talk: { lines: [L('quote', 'm7.eng.talk')] },
      },
    },
    suggest: () => [['look', 'board'], ['talk', 'engineer'], ['hack', 'board']],
  });

  // ===== 黑暗的白廳街 =====
  const HOME = 's2.m7.end';
  E.registerScene({
    id: 's2.m7.street',
    location: 's2.loc.m7street',
    art: 'highstreet-dark',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm7.o.1'), L('narr', 'm7.o.2'), L('warn', 'm7.o.3')],
    look: [L('narr', 'm7.o.look')],
    implicit: { talk: 'team', go: 'away' },
    entities: {
      team: teamEntity('out', { goto: HOME }),
      car: {
        aliases: ['car', 'patrol', 'van', '巡邏車', '巡逻车', '車', '车'],
        look: { lines: [L('narr', 'm7.car.look')] },
        hack: { cost: 1, exposure: 2, lines: [L('narr', 'm7.car.hack')], goto: HOME },
      },
      balconies: {
        aliases: ['balcony', 'balconies', 'candles', 'people', 'windows', '陽台', '阳台', '蠟燭', '蜡烛', '人們', '人们', '窗'],
        look: { lines: [L('narr', 'm7.balc.look')] },
      },
      away: {
        aliases: ['away', 'run', 'home', 'safe house', '離開', '离开', '跑', '回去', '安全屋'],
        go: { lines: [L('narr', 'm7.o.go'), alertUp(6)], effects: { exposure: 6 }, goto: HOME },
      },
    },
    suggest(s) {
      const out = [['look', 'balconies']];
      if (helper(s, 'out')) out.push(['talk', 'team']);
      out.push(['hack', 'car'], ['go', 'away']);
      return out;
    },
  });

  // ===== 安全屋 =====
  E.registerScene({
    id: HOME,
    location: 's2.loc.m7end',
    art: 'flat',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm7.e.1'), L('bagley', 'm7.e.2'), L('dim', 'm7.e.hint')],
    look: [L('narr', 'm7.e.look')],
    implicit: { talk: 'bagley' },
    entities: {
      bagley: {
        aliases: ['bagley', 'phone', '貝格利', '贝格利', '手機', '手机'],
        talk: { id: 'm7.end', lines: [L('bagley', 'm7.e.end')], effects: { flags: { m7done: true } } },
      },
    },
    suggest: () => [['talk', 'bagley']],
  });

  E.s2.missions.m7 = { start: 's2.m7.bridge' };
})(window.ECHO = window.ECHO || {});
