// 第二季戰術地圖的格子圖（13×9）和每種行動用哪一張。
// 符號：# 牆　. 地板　, 暗處（只有貼身才看得到）　= 圍欄（可以翻，不擋視線）　D 上鎖的門　d 開著的門
//       H 藏身處（貨櫃、樹叢）　S 出發點　X 撤離點　E 增援點　T 目標　P 被關的人　F 要燒的檔案
// guards／drones 的 route 是巡邏路線；cams 是牆上的攝影機和它輪流看的方向；minRank 是從第幾區起才出現（康登是 0）。
// 每張圖都保證：就算隊上沒有對應的專長，硬撞門、繞遠路也一定走得到目標和撤離點（tools/check.js 會檢查）。
(function (E) {
  const S2 = (E.s2 = E.s2 || {});

  S2.maps = {
    // 工地：圍欄隔開街道和空地，空地中央是監控塔的控制箱。圍欄有一扇上鎖的門，下面有一個缺口，但攝影機盯著。
    site: {
      obj: 'box',
      rows: [
        '#############',
        '#S,,,=.....H#',
        '#S,,,=..T...#',
        '#X,,,D....,,#',
        '#...,=.,,,H.#',
        '#...,.......#',
        '#...,=..H...#',
        '#E..,=......#',
        '#############',
      ],
      guards: [{ route: [[6, 1], [10, 1], [10, 6], [6, 6]] }, { route: [[6, 7], [11, 7]], minRank: 3 }],
      drones: [{ route: [[7, 2], [11, 2], [11, 6], [7, 6]], minRank: 1 }],
      cams: [{ x: 5, y: 8, faces: [[0, -1]] }],
    },
    // 辦公室：三個房間和樓下的大廳。目標在右上角的房間：上鎖的門，或從大廳翻上去。
    office: {
      obj: 'terminal',
      rows: [
        '#############',
        '#S..#,..#..T#',
        '#S..d...D...#',
        '#X..#,..#.H.#',
        '#####.###=###',
        '#E,,..,,....#',
        '#.H..#..H...#',
        '#....d......#',
        '#############',
      ],
      guards: [{ route: [[6, 1], [6, 3], [5, 5], [10, 5], [10, 7], [6, 7]] }, { route: [[9, 1], [9, 3]], minRank: 2 }],
      cams: [{ x: 12, y: 5, faces: [[-1, 0]] }, { x: 10, y: 0, faces: [[0, 1]], minRank: 1 }],
    },
    // 留置場：圍欄後面是院子，右上角的牢房裡關著人。把人帶出來，一起走到撤離點。
    compound: {
      rows: [
        '#############',
        '#S..=,,...#P#',
        '#S..=..H..D.#',
        '#X..D.....#.#',
        '#...=,,,..###',
        '#...=,,,....#',
        '#E..=..H....#',
        '#...,.......#',
        '#############',
      ],
      guards: [{ route: [[5, 2], [9, 2], [9, 7], [5, 7]] }, { route: [[5, 5], [11, 5]], minRank: 2 }],
      drones: [{ route: [[6, 1], [9, 1], [9, 6], [6, 6]], minRank: 1 }],
      cams: [{ x: 8, y: 0, faces: [[0, 1]] }],
    },
    // 安全屋被突襲：獅心防務從左邊攻進來。燒掉兩份檔案，從右邊的後門撤離。
    // 守衛沒有這裡的鑰匙：駭客可以把開著的門鎖上，拖住他們兩回合。
    safehouse: {
      keys: false,
      rows: [
        '#############',
        '#E....#..F..#',
        '#.....D.....#',
        '#E....#..,,.#',
        '###d###..,,.#',
        '#.....#..S..#',
        '#..F..d..S..X',
        '#.....#..S..#',
        '#############',
      ],
      guards: [{ route: [[2, 1]], state: 'alert', chase: true }, { route: [[2, 3]], state: 'alert', chase: true, minRank: 1 }],
    },
    // 街區：一排店面和後巷。目標在左上角的店裡：前門對著街（攝影機看得到），後門上了鎖。
    street: {
      obj: 'terminal',
      rows: [
        '#############',
        '#S..#,,T#...#',
        '#S..D,,.#.H.#',
        '#X........,.#',
        '#.H..##..,,.#',
        '#....##.....#',
        '#E..,....H..#',
        '#...,..#....#',
        '#############',
      ],
      guards: [{ route: [[2, 3], [11, 3], [11, 6], [2, 6]] }, { route: [[9, 1], [11, 1]], minRank: 2 }],
      drones: [{ route: [[3, 3], [10, 3]], minRank: 1 }],
      cams: [{ x: 12, y: 3, faces: [[-1, 0]] }],
    },
  };

  // 每種行動用哪一張地圖、T 格是什麼目標。擴充安全屋（談租約）沒有地圖，只能快速結算。
  S2.opMaps = {
    tower: { map: 'site', obj: 'box' },
    broadcast: { map: 'office', obj: 'antenna' },
    rescue: { map: 'compound' },
    raid: { map: 'safehouse' },
    recruit: {
      rescue: { map: 'compound' },
      erase_score: { map: 'office', obj: 'terminal' },
      recover: { map: 'street', obj: 'terminal' },
      debt: { map: 'office', obj: 'terminal' },
      broadcast: { map: 'office', obj: 'antenna' },
      protect: { map: 'street', obj: 'terminal' },
      search: { map: 'street', obj: 'person' },
    },
    main: {
      m2: { map: 'site', obj: 'box' },
      m3: { map: 'compound' },
      m4: { map: 'office', obj: 'terminal' },
      m5: { map: 'street', obj: 'terminal' },
      m7: { map: 'office', obj: 'terminal' },
      m8: { map: 'office', obj: 'terminal' },
    },
  };
})(window.ECHO = window.ECHO || {});
