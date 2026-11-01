// 可重現的亂數：同一個種子永遠產生同一串數字。
// 第二季的路人、任務結果都用它，所以存檔、測試和錄影都能重現同一個結果。
// 狀態只有一個整數，可以直接存進存檔再還原。
(function (E) {
  // 把任意字串變成 32 位元的種子（FNV-1a）。
  function hash(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function create(seed) {
    let a = (typeof seed === 'number' ? seed : hash(seed)) >>> 0;

    // mulberry32
    function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    const r = {
      next,
      // min 到 max（含）之間的整數
      int(min, max) { return min + Math.floor(next() * (max - min + 1)); },
      chance(p) { return next() < p; },
      pick(arr) { return arr[Math.floor(next() * arr.length)]; },
      // 依權重挑選：weights 是 { 選項: 權重 } 或搭配 weightOf 的陣列
      weighted(items, weightOf) {
        const list = Array.isArray(items) ? items : Object.keys(items);
        const w = Array.isArray(items) ? weightOf : (k) => items[k];
        const total = list.reduce((sum, it) => sum + Math.max(0, w(it)), 0);
        let roll = next() * total;
        for (const it of list) {
          roll -= Math.max(0, w(it));
          if (roll < 0) return it;
        }
        return list[list.length - 1];
      },
      shuffle(arr) {
        const out = arr.slice();
        for (let i = out.length - 1; i > 0; i--) {
          const j = Math.floor(next() * (i + 1));
          [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
      },
      get state() { return a; },
    };
    return r;
  }

  E.rng = {
    hash,
    create,
    // 從存檔的狀態還原，接著產生的數字和存檔前完全一樣。
    restore(state) { return create(state >>> 0); },
    // 由多個片段組成一個獨立的種子，例如（世界種子, 行政區, 第幾個路人）。
    // 每個路人有自己的亂數，所以生成順序不影響結果。
    derive(...parts) { return create(hash(parts.join(':'))); },
  };
})(window.ECHO = window.ECHO || {});
