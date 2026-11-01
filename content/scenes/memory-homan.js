// 記憶二：陳浩文，燎原的交易。三個場景：鐵道橋下的外送點 → 維多利亞堤岸 → 浩文的公寓。
// 同步率從 60% 開始。浩文的人格：怕事、習慣低頭、為了女兒什麼都肯做、從不對女兒說謊、不懂駭客技術。
// 跟記憶一相反：在這裡駭入會扣同步率。想拒絕燎原的錢也會崩塌——記憶是已經發生的事。
// 隱藏線索：同步率 85% 以上查看艾琳，會看到她把一本皮面筆記本交給瑪雅（記憶三的伏筆）。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });
  const I = (s, base) => base + (s.bleed >= 25 ? '.me' : '');

  const defaults = {
    hack: { lines: [L('narr', 'mem2.hack.1'), L('dim', 'mem2.hack.2')], effects: { sync: -10 } },
    attack: { lines: [L('narr', 'mem.attack.1'), L('dim', 'mem2.attack.2')], effects: { sync: -30 } },
  };

  const common = {
    memory: true,
    checkpoint: true,
    desync: 'mem2.desync',
    defaults,
  };

  E.registerScene(Object.assign({}, common, {
    id: 'memory.homan.hub',
    location: 'mem2.hub.loc',
    implicit: { go: 'next' },

    enter: [
      L('sys', 'mem2.hub.1'),
      L('dim', 'mem2.hub.2'),
      L('dim', 'mem2.hub.3'),
      L('pause'),
      L('narr', 'mem2.hub.4'),
      L('narr', 'mem2.hub.5'),
      L('narr', 'mem2.hub.6'),
    ],

    look: [L('narr', 'mem2.hub.look.1'), L('narr', 'mem2.hub.look.2'), L('dim', 'mem2.hub.look.3')],

    entities: {
      // 手機放在女兒前面：「回覆訊息」會先比對到手機，再由交談改找女兒。
      phone: {
        aliases: ['phone', 'message', 'text', '手機', '訊息', '簡訊', '手机', '消息', '短信'],
        look: { lines: [L('narr', 'mem2.phone.look')] },
        read: {
          id: 'mem2.text',
          once: true,
          lines: [L('quote', 'mem2.phone.read.1'), L('quote', 'mem2.phone.read.2')],
          effects: { sync: 4, flags: { readText: true } },
          after: [L('echo', 'mem2.phone.echo')],
          repeat: [L('quote', 'mem2.phone.read.1')],
        },
      },

      hiuching: {
        aliases: ['hiu-ching', 'hiuching', 'daughter', 'message', 'text', '曉晴', '女兒', '訊息', '晓晴', '女儿', '消息'],
        look: { lines: [L('narr', 'mem2.hc.look')] },
        talk: {
          id: 'mem2.reply',
          once: true,
          requires: (s) => s.flags.readText,
          fail: [L('dim', 'mem2.hc.notyet')],
          lines: [L('narr', 'mem2.reply.1'), L('quote', 'mem2.reply.2')],
          effects: { sync: 6, bleed: 2, flags: { replied: true } },
          repeat: [L('dim', 'mem2.reply.again')],
        },
      },

      cassie: {
        aliases: ['cassie', 'dunn', 'woman', 'hoodie', 'wildfire', '卡西', '女人', '連帽衫', '燎原', '那個女人', '连帽衫', '那个女人'],
        look: { lines: [L('narr', 'mem2.cassie.look')] },
        scan: {
          lines: [L('prof', 'mem2.cassie.scan.1'), L('prof', 'mem2.cassie.scan.2'), L('prof', 'mem2.cassie.scan.3')],
          effects: { clue: 'cassie' },
          after: (s) => [L('echo', I(s, 'mem2.cassie.echo'))],
        },
        talk: {
          lines: (s) => (s.flags.heard
            ? [L('dim', 'mem2.cassie.again'), L('dim', 'mem2.cassie.hint')]
            : [L('quote', 'mem2.cassie.1'), L('quote', 'mem2.cassie.2'), L('quote', 'mem2.cassie.3')]),
          effects: (s) => (s.flags.heard ? null : { sync: 3, flags: { heard: true } }),
          topics: {
            box: {
              aliases: ['box', 'tracker', "what's inside", 'inside', '箱子', '盒子', '裡面', '追蹤器', '里面', '追踪器'],
              id: 'mem2.t.box',
              once: true,
              requires: (s) => s.flags.heard,
              fail: [L('dim', 'mem2.t.early')],
              lines: [L('quote', 'mem2.t.box.1'), L('quote', 'mem2.t.box.2')],
              effects: { sync: 2 },
              repeat: [L('dim', 'mem2.t.again')],
            },
            maya: {
              aliases: ['maya', 'girl', 'dedsec', 'danger', '瑪雅', '女生', '危險', '玛雅', '危险'],
              id: 'mem2.t.maya',
              once: true,
              requires: (s) => s.flags.heard,
              fail: [L('dim', 'mem2.t.early')],
              lines: [L('quote', 'mem2.t.maya.1'), L('quote', 'mem2.t.maya.2')],
              effects: { sync: 4, flags: { askedSafety: true } },
              repeat: [L('dim', 'mem2.t.again')],
            },
            who: {
              aliases: ['who', 'wildfire', 'you', '你是誰', '你們', '燎原', '你是谁', '你们'],
              id: 'mem2.t.who',
              once: true,
              requires: (s) => s.flags.heard,
              fail: [L('dim', 'mem2.t.early')],
              lines: [L('quote', 'mem2.t.who.1'), L('quote', 'mem2.t.who.2')],
              repeat: [L('dim', 'mem2.t.again')],
            },
            // 想改寫過去：記憶會抗拒。
            refuse: {
              aliases: ['refuse', 'decline', 'reject', 'say no', '拒絕', '不要', '不幹', '拒绝', '不干'],
              lines: [L('narr', 'mem2.refuse.1'), L('dim', 'mem2.refuse.2')],
              effects: { sync: -25 },
            },
          },
        },
      },

      box: {
        aliases: ['box', 'delivery box', 'cooler', 'envelope', '保溫箱', '箱子', '信封', '保温箱', '外卖箱'],
        look: { lines: [L('narr', 'mem2.box.look')] },
        take: {
          id: 'mem2.take',
          once: true,
          requires: (s) => s.flags.heard,
          fail: [L('quote', 'mem2.take.early')],
          lines: [L('narr', 'mem2.take.1'), L('quote', 'mem2.take.2')],
          effects: { sync: 5, flags: { took: true } },
          repeat: [L('dim', 'mem2.take.again')],
        },
        read: {
          lines: [L('narr', 'mem2.box.dont.1'), L('dim', 'mem2.box.dont.2')],
          effects: { sync: -5 },
        },
      },

      next: {
        aliases: ['next', 'road', 'ride', 'go', 'next order', '下一單', '出發', '上路', '下一单', '出发'],
        look: { lines: [L('dim', 'mem2.hub.next.look')] },
        go: {
          requires: (s) => s.flags.took,
          fail: [L('dim', 'mem2.hub.notyet')],
          lines: [L('narr', 'mem2.hub.go')],
          goto: 'memory.homan.embankment',
        },
      },
    },

    suggest(s) {
      const out = [['look']];
      if (!s.flags.readText) out.push(['read', 'phone']);
      else if (!s.flags.replied) out.push(['talk', 'hiuching']);
      if (!s.flags.heard) out.push(['talk', 'cassie']);
      else {
        if (!s.fired['mem2.t.maya']) out.push(['talk', 'cassie', 'maya']);
        if (!s.fired['mem2.t.box']) out.push(['talk', 'cassie', 'box']);
        if (!s.flags.took) out.push(['take', 'box']);
      }
      if (s.flags.took) out.push(['go', 'next']);
      return out;
    },
  }));

  E.registerScene(Object.assign({}, common, {
    id: 'memory.homan.embankment',
    location: 'mem2.emb.loc',
    implicit: { go: 'road' },

    enter: [L('narr', 'mem2.emb.1'), L('narr', 'mem2.emb.2'), L('narr', 'mem2.emb.3'), L('echo', 'mem2.emb.4')],

    look: [L('narr', 'mem2.emb.look.1'), L('dim', 'mem2.emb.look.2')],

    entities: {
      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
        look: {
          id: 'mem2.watch',
          once: true,
          lines: [L('narr', 'mem2.emb.maya.1'), L('quote', 'mem2.emb.maya.2')],
          effects: { sync: 3, flags: { watched: true } },
          repeat: [L('dim', 'mem2.emb.maya.again')],
        },
        scan: { lines: [L('prof', 'mem2.emb.maya.scan')] },
        talk: { lines: [L('narr', 'mem2.emb.call.1'), L('dim', 'mem2.emb.call.2')], effects: { sync: -15 } },
      },

      eileen: {
        aliases: ['eileen', 'old lady', 'old woman', 'woman', 'umbrella', '老太太', '老婦人', '雨傘', '艾琳', '老妇人', '雨伞'],
        look: {
          // 只有真正像浩文一樣看得夠久（同步率夠高），才會看到筆記本被交出去。
          lines: (s) => {
            const out = [L('narr', 'mem2.emb.eileen.1')];
            if (s.flags.notebook) out.push(L('dim', 'mem2.emb.eileen.4'));
            else if (s.sync >= 85) out.push(L('narr', 'mem2.emb.eileen.2'));
            else out.push(L('dim', 'mem2.emb.eileen.3'));
            return out;
          },
          effects: (s) => (!s.flags.notebook && s.sync >= 85
            ? { sync: 3, clue: 'notebook', flags: { notebook: true } }
            : null),
        },
        scan: {
          lines: [L('prof', 'mem2.emb.eileen.scan.1'), L('prof', 'mem2.emb.eileen.scan.2')],
          effects: { clue: 'eileen', flags: { eileenKnown: true } },
          after: [L('echo', 'mem2.emb.eileen.echo')],
        },
        talk: { lines: [L('narr', 'mem2.emb.call.1'), L('dim', 'mem2.emb.stranger')], effects: { sync: -10 } },
      },

      outlet: {
        aliases: ['outlet', 'grate', 'drain', 'grille', 'symbol', '排水口', '鐵柵', '符號', '铁栅', '符号'],
        look: {
          lines: [L('narr', 'mem2.emb.outlet.1'), L('narr', 'mem2.emb.outlet.2')],
          effects: { clue: 'symbol' },
          after: [L('echo', 'mem2.emb.outlet.echo')],
        },
        scan: { lines: [L('prof', 'mem2.emb.outlet.scan')] },
      },

      road: {
        aliases: ['light', 'lights', 'road', 'bike', 'breakfast', 'ride', '綠燈', '紅綠燈', '機車', '早餐', '出發', '绿灯', '红绿灯', '电动车', '出发'],
        look: { lines: [L('dim', 'mem2.emb.bike')] },
        go: {
          lines: (s) => (s.flags.watched
            ? [L('narr', 'mem2.emb.go')]
            : [L('narr', 'mem2.emb.go'), L('dim', 'mem2.emb.nolook')]),
          effects: (s) => (s.flags.watched ? null : { sync: -5 }),
          goto: 'memory.homan.flat',
        },
      },
    },

    suggest(s) {
      const out = [['look']];
      if (!s.flags.watched) out.push(['look', 'maya']);
      if (!s.flags.eileenKnown) out.push(['scan', 'eileen']);
      if (!s.flags.notebook) out.push(['look', 'eileen']);
      if (!s.clues.includes('symbol')) out.push(['look', 'outlet']);
      out.push(['go', 'road']);
      return out;
    },
  }));

  E.registerScene(Object.assign({}, common, {
    id: 'memory.homan.flat',
    location: 'mem2.flat.loc',

    enter: [L('narr', 'mem2.flat.1'), L('narr', 'mem2.flat.2'), L('narr', 'mem2.flat.3'), L('warn', 'mem2.flat.4')],

    look: [L('narr', 'mem2.flat.look.1'), L('dim', 'mem2.flat.look.2')],

    entities: {
      caller: {
        aliases: ['phone', 'call', 'caller', 'cassie', '電話', '來電', '手機', '卡西', '电话', '来电', '手机'],
        look: { lines: [L('narr', 'mem2.call.look')] },
        talk: {
          lines: (s) => (s.flags.answered
            ? [L('dim', 'mem2.call.again')]
            : [L('quote', 'mem2.call.1'), L('quote', 'mem2.call.2')]),
          effects: (s) => (s.flags.answered ? null : { sync: 3, flags: { answered: true } }),
          topics: {
            maya: {
              aliases: ['maya', 'girl', '瑪雅', '女生', '她', '玛雅'],
              id: 'mem2.call.maya',
              once: true,
              requires: (s) => s.flags.answered,
              fail: [L('dim', 'mem2.call.notyet')],
              lines: [L('quote', 'mem2.call.maya.1'), L('quote', 'mem2.call.maya.2')],
              effects: { sync: 4, bleed: 2, flags: { askedMaya: true } },
              repeat: [L('dim', 'mem2.call.again')],
            },
            machine: {
              aliases: ['machine', 'echo', 'ai', '機器', '那台機器', '机器', '那台机器'],
              id: 'mem2.call.machine',
              once: true,
              requires: (s) => s.flags.answered,
              fail: [L('dim', 'mem2.call.notyet')],
              lines: [L('quote', 'mem2.call.machine.1'), L('quote', 'mem2.call.machine.2')],
              effects: { sync: 2 },
              repeat: [L('dim', 'mem2.call.again')],
            },
            shout: {
              aliases: ['shout', 'yell', 'threaten', 'police', 'angry', '罵', '吼', '威脅', '報警', '骂', '威胁', '报警'],
              lines: [L('narr', 'mem2.call.shout.1'), L('dim', 'mem2.call.shout.2')],
              effects: { sync: -15 },
            },
          },
        },
      },

      daughter: {
        aliases: ['hiu-ching', 'hiuching', 'daughter', 'bed', 'blanket', '曉晴', '女兒', '被子', '床', '晓晴', '女儿'],
        look: {
          id: 'mem2.cover',
          once: true,
          lines: [L('narr', 'mem2.flat.hc.1'), L('narr', 'mem2.flat.hc.2')],
          effects: { sync: 5, bleed: 2, flags: { covered: true } },
          repeat: [L('dim', 'mem2.flat.hc.again')],
        },
        talk: { lines: [L('dim', 'mem2.flat.hc.sleep')], effects: { sync: -5 } },
      },

      notice: {
        aliases: ['bill', 'notice', 'rent', 'fridge', 'certificate', '催繳單', '房租', '冰箱', '獎狀', '催缴单', '奖状'],
        look: { lines: [L('narr', 'mem2.flat.bill')] },
      },
    },

    events: [
      {
        id: 'mem2.done',
        when: (s) => s.flags.answered && s.flags.covered,
        lines: (s) => [
          L('pause'),
          L('title', 'mem2.done'),
          L('sys', 'mem1.sync', { sync: s.sync }),
          s.flags.notebook ? L('gain', 'mem2.notebook') : L('dim', 'mem1.nodevice'),
          L('pause'),
          L('sys', 'mem1.echo.1'),
          L('echo', I(s, 'mem2.echo.2')),
          L('bleed', 'mem2.echo.3'),
          L('pause'),
          L('sys', 'mem1.back'),
        ],
        effects: { bleed: 8 },
        run: (s) => { s.sync = null; },
        goto: 'present.node',
      },
    ],

    suggest(s) {
      const out = [['look']];
      if (!s.flags.answered) out.push(['talk', 'caller']);
      else if (!s.fired['mem2.call.maya']) out.push(['talk', 'caller', 'maya']);
      if (s.flags.answered && !s.fired['mem2.call.machine']) out.push(['talk', 'caller', 'machine']);
      if (!s.flags.covered) out.push(['look', 'daughter']);
      return out;
    },
  }));
})(window.ECHO = window.ECHO || {});
