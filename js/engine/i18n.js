// 多語文本：所有台詞以 key 引用，畫面上的文字在顯示當下才翻譯。
(function (E) {
  const tables = {};
  let current = 'zh-Hant';

  function resolve(key, vars) {
    let s = tables[current] && tables[current][key];
    if (s === undefined) {
      console.warn('[i18n] missing key', current, key);
      return '⟦' + key + '⟧';
    }
    return s.replace(/\{(\w+)\}/g, (m, name) => {
      const v = vars ? vars[name] : undefined;
      if (v === undefined || v === null) return m;
      // { t: 'key' } 代表這個變數本身也要翻譯，例如指令名稱或物件名稱。
      if (typeof v === 'object' && v.t) return resolve(v.t, v.v);
      return String(v);
    });
  }

  E.i18n = {
    codes: ['zh-Hant', 'zh-Hans', 'en'],
    // 同一個語言可以分成多個檔案註冊，內容會合併。
    register(code, table) { tables[code] = Object.assign(tables[code] || {}, table); },
    has(code) { return !!tables[code]; },
    get lang() { return current; },
    set(code) {
      if (!tables[code]) return false;
      current = code;
      document.documentElement.lang = code;
      return true;
    },
    t: resolve,
  };
})(window.ECHO = window.ECHO || {});
