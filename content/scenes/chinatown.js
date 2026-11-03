// 現實・唐人街：找到並招募陳浩文。
// Echo 沒有身體，只能在攝影機之間移動：爵祿街口 → 金鳳茶樓。
// 招募條件（照《自由軍團》的招募任務）：解決他的麻煩（帳號被凍結、靜域探員跟蹤），並讓信任達到 4。
// 信任來源：問瑪雅 +1（記憶一裡向他道謝過則 +2）、匯款 +2、盒子 +2（需記憶一的線索）、恢復帳號 +2、支開探員 +1。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });
  const TRUST_GOAL = 4;
  const met = (s) => !!s.flags.met;
  const trust = (s) => s.trust.homan || 0;
  const ready = (s) => trust(s) >= TRUST_GOAL && s.flags.accountFixed && s.flags.agentGone;
  // Echo 的自稱會隨出血指數改變。
  const I = (s, base) => base + (s.bleed >= 25 ? '.me' : '');

  const meter = { label: 'hud.trust', get: trust, max: 8, goal: TRUST_GOAL, unit: '' };

  const presentDefaults = {
    wait: {
      lines: (s) => (s.bandwidth >= s.bandwidthMax ? [L('dim', 'wait.full')] : [L('dim', 'wait.1'), L('cost', 'wait.2')]),
      effects: (s) => (s.bandwidth >= s.bandwidthMax ? null : { bandwidth: 1, exposure: 3 }),
    },
    attack: { lines: [L('echo', 'attack.prologue')] },
  };

  const nightwatch = {
    id: 'nw2',
    when: (s) => s.exposure >= 15,
    lines: [L('warn', 'cw.nw.1'), L('echo', 'cw.nw.2')],
  };

  const agentScan = {
    lines: [L('prof', 'cw.agent.scan.1'), L('prof', 'cw.agent.scan.2')],
    effects: { flags: { agentKnown: true } },
    after: [L('warn', 'cw.agent.warn')],
  };
  // 不要用 "man"：會比對到 "ho-man" 裡面。
  const agentAliases = ['agent', 'coat', 'grey coat', 'gray coat', 'stranger', '灰大衣', '男人', '探員', '灰衣人', '探员'];

  E.registerScene({
    id: 'present.chinatown.street',
    location: 'cw.st.loc',
    bandwidth: 2,
    meter,
    implicit: { go: 'teahouse' },
    defaults: presentDefaults,

    enter: [
      L('sys', 'cw.st.1'),
      L('narr', 'cw.st.2'),
      L('narr', 'cw.st.3'),
      L('dim', 'cw.st.4'),
    ],

    look: [L('narr', 'cw.st.look.1'), L('narr', 'cw.st.look.2'), L('dim', 'cw.st.look.3')],

    entities: {
      gate: {
        aliases: ['gate', 'arch', '牌樓', '牌坊', '牌楼'],
        look: { lines: [L('narr', 'cw.gate.look')] },
      },

      bike: {
        aliases: ['bike', 'e-bike', 'scooter', 'moped', '機車', '電動機車', '電動車', '电动车', '摩托'],
        look: { lines: [L('narr', 'cw.bike.look')] },
        scan: {
          lines: [L('prof', 'cw.bike.scan.1'), L('prof', 'cw.bike.scan.2')],
          effects: { flags: { foundBike: true, needsAccount: true } },
          after: [L('echo', 'cw.bike.echo')],
        },
      },

      agent: {
        aliases: agentAliases,
        look: { lines: [L('narr', 'cw.agent.look')] },
        scan: agentScan,
      },

      crowd: {
        aliases: ['crowd', 'people', 'passers-by', 'pedestrians', '人群', '路人', '行人'],
        look: { lines: [L('narr', 'cw.crowd.look')] },
        // 每次掃描換一個路人，像原作一樣每個人都有自己的人生。
        // 第二次掃描會掃到一個戴 LED 面具的人：Wrench 的客串彩蛋。
        scan: {
          lines: (s) => {
            const n = (s.flags.crowd || 0) % 4;
            if (n === 1) {
              return [
                Object.assign(L('prof', 'cw.wrench.1'), { who: 'wrench' }),
                Object.assign(L('prof', 'cw.wrench.2'), { who: 'wrench' }),
                L('narr', 'cameo.wrench'),
              ];
            }
            const k = n === 0 ? 0 : n - 1;
            return [L('prof', 'cw.crowd.' + k + '.1'), L('prof', 'cw.crowd.' + k + '.2')];
          },
          effects: (s) => ({ flags: { crowd: (s.flags.crowd || 0) + 1 } }),
        },
      },

      teahouse: {
        aliases: ['teahouse', 'restaurant', 'inside', '茶樓', '金鳳', '餐廳', '店裡', '茶楼', '金凤', '餐厅'],
        look: { lines: [L('narr', 'cw.teahouse.look')] },
        go: { lines: [L('echo', 'cw.teahouse.nolegs')] },
      },

      tcam: {
        aliases: ['camera', 'teahouse camera', 'cctv', '監視器', '茶樓監視器', '攝影機', '监控', '茶楼监控', '摄像头'],
        look: { lines: [L('narr', 'cw.tcam.look')] },
        hack: {
          cost: 1,
          exposure: 2,
          lines: [L('sys', 'cw.tcam.hack')],
          goto: 'present.chinatown.teahouse',
        },
      },
    },

    events: [nightwatch],

    // 目標清單（畫面上的「目標」）：第一次玩的人知道現在要做什麼、為什麼。
    goals: () => [{ k: 'cw.goal.find', how: 'cw.goal.find.how', done: false }],

    suggest(s) {
      const out = [['look']];
      if (!s.flags.foundBike) out.push(['scan', 'bike']);
      if (!s.flags.agentKnown) out.push(['scan', 'agent']);
      out.push(['scan', 'crowd']);
      out.push(['hack', 'tcam']);
      return out;
    },
  });

  E.registerScene({
    id: 'present.chinatown.teahouse',
    location: 'cw.tea.loc',
    bandwidth: 4,
    meter,
    defaults: presentDefaults,

    enter: (s) => [
      L('narr', 'cw.tea.1'),
      L('narr', 'cw.tea.2'),
      L('echo', I(s, 'cw.tea.3')),
    ],

    look: (s) => [
      L('narr', 'cw.tea.look.1'),
      s.flags.agentGone ? L('narr', 'cw.tea.look.3') : L('narr', 'cw.tea.look.2'),
    ],

    entities: {
      // 浩文放在第一個：同分時以他為準，「問浩文平台的事」不會被誤認成平板。
      homan: {
        aliases: ['homan', 'ho-man', 'chan', 'rider', '浩文', '陳浩文', '外送員', '陈浩文', '外卖骑手', '骑手'],
        look: { lines: [L('narr', 'cw.homan.look')] },
        scan: {
          lines: [
            L('prof', 'cw.homan.scan.1'),
            L('prof', 'cw.homan.scan.2'),
            L('prof', 'cw.homan.scan.3'),
            L('prof', 'cw.homan.scan.4'),
          ],
          effects: { flags: { needsAccount: true } },
        },
        // 招募之後，浩文同意讓 Echo 重建他的記憶：第二章開始。
        recall: {
          requires: (s) => s.flags.recruitedHoman,
          fail: [L('dim', 'cw.recall.notyet')],
          lines: [
            L('sys', 'mem2.recall.1'),
            L('quote', 'mem2.recall.2'),
            L('sys', 'mem2.recall.3'),
            L('pause'),
            L('title', 'mem2.recall.4'),
          ],
          run: (s) => { s.sync = 60; s.actor = 'echo'; },
          goto: 'memory.homan.hub',
        },
        talk: {
          requires: (s) => s.flags.contact,
          fail: [L('echo', 'cw.tea.novoice'), L('dim', 'cw.tea.novoice.hint')],
          lines: (s) => (met(s)
            ? [L('dim', 'cw.talk.hint')]
            : [
              L('quote', 'cw.contact.1'),
              L('echo', I(s, 'cw.contact.2')),
              L('narr', 'cw.contact.3'),
              L('dim', 'cw.talk.hint'),
            ]),
          effects: { flags: { met: true } },
          topics: {
            maya: {
              aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
              id: 'topic.maya',
              once: true,
              requires: met,
              fail: [L('dim', 'cw.notmet')],
              lines: (s) => [
                L('quote', 'cw.maya.1'),
                s.fired['mem.thanks'] ? L('quote', 'cw.maya.thanked') : L('quote', 'cw.maya.2'),
              ],
              effects: (s) => ({ trust: { homan: s.fired['mem.thanks'] ? 2 : 1 } }),
              repeat: [L('quote', 'cw.maya.again')],
            },
            night: {
              aliases: ['night', 'stillwater', 'heist', 'that night', '那晚', '那天晚上', '靜域', '静域'],
              requires: met,
              fail: [L('dim', 'cw.notmet')],
              lines: (s) => (s.flags.confessed
                ? [L('quote', 'cw.night.2')]
                : [L('quote', 'cw.night.1'), L('prof', 'cw.night.lie')]),
            },
            payment: {
              aliases: ['payment', 'money', 'paid', 'cash', '匯款', '錢', '兩千', '汇款', '钱', '两千'],
              id: 'topic.payment',
              once: true,
              requires: (s) => met(s) && s.clues.includes('payment'),
              fail: (s) => [L('dim', met(s) ? 'cw.noclue' : 'cw.notmet')],
              lines: [L('quote', 'cw.pay.1'), L('quote', 'cw.pay.2')],
              effects: { trust: { homan: 2 }, flags: { confessed: true } },
              repeat: [L('dim', 'cw.pay.again')],
            },
            device: {
              aliases: ['box', 'device', 'tracker', 'black box', '盒子', '裝置', '追蹤器', '黑盒子', '装置', '追踪器'],
              id: 'topic.device',
              once: true,
              requires: (s) => met(s) && s.clues.includes('device'),
              fail: (s) => [L('dim', met(s) ? 'cw.noclue' : 'cw.notmet')],
              lines: [L('quote', 'cw.dev.1'), L('quote', 'cw.dev.2'), L('sys', 'cw.dev.3')],
              effects: { trust: { homan: 2 }, clue: 'wildfire', flags: { confessed: true, wildfireKnown: true } },
              repeat: [L('dim', 'cw.dev.again')],
            },
            account: {
              aliases: ['account', 'job', 'work', 'app', 'orders', '帳號', '工作', '平台', '凍結', '接單', '账号', '冻结', '接单'],
              requires: met,
              fail: [L('dim', 'cw.notmet')],
              lines: (s) => {
                if (s.flags.accountFixed) return [L('quote', 'cw.acc.fixed')];
                if (s.flags.askedAccount) return [L('dim', 'cw.acc.again')];
                return [L('quote', 'cw.acc.1'), L('quote', 'cw.acc.2')];
              },
              effects: { flags: { needsAccount: true, askedAccount: true } },
            },
            agent: {
              aliases: [...agentAliases, 'following', 'tail', '外面', '跟蹤', '跟踪'],
              requires: met,
              fail: [L('dim', 'cw.notmet')],
              lines: (s) => (s.flags.agentGone
                ? [L('quote', 'cw.agent.gone')]
                : [L('quote', 'cw.agent.t1'), L('quote', 'cw.agent.t2')]),
              effects: { flags: { agentKnown: true } },
            },
            join: {
              aliases: ['join', 'help', 'recruit', 'team', 'work with', '加入', '幫忙', '幫我', '合作', '帮忙', '帮我'],
              requires: met,
              fail: [L('dim', 'cw.notmet')],
              lines: (s) => {
                if (!s.flags.accountFixed) return [L('quote', 'cw.join.acc')];
                if (!s.flags.agentGone) return [L('quote', 'cw.join.agent')];
                return [L('quote', 'cw.join.trust')];
              },
            },
          },
        },
      },

      phone: {
        aliases: ['phone', 'his phone', 'speaker', '手機', '他的手機', '喇叭', '手机', '他的手机'],
        look: { lines: [L('narr', 'cw.phone.look')] },
        hack: {
          id: 'cw.contact',
          once: true,
          cost: 1,
          exposure: 2,
          lines: (s) => [L('sys', I(s, 'cw.phone.hack'))],
          effects: { flags: { contact: true } },
          after: [L('dim', 'cw.phone.hint')],
        },
      },

      tablet: {
        aliases: ['tablet', 'terminal', 'ipad', 'backend', '平板', '商家平板', '後台', '后台'],
        look: { lines: [L('narr', 'cw.tablet.look')] },
        hack: {
          id: 'cw.tablet',
          once: true,
          requires: (s) => s.flags.needsAccount,
          fail: [L('dim', 'cw.tablet.why')],
          cost: 1,
          exposure: 4,
          lines: [L('sys', 'cw.tablet.1'), L('narr', 'cw.tablet.2'), L('sys', 'cw.tablet.3'), L('narr', 'cw.tablet.4')],
          effects: (s) => (met(s)
            ? { trust: { homan: 2 }, flags: { accountFixed: true } }
            : { flags: { accountFixed: true, pendingAccountTrust: true } }),
        },
      },

      agent: {
        aliases: agentAliases,
        look: { lines: (s) => [L('narr', s.flags.agentGone ? 'cw.tea.look.3' : 'cw.tea.look.2')] },
        scan: agentScan,
        hack: {
          id: 'cw.agent',
          once: true,
          cost: 1,
          exposure: 3,
          lines: (s) => [
            ...(s.flags.agentKnown ? [] : [L('dim', 'cw.agent.unknown')]),
            L('narr', 'cw.agent.hack.1'),
            L('narr', 'cw.agent.hack.2'),
            ...(met(s) ? [L('quote', 'cw.agent.hack.3')] : []),
          ],
          effects: (s) => (met(s)
            ? { trust: { homan: 1 }, flags: { agentGone: true } }
            : { flags: { agentGone: true, pendingAgentTrust: true } }),
        },
      },

      tv: {
        aliases: ['tv', 'television', 'news', '電視', '新聞', '电视', '新闻'],
        look: { lines: [L('narr', 'cw.tv.look')] },
        hack: {
          id: 'cw.tv',
          once: true,
          cost: 1,
          exposure: 1,
          lines: [L('narr', 'cw.tv.hack')],
          after: [L('echo', 'cw.tv.echo')],
        },
      },
    },

    events: [
      // 在打招呼之前就先幫了他：等他知道 Echo 是誰時再補上信任。
      {
        id: 'cw.latetrust',
        when: (s) => met(s) && (s.flags.pendingAccountTrust || s.flags.pendingAgentTrust),
        lines: [L('quote', 'cw.latetrust')],
        effects: (s) => ({ trust: { homan: (s.flags.pendingAccountTrust ? 2 : 0) + (s.flags.pendingAgentTrust ? 1 : 0) } }),
      },
      nightwatch,
      {
        id: 'cw.hesitate',
        when: (s) => met(s) && s.flags.accountFixed && s.flags.agentGone && trust(s) < TRUST_GOAL,
        lines: [L('dim', 'cw.hesitate')],
      },
      {
        id: 'cw.recruit',
        when: (s) => met(s) && ready(s),
        lines: (s) => [
          L('pause'),
          L('quote', 'cw.rec.1'),
          L('quote', 'cw.rec.2'),
          L('gain', 'cw.rec.3'),
          ...(s.flags.wildfireKnown ? [L('sys', 'cw.rec.wildfire')] : []),
          L('sys', 'cw.rec.4'),
          L('pause'),
          L('title', 'cw.rec.5'),
          L('echo', I(s, 'cw.rec.6')),
          L('dim', 'cw.rec.go'),
        ],
        effects: { flags: { recruitedHoman: true } },
        run: (s) => { s.party.push('homan'); },
      },
    ],

    // 招募浩文的四個條件；招募之後只剩「重建他的記憶」。
    goals(s) {
      if (s.flags.recruitedHoman) return [{ k: 'cw.goal.recruited', done: true }, { k: 'cw.goal.recall', how: 'cw.goal.recall.how', done: false }];
      return [
        { k: 'cw.goal.why', note: true },
        { k: 'cw.goal.contact', how: s.flags.contact ? 'cw.goal.contact.how2' : 'cw.goal.contact.how', done: met(s) },
        { k: 'cw.goal.account', how: s.flags.needsAccount ? 'cw.goal.account.how' : 'cw.goal.account.how0', done: !!s.flags.accountFixed },
        { k: 'cw.goal.agent', how: 'cw.goal.agent.how', done: !!s.flags.agentGone },
        { k: 'cw.goal.trust', v: { n: trust(s), max: TRUST_GOAL }, how: 'cw.goal.trust.how', done: trust(s) >= TRUST_GOAL },
      ];
    },

    suggest(s) {
      if (s.flags.recruitedHoman) return [['recall', 'homan'], ['talk', 'homan', 'maya']];
      const out = [];
      if (!s.flags.contact) {
        out.push(['look'], ['scan', 'homan'], ['hack', 'phone']);
      } else if (!met(s)) {
        out.push(['talk', 'homan']);
      } else {
        if (!s.fired['topic.maya']) out.push(['talk', 'homan', 'maya']);
        if (!s.flags.askedAccount && !s.flags.accountFixed) out.push(['talk', 'homan', 'account']);
        if (s.clues.includes('payment') && !s.fired['topic.payment']) out.push(['talk', 'homan', 'payment']);
        if (s.clues.includes('device') && !s.fired['topic.device']) out.push(['talk', 'homan', 'device']);
        if (s.flags.needsAccount && !s.flags.accountFixed) out.push(['hack', 'tablet']);
        if (!s.flags.agentGone) out.push(['hack', 'agent']);
        out.push(['talk', 'homan', 'join']);
      }
      if (s.bandwidth === 0) out.push(['wait']);
      return out;
    },
  });
})(window.ECHO = window.ECHO || {});
