// 第二季主線任務八：空域控制中心（終局）。
// 白廳底下的空域控制中心，全倫敦的守夜人都聽命於這個房間。獅心防務的執行長黑斯廷斯也在。
// 白廳 → 地堡入口 → 武裝無人機的走廊 → 控制中心（依盟友做最後一件事；回收的世界可以把 Echo 帶出來）→ 河邊的黎明。
// 結局由盟友決定：hale 籠子、cassie 野火、kahn 交易、誰都不選 黎明。
(function (E) {
  const { L, alertUp, help } = E.s2.kit;
  const HELP = {
    door: [
      ['badge', (m) => m.perk === 'network_access', 0],
      ['disguise', (m) => m.perk === 'disguise', 0],
      ['talk', (m) => m.cat === 'social', 2],
      ['climb', (m) => m.cat === 'physical', 3],
    ],
    hall: [
      ['takeover', (m) => m.perk === 'take_over', 0],
      ['legacy', (m) => m.perk === 'legacy', 0],
      ['loop', (m) => m.cat === 'hacker', 2],
      ['throw', (m) => m.cat === 'physical', 4],
    ],
  };
  const { helper, teamEntity } = E.s2.kit.kit('m8', HELP);
  const END = { hale: 'cage', cassie: 'wild', kahn: 'deal' };
  const ending = (s) => END[s.flags.ally] || 'dawn';
  const ally = (s) => s.flags.ally || 'none';

  // ===== 白廳 =====
  E.registerScene({
    id: 's2.m8.whitehall',
    location: 's2.loc.m8whitehall',
    art: 'alley',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('title', 'm8.title'),
      L('sys', 'm8.s.1', { n: s.flags.night }),
      L('narr', 'm8.s.2'),
      L('bagley', 'm8.s.3'),
      L('bagley', 'm8.ally.' + ally(s)),
      L('prof', 'm2.s.team', { names: s.flags.names }),
      L('dim', 'm8.s.hint'),
    ],
    look: [L('narr', 'm8.s.look')],
    implicit: { go: 'bunker' },
    entities: {
      horseguards: {
        aliases: ['horse guards', 'guards', 'arch', 'building', '騎兵衛隊', '骑兵卫队', '拱門', '拱门', '建築', '建筑'],
        look: { lines: [L('narr', 'm8.hg.look')] },
        scan: { lines: [L('prof', 'm8.hg.scan')] },
      },
      bunker: {
        aliases: ['bunker', 'stairs', 'down', 'door', 'go', '地堡', '樓梯', '楼梯', '下去', '入口', '出發', '出发'],
        look: { lines: [L('narr', 'm8.bunker.far')] },
        go: { lines: [L('narr', 'm8.bunker.go')], goto: 's2.m8.door' },
      },
    },
    suggest: () => [['scan', 'horseguards'], ['go', 'bunker']],
  });

  // ===== 地堡入口 =====
  const HALL = 's2.m8.hall';
  E.registerScene({
    id: 's2.m8.door',
    location: 's2.loc.m8door',
    art: 'dock',
    anyoneHacks: true,
    bandwidth: 3,
    help,
    enter: [L('narr', 'm8.d.1'), L('warn', 'm8.d.2'), L('bagley', 'm8.d.3')],
    look: [L('narr', 'm8.d.look')],
    implicit: { talk: 'team' },
    entities: {
      team: teamEntity('door', { goto: HALL }),
      blastdoor: {
        aliases: ['door', 'blast door', 'vault', 'reader', '防爆門', '防爆门', '門', '门', '讀卡機', '读卡器'],
        look: { lines: [L('narr', 'm8.door.look')] },
        hack: { cost: 1, exposure: 5, lines: [L('narr', 'm8.door.hack')], goto: HALL },
      },
      guard: {
        aliases: ['guard', 'guards', 'soldier', '警衛', '警卫', '士兵'],
        look: { lines: [L('narr', 'm8.guard.look')] },
        scan: { lines: [L('prof', 'm8.guard.scan')] },
      },
    },
    suggest(s) {
      const out = [];
      if (helper(s, 'door')) out.push(['talk', 'team']);
      out.push(['hack', 'blastdoor'], ['scan', 'guard']);
      return out;
    },
  });

  // ===== 武裝無人機的走廊：每兩個動作開火一次 =====
  const down = (s) => !!s.flags.hallDown;
  E.registerScene({
    id: HALL,
    location: 's2.loc.m8hall',
    art: 'tunnels',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm8.h.1'), L('warn', 'm8.h.2'), L('bagley', 'm8.h.3')],
    look: [L('narr', 'm8.h.look')],
    implicit: { talk: 'team', go: 'control' },
    onTurn(s) {
      if (down(s)) return [];
      s.flags.fire = ((s.flags.fire || 0) + 1) % 2;
      if (s.flags.fire) return [];
      s.exposure = Math.min(100, s.exposure + 8);
      return [L('warn', 'm8.h.fire'), alertUp(8)];
    },
    entities: {
      team: teamEntity('hall', { done: down, effects: () => ({ flags: { hallDown: true } }) }),
      turrets: {
        aliases: ['turret', 'turrets', 'drone', 'drones', 'guns', '砲塔', '炮塔', '無人機', '无人机', '槍', '枪'],
        look: { lines: (s) => [L('narr', down(s) ? 'm8.turret.down' : 'm8.turret.look')] },
        scan: { lines: [L('prof', 'm8.turret.scan')] },
        hack: { requires: (s) => !down(s), fail: [L('dim', 'err.done')], cost: 1, exposure: 4, lines: [L('narr', 'm8.turret.hack')], effects: { flags: { hallDown: true } } },
      },
      control: {
        aliases: ['control', 'room', 'end', 'door', 'ahead', '控制中心', '控制室', '盡頭', '尽头', '前面'],
        go: {
          lines: (s) => (down(s) ? [L('narr', 'm8.h.walk')] : [L('warn', 'm8.h.run'), alertUp(12)]),
          effects: (s) => ({ exposure: down(s) ? 0 : 12 }),
          goto: 's2.m8.control',
        },
      },
    },
    suggest(s) {
      const out = [];
      if (!down(s)) {
        if (helper(s, 'hall')) out.push(['talk', 'team']);
        out.push(['hack', 'turrets']);
      }
      out.push(['go', 'control']);
      return out;
    },
  });

  // ===== 空域控制中心 =====
  const recaptured = (s) => s.flags.world === 'recaptured';
  E.registerScene({
    id: 's2.m8.control',
    location: 's2.loc.m8control',
    art: 'server',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm8.c.1'), L('narr', 'm8.c.2'), L('quote', 'm8.c.3'), L('bagley', 'm8.c.4')]
      .concat(recaptured(s) ? [L('quote', 'm8.c.echo')] : []),
    look: [L('narr', 'm8.c.look')],
    implicit: { talk: 'hastings', hack: 'console' },
    entities: {
      hastings: {
        aliases: ['hastings', 'corbin', 'ceo', 'man', '黑斯廷斯', '科爾賓', '科尔宾', '執行長', '执行长'],
        look: { lines: [L('narr', 'm8.hast.look')] },
        scan: { lines: [L('prof', 'm8.hast.scan')] },
        talk: {
          lines: [L('quote', 'm8.hast.hi')],
          topics: {
            order: { aliases: ['order', 'why', 'curfew', '秩序', '為什麼', '为什么', '宵禁'], lines: [L('quote', 'm8.hast.order.1'), L('quote', 'm8.hast.order.2')] },
            list: { aliases: ['list', 'prediction', '名單', '名单', '預測', '预测'], lines: [L('quote', 'm8.hast.list'), L('bagley', 'm8.hast.list.b')] },
            echo: { aliases: ['echo', 'ai', 'engine', '引擎'], lines: (s) => [L('quote', 'm8.hast.echo.' + (s.flags.world || 'stay'))] },
          },
        },
      },
      screens: {
        aliases: ['screens', 'map', 'wall', 'drones', '螢幕', '屏幕', '地圖', '地图', '牆', '墙'],
        look: { lines: [L('narr', 'm8.screens.look')] },
        scan: { lines: [L('prof', 'm8.screens.scan')] },
      },
      echo: {
        aliases: ['echo', 'mainframe', 'core', 'help me', '主機', '主机', '核心'],
        visible: recaptured,
        look: { lines: [L('narr', 'm8.echo.look')] },
        talk: { requires: (s) => !s.flags.freedEcho, fail: [L('dim', 'err.done')], lines: [L('moment', 'm8.echo.free.1'), L('quote', 'm8.echo.free.2'), L('bagley', 'm8.echo.free.3')], effects: { flags: { freedEcho: true } } },
        hack: { requires: (s) => !s.flags.freedEcho, fail: [L('dim', 'err.done')], lines: [L('moment', 'm8.echo.free.1'), L('quote', 'm8.echo.free.2'), L('bagley', 'm8.echo.free.3')], effects: { flags: { freedEcho: true } } },
      },
      console: {
        aliases: ['console', 'keyboard', 'master', 'controls', 'nightwatch', '控制台', '鍵盤', '键盘', '主控', '守夜人'],
        look: { lines: [L('narr', 'm8.console.look')] },
        hack: {
          lines: (s) => [L('narr', 'm8.end.' + ending(s) + '.1'), L('moment', 'm8.end.' + ending(s) + '.2'), L('quote', 'm8.end.hastings')],
          goto: 's2.m8.dawn',
        },
      },
    },
    suggest(s) {
      const out = [['talk', 'hastings', 'order']];
      if (recaptured(s) && !s.flags.freedEcho) out.push(['talk', 'echo']);
      out.push(['look', 'screens'], ['hack', 'console']);
      return out;
    },
  });

  // ===== 河邊的黎明 =====
  E.registerScene({
    id: 's2.m8.dawn',
    location: 's2.loc.m8dawn',
    art: 'embankment',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm8.dawn.1'), L('moment', 'm8.dawn.2'), L('narr', 'm8.dawn.' + ending(s)), L('bagley', 'm8.dawn.b'), L('dim', 'm8.dawn.hint')],
    look: [L('narr', 'm8.dawn.look')],
    implicit: { talk: 'bagley' },
    entities: {
      bagley: {
        aliases: ['bagley', 'phone', '貝格利', '贝格利', '手機', '手机'],
        talk: { id: 'm8.end', lines: (s) => [L('bagley', 'm8.last.' + ending(s))], effects: { flags: { m8done: true } } },
      },
      sky: {
        aliases: ['sky', 'drones', 'sun', '天空', '無人機', '无人机', '太陽', '太阳'],
        look: { lines: [L('narr', 'm8.dawn.sky')] },
      },
    },
    suggest: () => [['look', 'sky'], ['talk', 'bagley']],
  });

  E.s2.missions.m8 = { start: 's2.m8.whitehall' };
})(window.ECHO = window.ECHO || {});
