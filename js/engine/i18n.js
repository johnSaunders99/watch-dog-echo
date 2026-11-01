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
      // { l: { en, tc, sc } } 是直接帶著三語文字的變數，例如隨機生成的人名。
      if (typeof v === 'object' && v.l) return pickLang(v.l);
      return String(v);
    });
  }

  // 資料表裡的三語文字用短代碼：en、tc（繁中）、sc（簡中）。
  const SHORT = { en: 'en', 'zh-Hant': 'tc', 'zh-Hans': 'sc' };
  function pickLang(map) {
    const v = map[SHORT[current]];
    return v !== undefined ? v : map.en;
  }

  E.i18n = {
    codes: ['zh-Hant', 'zh-Hans', 'en'],
    pick: pickLang,
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
