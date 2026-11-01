// 指令解析：把三種語言的輸入對應到同一組標準指令和目標。
// 中文不用空格分詞，所以動詞用「最長前綴」比對，目標用別名包含比對。
(function (E) {
  function isLatin(alias) { return /[a-z0-9?]$/.test(alias); }

  function matchVerb(s) {
    let verb = null, best = '';
    for (const v in E.commands) {
      for (const a of E.commands[v]) {
        const al = a.toLowerCase();
        if (al.length <= best.length || !s.startsWith(al)) continue;
        // 英文指令後面必須是空格或結尾，避免 "items" 被當成 "i" + "tems"。
        const next = s.charAt(al.length);
        if (isLatin(al) && next && next !== ' ') continue;
        best = al;
        verb = v;
      }
    }
    return { verb, rest: verb ? s.slice(best.length).trim() : s };
  }

  function matchEntity(rest, scene, state) {
    let found = null, score = 0;
    for (const id of E.engine.visibleEntities(scene, state)) {
      for (const a of scene.entities[id].aliases) {
        const al = a.toLowerCase();
        const sc = rest === al ? 1000 + al.length : rest.includes(al) ? al.length : 0;
        if (sc > score) { score = sc; found = id; }
      }
    }
    return found;
  }

  E.parser = {
    parse(input, scene, state) {
      const raw = input.trim();
      const s = raw.toLowerCase().replace(/\s+/g, ' ');
      if (!s) return null;
      const { verb, rest } = matchVerb(s);
      const target = rest && scene ? matchEntity(rest, scene, state) : null;
      // 只輸入物件名稱，例如「筆電」，就當作查看它。
      if (!verb) return target ? { verb: 'look', target, rest, raw } : { verb: null, rest, raw };
      return { verb, target, rest, raw };
    },
  };
})(window.ECHO = window.ECHO || {});
