// 第二季的多解法任務框架。
// 一個關卡（node）有好幾種解法（approach），每種解法需要不同的人：
//   needs.skill    能力門檻，例如 { hack: 2 }
//   needs.perk     特定職業專長，例如 'site_pass'（建築工人的工地門卡）
//   needs.ability  一般能力，例如 'climb'、'run'、'tunnel'；弱點可能封鎖它（懼高封鎖 climb）
// 解法還有代價（cost）和失敗風險（risk），會依隊員的專長、弱點和能力調整。
// 這裡只放純函式，不碰介面，方便測試和之後的主線、模板任務共用。
(function (E) {
  function check(approach, member) {
    const p = member.person || member;
    const needs = approach.needs || {};
    const flaw = E.people.flawOf(p);
    const perk = E.people.occupationOf(p).perk;

    if (needs.perk && perk !== needs.perk) return { ok: false, reason: 's2.need.perk' };
    if (needs.ability && (flaw.blocks || []).includes(needs.ability)) return { ok: false, reason: 's2.need.blocked' };
    for (const skill in needs.skill || {}) {
      if ((p.skills[skill] || 0) < needs.skill[skill]) return { ok: false, reason: 's2.need.skill' };
    }
    return { ok: true };
  }

  // 失敗風險：基礎風險，能力超過門檻每一級 -0.1，專長吻合 -0.1，弱點「容易緊張」等會加上去。
  function risk(approach, member) {
    const p = member.person || member;
    const needs = approach.needs || {};
    let r = approach.risk || 0;
    for (const skill in needs.skill || {}) r -= 0.1 * Math.max(0, (p.skills[skill] || 0) - needs.skill[skill]);
    // 職業專長剛好就是這項能力（例如消防員的「攀爬」去翻牆），比較不會失手。
    if (needs.ability && E.people.occupationOf(p).perk === needs.ability) r -= 0.1;
    if (E.people.traitOf(p).tags.includes('steady')) r -= 0.05;
    r += E.people.flawOf(p).risk || 0;
    return Math.max(0, Math.min(0.95, Math.round(r * 100) / 100));
  }

  // 實際的曝光代價：大嘴巴、手機成癮這類弱點會讓行動更容易被注意到。
  function exposure(approach, member) {
    const p = member.person || member;
    return (approach.cost && approach.cost.exposure || 0) + (E.people.flawOf(p).exposure || 0);
  }

  E.mission = {
    check,
    risk,
    exposure,

    // 列出一個關卡的所有解法，以及隊伍裡每個人能不能用、成功率多少。給介面畫選項用。
    options(node, members) {
      return node.approaches.map((a) => ({
        approach: a,
        candidates: members.map((m) => {
          const c = check(a, m);
          return { id: (m.person || m).id, ok: c.ok, reason: c.reason, risk: c.ok ? risk(a, m) : null };
        }),
      }));
    },

    // 結算一次行動。rng 由呼叫端傳入，所以同一個存檔重玩會得到同樣的結果。
    resolve(approach, member, rng) {
      const c = check(approach, member);
      if (!c.ok) return { ok: false, reason: c.reason };
      const chance = risk(approach, member);
      return {
        ok: true,
        success: rng.next() >= chance,
        risk: chance,
        exposure: exposure(approach, member),
        bandwidth: approach.cost && approach.cost.bandwidth || 0,
      };
    },
  };
})(window.ECHO = window.ECHO || {});
