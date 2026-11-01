// 第二季的隊伍：招募來的人、他們的狀態，以及被捕、受傷、永久失去的規則。
// 狀態：active 在隊 → injured 受傷（幾晚後復原）／arrested 被捕（三晚內沒救出就被轉移，變成 lost）。
// 鐵人模式下，被捕就直接永久失去。
(function (E) {
  const TRANSFER_AFTER = 3; // 被捕幾晚後會被轉移
  const BASE_CAPACITY = 6;

  E.roster = {
    TRANSFER_AFTER,

    create(opts = {}) {
      return { members: [], capacity: BASE_CAPACITY, ironman: !!opts.ironman };
    },

    get(r, id) { return r.members.find((m) => m.person.id === id) || null; },
    // 還在隊伍裡、能被派出去的人。
    active(r) { return r.members.filter((m) => m.status === 'active'); },
    // 佔用安全屋床位的人（被捕和失去的不算）。
    housed(r) { return r.members.filter((m) => m.status === 'active' || m.status === 'injured'); },

    canRecruit(r) { return this.housed(r).length < r.capacity; },

    recruit(r, person, night = 0) {
      if (!this.canRecruit(r) || this.get(r, person.id)) return false;
      r.members.push({ person, status: 'active', since: night, injuredFor: 0 });
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
      if (!m || (m.status !== 'active' && m.status !== 'injured')) return false;
      m.status = r.ironman ? 'lost' : 'arrested';
      m.since = night;
      return true;
    },

    rescue(r, id) {
      const m = this.get(r, id);
      if (!m || m.status !== 'arrested') return false;
      m.status = 'active';
      return true;
    },

    // 每過一晚：受傷的人復原一點，被捕太久的人被轉移。回傳發生的事件，交給劇情顯示。
    tickNight(r, night) {
      const events = [];
      for (const m of r.members) {
        if (m.status === 'injured' && --m.injuredFor <= 0) {
          m.status = 'active';
          events.push({ type: 'healed', id: m.person.id });
        } else if (m.status === 'arrested' && night - m.since >= TRANSFER_AFTER) {
          m.status = 'lost';
          events.push({ type: 'transferred', id: m.person.id });
        }
      }
      return events;
    },
  };
})(window.ECHO = window.ECHO || {});
