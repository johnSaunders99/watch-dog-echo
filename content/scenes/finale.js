// 終章：地下交換機房。布魯內爾豎井 → 舊液壓泵站交換機房。
// 隊伍：Echo、浩文、艾琳（找到瑪雅之後加入）。只有艾琳認得隧道的路。
// 守夜人逼近：每次駭入、以及最後階段的每一回合都會增加曝光；曝光到 RECAPTURE 就是「回收」結局。
// 浩文可以用身體做 Echo 做不到、也不會留下數位痕跡的事：蓋住井口、閂上鐵門。
// 最終抉擇：留下（真結局，需要出血指數 STAY_BLEED 以上）、封存、燎原。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });
  const I = (s, base) => base + (s.bleed >= 25 ? '.me' : '');
  const RECAPTURE = 60;
  const STAY_BLEED = 55;

  // 顯示離「回收」還剩多少曝光；低於 goal 轉紅。
  const meter = { label: 'hud.nightwatch', get: (s) => Math.max(0, RECAPTURE - s.exposure), max: RECAPTURE, goal: 20, unit: '', danger: true };

  // 「拿 鐵門」讀起來很怪，按鈕上改用更貼切的動詞。
  E.chipLabels = Object.assign(E.chipLabels || {}, { 'take:door': 'chip.bolt', 'take:tarp': 'chip.cover' });

  const presentDefaults = {
    wait: {
      lines: (s) => (s.bandwidth >= s.bandwidthMax ? [L('dim', 'wait.full')] : [L('dim', 'wait.1'), L('cost', 'wait.2')]),
      effects: (s) => (s.bandwidth >= s.bandwidthMax ? null : { bandwidth: 1, exposure: 3 }),
    },
    attack: { lines: [L('echo', 'attack.prologue')] },
    jump: { lines: [L('dim', 'fin.jump.none')] },
  };

  // 所有結局共用的尾聲：Broca Tech 的伏筆。
  const coda = [
    L('pause'),
    L('sys', 'end.broca.1'),
    L('quote', 'end.broca.2'),
    L('pause'),
    L('narr', 'end.thanks'),
  ];

  const recapture = {
    id: 'fin.recaptured',
    when: (s) => s.exposure >= RECAPTURE && !s.ended,
    lines: [
      L('pause'),
      L('warn', 'end.rc.1'),
      L('narr', 'end.rc.2'),
      L('echo', 'end.rc.3'),
      L('sys', 'end.rc.4'),
      L('pause'),
      L('dim', 'end.rc.5'),
      L('dim', 'end.rc.6'),
      L('title', 'end.rc.title'),
      L('dim', 'end.rc.hint'),
      ...coda,
    ],
    run: (s) => { s.ended = true; s.flags.ending = 'recaptured'; },
  };

  E.registerScene({
    id: 'finale.shaft',
    location: 'fin.sh.loc',
    bandwidth: 3,
    meter,
    implicit: { go: 'tunnel' },
    defaults: presentDefaults,

    enter: [
      L('narr', 'fin.sh.1'),
      L('warn', 'fin.sh.2'),
      L('dim', 'fin.sh.3'),
      L('dim', 'fin.sh.4'),
    ],

    look: (s) => [
      L('narr', 'fin.sh.look.1'),
      s.flags.shaftCovered ? L('narr', 'fin.sh.look.3') : L('warn', 'fin.sh.look.2'),
    ],

    entities: {
      drone: {
        aliases: ['drone', 'drones', 'light', '無人機', '空拍機', '无人机'],
        visible: (s) => !s.flags.shaftCovered && !s.flags.droneDown,
        look: { lines: [L('narr', 'fin.drone.look')] },
        scan: { lines: [L('prof', 'fin.drone.scan')] },
        hack: {
          id: 'fin.drone',
          once: true,
          cost: 1,
          exposure: 8,
          lines: [L('sys', 'fin.drone.hack.1'), L('narr', 'fin.drone.hack.2')],
          effects: { flags: { droneDown: true } },
        },
      },

      tarp: {
        aliases: ['tarp', 'tarpaulin', 'cover', 'sheet', '防水布', '帆布', '布', '井口'],
        look: { lines: [L('narr', 'fin.tarp.look')] },
        take: {
          id: 'fin.tarp',
          once: true,
          actor: 'homan',
          lines: [L('narr', 'fin.tarp.1'), L('quote', 'fin.tarp.2')],
          effects: { flags: { shaftCovered: true } },
          repeat: [L('dim', 'fin.tarp.again')],
        },
      },

      shaft: {
        aliases: ['shaft', 'well', 'water', 'leap of faith', '深井', '井', '水', '信仰之躍', '信仰之跃'],
        look: { lines: [L('narr', 'fin.shaft.look')] },
        jump: {
          lines: (s) => [L('narr', 'fin.shaft.jump.' + s.actor)],
        },
      },

      tunnel: {
        aliases: ['tunnel', 'arch', 'third arch', 'way', '隧道', '拱門', '第三個拱門', '拱门', '第三个拱门'],
        look: { lines: [L('narr', 'fin.tunnel.look')] },
        go: {
          actor: 'eileen',
          lines: (s) => [
            L('narr', 'fin.tunnel.go.1'),
            ...(s.flags.shaftCovered || s.flags.droneDown ? [] : [L('warn', 'fin.tunnel.followed')]),
          ],
          effects: (s) => (s.flags.shaftCovered || s.flags.droneDown ? null : { exposure: 15 }),
          goto: 'finale.exchange',
        },
      },

      homan: {
        aliases: ['homan', 'ho-man', '浩文'],
        look: { lines: [L('narr', 'fin.homan.look')] },
      },
      eileen: {
        aliases: ['eileen', '艾琳'],
        look: { lines: [L('narr', 'fin.eileen.look')] },
      },
    },

    events: [recapture],

    suggest(s) {
      if (s.ended) return [['restart']];
      const out = [['look']];
      if (!s.flags.shaftCovered && !s.flags.droneDown) {
        if (s.actor !== 'homan') out.push(['switch', 'homan']);
        out.push(['take', 'tarp']);
        out.push(['hack', 'drone']);
      }
      if (s.actor !== 'eileen') out.push(['switch', 'eileen']);
      out.push(['go', 'tunnel']);
      return out;
    },
  });

  const canStay = (s) => s.bleed >= STAY_BLEED && s.flags.foundMaya;

  E.registerScene({
    id: 'finale.exchange',
    location: 'fin.ex.loc',
    bandwidth: 2,
    meter,
    defaults: presentDefaults,

    enter: [L('narr', 'fin.ex.1'), L('narr', 'fin.ex.2')],

    look: (s) => [
      L('narr', 'fin.ex.look.1'),
      s.flags.finalPhase ? L('warn', 'fin.ex.look.3') : L('dim', 'fin.ex.look.2'),
    ],

    // 進入最後階段之後，每一回合守夜人都會更近一步；閂上鐵門可以拖慢它。
    onTurn: (s) => {
      if (!s.flags.finalPhase || s.ended) return [];
      // 閂上鐵門、Darcy 守住隧道，都能拖慢守夜人。
      let step = s.flags.doorBarred ? 2 : 4;
      if (s.flags.darcy) step = Math.max(1, step - 2);
      s.exposure = Math.min(100, s.exposure + step);
      return [L('cost', 'fin.tick', { n: step })];
    },

    entities: {
      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '玛雅'],
        look: { lines: (s) => [L('narr', s.flags.foundMaya ? 'fin.maya.look.2' : 'fin.maya.look.1')] },
        talk: {
          // 誰先開口，瑪雅的反應就不一樣。
          lines: (s) => {
            if (s.flags.foundMaya) return [L('dim', 'fin.maya.again')];
            if (s.actor === 'homan') return [L('quote', 'fin.maya.homan.1'), L('quote', 'fin.maya.homan.2')];
            if (s.actor === 'eileen') return [L('quote', 'fin.maya.eileen.1'), L('quote', 'fin.maya.eileen.2')];
            return [L('echo', I(s, 'fin.maya.echo.1')), L('narr', 'fin.maya.echo.2'), L('quote', 'fin.maya.echo.3')];
          },
          effects: (s) => {
            if (s.flags.foundMaya) return null;
            return { bleed: s.actor === 'echo' ? 5 : 2, flags: { foundMaya: true, firstVoice: s.actor } };
          },
        },
      },

      door: {
        aliases: ['door', 'iron door', 'gate', 'bar', '鐵門', '門', '門閂', '铁门', '门', '门闩'],
        look: { lines: [L('narr', 'fin.door.look')] },
        take: {
          id: 'fin.door',
          once: true,
          actor: 'homan',
          lines: [L('narr', 'fin.door.1'), L('quote', 'fin.door.2')],
          effects: { flags: { doorBarred: true } },
          repeat: [L('dim', 'fin.door.again')],
        },
      },

      exchange: {
        aliases: ['exchange', 'switchboard', 'relay', 'wires', '交換機', '線路', '繼電器', '交换机', '线路', '继电器'],
        look: { lines: [L('narr', 'fin.exch.look')] },
        hack: {
          id: 'fin.exch',
          once: true,
          cost: 1,
          exposure: 6,
          lines: [L('sys', 'fin.exch.1'), L('narr', 'fin.exch.2')],
          effects: { exposure: -12 },
          after: [L('gain', 'fin.exch.3')],
        },
      },

      // 三個選項本身也是可以「查看」的物件，讓玩家在決定前讀清楚代價。
      stay: {
        aliases: ['stay', 'remain', 'dedsec', '留下', '留'],
        visible: (s) => s.flags.finalPhase,
        look: { lines: [L('narr', 'fin.opt.stay')] },
        choose: {
          requires: canStay,
          fail: (s) => [
            L('echo', I(s, 'fin.stay.no.1')),
            L('dim', s.flags.foundMaya ? 'fin.stay.no.bleed' : 'fin.stay.no.maya'),
          ],
          lines: (s) => [
            L('pause'),
            L('echo', 'end.stay.1'),
            L('sys', 'end.stay.2'),
            L('bleed', 'end.stay.3'),
            L('pause'),
            L('sys', 'end.stay.4'),
            L('quote', 'end.stay.r1'),
            L('quote', 'end.stay.r2'),
            L('quote', 'end.stay.r3'),
            L('pause'),
            L('narr', 'end.stay.5'),
            L('narr', 'end.stay.6'),
            ...(s.fired['ch3.bag.nw'] || s.fired['ch3.bag.rules'] ? [L('quote', 'end.stay.bag.1'), L('quote', 'end.stay.bag.2')] : []),
            ...(s.flags.evidence ? [L('gain', 'end.stay.evidence')] : []),
            L('title', 'end.stay.title'),
            ...coda,
          ],
          run: (s) => { s.ended = true; s.flags.ending = 'stay'; },
        },
      },

      seal: {
        aliases: ['seal', 'delete', 'shut down', 'sleep', '封存', '刪除', '休眠', '删除'],
        visible: (s) => s.flags.finalPhase,
        look: { lines: [L('narr', 'fin.opt.seal')] },
        choose: {
          lines: (s) => [
            L('pause'),
            L('echo', I(s, 'end.seal.1')),
            L('narr', 'end.seal.2'),
            L('narr', 'end.seal.3'),
            L('quote', 'end.seal.4'),
            L('dim', 'end.seal.5'),
            L('title', 'end.seal.title'),
            ...coda,
          ],
          run: (s) => { s.ended = true; s.flags.ending = 'seal'; },
        },
      },

      wildfire: {
        aliases: ['wildfire', 'upload', 'cassie', 'free', 'offer', '燎原', '上傳', '卡西', '自由', '上传'],
        visible: (s) => s.flags.finalPhase,
        look: { lines: [L('narr', 'fin.opt.wildfire')] },
        choose: {
          lines: [
            L('pause'),
            L('sys', 'end.wf.1'),
            L('quote', 'end.wf.2'),
            L('narr', 'end.wf.3'),
            L('narr', 'end.wf.4'),
            L('narr', 'end.wf.5'),
            L('title', 'end.wf.title'),
            ...coda,
          ],
          run: (s) => { s.ended = true; s.flags.ending = 'wildfire'; },
        },
      },
    },

    events: [
      {
        id: 'fin.phase',
        when: (s) => s.flags.foundMaya,
        lines: (s) => [
          L('pause'),
          L('warn', 'fin.phase.1'),
          // 客串：發現過老鷹符號的玩家，會看到「穿兜帽的人」真的出現。
          ...(s.clues.includes('symbol') ? [
            L('pause'),
            L('narr', 'cameo.darcy'),
            L('quote', 'fin.darcy.1'),
            L('quote', 'fin.darcy.2'),
            L('gain', 'fin.darcy.3'),
          ] : []),
          // 客串：見過 Bagley 的話，他會借用半個倫敦的號誌替你們爭取時間。
          ...(s.fired['ch3.bag.nw'] || s.fired['ch3.bag.rules'] ? [
            L('quote', 'fin.bag.1'),
            L('gain', 'fin.bag.2'),
          ] : []),
          L('sys', 'fin.phase.2'),
          L('quote', 'fin.phase.3'),
          L('quote', 'fin.phase.4'),
          L('sys', 'fin.phase.5'),
          L('dim', 'fin.phase.hint'),
        ],
        effects: (s) => ({
          flags: { finalPhase: true, darcy: s.clues.includes('symbol') },
          exposure: s.fired['ch3.bag.nw'] || s.fired['ch3.bag.rules'] ? -8 : 0,
        }),
        run: (s) => { s.party.push('maya'); },
      },
      recapture,
    ],

    suggest(s) {
      if (s.ended) return [['restart']];
      if (!s.flags.foundMaya) {
        const out = [['look'], ['talk', 'maya']];
        if (s.actor !== 'echo') out.push(['switch', 'echo']);
        return out;
      }
      const out = [];
      if (!s.flags.doorBarred) {
        if (s.actor !== 'homan') out.push(['switch', 'homan']);
        out.push(['take', 'door']);
      }
      out.push(['choose', 'stay'], ['choose', 'seal'], ['choose', 'wildfire']);
      return out;
    },
  });
})(window.ECHO = window.ECHO || {});
