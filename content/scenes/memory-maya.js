// 記憶一：瑪雅・奧卡福，靜域突入之夜。三個場景：後巷 → 裝卸區 → 靜室。
// 同步率從 64% 開始，低於 50% 記憶崩塌，回到該場景的入口。
// 瑪雅的人格：不使用暴力、不丟下同伴、先確認退路。符合就加分，違背就扣分。
// 隱藏線索：同步率 85% 以上時查看浩文，會注意到他在機櫃後面動了手腳；硬翻他的保溫箱也能找到，但會扣同步率。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });

  // 三個記憶場景共用：瑪雅不動手。
  const memoryDefaults = {
    attack: { lines: [L('narr', 'mem.attack.1'), L('dim', 'mem.attack.2')], effects: { sync: -30 } },
  };

  E.registerScene({
    id: 'memory.maya.alley',
    location: 'mem.alley.loc',
    memory: true,
    checkpoint: true,
    implicit: { go: 'dock' },
    defaults: memoryDefaults,

    enter: [
      L('sys', 'mem.alley.1'),
      L('dim', 'mem.alley.2'),
      L('dim', 'mem.alley.3'),
      L('pause'),
      L('narr', 'mem.alley.4'),
      L('narr', 'mem.alley.5'),
      L('quote', 'mem.alley.6'),
    ],

    look: [L('narr', 'mem.alley.look.1'), L('narr', 'mem.alley.look.2'), L('dim', 'mem.alley.look.3')],

    entities: {
      phone: {
        aliases: ['phone', 'map', 'plan', '手機', '平面圖', '地圖', '手机', '平面图', '地图'],
        look: { lines: [L('narr', 'mem.phone.look')] },
        read: {
          id: 'mem.plan',
          once: true,
          lines: [L('narr', 'mem.phone.read.1'), L('narr', 'mem.phone.read.2')],
          effects: { sync: 4 },
          repeat: [L('narr', 'mem.phone.read.1')],
        },
      },

      alleycam: {
        aliases: ['camera', 'cctv', 'cam', '巷口監視器', '監視器', '攝影機', '监控', '摄像头', '监视器'],
        look: { lines: [L('narr', 'mem.alleycam.look')] },
        scan: { lines: [L('prof', 'mem.alleycam.scan')] },
        hack: {
          id: 'mem.alleycam',
          once: true,
          lines: [L('narr', 'mem.alleycam.hack')],
          effects: { sync: 6 },
        },
      },

      drain: {
        aliases: ['drain', 'manhole', 'grate', 'cover', 'sewer', '排水溝蓋', '排水溝', '溝蓋', '下水道', '排水沟盖', '排水沟', '井盖'],
        look: {
          id: 'mem.drain',
          once: true,
          lines: [L('narr', 'mem.drain.look.1'), L('narr', 'mem.drain.look.2')],
          effects: { sync: 8, clue: 'drain', flags: { exitChecked: true } },
          repeat: [L('dim', 'mem.drain.repeat')],
        },
        scan: { lines: [L('prof', 'mem.drain.scan')] },
      },

      bin: {
        aliases: ['bin', 'skip', 'trash', 'badges', '回收箱', '垃圾桶', '識別證', '垃圾箱', '工牌'],
        look: { lines: [L('narr', 'mem.bin.look')] },
      },

      dock: {
        aliases: ['dock', 'loading bay', 'loading', 'bay', '裝卸區', '裝卸', '装卸区', '装卸'],
        look: { lines: [L('narr', 'mem.dock.far')] },
        go: {
          lines: (s) => s.flags.exitChecked
            ? [L('narr', 'mem.dock.go')]
            : [L('narr', 'mem.dock.go'), L('dim', 'mem.dock.noexit')],
          effects: (s) => (s.flags.exitChecked ? null : { sync: -6 }),
          goto: 'memory.maya.dock',
        },
      },
    },

    suggest(s) {
      const out = [['look']];
      if (!s.fired['mem.plan']) out.push(['read', 'phone']);
      if (!s.fired['mem.alleycam']) out.push(['hack', 'alleycam']);
      if (!s.flags.exitChecked) out.push(['look', 'drain']);
      out.push(['go', 'dock']);
      return out;
    },
  });

  E.registerScene({
    id: 'memory.maya.dock',
    location: 'mem.dock.loc',
    memory: true,
    checkpoint: true,
    implicit: { go: 'shutter' },
    defaults: memoryDefaults,

    enter: [L('narr', 'mem.dock.1'), L('narr', 'mem.dock.2'), L('echo', 'mem.dock.3')],

    look: [L('narr', 'mem.dock.look.1'), L('dim', 'mem.dock.look.2')],

    entities: {
      guard: {
        aliases: ['guard', 'security', 'hollis', '守衛', '保全', '警衛', '守卫', '保安'],
        look: { lines: [L('narr', 'mem.guard.look')] },
        scan: { lines: [L('prof', 'mem.guard.scan.1'), L('prof', 'mem.guard.scan.2'), L('prof', 'mem.guard.scan.3')] },
        talk: {
          lines: [L('narr', 'mem.guard.talk'), L('dim', 'mem.guard.talk.2')],
          effects: { sync: -5 },
        },
      },

      monitor: {
        aliases: ['monitor', 'screen', 'booth', '監控螢幕', '螢幕', '警衛亭', '监控屏幕', '屏幕', '岗亭'],
        look: { lines: [L('narr', 'mem.monitor.look')] },
        hack: {
          id: 'mem.loop',
          once: true,
          lines: [L('narr', 'mem.monitor.hack')],
          effects: { sync: 4, flags: { path: true } },
        },
      },

      gphone: {
        aliases: ['phone', "guard's phone", '守衛的手機', '他的手機', '手機', '保安的手机', '守卫的手机', '他的手机', '手机'],
        look: { lines: [L('narr', 'mem.gphone.look')] },
        hack: {
          id: 'mem.gphone',
          once: true,
          lines: [L('narr', 'mem.gphone.hack.1'), L('narr', 'mem.gphone.hack.2')],
          effects: { sync: -3, flags: { path: true } },
          after: [L('dim', 'mem.gphone.hack.3')],
        },
      },

      rider: {
        aliases: ['rider', 'courier', 'delivery', 'homan', 'ho-man', 'chan', '外送員', '浩文', '陳浩文', '外卖骑手', '外卖员', '骑手', '陈浩文'],
        look: { lines: [L('narr', 'mem.rider.look')] },
        scan: {
          lines: [L('prof', 'mem.rider.scan.1'), L('prof', 'mem.rider.scan.2')],
          effects: { clue: 'payment' },
          after: [L('echo', 'mem.rider.scan.3')],
        },
        talk: {
          id: 'mem.thanks',
          once: true,
          lines: [L('quote', 'mem.rider.talk'), L('narr', 'mem.rider.talk.2')],
          effects: { sync: 5 },
          repeat: [L('dim', 'mem.rider.talk.again')],
        },
      },

      shutter: {
        aliases: ['shutter', 'door', 'gate', 'lift', 'elevator', '鐵捲門', '貨梯', '門', '卷帘门', '铁卷门', '货梯', '门'],
        look: { lines: [L('narr', 'mem.shutter.look')] },
        go: {
          requires: (s) => s.flags.path,
          fail: [L('narr', 'mem.shutter.blocked'), L('dim', 'mem.shutter.hint')],
          lines: [L('narr', 'mem.shutter.go.1'), L('quote', 'mem.shutter.go.2')],
          goto: 'memory.maya.server',
        },
      },
    },

    suggest(s) {
      const out = [['look']];
      if (!s.clues.includes('payment')) out.push(['scan', 'rider']);
      if (!s.fired['mem.thanks']) out.push(['talk', 'rider']);
      if (!s.flags.path) out.push(['hack', 'monitor']);
      out.push(['go', 'shutter']);
      return out;
    },
  });

  E.registerScene({
    id: 'memory.maya.server',
    location: 'mem.server.loc',
    memory: true,
    checkpoint: true,
    implicit: { go: 'exit' },
    defaults: memoryDefaults,

    enter: [L('narr', 'mem.server.1'), L('narr', 'mem.server.2'), L('echo', 'mem.server.3')],

    look: (s) => [
      L('narr', 'mem.server.look.1'),
      s.flags.alarm ? L('warn', 'mem.server.look.3') : L('dim', 'mem.server.look.2'),
    ],

    entities: {
      echo7: {
        aliases: ['echo-7', 'echo7', 'echo', 'rack', 'server', 'port', 'ECHO-7', '機櫃', '伺服器', '傳輸埠', '机柜', '服务器', '端口'],
        look: { lines: [L('narr', 'mem.echo7.look')] },
        scan: {
          lines: [L('prof', 'mem.echo7.scan.1'), L('prof', 'mem.echo7.scan.2')],
          after: [L('echo', 'mem.echo7.scan.3')],
        },
        hack: {
          id: 'mem.transfer',
          once: true,
          lines: [L('sys', 'mem.transfer.1'), L('sys', 'mem.transfer.2'), L('warn', 'mem.transfer.3')],
          effects: { sync: 4, flags: { alarm: true } },
        },
      },

      board: {
        aliases: ['whiteboard', 'board', 'wall', '白板', '牆', '墙'],
        look: { lines: [L('narr', 'mem.board.look.1'), L('quote', 'mem.board.look.2')], effects: { clue: 'board' } },
        scan: { lines: [L('prof', 'mem.board.scan')] },
      },

      homan: {
        aliases: ['homan', 'ho-man', 'chan', 'rider', 'him', '浩文', '陳浩文', '外送員', '他', '陈浩文', '外卖骑手', '骑手'],
        look: {
          // 只有同步率夠高、真正用瑪雅的眼睛在看的時候，才會注意到他的小動作。
          lines: (s) => {
            const out = [L('narr', 'mem.homan.look.1')];
            if (s.flags.device) out.push(L('dim', 'mem.homan.look.4'));
            else if (s.sync >= 85) out.push(L('narr', 'mem.homan.look.2'));
            else out.push(L('dim', 'mem.homan.look.3'));
            return out;
          },
          effects: (s) => (!s.flags.device && s.sync >= 85
            ? { sync: 3, clue: 'device', flags: { device: true } }
            : null),
        },
        talk: {
          lines: (s) => {
            if (s.flags.alarm) return s.flags.follows ? [L('dim', 'mem.homan.talk.again2')] : [L('quote', 'mem.homan.go')];
            return s.flags.asked
              ? [L('dim', 'mem.homan.talk.again')]
              : [L('quote', 'mem.homan.talk.1'), L('quote', 'mem.homan.talk.2')];
          },
          effects: (s) => {
            if (s.flags.alarm) return s.flags.follows ? null : { sync: 5, flags: { follows: true } };
            return s.flags.asked ? null : { sync: 3, flags: { asked: true } };
          },
        },
        scan: { lines: [L('prof', 'mem.homan.scan')] },
      },

      box: {
        aliases: ['box', 'bag', 'cooler', 'delivery box', '保溫箱', '箱子', '保温箱', '外卖箱'],
        look: { lines: [L('narr', 'mem.box.look')] },
        read: {
          id: 'mem.box',
          once: true,
          lines: [L('narr', 'mem.box.open.1'), L('dim', 'mem.box.open.2')],
          effects: (s) => (s.flags.device ? { sync: -8 } : { sync: -8, clue: 'device', flags: { device: true } }),
          repeat: [L('dim', 'mem.box.repeat')],
        },
      },

      exit: {
        aliases: ['exit', 'out', 'stairs', 'corridor', '出口', '樓梯', '走廊', '外面', '楼梯'],
        look: { lines: [L('narr', 'mem.exit.look')] },
        go: {
          requires: (s) => s.flags.alarm,
          fail: [L('dim', 'mem.exit.notyet')],
          lines: (s) => {
            if (!s.flags.follows) return [L('narr', 'mem.exit.alone.1'), L('dim', 'mem.exit.alone.2')];
            return s.flags.exitChecked
              ? [L('narr', 'mem.exit.drain.1'), L('narr', 'mem.exit.drain.2')]
              : [L('narr', 'mem.exit.dock.1'), L('narr', 'mem.exit.dock.2')];
          },
          effects: (s) => {
            if (!s.flags.follows) return { sync: -15 };
            return { sync: s.flags.exitChecked ? 5 : -3, flags: { escaped: true } };
          },
        },
      },
    },

    events: [
      {
        id: 'mem1.done',
        when: (s) => s.flags.escaped,
        lines: (s) => [
          L('pause'),
          L('title', 'mem1.done'),
          L('sys', 'mem1.sync', { sync: s.sync }),
          s.flags.device ? L('gain', 'mem1.device') : L('dim', 'mem1.nodevice'),
          L('pause'),
          L('sys', 'mem1.echo.1'),
          L('echo', 'mem1.echo.2'),
          L('bleed', 'mem1.echo.3'),
          L('pause'),
          L('sys', 'mem1.back'),
          L('echo', 'mem1.lead'),
          L('pause'),
        ],
        effects: { bleed: 8 },
        // 離開記憶，回到現實的唐人街。
        run: (s) => { s.sync = null; },
        goto: 'present.chinatown.street',
      },
    ],

    suggest(s) {
      const out = [['look']];
      if (!s.flags.alarm) {
        if (!s.flags.device) out.push(['look', 'homan']);
        if (!s.flags.asked) out.push(['talk', 'homan']);
        out.push(['look', 'board']);
        out.push(['hack', 'echo7']);
      } else {
        if (!s.flags.follows) out.push(['talk', 'homan']);
        out.push(['go', 'exit']);
      }
      return out;
    },
  });
})(window.ECHO = window.ECHO || {});
