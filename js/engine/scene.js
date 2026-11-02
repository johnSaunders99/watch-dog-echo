// 場景執行：讀取場景資料，依玩家指令和遊戲狀態產生要輸出的文字。
// 輸出的每一行都是 { c: 樣式, k: 文字 key, v: 變數 }，由介面層負責翻譯和顯示。
(function (E) {
  E.scenes = {};
  E.registerScene = (scene) => { E.scenes[scene.id] = scene; };

  // 記憶中同步率低於這個值，記憶就會崩塌。
  const DESYNC_BELOW = 50;

  function lines(src, s) {
    if (!src) return [];
    const arr = typeof src === 'function' ? src(s) : src;
    return arr.map((l) => Object.assign({}, l));
  }

  const fallback = {
    look: 'err.noLook',
    scan: 'scan.none',
    hack: 'err.noHack',
    read: 'err.noRead',
    recall: 'err.noRecall',
    go: 'err.noGo',
    talk: 'err.noTalk',
    attack: 'err.noAttack',
    wait: 'err.noWait',
    take: 'err.noTake',
    choose: 'err.noChoose',
    jump: 'err.noJump',
  };

  // 判斷「交談」的句子裡，除了人名和虛詞之外還有沒有別的內容（也就是問了一個不存在的話題）。
  const FILLERS = ['about', 'the', 'to', 'with', 'him', 'her', '關於', '关于', '跟', '和', '說', '说', '話', '话', '聊', '的', '一下', '他', '她'];
  function leftover(rest, ent) {
    let r = (rest || '').toLowerCase();
    for (const a of [...ent.aliases].sort((x, y) => y.length - x.length)) r = r.split(a.toLowerCase()).join(' ');
    for (const f of FILLERS) r = r.split(f).join(' ');
    return r.replace(/[\s,，。？?！!「」"']/g, '');
  }

  function matchTopic(topics, rest) {
    const r = (rest || '').toLowerCase();
    let found = null, best = 0;
    for (const id in topics) {
      for (const a of topics[id].aliases) {
        const al = a.toLowerCase();
        if (al.length > best && r.includes(al)) { best = al.length; found = id; }
      }
    }
    return found;
  }

  E.engine = {
    visibleEntities(scene, s) {
      return Object.keys(scene.entities).filter((id) => {
        const ent = scene.entities[id];
        return !ent.visible || ent.visible(s);
      });
    },

    enter(s) {
      const scene = E.scenes[s.scene];
      return [{ c: 'loc', k: scene.location }, ...lines(scene.enter, s)];
    },

    goto(s, id) {
      const scene = E.scenes[id];
      s.scene = id;
      // 第一次進入有頻寬設定的場景時，頻寬重置為該場景的上限。
      if (scene.bandwidth && !s.fired['bw:' + id]) {
        s.fired['bw:' + id] = true;
        s.bandwidth = s.bandwidthMax = scene.bandwidth;
      }
      if (scene.checkpoint) s.checkpoint = E.state.snapshot(s);
      return this.enter(s);
    },

    exec(cmd, s) {
      const scene = E.scenes[s.scene];
      const out = [];
      const say = (c, k, v) => out.push({ c, k, v });
      const verb = cmd.verb;
      // 有些指令在特定場景可以省略目標，例如在後巷輸入「前往」就是去裝卸區。
      const target = cmd.target || (!cmd.rest && scene.implicit && scene.implicit[verb]) || null;

      if (!verb) {
        say('err', 'err.unknown', { input: cmd.raw });
        say('dim', 'err.tryHelp');
      } else if (verb === 'help') {
        out.push(...lines(scene.help || E.defaultHelp, s));
      } else if (verb === 'items') {
        if (!s.clues.length) say('dim', 'items.none');
        else {
          say('sys', 'items.header');
          s.clues.forEach((c) => say('narr', 'items.row', { clue: { t: 'clue.' + c } }));
        }
      } else if (verb === 'switch') {
        this.switchActor(cmd, s, scene, say);
      } else if (verb === 'hack' && s.actor !== 'echo' && !scene.memory && !scene.anyoneHacks) {
        // 只有 Echo 會駭客技術；人類同伴得切換回 Echo 才能駭入。
        // 第二季的場景標了 anyoneHacks：主角是人類，用手機加上 Bagley 的幫忙駭入。
        say('dim', 'actor.nohack', { who: { t: 'name.' + s.actor } });
      } else if (!target) {
        if (cmd.rest) say('err', 'err.noTarget', { target: cmd.rest });
        else if (verb === 'look') out.push(...lines(scene.look, s));
        else say('err', 'err.what', { verb: { t: 'verb.' + verb } });
      } else {
        let id = target;
        let ent = scene.entities[id];
        // 「問浩文灰大衣」會先比對到灰大衣；交談時改找句子裡提到、而且能對話的人。
        if (verb === 'talk' && !ent.talk && cmd.rest) {
          const alt = this.visibleEntities(scene, s).find((e) => scene.entities[e].talk
            && scene.entities[e].aliases.some((a) => cmd.rest.includes(a.toLowerCase())));
          if (alt) { id = alt; ent = scene.entities[alt]; }
        }
        let act = ent[verb] || (scene.defaults && scene.defaults[verb]);
        // 同一個動作可以掛在多個指令上（例如查看和讀取便條），用 act.id 確保只結算一次。
        let key = act && (act.id || verb + ':' + id);
        let handled = false;
        if (act && act.topics) {
          if (act.actor && ![].concat(act.actor).includes(s.actor)) {
            say('dim', 'actor.need', { who: { t: 'name.' + [].concat(act.actor)[0] } });
            act = null;
            handled = true;
          } else if (act.requires && !act.requires(s)) {
            out.push(...lines(act.fail, s));
            act = null;
            handled = true;
          } else {
            const topic = cmd.topic || matchTopic(act.topics, cmd.rest);
            if (topic) {
              act = act.topics[topic];
              key = act.id || 'talk:' + id + ':' + topic;
            } else if (leftover(cmd.rest, ent)) {
              say('dim', 'talk.unknownTopic');
              act = null;
              handled = true;
            }
          }
        }
        if (act) this.perform(act, s, out, key);
        else if (!handled) say('dim', fallback[verb]);
      }

      if (s.sync !== null && s.sync < DESYNC_BELOW && E.scenes[s.scene].memory) {
        say('err', 'desync.1');
        say('dim', E.scenes[s.scene].desync || 'desync.2');
        E.state.restore(s);
        out.push(...this.enter(s));
        return out;
      }

      // 每回合結算（例如終章裡守夜人一步步逼近）。
      const now = E.scenes[s.scene];
      if (now === scene && scene.onTurn && verb) out.push(...lines(scene.onTurn(s) || [], s));

      this.checkEvents(E.scenes[s.scene], s, out);
      return out;
    },

    switchActor(cmd, s, scene, say) {
      const r = (cmd.rest || '').toLowerCase();
      const ids = Object.keys(E.partyAliases);
      const id = (cmd.target && ids.includes(cmd.target) && cmd.target)
        || ids.find((p) => E.partyAliases[p].some((a) => r.includes(a.toLowerCase())));
      const who = id ? { t: 'name.' + id } : null;
      if (scene.memory) say('dim', 'switch.memory');
      else if (!id) say('err', 'switch.who');
      else if (id !== 'echo' && !s.party.includes(id)) say('dim', 'switch.notin', { who });
      else if (id === s.actor) say('dim', 'switch.already', { who });
      else {
        s.actor = id;
        say('sys', 'switch.to', { who });
      }
    },

    perform(act, s, out, key) {
      // 有些動作只有特定角色做得到，例如敲門要有身體，駭入要是 Echo。
      if (act.actor && ![].concat(act.actor).includes(s.actor)) {
        out.push({ c: 'dim', k: 'actor.need', v: { who: { t: 'name.' + [].concat(act.actor)[0] } } });
        return;
      }
      if (act.requires && !act.requires(s)) {
        out.push(...lines(act.fail, s));
        return;
      }
      if (act.once && s.fired[key]) {
        out.push(...lines(act.repeat || [{ c: 'dim', k: 'err.done' }], s));
        return;
      }
      if (act.cost) {
        if (s.bandwidth < act.cost) {
          out.push({ c: 'err', k: 'err.bandwidth' });
          return;
        }
        s.bandwidth -= act.cost;
      }
      if (act.cost || act.exposure) {
        s.exposure = Math.min(100, s.exposure + (act.exposure || 0));
        out.push({ c: 'cost', k: 'fx.cost', v: { bw: act.cost || 0, exp: act.exposure || 0 } });
      }
      out.push(...lines(act.lines, s));
      out.push(...E.state.apply(s, act.effects));
      out.push(...lines(act.after, s));
      if (act.once) s.fired[key] = true;
      if (act.run) act.run(s);
      // 同步率已經崩塌就不換場景：否則新場景的存檔點會存下崩塌的狀態，永遠回不來。
      if (s.sync !== null && s.sync < DESYNC_BELOW && E.scenes[s.scene].memory) return;
      const dest = typeof act.goto === 'function' ? act.goto(s) : act.goto;
      if (dest) out.push(...this.goto(s, dest));
    },

    checkEvents(scene, s, out) {
      for (const ev of scene.events || []) {
        const key = 'ev:' + ev.id;
        if (s.fired[key] || !ev.when(s)) continue;
        s.fired[key] = true;
        out.push(...lines(ev.lines, s));
        out.push(...E.state.apply(s, ev.effects));
        if (ev.run) ev.run(s);
        if (ev.goto) {
          out.push(...this.goto(s, ev.goto));
          return;
        }
      }
    },

    suggestions(s) {
      const scene = E.scenes[s.scene];
      return scene.suggest ? scene.suggest(s) : [];
    },
  };
})(window.ECHO = window.ECHO || {});
