// 第二季主線任務六：三方會談（第三幕的開場，不用組隊）。
// 三份名單湊齊了，上面有你的一名隊員（flags.listed）。先決定名單怎麼處理：燒掉、公開，或留著談判。
// 然後在倫敦眼的車廂裡見三個人：靜域的黑爾博士、燎原分裂派的卡西、Broca Tech 的坎恩。選一個盟友，或誰都不選。
// 結果寫在 flags.listChoice（burn / publish / trade）和 flags.ally（hale / cassie / kahn / none），由夜間引擎結算。
(function (E) {
  const { L, help } = E.s2.kit;
  const world = (s) => s.flags.world || 'stay';
  const listed = (s) => ({ name: s.flags.listed || { l: { en: '-', tc: '-', sc: '-' } } });

  // ===== 備用安全屋：名單到齊 =====
  E.registerScene({
    id: 's2.m6.list',
    location: 's2.loc.m6list',
    art: 'basement',
    anyoneHacks: true,
    help,
    enter: (s) => [
      L('title', 'm6.title'),
      L('narr', 'm6.l.1'),
      L('prof', 'm6.l.2'),
      L('narr', 'm6.l.3'),
      s.flags.listed ? L('moment', 'm6.l.4', listed(s)) : L('narr', 'm6.l.nobody'),
      L('bagley', s.flags.listed ? 'm6.l.5' : 'm6.l.5b'),
      L('bagley', 'm6.l.6'),
      L('dim', 'm6.l.hint'),
    ],
    look: [L('narr', 'm6.l.look')],
    implicit: { talk: 'bagley', go: 'eye' },
    entities: {
      bagley: {
        aliases: ['bagley', 'list', 'phone', '貝格利', '贝格利', '名單', '名单', '手機', '手机'],
        talk: {
          lines: [L('bagley', 'm6.l.ask')],
          topics: {
            burn: { aliases: ['burn', 'delete', 'destroy', '燒', '烧', '燒掉', '烧掉', '刪', '删'], lines: (s) => [L('bagley', 'm6.burn.1', listed(s)), L('dim', 'm6.burn.2')], effects: { flags: { listChoice: 'burn' } } },
            publish: { aliases: ['publish', 'public', 'release', 'tell', '公開', '公开', '發布', '发布'], lines: (s) => [L('bagley', 'm6.publish.1'), L('dim', 'm6.publish.2', listed(s))], effects: { flags: { listChoice: 'publish' } } },
            trade: { aliases: ['trade', 'keep', 'deal', 'bargain', '留著', '留着', '談判', '谈判', '交易', '交出'], lines: (s) => [L('bagley', 'm6.trade.1'), L('dim', 'm6.trade.2', listed(s))], effects: { flags: { listChoice: 'trade' } } },
          },
        },
      },
      screen: {
        aliases: ['screen', 'names', 'list', '螢幕', '屏幕', '名字'],
        look: { lines: (s) => [L('narr', 'm6.l.3'), s.flags.listed ? L('narr', 'm6.l.again', listed(s)) : L('narr', 'm6.l.nobody')] },
      },
      eye: {
        aliases: ['eye', 'london eye', 'meeting', 'go', '倫敦眼', '伦敦眼', '會談', '会谈', '出發', '出发'],
        look: { lines: [L('narr', 'm6.eye.far')] },
        go: { requires: (s) => !!s.flags.listChoice, fail: [L('dim', 'm6.eye.decide')], lines: [L('narr', 'm6.eye.go')], goto: 's2.m6.eye' },
      },
    },
    suggest: (s) => (s.flags.listChoice ? [['go', 'eye'], ['talk', 'bagley', 'burn'], ['talk', 'bagley', 'publish'], ['talk', 'bagley', 'trade']]
      : [['talk', 'bagley', 'burn'], ['talk', 'bagley', 'publish'], ['talk', 'bagley', 'trade']]),
  });

  // ===== 倫敦眼，第 17 號車廂 =====
  const offer = (who) => ({
    lines: (s) => [L('quote', 'm6.' + who + '.offer.1'), L('quote', 'm6.' + who + '.offer.2')],
    effects: { flags: { ['heard_' + who]: true } },
  });
  const askList = (who) => ({ lines: (s) => [L('quote', 'm6.' + who + '.list.' + (s.flags.listChoice || 'burn'))] });
  E.registerScene({
    id: 's2.m6.eye',
    location: 's2.loc.m6eye',
    art: 'embankment',
    anyoneHacks: true,
    help,
    enter: [L('narr', 'm6.e.1'), L('narr', 'm6.e.2'), L('bagley', 'm6.e.3'), L('dim', 'm6.e.hint')],
    look: [L('narr', 'm6.e.look')],
    implicit: { talk: 'bagley' },
    entities: {
      hale: {
        aliases: ['hale', 'doctor', '黑爾', '黑尔', '博士'],
        look: { lines: [L('narr', 'm6.hale.look')] },
        talk: { lines: [L('quote', 'm6.hale.hi')], topics: { offer: Object.assign({ aliases: ['offer', 'deal', 'want', '條件', '条件', '提議', '提议', '想要'] }, offer('hale')), list: Object.assign({ aliases: ['list', '名單', '名单'] }, askList('hale')) } },
      },
      cassie: {
        aliases: ['cassie', 'dunn', '卡西', '鄧恩', '邓恩'],
        look: { lines: [L('narr', 'm6.cassie.look')] },
        scan: { lines: [L('prof', 'm6.cassie.scan')] },
        talk: { lines: [L('quote', 'm6.cassie.hi')], topics: { offer: Object.assign({ aliases: ['offer', 'deal', 'want', '條件', '条件', '提議', '提议', '想要'] }, offer('cassie')), list: Object.assign({ aliases: ['list', '名單', '名单'] }, askList('cassie')) } },
      },
      kahn: {
        aliases: ['kahn', 'adele', 'broca', '坎恩', '艾黛兒', '艾黛儿'],
        look: { lines: [L('narr', 'm6.kahn.look')] },
        scan: { lines: [L('prof', 'm6.kahn.scan')] },
        talk: {
          lines: [L('quote', 'm6.kahn.hi')],
          topics: {
            offer: Object.assign({ aliases: ['offer', 'deal', 'want', '條件', '条件', '提議', '提议', '想要'] }, offer('kahn')),
            list: Object.assign({ aliases: ['list', '名單', '名单'] }, askList('kahn')),
            why: {
              aliases: ['why', 'purpose', 'really', 'curfew', '為什麼', '为什么', '目的', '真正', '宵禁'],
              lines: [L('quote', 'm6.kahn.why.1'), L('moment', 'm6.kahn.why.2'), L('quote', 'm6.kahn.why.3'), L('bagley', 'm6.kahn.why.4')],
              effects: { flags: { kahnTruth: true } },
            },
            echo: { aliases: ['echo', 'ai'], lines: (s) => [L('quote', 'm6.kahn.echo.' + world(s))] },
          },
        },
      },
      bagley: {
        aliases: ['bagley', 'phone', 'choose', 'decide', '貝格利', '贝格利', '手機', '手机', '決定', '决定'],
        talk: {
          lines: [L('bagley', 'm6.choose')],
          topics: {
            hale: { aliases: ['hale', '黑爾', '黑尔', '博士'], lines: [L('bagley', 'm6.pick.hale')], effects: { flags: { ally: 'hale' } }, goto: 's2.m6.after' },
            cassie: { aliases: ['cassie', '卡西'], lines: [L('bagley', 'm6.pick.cassie')], effects: { flags: { ally: 'cassie' } }, goto: 's2.m6.after' },
            kahn: { aliases: ['kahn', 'broca', '坎恩'], lines: [L('bagley', 'm6.pick.kahn')], effects: { flags: { ally: 'kahn' } }, goto: 's2.m6.after' },
            none: { aliases: ['none', 'nobody', 'alone', 'no one', '都不', '誰都不', '谁都不', '自己', '不結盟', '不结盟'], lines: [L('bagley', 'm6.pick.none')], effects: { flags: { ally: 'none' } }, goto: 's2.m6.after' },
          },
        },
      },
      view: {
        aliases: ['view', 'window', 'london', 'city', '窗', '窗外', '倫敦', '伦敦', '城市'],
        look: { lines: [L('narr', 'm6.e.view')] },
      },
    },
    suggest(s) {
      const out = [];
      if (!s.flags.heard_hale) out.push(['talk', 'hale', 'offer']);
      if (!s.flags.heard_cassie) out.push(['talk', 'cassie', 'offer']);
      if (!s.flags.heard_kahn) out.push(['talk', 'kahn', 'offer']);
      if (s.flags.heard_kahn && !s.flags.kahnTruth) out.push(['talk', 'kahn', 'why']);
      if (out.length < 2) out.push(['talk', 'bagley', 'hale'], ['talk', 'bagley', 'cassie'], ['talk', 'bagley', 'kahn'], ['talk', 'bagley', 'none']);
      return out;
    },
  });

  // ===== 下車之後 =====
  E.registerScene({
    id: 's2.m6.after',
    location: 's2.loc.m6after',
    art: 'embankment',
    anyoneHacks: true,
    help,
    enter: (s) => [L('narr', 'm6.a.1'), L('narr', 'm6.a.' + (s.flags.ally || 'none')), L('bagley', 'm6.a.2'), L('dim', 'm6.a.hint')],
    look: [L('narr', 'm6.e.view')],
    implicit: { talk: 'bagley' },
    entities: {
      bagley: {
        aliases: ['bagley', 'phone', '貝格利', '贝格利', '手機', '手机'],
        talk: { id: 'm6.end', lines: [L('bagley', 'm6.a.end')], effects: { flags: { m6done: true } } },
      },
    },
    suggest: () => [['talk', 'bagley']],
  });

  E.s2.missions.m6 = { start: 's2.m6.list' };
})(window.ECHO = window.ECHO || {});
