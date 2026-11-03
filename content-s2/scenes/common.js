// 第二季主線任務共用的工具：隊友出手的解法、警戒提示、「隊友」這個對象。
// 每個任務用 kit(前綴, 解法表) 拿到自己的一套：解法表是 { 關卡: [[解法, 條件, 增加的警戒], ...] }，
// 依序找第一個符合條件的隊友；台詞的 key 是「前綴.關卡.解法」，隊友用 {name} 稱呼。
// 隊友資料（flags.team：id、類別 cat、專長 perk、名字 name）由夜間引擎在任務開始時填好。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });

  // 第二季的文字冒險可以「翻越」（借用 jump 指令），也可以「躲到」某個地方（算是前往）。
  E.commands.jump.push('climb', 'climb over', 'scale', '翻越', '翻過', '翻过', '翻', '爬上', '爬過', '爬过', '爬', '攀爬');
  E.commands.go.push('hide', 'hide behind', 'hide in', 'duck behind', '躲到', '躲進', '躲进', '躲在', '躲');

  const team = (s) => s.flags.team || [];
  // 不是手機駭入造成的警戒（隊友出手、被照到），只顯示警戒增加多少。
  const alertUp = (n) => L('cost', 's2.story.alertUp', { n });
  const TEAM = ['team', 'crew', 'squad', 'everyone', 'friends', '隊友', '队友', '大家', '夥伴', '伙伴', '同伴', '隊員', '队员'];

  function kit(prefix, HELP) {
    function helper(s, stage, only) {
      for (const [kind, test, exposure] of HELP[stage]) {
        if (only && !only.includes(kind)) continue;
        const m = team(s).find(test);
        if (m) return { m, kind, exposure };
      }
      return null;
    }

    // 讓隊友出手。only 限定解法（例如「跟警衛說話」只找社交類），fail 是找不到人時的台詞，
    // done 為真時表示這一關已經用別的辦法解決了。
    function assist(stage, opt = {}) {
      return {
        id: prefix + '.help.' + stage,
        once: true,
        requires: (s) => !(opt.done && opt.done(s)) && !!helper(s, stage, opt.only),
        fail: (s) => (opt.done && opt.done(s) ? [L('dim', 'err.done')]
          : opt.fail ? opt.fail(s) : [L('dim', 'm2.team.none')]),
        lines: (s) => {
          const h = helper(s, stage, opt.only);
          const out = [L('narr', prefix + '.' + stage + '.' + h.kind, { name: h.m.name })];
          if (h.exposure) out.push(alertUp(h.exposure));
          return out;
        },
        effects: (s) => {
          const h = helper(s, stage, opt.only);
          return Object.assign({ exposure: h.exposure }, opt.effects && opt.effects(s, h));
        },
        after: opt.after,
        goto: opt.goto,
      };
    }

    // 「跟隊友說話」：每個場景的隊友解法入口。
    const teamEntity = (stage, opt) => ({
      aliases: TEAM,
      look: { lines: [L('narr', 'm2.team.look')] },
      talk: assist(stage, opt),
    });

    return { helper, assist, teamEntity };
  }

  E.s2 = E.s2 || {};
  E.s2.missions = E.s2.missions || {};
  E.s2.kit = { L, alertUp, team, kit, TEAM, help: () => E.s2.storyHelp };
})(window.ECHO = window.ECHO || {});
