// 存檔：存在瀏覽器 localStorage。私密視窗或被封鎖時會靜默失敗，遊戲照常進行。
(function (E) {
  // 第一季的存檔位置。第二季會從這裡讀取第一季的結局，所以這個 key 和格式從 v1.0 起不能再改。
  const V1_KEY = 'watchdogs-echo.save.v2';

  function getRaw(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function setRaw(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 無法存檔時忽略 */ }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* 忽略 */ }
  }

  // 帶版本號的存檔欄位。存進去的是 { v, data }；讀出來時，舊版本會依序經過 migrations 升級到目前版本。
  // migrations[n] 負責把第 n 版的 data 轉成第 n+1 版。沒有版本號的舊資料視為第 0 版。
  function slot(key, version, migrations = {}) {
    return {
      key,
      version,
      write(data) { setRaw(key, { v: version, data }); },
      read() {
        const stored = getRaw(key);
        if (!stored) return null;
        let v = typeof stored.v === 'number' ? stored.v : 0;
        let data = typeof stored.v === 'number' ? stored.data : stored;
        if (v > version) return null; // 比遊戲還新的存檔（玩家玩過更新版又退回舊版）：不讀，避免弄壞
        while (v < version) {
          if (!migrations[v]) return null;
          data = migrations[v](data);
          v++;
        }
        return data;
      },
      clear() { remove(key); },
    };
  }

  E.save = {
    // 第一季沿用原本的介面。
    write(data) { setRaw(V1_KEY, data); },
    read() { return getRaw(V1_KEY); },
    clear() { remove(V1_KEY); },

    slot,

    // 讀取第一季的結局：stay、seal、wildfire、recaptured；沒有打完就回傳 null。
    v1Ending() {
      const save = getRaw(V1_KEY);
      const s = save && save.state;
      return s && s.ended && s.flags && s.flags.ending ? s.flags.ending : null;
    },
  };
})(window.ECHO = window.ECHO || {});
