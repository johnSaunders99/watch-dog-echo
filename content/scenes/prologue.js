// 序章：康登區地下室。目標是把瑪雅的資料完整度從 34% 蒐集到 60%，然後啟動第一段記憶重建（memory-maya.js）。
// 資料來源：便條 +5、舊筆電 +13、監視器 +10、對講機 +8。頻寬 3 點，三台設備都能駭，但曝光會累積。
(function (E) {
  const L = (c, k, v) => ({ c, k, v });

  E.registerScene({
    id: 'prologue.basement',
    location: 'loc.basement',
    meter: { label: 'hud.trace', get: (s) => s.trace.maya, max: 100, goal: 60, unit: '%' },

    enter: [
      L('sys', 'boot.1'),
      L('sys', 'boot.2'),
      L('warn', 'boot.3'),
      L('pause'),
      L('echo', 'boot.4'),
      L('echo', 'boot.5'),
    ],

    look: [L('narr', 'room.look.1'), L('narr', 'room.look.2'), L('dim', 'room.look.3')],

    entities: {
      message: {
        aliases: ['message', 'msg', 'mail', '訊息', '郵件', '遺言', '信', '讯息', '消息', '邮件', '遗言'],
        look: { lines: [L('narr', 'message.look')] },
        read: {
          lines: [
            L('sys', 'message.header'),
            L('pause'),
            L('quote', 'message.1'),
            L('quote', 'message.2'),
            L('quote', 'message.3'),
            L('quote', 'message.4'),
            L('sys', 'message.attach'),
          ],
          effects: { flags: { readMessage: true }, clue: 'message' },
          after: [L('dim', 'message.hint')],
        },
        scan: { lines: [L('prof', 'message.scan.1'), L('prof', 'message.scan.2')] },
      },

      desk: {
        aliases: ['desk', 'table', '書桌', '桌子', '桌', '书桌'],
        look: { lines: [L('narr', 'desk.look')], effects: { flags: { deskSeen: true } } },
      },

      note: {
        aliases: ['note', 'sticky', '便條', '紙條', '便签', '纸条'],
        visible: (s) => s.flags.deskSeen,
        look: null, // 下方與 read 共用
        read: {
          id: 'note',
          once: true,
          lines: [L('narr', 'note.look'), L('quote', 'note.text'), L('echo', 'note.echo')],
          effects: { trace: { maya: 5 }, clue: 'note' },
          repeat: [L('quote', 'note.text')],
        },
      },

      graffiti: {
        aliases: ['graffiti', 'wall', 'mask', '塗鴉', '牆', '面具', '涂鸦', '墙'],
        look: { lines: [L('narr', 'graffiti.look.1'), L('narr', 'graffiti.look.2'), L('echo', 'graffiti.echo')] },
        scan: { lines: [L('prof', 'graffiti.scan')] },
      },

      laptop: {
        aliases: ['laptop', 'computer', 'pc', '舊筆電', '筆電', '電腦', '旧笔记本', '笔记本', '电脑', '笔电'],
        look: { lines: [L('narr', 'laptop.look')] },
        scan: { lines: [L('prof', 'laptop.scan')] },
        hack: {
          id: 'hack.laptop',
          once: true,
          cost: 1,
          exposure: 2,
          lines: [L('sys', 'laptop.hack.1'), L('narr', 'laptop.hack.2')],
          effects: { trace: { maya: 13 }, bleed: 2, clue: 'photo', flags: { photo: true } },
          after: [L('echo', 'laptop.echo')],
        },
      },

      photo: {
        aliases: ['photo', 'picture', 'wallpaper', '照片', '合照', '相片', '桌布', '合影', '壁纸'],
        visible: (s) => s.flags.photo,
        look: { lines: [L('narr', 'photo.look')] },
        scan: {
          lines: [
            L('prof', 'photo.scan.1'),
            L('prof', 'photo.scan.2'),
            L('prof', 'photo.scan.3'),
            L('prof', 'photo.scan.4'),
            L('prof', 'photo.scan.5'),
          ],
          effects: { flags: { homan: true } },
          after: [L('echo', 'photo.echo')],
        },
      },

      camera: {
        aliases: ['camera', 'cctv', 'cam', '監視器', '攝影機', '鏡頭', '监控摄像头', '监控', '摄像头', '镜头'],
        look: { lines: [L('narr', 'camera.look')] },
        scan: { lines: [L('prof', 'camera.scan')] },
        hack: {
          id: 'hack.camera',
          once: true,
          cost: 1,
          exposure: 4,
          lines: [L('sys', 'camera.hack.1'), L('narr', 'camera.hack.2')],
          effects: { trace: { maya: 10 }, bleed: 2, clue: 'footage', flags: { van: true } },
          after: [L('echo', 'camera.echo'), L('warn', 'camera.hack.3')],
        },
      },

      van: {
        aliases: ['van', 'vehicle', 'car', '廂型車', '車', '面包车', '车'],
        visible: (s) => s.flags.van,
        look: { lines: [L('narr', 'van.look')] },
        scan: {
          lines: [L('prof', 'van.scan.1'), L('prof', 'van.scan.2'), L('prof', 'van.scan.3')],
          effects: { flags: { vanScanned: true } },
          after: [L('warn', 'van.warn')],
        },
      },

      radio: {
        aliases: ['radio', 'walkie', '對講機', '無線電', '对讲机', '无线电'],
        look: { lines: [L('narr', 'radio.look')] },
        scan: { lines: [L('prof', 'radio.scan')] },
        hack: {
          id: 'hack.radio',
          once: true,
          cost: 1,
          exposure: 3,
          lines: [L('sys', 'radio.hack.1'), L('quote', 'radio.hack.2'), L('dim', 'radio.hack.3')],
          effects: { trace: { maya: 8 }, bleed: 3, clue: 'radiolog' },
          after: [L('echo', 'radio.echo')],
        },
      },

      maya: {
        aliases: ['maya', 'okafor', '瑪雅', '奧卡福', '玛雅', '奥卡福'],
        look: { lines: [L('narr', 'maya.look')] },
        scan: {
          lines: (s) => [
            L('prof', 'maya.scan.1'),
            L('prof', 'maya.scan.2'),
            L('prof', 'maya.scan.3', { n: s.trace.maya }),
          ],
        },
        recall: {
          requires: (s) => s.trace.maya >= 60,
          fail: (s) => [L('err', 'recall.short', { n: s.trace.maya }), L('dim', 'recall.hint')],
          lines: [
            L('sys', 'recall.1'),
            L('sys', 'recall.2'),
            L('sys', 'recall.3'),
            L('pause'),
            L('narr', 'recall.4'),
            L('quote', 'recall.5'),
            L('pause'),
            L('echo', 'recall.6'),
            L('bleed', 'recall.7'),
            L('pause'),
            L('title', 'recall.8'),
          ],
          effects: { bleed: 10 },
          run: (s) => { s.sync = 64; },
          goto: 'memory.maya.alley',
        },
      },
    },

    events: [
      {
        id: 'nightwatch',
        when: (s) => s.exposure >= 7,
        lines: [L('warn', 'ev.nw.1'), L('echo', 'ev.nw.2')],
      },
      {
        id: 'ready',
        when: (s) => s.trace.maya >= 60,
        lines: [L('sys', 'ev.ready.1'), L('dim', 'ev.ready.2')],
      },
    ],

    defaults: {
      attack: { lines: [L('echo', 'attack.prologue')] },
    },

    // 建議指令：依進度給出 [指令, 目標]，介面會翻譯成目前語言的按鈕。
    suggest(s) {
      if (!s.flags.readMessage) return [['read', 'message'], ['look'], ['help']];
      const out = [];
      if (s.trace.maya >= 60) out.push(['recall', 'maya']);
      out.push(['look']);
      if (!s.fired['hack.laptop']) out.push(['hack', 'laptop']);
      else if (!s.flags.homan) out.push(['scan', 'photo']);
      if (!s.fired['hack.camera']) out.push(['hack', 'camera']);
      else if (!s.flags.vanScanned) out.push(['scan', 'van']);
      if (!s.fired['hack.radio']) out.push(['hack', 'radio']);
      if (!s.flags.deskSeen) out.push(['look', 'desk']);
      else if (!s.fired.note) out.push(['read', 'note']);
      if (s.trace.maya < 60) out.push(['recall', 'maya']);
      out.push(['items']);
      return out;
    },
  });

  // 查看便條和讀取便條是同一個動作。
  const note = E.scenes['prologue.basement'].entities.note;
  note.look = note.read;
})(window.ECHO = window.ECHO || {});
