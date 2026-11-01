// 第二季的隊伍：招募來的人、他們的狀態，以及被捕、受傷、離隊的規則。
// 核心成員住在安全屋，佔床位，可以出夜間行動：
//   active 待命 → injured 受傷（幾晚後復原）／arrested 被捕（三晚內沒救出就被轉移，變成 lost）
// 其他狀態不佔床位：
//   network 外圍：住在自己家，提供被動效果，一晚可以叫一個人來支援
//   away 避風頭：離開倫敦幾晚，回來時有床就回安全屋，沒床就進外圍
//   retired 退休：永久離隊
// 鐵人模式下，被捕就直接永久失去。
(function (E) {
  const TRANSFER_AFTER = 3; // 被捕幾晚後會被轉移
  const BASE_CAPACITY = 6;
  const HOUSED = ['active', 'injured'];

  E.roster = {
    TRANSFER_AFTER,
    BASE_CAPACITY,

    create(opts = {}) {
      return { members: [], capacity: BASE_CAPACITY, ironman: !!opts.ironman };
    },

    get(r, id) { return r.members.find((m) => m.person.id === id) || null; },
    // 還在隊伍裡、能被派出去的人。
    active(r) { return r.members.filter((m) => m.status === 'active'); },
    // 佔用安全屋床位的人。
    housed(r) { return r.members.filter((m) => HOUSED.includes(m.status)); },
    network(r) { return r.members.filter((m) => m.status === 'network'); },

    canRecruit(r) { return this.housed(r).length < r.capacity; },

    // 沒指定狀態時，要有空床才能加入；指定 network 則不需要床位。
    recruit(r, person, night = 0, status) {
      if (this.get(r, person.id)) return false;
      const st = status || 'active';
      if (HOUSED.includes(st) && !this.canRecruit(r)) return false;
      r.members.push({ person, status: st, since: night, injuredFor: 0, awayFor: 0 });
      return true;
    },

    injure(r, id, nights = 2) {
      const m = this.get(r, id);
      if (!m || m.status !== 'active') return false;
      m.status = 'injured';
      m.injuredFor = nights;
      return true;
    },

    arrest(r, id, night) {
      const m = this.get(r, id);
      if (!m || !['active', 'injured', 'network'].includes(m.status)) return false;
      m.status = r.ironman ? 'lost' : 'arrested';
      m.since = night;
      return true;
    },

    // 救回來的人：有空床回安全屋，沒有就先回家。
    rescue(r, id) {
      const m = this.get(r, id);
      if (!m || m.status !== 'arrested') return false;
      m.status = this.canRecruit(r) ? 'active' : 'network';
      return true;
    },

    sendHome(r, id) {
      const m = this.get(r, id);
      if (!m || !HOUSED.includes(m.status)) return false;
      m.status = 'network';
      return true;
    },

    callBack(r, id) {
      const m = this.get(r, id);
      if (!m || m.status !== 'network' || !this.canRecruit(r)) return false;
      m.status = 'active';
      return true;
    },

    layLow(r, id, nights) {
      const m = this.get(r, id);
      if (!m || !['active', 'injured', 'network'].includes(m.status)) return false;
      m.status = 'away';
      m.awayFor = nights;
      return true;
    },

    retire(r, id) {
      const m = this.get(r, id);
      if (!m || !['active', 'injured', 'network'].includes(m.status)) return false;
      m.status = 'retired';
      return true;
    },

    // 每過一晚：受傷的人復原一點，被捕太久的人被轉移，避風頭的人回來。回傳發生的事件，交給劇情顯示。
    tickNight(r, night) {
      const events = [];
      for (const m of r.members) {
        if (m.status === 'injured' && --m.injuredFor <= 0) {
          m.status = 'active';
          events.push({ type: 'healed', id: m.person.id });
        } else if (m.status === 'arrested' && night - m.since >= TRANSFER_AFTER) {
          m.status = 'lost';
          events.push({ type: 'transferred', id: m.person.id });
        } else if (m.status === 'away' && --m.awayFor <= 0) {
          m.status = this.canRecruit(r) ? 'active' : 'network';
          events.push({ type: 'returned', id: m.person.id });
        }
      }
      return events;
    },
  };
})(window.ECHO = window.ECHO || {});
