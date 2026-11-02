// 第二季主線任務三：高威脅（唐人街與蘇豪）。
// 一個威脅評分 91 的外送員（flags.extraName）在爵祿街被帶走，關在停車場裡的「預防性留置」廂型車上，十二點整就會被送走。
// 爵祿街 → 金鳳茶樓（浩文回來了）→ 停車場（進去、打開廂型車、讀到這個人的「重建報告」，也拿到名單的一份）→ 外送員車隊撤離 → 茶樓。
// 浩文一定要談過才能出發；最後撤離時，浩文叫來整條街的外送員。
(function (E) {
  const { L, alertUp, team, help } = E.s2.kit;
  const HELP = {
    door: [
      ['deliver', (m) => m.perk === 'building_access', 0],
      ['talk', (m) => m.cat === 'social', 1],
      ['climb', (m) => m.cat === 'physical', 2],
    ],
    van: [
      ['pick', (m) => m.perk === 'lockpick', 0],
      ['crack', (m) => m.cat === 'hacker', 2],
      ['force', (m) => m.cat === 'physical', 4],
    ],
  };
  const { helper, assist, teamEntity } = E.s2.kit.kit('m3', HELP);
  const rider = (s) => ({ name: s.flags.extraName });

  // ===== 爵祿街 =====
  E.registerScene({
    id: 's2.m3.gerrard',
    location: 's2.loc.m3street',
    art: 'gerrard',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('title', 'm3.title'),
      L('sys', 'm3.s.1', { n: s.flags.night }),
      L('narr', 'm3.s.2'),
      L('bagley', 'm3.s.3', rider(s)),
      L('bagley', 'm3.s.4'),
      L('prof', 'm2.s.team', { names: s.flags.names }),
      L('dim', 'm3.s.hint'),
    ],
    look: [L('narr', 'm3.s.look')],
    implicit: { go: 'teahouse' },
    entities: {
      app: {
        aliases: ['app', 'phone', 'delivery app', 'account', '外送平台', '外卖平台', '平台', '帳號', '账号', '手機', '手机'],
        look: { lines: (s) => [L('prof', 'm3.app.scan', rider(s))] },
        scan: { lines: (s) => [L('prof', 'm3.app.scan', rider(s)), L('bagley', 'm3.app.b')] },
      },
      lanterns: {
        aliases: ['lantern', 'lanterns', 'gate', 'arch', '燈籠', '灯笼', '牌樓', '牌楼'],
        look: { lines: [L('narr', 'm3.lanterns.look')] },
      },
      bikes: {
        aliases: ['bike', 'bikes', 'scooter', 'scooters', '機車', '摩托车', '外送車', '外卖车', '車', '车'],
        look: { lines: [L('narr', 'm3.bikes.look')] },
      },
      teahouse: {
        aliases: ['teahouse', 'golden phoenix', 'restaurant', 'tea house', '茶樓', '茶楼', '金鳳', '金凤', '餐廳', '餐厅'],
        look: { lines: [L('narr', 'm3.tea.look')] },
        go: { lines: [L('narr', 'm3.tea.go')], goto: 's2.m3.teahouse' },
      },
    },
    suggest: () => [['scan', 'app'], ['look', 'bikes'], ['go', 'teahouse']],
  });

  // ===== 金鳳茶樓：浩文 =====
  E.registerScene({
    id: 's2.m3.teahouse',
    location: 's2.loc.m3tea',
    art: 'teahouse',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm3.t.1'), L('narr', 'm3.t.2'), L('quote', 'm3.t.3'), L('bagley', 'm3.t.4')],
    look: [L('narr', 'm3.t.look')],
    implicit: { talk: 'homan', go: 'carpark' },
    entities: {
      homan: {
        aliases: ['homan', 'ho-man', 'chan', 'man', 'rider', '浩文', '陳浩文', '陈浩文', '浩文哥'],
        look: { lines: [L('narr', 'm3.homan.look')] },
        scan: { lines: [L('prof', 'm3.homan.scan')] },
        talk: {
          lines: [L('quote', 'm3.homan.hi')],
          effects: { flags: { metHoman: true } },
          topics: {
            where: {
              aliases: ['where', 'van', 'car park', 'taken', '哪裡', '哪里', '在哪', '廂型車', '面包车', '停車場', '停车场', '帶走', '带走'],
              lines: [L('quote', 'm3.homan.where.1'), L('quote', 'm3.homan.where.2')],
              effects: { flags: { metHoman: true, knowWhere: true } },
            },
            score: {
              aliases: ['score', 'threat', 'number', '分數', '分数', '評分', '评分', '91'],
              lines: [L('quote', 'm3.homan.score.1'), L('quote', 'm3.homan.score.2')],
              effects: { flags: { metHoman: true } },
            },
            echo: {
              aliases: ['echo', 'ai', '那個小傢伙', '那个小家伙', '機器', '机器'],
              lines: (s) => [L('quote', 'm3.homan.echo'), L('bagley', 'm3.homan.echo.' + (s.flags.world || 'stay'))],
              effects: { flags: { metHoman: true } },
            },
            help: {
              aliases: ['help', 'come', 'join', 'yes', '幫', '帮', '一起', '來', '来', '加入'],
              lines: [L('quote', 'm3.homan.help.1'), L('narr', 'm3.homan.help.2')],
              effects: { flags: { metHoman: true, knowWhere: true, homan: true } },
            },
          },
        },
      },
      riders: {
        aliases: ['riders', 'table', 'others', 'crowd', '外送員', '外卖员', '騎手', '骑手', '那桌', '其他人'],
        look: { lines: [L('narr', 'm3.riders.look')] },
      },
      tv: {
        aliases: ['tv', 'television', 'news', 'screen', '電視', '电视', '新聞', '新闻'],
        look: { lines: [L('narr', 'm3.tv.look')] },
      },
      carpark: {
        aliases: ['car park', 'carpark', 'go', 'out', '停車場', '停车场', '出發', '出发'],
        look: { lines: [L('narr', 'm3.carpark.far')] },
        go: { requires: (s) => s.flags.knowWhere, fail: [L('dim', 'm3.carpark.where')], lines: [L('narr', 'm3.carpark.go')], goto: 's2.m3.carpark' },
      },
    },
    suggest(s) {
      const out = [];
      if (!s.flags.metHoman) out.push(['talk', 'homan']);
      if (!s.flags.knowWhere) out.push(['talk', 'homan', 'where']);
      out.push(['talk', 'homan', 'score']);
      if (!s.flags.homan) out.push(['talk', 'homan', 'help']);
      if (s.flags.knowWhere) out.push(['go', 'carpark']);
      return out;
    },
  });

  // ===== 停車場：十二點整，廂型車就開走 =====
  // 第五個動作之後廂型車發動，浩文騎車擋在出口（被照到，警戒 +15）。
  const vanTimer = (s) => {
    if (s.flags.freed) return [];
    s.flags.clock = (s.flags.clock || 0) + 1;
    if (s.flags.clock === 3) return [L('warn', 'm3.c.clock')];
    return [];
  };
  E.registerScene({
    id: 's2.m3.carpark',
    location: 's2.loc.m3carpark',
    art: 'dock',
    anyoneHacks: true,
    bandwidth: 3,
    help,
    enter: (s) => [L('narr', 'm3.c.1'), L('warn', 'm3.c.2', rider(s)), L('bagley', 'm3.c.3')],
    look: [L('narr', 'm3.c.look')],
    implicit: { talk: 'team' },
    onTurn: vanTimer,
    events: [{
      id: 'm3.rush', when: (s) => !s.flags.inside && (s.flags.clock || 0) >= 5,
      lines: [L('warn', 'm3.c.rush.1'), L('narr', 'm3.c.rush.2'), alertUp(15)],
      effects: { exposure: 15, flags: { inside: true } },
      goto: 's2.m3.van',
    }],
    entities: {
      team: teamEntity('door', { effects: () => ({ flags: { inside: true } }), goto: 's2.m3.van' }),
      barrier: {
        aliases: ['barrier', 'gate', 'booth', 'camera', 'entrance', '柵欄', '栅栏', '閘門', '闸门', '崗亭', '岗亭', '入口', '攝影機', '摄像头'],
        look: { lines: [L('narr', 'm3.barrier.look')] },
        hack: { cost: 1, exposure: 4, lines: [L('narr', 'm3.barrier.hack')], effects: { flags: { inside: true } }, goto: 's2.m3.van' },
      },
      stairs: {
        aliases: ['stairs', 'stairwell', 'stair door', '樓梯', '楼梯', '樓梯間', '楼梯间', '樓梯門', '楼梯门'],
        look: { lines: [L('narr', 'm3.stairs.look')] },
        go: { lines: [L('narr', 'm3.stairs.go'), alertUp(6)], effects: { exposure: 6, flags: { inside: true } }, goto: 's2.m3.van' },
      },
      guards: {
        aliases: ['guard', 'guards', 'lionheart', '警衛', '警卫', '保全', '保安'],
        look: { lines: [L('narr', 'm3.guards.look')] },
        scan: { lines: [L('prof', 'm3.guards.scan')] },
      },
    },
    suggest(s) {
      const out = [];
      if (helper(s, 'door')) out.push(['talk', 'team']);
      out.push(['hack', 'barrier'], ['go', 'stairs'], ['scan', 'guards']);
      return out;
    },
  });

  // ===== 廂型車：打開車門、讀重建報告 =====
  const open = (s) => !!s.flags.freed;
  E.registerScene({
    id: 's2.m3.van',
    location: 's2.loc.m3van',
    art: 'dock',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm3.v.1'), L('narr', 'm3.v.2', rider(s))],
    look: [L('narr', 'm3.v.look')],
    implicit: { talk: 'team', read: 'terminal' },
    onTurn: vanTimer,
    entities: {
      team: teamEntity('van', { done: open, effects: () => ({ flags: { freed: true } }) }),
      van: {
        aliases: ['van', 'door', 'lock', 'back door', '廂型車', '面包车', '車門', '车门', '鎖', '锁'],
        look: { lines: (s) => [L('narr', open(s) ? 'm3.van.open' : 'm3.van.look')] },
        hack: { requires: (s) => !open(s), fail: [L('dim', 'err.done')], cost: 1, exposure: 4, lines: [L('narr', 'm3.van.hack')], effects: { flags: { freed: true } } },
      },
      prisoner: {
        aliases: ['rider', 'prisoner', 'person', 'them', '外送員', '外卖员', '騎手', '骑手', '那個人', '那个人'],
        look: { lines: (s) => [L('narr', open(s) ? 'm3.rider.free' : 'm3.rider.look', rider(s))] },
        talk: { lines: (s) => [L('quote', open(s) ? 'm3.rider.thanks' : 'm3.rider.wait', rider(s))] },
        scan: { lines: (s) => [L('prof', 'm3.app.scan', rider(s))] },
      },
      terminal: {
        aliases: ['terminal', 'report', 'screen', 'tablet', '終端', '终端', '報告', '报告', '螢幕', '屏幕', '平板'],
        look: { lines: [L('narr', 'm3.term.look')] },
        read: {
          id: 'm3.report', once: true,
          lines: (s) => [L('prof', 'm3.report.1', rider(s)), L('prof', 'm3.report.2'), L('prof', 'm3.report.3'), L('prof', 'm3.report.4'),
            L('bagley', 'm3.report.b'), L('gain', 'm3.piece', { n: s.flags.piece })],
          effects: { flags: { report: true } },
          repeat: [L('dim', 'err.done')],
        },
        hack: { lines: [L('dim', 'm3.term.hack')] },
      },
      exit: {
        aliases: ['exit', 'ramp', 'out', 'leave', '出口', '坡道', '離開', '离开', '出去'],
        look: { lines: [L('narr', 'm3.exit.look')] },
        go: { requires: open, fail: [L('dim', 'm3.exit.need')], lines: (s) => [L('narr', 'm3.exit.go', rider(s))], goto: 's2.m3.street2' },
      },
    },
    suggest(s) {
      const out = [];
      if (!open(s)) {
        if (helper(s, 'van')) out.push(['talk', 'team']);
        out.push(['hack', 'van']);
      }
      if (!s.flags.report) out.push(['read', 'terminal']);
      if (open(s)) out.push(['go', 'exit']);
      return out;
    },
  });

  // ===== 撤離：浩文叫來整條街的外送員 =====
  E.registerScene({
    id: 's2.m3.street2',
    location: 's2.loc.m3out',
    art: 'arches',
    anyoneHacks: true,
    help,
    enter: (s) => [L('warn', 'm3.o.1'), L('bagley', 'm3.o.2')].concat(s.flags.homan ? [L('quote', 'm3.o.homan')] : [L('dim', 'm3.o.alone')]),
    look: [L('narr', 'm3.o.look')],
    implicit: { talk: 'homan' },
    entities: {
      homan: {
        aliases: ['homan', 'ho-man', 'chan', 'riders', '浩文', '陳浩文', '陈浩文', '外送員', '外卖员', '車隊', '车队'],
        visible: (s) => !!s.flags.homan,
        talk: {
          lines: [L('narr', 'm3.swarm.1'), L('moment', 'm3.swarm.2'), L('narr', 'm3.swarm.3'), L('quote', 'm3.swarm.4')],
          goto: 's2.m3.end',
        },
      },
      drones: {
        aliases: ['drone', 'drones', 'nightwatch', '無人機', '无人机', '守夜人'],
        look: { lines: [L('narr', 'm3.o.drones')] },
        hack: { cost: 1, exposure: 3, lines: [L('narr', 'm3.o.hack')], goto: 's2.m3.end' },
      },
      street: {
        aliases: ['street', 'run', 'alley', 'away', '街', '巷子', '跑', '離開', '离开'],
        go: { lines: [L('warn', 'm3.o.run'), alertUp(12)], effects: { exposure: 12 }, goto: 's2.m3.end' },
      },
    },
    suggest: (s) => (s.flags.homan ? [['talk', 'homan'], ['hack', 'drones']] : [['hack', 'drones'], ['go', 'street']]),
  });

  // ===== 茶樓：結尾 =====
  E.registerScene({
    id: 's2.m3.end',
    location: 's2.loc.m3end',
    art: 'teahouse',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm3.e.1', rider(s)), L('quote', 'm3.e.2'), L('narr', 'm3.e.3'), L('bagley', 'm3.e.4'), L('dim', 'm3.e.hint')],
    look: [L('narr', 'm3.t.look')],
    implicit: { talk: 'homan' },
    entities: {
      homan: {
        aliases: ['homan', 'ho-man', 'chan', 'bagley', '浩文', '陳浩文', '陈浩文', '貝格利', '贝格利'],
        talk: { id: 'm3.end', lines: [L('quote', 'm3.e.join'), L('bagley', 'm3.e.b')], effects: { flags: { m3done: true } } },
      },
    },
    suggest: () => [['talk', 'homan']],
  });

  E.s2.missions.m3 = { start: 's2.m3.gerrard' };
})(window.ECHO = window.ECHO || {});
