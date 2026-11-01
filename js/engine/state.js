// 遊戲狀態：只存數值、旗標和 key，不存任何已翻譯的文字，所以隨時可以切換語言。
(function (E) {
  E.state = {
    create() {
      return {
        scene: 'prologue.basement',
        bandwidth: 3,
        bandwidthMax: 3,
        exposure: 0,
        bleed: 0,
        trace: { maya: 34 },
        trust: {},
        actor: 'echo', // 目前操作的角色；招募的人類可以代替 Echo 在現實中行動
        party: [],
        sync: null, // 只在記憶中有數值
        checkpoint: null, // 記憶場景入口的狀態快照，同步中斷時回到這裡
        flags: {},
        clues: [],
        fired: {},
        ended: false,
      };
    },

    snapshot(s) {
      return JSON.stringify(Object.assign({}, s, { checkpoint: null }));
    },

    restore(s) {
      const cp = s.checkpoint;
      Object.assign(s, JSON.parse(cp));
      s.checkpoint = cp;
    },

    // effects 範例：{ trace: { maya: 13 }, sync: -5, exposure: 2, bleed: 2, flags: { x: true }, clue: 'photo' }
    // 也可以是函式，依當下狀態決定效果。
    apply(s, fx) {
      const report = [];
      if (typeof fx === 'function') fx = fx(s);
      if (!fx) return report;
      if (fx.trace) {
        for (const who in fx.trace) {
          const from = s.trace[who] || 0;
          const to = Math.min(100, from + fx.trace[who]);
          s.trace[who] = to;
          report.push({ c: 'gain', k: 'fx.trace', v: { who: { t: 'name.' + who }, from, to } });
        }
      }
      if (fx.sync && s.sync !== null) {
        const from = s.sync;
        const to = Math.max(0, Math.min(100, from + fx.sync));
        s.sync = to;
        if (to !== from) report.push({ c: fx.sync > 0 ? 'gain' : 'loss', k: 'fx.sync', v: { from, to } });
      }
      if (fx.trust) {
        for (const who in fx.trust) {
          const from = s.trust[who] || 0;
          const to = from + fx.trust[who];
          s.trust[who] = to;
          report.push({ c: 'gain', k: 'fx.trust', v: { who: { t: 'name.' + who }, from, to } });
        }
      }
      if (fx.bandwidth) s.bandwidth = Math.max(0, Math.min(s.bandwidthMax, s.bandwidth + fx.bandwidth));
      if (fx.exposure) s.exposure = Math.max(0, Math.min(100, s.exposure + fx.exposure));
      if (fx.bleed) s.bleed = Math.max(0, Math.min(100, s.bleed + fx.bleed));
      if (fx.flags) Object.assign(s.flags, fx.flags);
      if (fx.clue && !s.clues.includes(fx.clue)) {
        s.clues.push(fx.clue);
        report.push({ c: 'gain', k: 'fx.clue', v: { clue: { t: 'clue.' + fx.clue } } });
      }
      return report;
    },
  };
})(window.ECHO = window.ECHO || {});
