// 記憶三：艾琳・沃什，維多利亞隧道。三個場景：艾琳的廚房 → 布魯內爾豎井 → 舊液壓泵站密室。
// 資料來源是艾琳六十年的手寫日記，所以同步率從 62% 開始。
// 艾琳的人格：說話直、討厭被當成老人、相信紙筆不相信螢幕、從不迷路。
// 刺客教條的梗：祖母筆記本裡「穿兜帽的人」走的路線，以及一口可以「信仰之躍」的積水深井。
// 隱藏線索：同步率 85% 以上查看泵站的活塞，會看到瑪雅藏起來的隨身碟（靜域與警方的合約證據）。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });
  const I = (s, base) => base + (s.bleed >= 25 ? '.me' : '');

  const defaults = {
    hack: { lines: [L('narr', 'mem3.hack.1'), L('dim', 'mem3.hack.2')], effects: { sync: -10 } },
    attack: { lines: [L('narr', 'mem.attack.1'), L('dim', 'mem3.attack.2')], effects: { sync: -30 } },
    jump: { lines: [L('narr', 'mem3.jump.no.1'), L('dim', 'mem3.jump.no.2')] },
  };

  const common = { memory: true, checkpoint: true, desync: 'mem3.desync', defaults };

  const notebook = {
    aliases: ['notebook', 'book', 'diary', 'grandmother', '筆記本', '筆記', '祖母', '日記', '笔记本', '笔记', '日记'],
    look: { lines: [L('narr', 'mem3.nb.look')] },
    read: {
      id: 'mem3.nb',
      once: true,
      lines: [L('narr', 'mem3.nb.1'), L('quote', 'mem3.nb.2'), L('quote', 'mem3.nb.3')],
      effects: { sync: 4, flags: { readRoute: true } },
      repeat: [L('quote', 'mem3.nb.2')],
    },
  };

  E.registerScene(Object.assign({}, common, {
    id: 'memory.eileen.kitchen',
    location: 'mem3.k.loc',
    implicit: { go: 'cellar' },

    enter: [
      L('sys', 'mem3.k.1'),
      L('dim', 'mem3.k.2'),
      L('pause'),
      L('narr', 'mem3.k.3'),
      L('narr', 'mem3.k.4'),
      L('quote', 'mem3.k.5'),
    ],

    look: [L('narr', 'mem3.k.look.1'), L('dim', 'mem3.k.look.2')],

    entities: {
      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
        look: { lines: [L('narr', 'mem3.k.maya.look')] },
        talk: {
          lines: (s) => (s.flags.heardMaya
            ? [L('dim', 'mem3.k.maya.again')]
            : [L('quote', 'mem3.k.maya.1'), L('quote', 'mem3.k.maya.2')]),
          effects: (s) => (s.flags.heardMaya ? null : { sync: 3, flags: { heardMaya: true } }),
          topics: {
            scold: {
              aliases: ['scold', 'lecture', 'told you', 'warned', '罵', '說教', '早就說過', '骂', '说教', '早就说过'],
              id: 'mem3.t.scold',
              once: true,
              requires: (s) => s.flags.heardMaya,
              fail: [L('dim', 'mem3.t.early')],
              lines: [L('quote', 'mem3.t.scold.1'), L('quote', 'mem3.t.scold.2')],
              effects: { sync: 3 },
              repeat: [L('dim', 'mem3.t.again')],
            },
            echo: {
              aliases: ['echo', 'machine', 'ai', '機器', 'ECHO', '那台機器', '机器', '那台机器'],
              id: 'mem3.t.echo',
              once: true,
              requires: (s) => s.flags.heardMaya,
              fail: [L('dim', 'mem3.t.early')],
              lines: (s) => [L('quote', 'mem3.t.echo.1'), L('quote', 'mem3.t.echo.2'), L('echo', I(s, 'mem3.t.echo.3'))],
              effects: { sync: 3, bleed: 4 },
              repeat: [L('dim', 'mem3.t.again')],
            },
            homan: {
              aliases: ['homan', 'ho-man', 'rider', 'box', '浩文', '外送員', '盒子', '骑手'],
              id: 'mem3.t.homan',
              once: true,
              requires: (s) => s.flags.heardMaya,
              fail: [L('dim', 'mem3.t.early')],
              lines: [L('quote', 'mem3.t.homan.1'), L('quote', 'mem3.t.homan.2')],
              effects: { sync: 2, bleed: 2 },
              repeat: [L('dim', 'mem3.t.again')],
            },
          },
        },
      },

      kettle: {
        aliases: ['kettle', 'tea', 'stove', '水壺', '茶', '爐子', '水壶', '炉子'],
        look: { lines: [L('narr', 'mem3.kettle.look')] },
        take: {
          id: 'mem3.tea',
          once: true,
          lines: [L('narr', 'mem3.kettle.1'), L('quote', 'mem3.kettle.2')],
          effects: { sync: 5 },
          repeat: [L('dim', 'mem3.kettle.again')],
        },
      },

      notebook,

      flipphone: {
        aliases: ['phone', 'flip phone', 'mobile', '手機', '翻蓋手機', '手机', '翻盖手机'],
        look: { lines: [L('narr', 'mem3.flip.look')] },
      },

      cellar: {
        aliases: ['cellar', 'out', 'tunnel', 'go', 'shaft', '地窖', '出發', '隧道', '豎井', '出发', '竖井'],
        look: { lines: [L('dim', 'mem3.cellar.look')] },
        go: {
          requires: (s) => s.flags.heardMaya,
          fail: [L('dim', 'mem3.cellar.notyet')],
          lines: [L('narr', 'mem3.cellar.go.1'), L('quote', 'mem3.cellar.go.2')],
          goto: 'memory.eileen.tunnels',
        },
      },
    },

    suggest(s) {
      const out = [['look']];
      if (!s.fired['mem3.tea']) out.push(['take', 'kettle']);
      if (!s.flags.heardMaya) out.push(['talk', 'maya']);
      else {
        if (!s.fired['mem3.t.echo']) out.push(['talk', 'maya', 'echo']);
        if (!s.fired['mem3.t.scold']) out.push(['talk', 'maya', 'scold']);
      }
      if (!s.flags.readRoute) out.push(['read', 'notebook']);
      if (s.flags.heardMaya) out.push(['go', 'cellar']);
      return out;
    },
  }));

  // 拱道：照祖母的筆記「往北第三個拱門」才是對的路。
  const wrongArch = (id) => ({
    aliases: id === 'arch1'
      ? ['first arch', 'arch 1', 'first', '第一個拱門', '第一個', '第一', '第一个拱门', '第一个']
      : ['second arch', 'arch 2', 'second', '第二個拱門', '第二個', '第二', '第二个拱门', '第二个'],
    look: { lines: [L('narr', 'mem3.arch.look')] },
    go: { lines: [L('narr', 'mem3.arch.wrong.1'), L('dim', 'mem3.arch.wrong.2')], effects: { sync: -8 } },
  });

  E.registerScene(Object.assign({}, common, {
    id: 'memory.eileen.tunnels',
    location: 'mem3.t.loc',

    enter: [L('narr', 'mem3.tn.1'), L('narr', 'mem3.tn.2'), L('dim', 'mem3.tn.3')],

    look: (s) => (s.flags.foundWay
      ? [L('narr', 'mem3.tn.look.2'), L('dim', 'mem3.tn.look.3')]
      : [L('narr', 'mem3.tn.look.1')]),

    entities: {
      notebook,
      arch1: wrongArch('arch1'),
      arch2: wrongArch('arch2'),
      arch3: {
        aliases: ['third arch', 'arch 3', 'third', 'north', '第三個拱門', '第三個', '第三', '北', '第三个拱门', '第三个'],
        look: { lines: [L('narr', 'mem3.arch.look')] },
        go: {
          id: 'mem3.arch3',
          once: true,
          lines: (s) => [L('narr', 'mem3.arch.right.1'), L('narr', 'mem3.arch.right.2'), ...(s.flags.readRoute ? [] : [L('dim', 'mem3.arch.memory')])],
          effects: { sync: 5, flags: { foundWay: true } },
          repeat: [L('dim', 'mem3.arch.again')],
        },
      },
      shaft: {
        aliases: ['shaft', 'well', 'water', 'pool', 'leap of faith', '深井', '井', '水', '信仰之躍', '信仰之跃'],
        visible: (s) => s.flags.foundWay,
        look: { lines: [L('narr', 'mem3.shaft.look.1'), L('quote', 'mem3.shaft.look.2')] },
        jump: { lines: [L('narr', 'mem3.jump.no.1'), L('dim', 'mem3.jump.no.2')] },
      },
      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
        look: { lines: [L('narr', 'mem3.tn.maya.look')] },
        talk: {
          lines: (s) => {
            if (!s.flags.foundWay) return [L('quote', 'mem3.tn.maya.lost')];
            if (s.flags.mayaJumped) return [L('dim', 'mem3.tn.maya.below')];
            return [L('quote', 'mem3.tn.maya.jump.1'), L('narr', 'mem3.tn.maya.jump.2'), L('narr', 'mem3.tn.maya.jump.3')];
          },
          effects: (s) => (s.flags.foundWay && !s.flags.mayaJumped ? { sync: 3, flags: { mayaJumped: true } } : null),
        },
      },
      ladder: {
        aliases: ['ladder', 'down', 'stairs', '鐵梯', '梯子', '下去', '铁梯'],
        visible: (s) => s.flags.foundWay,
        look: { lines: [L('narr', 'mem3.ladder.look')] },
        go: {
          lines: (s) => [L('narr', s.flags.mayaJumped ? 'mem3.ladder.go.jumped' : 'mem3.ladder.go.together')],
          goto: 'memory.eileen.station',
        },
      },
    },

    suggest(s) {
      const out = [['look']];
      if (!s.flags.readRoute) out.push(['read', 'notebook']);
      if (!s.flags.foundWay) out.push(['go', 'arch1'], ['go', 'arch3']);
      else {
        out.push(['look', 'shaft']);
        if (!s.flags.mayaJumped) out.push(['talk', 'maya']);
        out.push(['go', 'ladder']);
      }
      return out;
    },
  }));

  E.registerScene(Object.assign({}, common, {
    id: 'memory.eileen.station',
    location: 'mem3.st.loc',

    enter: [L('narr', 'mem3.st.1'), L('narr', 'mem3.st.2'), L('echo', 'mem3.st.3')],

    look: [L('narr', 'mem3.st.look.1'), L('dim', 'mem3.st.look.2')],

    entities: {
      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
        look: { lines: [L('narr', 'mem3.st.maya.look')] },
        talk: {
          lines: (s) => (s.flags.switchExplained
            ? [L('dim', 'mem3.st.maya.again')]
            : [L('quote', 'mem3.st.maya.1'), L('quote', 'mem3.st.maya.2'), L('echo', I(s, 'mem3.st.maya.3'))]),
          effects: (s) => (s.flags.switchExplained ? null : { sync: 3, bleed: 3, flags: { switchExplained: true } }),
          topics: {
            why: {
              aliases: ['why', 'worth', 'worth it', '為什麼', '值得', '为什么'],
              id: 'mem3.st.why',
              once: true,
              requires: (s) => s.flags.switchExplained,
              fail: [L('dim', 'mem3.t.early')],
              lines: [L('quote', 'mem3.st.why.1'), L('quote', 'mem3.st.why.2'), L('bleed', 'mem3.st.why.3')],
              effects: { sync: 3, bleed: 5, flags: { askedWhy: true } },
              repeat: [L('dim', 'mem3.t.again')],
            },
          },
        },
      },

      exchange: {
        aliases: ['exchange', 'switchboard', 'telephone', 'wires', '交換機', '電話', '線路', '交换机', '电话', '线路'],
        look: { lines: [L('narr', 'mem3.ex.look')] },
        scan: { lines: [L('prof', 'mem3.ex.scan')], after: [L('echo', 'mem3.ex.echo')] },
      },

      piston: {
        aliases: ['piston', 'pump', 'engine', 'machinery', '活塞', '泵', '機械', '机械'],
        look: {
          lines: (s) => {
            const out = [L('narr', 'mem3.piston.1')];
            if (s.flags.evidence) out.push(L('dim', 'mem3.piston.4'));
            else if (s.sync >= 85) out.push(L('narr', 'mem3.piston.2'));
            else out.push(L('dim', 'mem3.piston.3'));
            return out;
          },
          effects: (s) => (!s.flags.evidence && s.sync >= 85
            ? { sync: 3, clue: 'evidence', flags: { evidence: true } }
            : null),
        },
      },
    },

    events: [
      {
        id: 'mem3.done',
        when: (s) => s.flags.switchExplained && s.flags.askedWhy,
        lines: (s) => [
          L('pause'),
          L('title', 'mem3.done'),
          L('sys', 'mem1.sync', { sync: s.sync }),
          s.flags.evidence ? L('gain', 'mem3.evidence') : L('dim', 'mem1.nodevice'),
          L('pause'),
          L('sys', 'mem1.echo.1'),
          L('echo', I(s, 'mem3.echo.2')),
          L('bleed', 'mem3.echo.3'),
          L('pause'),
          L('sys', 'mem1.back'),
          L('title', 'fin.title'),
        ],
        effects: { bleed: 8 },
        run: (s) => { s.sync = null; s.actor = 'eileen'; },
        goto: 'finale.shaft',
      },
    ],

    suggest(s) {
      const out = [['look']];
      if (!s.flags.switchExplained) out.push(['talk', 'maya']);
      else if (!s.flags.askedWhy) out.push(['talk', 'maya', 'why']);
      if (!s.flags.evidence) out.push(['look', 'piston']);
      out.push(['scan', 'exchange']);
      return out;
    },
  }));
})(window.ECHO = window.ECHO || {});
