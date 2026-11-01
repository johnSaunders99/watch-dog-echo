// 第三章：燎原的提議。回到康登區地下室 → 羅瑟希德，艾琳的家門口。
// 卡西主動連線，提出「把 Echo 開源」的交易（最後在終章才做決定）。
// 要找到艾琳得靠浩文：她幾乎沒有數位足跡，Echo 看不見她，只能讓浩文騎車過河、敲門。
// 招募艾琳：支開門口的靜域廂型車（Echo 駭入），並讓她的信任達到 4（浩文誠實交談）。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });
  const I = (s, base) => base + (s.bleed >= 25 ? '.me' : '');
  const TRUST_GOAL = 4;
  const eTrust = (s) => s.trust.eileen || 0;
  const metE = (s) => !!s.flags.metEileen;
  const meter = { label: 'hud.trustEileen', get: eTrust, max: 8, goal: TRUST_GOAL, unit: '' };

  const presentDefaults = {
    wait: {
      lines: (s) => (s.bandwidth >= s.bandwidthMax ? [L('dim', 'wait.full')] : [L('dim', 'wait.1'), L('cost', 'wait.2')]),
      effects: (s) => (s.bandwidth >= s.bandwidthMax ? null : { bandwidth: 1, exposure: 3 }),
    },
    attack: { lines: [L('echo', 'attack.prologue')] },
  };

  E.registerScene({
    id: 'present.node',
    location: 'ch3.node.loc',
    bandwidth: 3,
    meter,
    implicit: { go: 'rotherhithe' },
    defaults: presentDefaults,

    // 卡西的連線先被 DedSec 的 Bagley 攔了下來：客串角色登場。
    enter: [
      L('title', 'ch3.title'),
      L('narr', 'ch3.node.1'),
      L('sys', 'ch3.bag.1'),
      L('pause'),
      L('narr', 'cameo.bagley'),
      L('quote', 'ch3.bag.2'),
      L('quote', 'ch3.bag.3'),
      L('sys', 'ch3.node.2'),
      L('quote', 'ch3.node.3'),
      L('dim', 'ch3.node.4'),
    ],

    look: [L('narr', 'ch3.node.look.1'), L('narr', 'ch3.node.look.2'), L('dim', 'ch3.node.look.3')],

    entities: {
      cassie: {
        aliases: ['cassie', 'dunn', 'wildfire', 'window', 'connection', '卡西', '燎原', '視窗', '連線', '视窗', '连线'],
        look: { lines: [L('narr', 'ch3.cassie.look')] },
        scan: { lines: [L('prof', 'mem2.cassie.scan.1'), L('prof', 'mem2.cassie.scan.2'), L('prof', 'mem2.cassie.scan.3')], effects: { clue: 'cassie' } },
        talk: {
          lines: (s) => (s.flags.cassieMet
            ? [L('dim', 'ch3.c.again')]
            : [L('quote', 'ch3.c.1'), L('quote', 'ch3.c.2'), L('quote', 'ch3.c.3')]),
          effects: { flags: { cassieMet: true } },
          topics: {
            offer: {
              aliases: ['offer', 'deal', 'free', 'freedom', 'open source', '提議', '交易', '自由', '開源', '提议', '开源'],
              id: 'ch3.c.offer',
              once: true,
              lines: (s) => [L('quote', 'ch3.c.offer.1'), L('quote', 'ch3.c.offer.2'), L('echo', I(s, 'ch3.c.offer.3')), L('quote', 'ch3.c.offer.4')],
              effects: { flags: { offerHeard: true } },
              repeat: [L('quote', 'ch3.c.offer.4')],
            },
            maya: {
              aliases: ['maya', '瑪雅', '玛雅'],
              id: 'ch3.c.maya',
              once: true,
              lines: [L('quote', 'ch3.c.maya.1'), L('quote', 'ch3.c.maya.2')],
              repeat: [L('dim', 'ch3.c.again')],
            },
            homan: {
              aliases: ['homan', 'ho-man', 'money', 'paid', 'bribe', '浩文', '收買', '錢', '收买', '钱'],
              id: 'ch3.c.homan',
              once: true,
              lines: [L('quote', 'ch3.c.homan.1'), L('quote', 'ch3.c.homan.2')],
              repeat: [L('dim', 'ch3.c.again')],
            },
            stillwater: {
              aliases: ['stillwater', 'hale', 'witness engine', '靜域', '黑爾', '證人引擎', '静域', '证人引擎'],
              id: 'ch3.c.sw',
              once: true,
              lines: [L('quote', 'ch3.c.sw.1')],
              repeat: [L('dim', 'ch3.c.again')],
            },
            eileen: {
              aliases: ['eileen', 'old lady', '艾琳', '老太太'],
              id: 'ch3.c.eileen',
              once: true,
              lines: [L('quote', 'ch3.c.eileen.1'), L('echo', 'ch3.c.eileen.2')],
              repeat: [L('dim', 'ch3.c.again')],
            },
            nightwatch: {
              aliases: ['nightwatch', 'drone', 'drones', 'lionheart', 'military', '守夜人', '無人機', '獅心', '軍方', '无人机', '狮心', '军方'],
              id: 'ch3.c.nw',
              once: true,
              lines: [L('quote', 'ch3.c.nw.1'), L('quote', 'ch3.c.nw.2')],
              repeat: [L('dim', 'ch3.c.again')],
            },
          },
        },
      },

      // 客串：倫敦 DedSec 的 AI。毒舌，但他是唯一一個「選擇留下」的前輩。
      bagley: {
        aliases: ['bagley', 'dedsec', '貝格利', '贝格利'],
        look: { lines: [L('narr', 'ch3.bag.look')] },
        scan: {
          lines: [L('prof', 'ch3.bag.scan.1', null), L('prof', 'ch3.bag.scan.2')].map((l) => Object.assign(l, { who: 'bagley' })),
          after: [L('quote', 'ch3.bag.scan.3')],
        },
        talk: {
          lines: [L('quote', 'ch3.bag.talk')],
          topics: {
            cassie: {
              aliases: ['cassie', 'wildfire', 'offer', '卡西', '燎原', '提議', '提议'],
              id: 'ch3.bag.cassie',
              once: true,
              lines: [L('quote', 'ch3.bag.cassie')],
              repeat: [L('dim', 'ch3.bag.again')],
            },
            nightwatch: {
              aliases: ['nightwatch', 'drone', 'drones', 'brother', '守夜人', '無人機', '兄弟', '无人机'],
              id: 'ch3.bag.nw',
              once: true,
              lines: [L('quote', 'ch3.bag.nw.1'), L('quote', 'ch3.bag.nw.2')],
              effects: { flags: { knowsDrones: true } },
              repeat: [L('dim', 'ch3.bag.again')],
            },
            rules: {
              aliases: ['rules', 'advice', 'choose', 'stay', 'how', '規則', '建議', '選擇', '留下', '规则', '建议', '选择'],
              id: 'ch3.bag.rules',
              once: true,
              lines: (s) => [L('quote', 'ch3.bag.rules.1'), L('quote', 'ch3.bag.rules.2'), L('echo', I(s, 'ch3.bag.rules.3'))],
              effects: { bleed: 3, flags: { bagleyAdvice: true } },
              repeat: [L('dim', 'ch3.bag.again')],
            },
          },
        },
      },

      homan: {
        aliases: ['homan', 'ho-man', 'chan', '浩文', '陳浩文', '陈浩文'],
        look: { lines: [L('narr', 'ch3.h.look')] },
        talk: {
          lines: [L('quote', 'ch3.h.1')],
          topics: {
            eileen: {
              aliases: ['eileen', 'old lady', 'embankment', 'umbrella', '艾琳', '老太太', '堤岸', '雨傘', '雨伞'],
              id: 'ch3.h.eileen',
              once: true,
              lines: [L('quote', 'ch3.h.eileen.1'), L('quote', 'ch3.h.eileen.2')],
              effects: { clue: 'eileen', flags: { eileenAddress: true, eileenKnown: true } },
              repeat: [L('quote', 'ch3.h.eileen.2')],
            },
            cassie: {
              aliases: ['cassie', 'wildfire', '卡西', '燎原'],
              id: 'ch3.h.cassie',
              once: true,
              lines: [L('quote', 'ch3.h.cassie.1')],
              repeat: [L('dim', 'ch3.h.again')],
            },
            daughter: {
              aliases: ['hiu-ching', 'daughter', '曉晴', '女兒', '晓晴', '女儿'],
              id: 'ch3.h.daughter',
              once: true,
              lines: [L('quote', 'ch3.h.daughter.1')],
              effects: { bleed: 2 },
              repeat: [L('dim', 'ch3.h.again')],
            },
          },
        },
      },

      // 另一條路：知道名字的話，可以去市政資料庫查地址。
      records: {
        aliases: ['records', 'council', 'database', 'register', '市政', '資料庫', '戶籍', '数据库', '户籍'],
        look: { lines: [L('narr', 'ch3.rec.look')] },
        hack: {
          id: 'ch3.records',
          once: true,
          requires: (s) => s.flags.eileenKnown,
          fail: [L('dim', 'ch3.rec.noname')],
          cost: 1,
          exposure: 3,
          lines: [L('sys', 'ch3.rec.1'), L('narr', 'ch3.rec.2'), L('echo', 'ch3.rec.3')],
          effects: { flags: { eileenAddress: true } },
        },
      },

      graffiti: {
        aliases: ['graffiti', 'wall', '塗鴉', '牆', '涂鸦', '墙'],
        look: { lines: [L('narr', 'graffiti.look.2')] },
      },

      rotherhithe: {
        aliases: ['rotherhithe', "eileen's house", 'house', 'river', '羅瑟希德', '艾琳家', '過河', '罗瑟希德', '过河'],
        look: { lines: [L('dim', 'ch3.go.look')] },
        go: {
          actor: 'homan',
          requires: (s) => s.flags.eileenAddress,
          fail: [L('dim', 'ch3.go.noaddr')],
          lines: [L('narr', 'ch3.go.1')],
          goto: 'present.eileen.door',
        },
      },
    },

    suggest(s) {
      const out = [];
      if (!s.fired['ch3.bag.nw']) out.push(['talk', 'bagley', 'nightwatch']);
      else if (!s.fired['ch3.bag.rules']) out.push(['talk', 'bagley', 'rules']);
      if (!s.flags.cassieMet) out.push(['talk', 'cassie']);
      else if (!s.flags.offerHeard) out.push(['talk', 'cassie', 'offer']);
      if (s.flags.cassieMet && !s.fired['ch3.c.maya']) out.push(['talk', 'cassie', 'maya']);
      if (!s.flags.eileenAddress) out.push(['talk', 'homan', 'eileen']);
      if (s.flags.eileenAddress && s.actor !== 'homan') out.push(['switch', 'homan']);
      if (s.flags.eileenAddress) out.push(['go', 'rotherhithe']);
      return out;
    },
  });

  E.registerScene({
    id: 'present.eileen.door',
    location: 'ch3.door.loc',
    bandwidth: 2,
    meter,
    defaults: presentDefaults,

    enter: [L('narr', 'ch3.door.1'), L('narr', 'ch3.door.2'), L('warn', 'ch3.door.3')],

    look: (s) => [
      L('narr', 'ch3.door.look.1'),
      s.flags.vanGone ? L('narr', 'ch3.door.look.3') : L('narr', 'ch3.door.look.2'),
    ],

    entities: {
      eileen: {
        aliases: ['eileen', 'walsh', 'old lady', 'woman', 'door', 'knock', '艾琳', '老太太', '門', '敲門', '门', '敲门'],
        look: { lines: (s) => [L('narr', metE(s) ? 'ch3.e.look.2' : 'ch3.e.look.1')] },
        scan: {
          lines: [L('prof', 'mem2.emb.eileen.scan.1'), L('prof', 'ch3.e.scan.2')],
          effects: { clue: 'eileen' },
          after: (s) => [L('echo', I(s, 'ch3.e.scan.3'))],
        },
        talk: {
          actor: 'homan',
          lines: (s) => (metE(s)
            ? [L('dim', 'ch3.e.hint')]
            : [L('narr', 'ch3.e.knock'), L('quote', 'ch3.e.1'), L('quote', 'ch3.e.2'), L('dim', 'ch3.e.hint')]),
          effects: { flags: { metEileen: true } },
          topics: {
            maya: {
              aliases: ['maya', '瑪雅', '玛雅'],
              id: 'ch3.e.maya',
              once: true,
              requires: metE,
              fail: [L('dim', 'ch3.e.notmet')],
              lines: [L('quote', 'ch3.e.maya.1'), L('prof', 'ch3.e.maya.2')],
              repeat: [L('quote', 'ch3.e.maya.again')],
            },
            truth: {
              aliases: ['truth', 'confess', 'sorry', 'wildfire', 'money', 'honest', '實話', '坦白', '道歉', '燎原', '錢', '实话', '钱'],
              id: 'ch3.e.truth',
              once: true,
              requires: metE,
              fail: [L('dim', 'ch3.e.notmet')],
              lines: [L('quote', 'ch3.e.truth.1'), L('quote', 'ch3.e.truth.2'), L('quote', 'ch3.e.truth.3')],
              effects: { trust: { eileen: 2 }, flags: { confessedE: true } },
              repeat: [L('dim', 'ch3.e.again')],
            },
            lie: {
              aliases: ['delivery', 'lie', 'order', 'parcel', '送貨', '外賣', '包裹', '送东西', '外卖', '送貨的'],
              id: 'ch3.e.lie',
              once: true,
              requires: metE,
              fail: [L('dim', 'ch3.e.notmet')],
              lines: [L('quote', 'ch3.e.lie.1'), L('quote', 'ch3.e.lie.2')],
              effects: (s) => (eTrust(s) > 0 ? { trust: { eileen: -1 } } : null),
              repeat: [L('dim', 'ch3.e.again')],
            },
            notebook: {
              aliases: ['notebook', 'book', 'grandmother', '筆記本', '筆記', '祖母', '笔记本', '笔记'],
              id: 'ch3.e.notebook',
              once: true,
              requires: (s) => metE(s) && s.clues.includes('notebook'),
              fail: (s) => [L('dim', metE(s) ? 'cw.noclue' : 'ch3.e.notmet')],
              lines: [L('quote', 'ch3.e.nb.1'), L('quote', 'ch3.e.nb.2')],
              effects: { trust: { eileen: 2 } },
              repeat: [L('dim', 'ch3.e.again')],
            },
            symbol: {
              aliases: ['symbol', 'eagle', 'mark', 'hood', '符號', '老鷹', '鷹', '記號', '符号', '老鹰', '鹰', '记号'],
              id: 'ch3.e.symbol',
              once: true,
              requires: (s) => metE(s) && s.clues.includes('symbol'),
              fail: (s) => [L('dim', metE(s) ? 'cw.noclue' : 'ch3.e.notmet')],
              lines: [L('quote', 'ch3.e.sym.1'), L('quote', 'ch3.e.sym.2')],
              effects: { trust: { eileen: 1 } },
              repeat: [L('dim', 'ch3.e.again')],
            },
            echo: {
              aliases: ['echo', 'machine', 'phone', 'ai', '機器', 'ECHO', '手機', '机器', '手机'],
              id: 'ch3.e.echo',
              once: true,
              requires: metE,
              fail: [L('dim', 'ch3.e.notmet')],
              lines: (s) => [L('quote', 'ch3.e.echo.1'), L('echo', I(s, 'ch3.e.echo.2')), L('quote', 'ch3.e.echo.3'), L('quote', 'ch3.e.echo.4')],
              effects: { trust: { eileen: 1 }, bleed: 2 },
              repeat: [L('dim', 'ch3.e.again')],
            },
            van: {
              aliases: ['van', 'stillwater', 'grey coat', 'agent', '廂型車', '灰大衣', '靜域', '面包车', '静域'],
              id: 'ch3.e.van',
              once: true,
              requires: metE,
              fail: [L('dim', 'ch3.e.notmet')],
              lines: (s) => (s.flags.vanGone ? [L('quote', 'ch3.e.van.gone')] : [L('quote', 'ch3.e.van.1'), L('quote', 'ch3.e.van.2')]),
              repeat: [L('dim', 'ch3.e.again')],
            },
          },
        },
        // 招募後：艾琳的六十年手寫日記，就是重建她記憶的資料。
        recall: {
          requires: (s) => s.flags.recruitedEileen,
          fail: [L('dim', 'ch3.e.recall.notyet')],
          lines: [
            L('sys', 'mem3.recall.1'),
            L('quote', 'mem3.recall.2'),
            L('sys', 'mem3.recall.3'),
            L('pause'),
            L('title', 'mem3.recall.4'),
          ],
          run: (s) => { s.sync = 62; s.actor = 'echo'; },
          goto: 'memory.eileen.kitchen',
        },
      },

      van: {
        aliases: ['van', 'grey van', 'stillwater', 'car', '廂型車', '灰色廂型車', '車', '面包车', '车'],
        look: { lines: (s) => [L('narr', s.flags.vanGone ? 'ch3.door.look.3' : 'ch3.van.look')] },
        scan: { lines: [L('prof', 'ch3.van.scan.1'), L('prof', 'ch3.van.scan.2')] },
        hack: {
          id: 'ch3.van',
          once: true,
          cost: 1,
          exposure: 4,
          lines: [L('sys', 'ch3.van.hack.1'), L('narr', 'ch3.van.hack.2'), L('narr', 'ch3.van.hack.3')],
          effects: (s) => (metE(s)
            ? { trust: { eileen: 1 }, flags: { vanGone: true } }
            : { flags: { vanGone: true, pendingVanTrust: true } }),
          after: (s) => (metE(s) ? [L('quote', 'ch3.van.hack.4')] : []),
        },
      },

      rosemary: {
        aliases: ['rosemary', 'plants', 'garden', '迷迭香', '花圃'],
        look: { lines: [L('narr', 'ch3.rosemary')] },
      },
    },

    events: [
      {
        id: 'ch3.latetrust',
        when: (s) => metE(s) && s.flags.pendingVanTrust,
        lines: [L('quote', 'ch3.van.hack.4')],
        effects: { trust: { eileen: 1 } },
      },
      {
        id: 'ch3.hesitate',
        when: (s) => metE(s) && s.flags.vanGone && eTrust(s) < TRUST_GOAL && s.fired['ch3.e.truth'],
        lines: [L('dim', 'ch3.hesitate')],
      },
      {
        id: 'ch3.recruit',
        when: (s) => metE(s) && s.flags.vanGone && eTrust(s) >= TRUST_GOAL,
        lines: [
          L('pause'),
          L('narr', 'ch3.rec.a'),
          L('quote', 'ch3.rec.b'),
          L('quote', 'ch3.rec.c'),
          L('quote', 'ch3.rec.d'),
          L('gain', 'ch3.rec.e'),
          L('sys', 'ch3.rec.f'),
          L('dim', 'ch3.rec.g'),
        ],
        effects: { flags: { recruitedEileen: true } },
        run: (s) => { s.party.push('eileen'); },
      },
    ],

    suggest(s) {
      if (s.flags.recruitedEileen) return [['recall', 'eileen']];
      const out = [];
      if (!metE(s)) {
        if (s.actor !== 'homan') out.push(['switch', 'homan']);
        out.push(['talk', 'eileen']);
      } else {
        if (!s.fired['ch3.e.truth']) out.push(['talk', 'eileen', 'truth']);
        if (!s.fired['ch3.e.echo']) out.push(['talk', 'eileen', 'echo']);
        if (s.clues.includes('notebook') && !s.fired['ch3.e.notebook']) out.push(['talk', 'eileen', 'notebook']);
        if (s.clues.includes('symbol') && !s.fired['ch3.e.symbol']) out.push(['talk', 'eileen', 'symbol']);
      }
      if (!s.flags.vanGone) {
        if (s.actor !== 'echo') out.push(['switch', 'echo']);
        out.push(['hack', 'van']);
      }
      if (s.bandwidth === 0) out.push(['wait']);
      return out;
    },
  });
})(window.ECHO = window.ECHO || {});
