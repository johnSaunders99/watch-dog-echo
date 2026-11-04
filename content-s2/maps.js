// 第二季戰術地圖的格子圖（15×11）和每種行動用哪一張。
// 符號：# 牆　. 地板　, 暗處（只有貼身才看得到）　= 圍欄（可以翻，不擋視線）　D 上鎖的門　d 開著的門
//       H 藏身處（貨櫃、樹叢）　S 出發點　X 撤離點　E 增援點　T 目標　P 被關的人　F 要燒的檔案
// theme 決定地板和藏身處長什麼樣子（工地、辦公室、院子、住家、街道、隧道）。
// guards／drones／dogs 的 route 是巡邏路線；cams 是牆上的攝影機和它輪流看的方向；minRank 是從第幾區起才出現（康登是 0）。
// dogs 是守衛犬：靠鼻子找人（暗處、藏身處都沒用），不抓人，只會叫來守衛。
// turns：限時行動（救人、突襲）在這張圖上有幾回合（地圖比文字關卡的步數大，所以另外算）。
// 撤離點一定離出發點很遠：完成目標之後還要穿過守衛的地盤才走得掉，不能駭完就在門口溜走。
// 每張圖都保證：就算隊上沒有對應的專長，硬撞門、繞遠路也一定走得到目標和撤離點（tools/check.js 會檢查）。
(function (E) {
  const S2 = (E.s2 = E.s2 || {});

  S2.maps = {
    // 工地：街道在左邊，圍欄後面是空地，監控塔的控制箱在空地中間；下面的倉庫區還有一個備用電源箱，兩個都要關。
    // 圍欄有一扇上鎖的門；街道下面通倉庫區，但右邊牆上的攝影機盯著。撤離點在倉庫區的最右邊。
    site: {
      obj: 'box',
      theme: 'site',
      rows: [
        '###############',
        '#S,,,=......H.#',
        '#S,,,=..T.....#',
        '#S,,,D.....,,E#',
        '#...,=.,,..H..#',
        '#...,=.....,,.#',
        '#...,=..H.....#',
        '#...,=====D===#',
        '#..,,......,,.#',
        '#.H.,...H..T.X#',
        '###############',
      ],
      guards: [{ route: [[6, 1], [12, 1], [12, 6], [6, 6]] }, { route: [[6, 8], [12, 8]], minRank: 2 }, { route: [[9, 2], [9, 6]], minRank: 3 }],
      drones: [{ route: [[7, 2], [12, 2], [12, 5], [7, 5]], minRank: 1 }],
      cams: [{ x: 14, y: 8, faces: [[-1, 0]] }, { x: 9, y: 0, faces: [[0, 1]], minRank: 1 }],
      dogs: [{ route: [[6, 9], [10, 9]], minRank: 2 }],
    },
    // 辦公室：中間是走廊，上面三個房間，下面是後勤區。目標在右上角的房間：上鎖的門，或從走廊翻窗上去。
    // 撤離點是右下角的逃生梯：從後勤區開鎖過去，或從走廊翻過去。
    office: {
      obj: 'terminal',
      theme: 'office',
      rows: [
        '###############',
        '#..,#...#....T#',
        '#.H.d...D.....#',
        '#...#.,,#..H..#',
        '##d###d##=#####',
        '#S....,,.....,#',
        '#S..H.....H...#',
        '#####d####=####',
        '#E,,,...#...,,#',
        '#.....H.D....X#',
        '###############',
      ],
      guards: [{ route: [[12, 5], [12, 6], [5, 6], [5, 5]] }, { route: [[9, 1], [12, 1], [12, 3], [9, 3]], minRank: 2 }, { route: [[2, 9], [7, 9]], minRank: 3 }],
      cams: [{ x: 14, y: 5, faces: [[-1, 0]] }, { x: 11, y: 0, faces: [[0, 1]], minRank: 1 }, { x: 14, y: 8, faces: [[-1, 0]], minRank: 2 }],
    },
    // 留置場：街道和院子之間是圍欄，右上角的牢房裡關著人。把人帶出來，穿過整個院子，從右下角的車道離開。
    compound: {
      theme: 'yard',
      turns: 12,
      rows: [
        '###############',
        '#S..=,,....#P.#',
        '#S..=..H...D..#',
        '#...D.....,####',
        '#...=,,,......#',
        '#E..=,,,...H..#',
        '#...=..H......#',
        '#...=......,,,#',
        '#...=.H....,,,#',
        '#...=........X#',
        '###############',
      ],
      guards: [{ route: [[5, 1], [10, 1], [10, 8], [5, 8]] }, { route: [[6, 5], [12, 5]], minRank: 2 }, { route: [[10, 2], [10, 4]], minRank: 3 }],
      drones: [{ route: [[6, 2], [10, 2], [10, 7], [6, 7]], minRank: 1 }],
      cams: [{ x: 8, y: 0, faces: [[0, 1]] }, { x: 14, y: 6, faces: [[-1, 0]], minRank: 2 }],
      dogs: [{ route: [[11, 7], [13, 7], [13, 4]] }],
    },
    // 安全屋被突襲：獅心防務從左上角攻進來。燒掉兩份檔案，從地下室的走道一路跑到左下角的後門。
    // 守衛沒有這裡的鑰匙：駭客可以把開著的門鎖上，拖住他們兩回合。
    safehouse: {
      keys: false,
      theme: 'home',
      turns: 9,
      rows: [
        '###############',
        '#E....#....F..#',
        '#.....D.......#',
        '#E....#...,,..#',
        '###d###...,,..#',
        '#.....#...S...#',
        '#..F..d...S...#',
        '#.....#...S...#',
        '###########d###',
        '#X,,,,,,,,,,..#',
        '###############',
      ],
      guards: [{ route: [[2, 1]], state: 'alert', chase: true }, { route: [[2, 3]], state: 'alert', chase: true, minRank: 1 }],
    },
    // 街區：一排店面、大街和後巷。目標在左上角的店裡：前門對著大街（攝影機看得到），後門上了鎖。
    // 撤離點在後巷的盡頭：後巷的鐵門鎖著，也可以翻圍欄過去。
    street: {
      obj: 'terminal',
      theme: 'street',
      rows: [
        '###############',
        '#S..#,,T#..,,.#',
        '#S..D,,.#.H.,.#',
        '#......,,.....#',
        '#.H..##....##.#',
        '#....##.H..##.#',
        '#E..,.....,,..#',
        '######D###=####',
        '#,,,,......,,.#',
        '#..H......,..X#',
        '###############',
      ],
      guards: [{ route: [[13, 3], [13, 6], [3, 6], [3, 3]] }, { route: [[9, 1], [13, 1]], minRank: 2 }, { route: [[2, 8], [12, 8]], minRank: 3 }],
      drones: [{ route: [[12, 3], [4, 3]], minRank: 1 }],
      cams: [{ x: 14, y: 3, faces: [[-1, 0]] }, { x: 14, y: 9, faces: [[-1, 0]], minRank: 2 }],
      dogs: [{ route: [[7, 9], [12, 9]], minRank: 1 }],
    },
    // 市集：收攤之後的攤位巷子，篷布底下很暗、堆著貨箱。從左上角進來，穿過三排攤位，從右下角的停車場出去。
    // 中間那排攤位的倉庫裡有一台終端（主線任務三要先從這裡查出押送車往哪裡開；不需要的時候這一格只是地板）。
    market: {
      theme: 'street',
      rows: [
        '###############',
        '#S.,,#..H..,,.#',
        '#S.,,D..#..,..#',
        '#...###.#.##=##',
        '#.H.,...=.....#',
        '#...#,,.#.,,H.#',
        '#E..#,T.#.,,..#',
        '#####.###...D.#',
        '#,,...H...#,,.#',
        '#..H..,,..#..X#',
        '###############',
      ],
      guards: [{ route: [[9, 1], [13, 1], [13, 2], [9, 2]] }, { route: [[5, 8], [9, 8]], minRank: 1 }, { route: [[10, 4], [13, 4]], minRank: 3 }],
      drones: [{ route: [[2, 4], [7, 4], [7, 8], [2, 8]], minRank: 2 }],
      cams: [{ x: 6, y: 3, faces: [[0, 1]] }, { x: 14, y: 6, faces: [[-1, 0]], minRank: 1 }],
      dogs: [{ route: [[11, 9], [12, 9], [12, 8]], minRank: 2 }],
    },
    // 碼頭：一排一排的貨櫃（牆）和吊車軌道。從左下角上岸，撤離點是右上角等著的小船。
    // 右下角的貨櫃區有一扇鎖著的門；吊車底下的控制箱（主線任務五）在中間。
    wharf: {
      theme: 'yard',
      rows: [
        '###############',
        '#..H...,,...#X#',
        '#.####.,,.#.#.#',
        '#.#..#....#...#',
        '#.#..D..H.##=##',
        '#...,,........#',
        '###=###.###.#.#',
        '#S..,,#.#T#.#.#',
        '#S..H.d.....#.#',
        '#S....#..,,..E#',
        '###############',
      ],
      guards: [{ route: [[7, 5], [13, 5], [13, 8], [11, 8]] }, { route: [[1, 1], [9, 1]], minRank: 1 }, { route: [[3, 3], [4, 3]], minRank: 3 }],
      drones: [{ route: [[2, 5], [12, 5], [12, 2], [2, 2]], minRank: 1 }],
      cams: [{ x: 6, y: 9, faces: [[0, -1]], minRank: 2 }, { x: 14, y: 3, faces: [[-1, 0]] }],
      dogs: [{ route: [[8, 8], [11, 8]], minRank: 2 }],
    },
    // 舊隧道：二戰時挖的防空隧道，大半沒有燈。從左上角的井口下去，撤離點在右下角的排水口。
    // 暗處很多，守衛只有貼身才看得到人，但狗鼻子不怕暗；手電筒照得到的那幾段（地板）要小心。
    tunnels: {
      theme: 'tunnel',
      rows: [
        '###############',
        '#S,,.#..,,,#,,#',
        '#S,,.D..,H,D,,#',
        '#,,#####.###.,#',
        '#,.#,,....,#.,#',
        '#,H#,,T,,H.=.,#',
        '#,.#..,,,,.#.,#',
        '#,.###D#####.,#',
        '#,,...,,,..,..#',
        '#E.,H,,,..,,.X#',
        '###############',
      ],
      guards: [{ route: [[6, 8], [12, 8], [12, 4]] }, { route: [[7, 1], [10, 1]], minRank: 1 }, { route: [[5, 4], [10, 4]], minRank: 2 }],
      cams: [{ x: 14, y: 8, faces: [[-1, 0]] }],
      dogs: [{ route: [[2, 8], [9, 8]], minRank: 1 }],
    },
  };

  // 地圖上的特殊狀況：每次潛入有一半的機會遇到一種（themes 是會出現的地圖主題，minRank 是從第幾區起）。
  // 效果在 js/engine/tactics.js 的 build／endTurn；文字是 tac.ev.<id>（標題）和 tac.ev.<id>.d（說明）。
  // quick：快速結算時同一件事的效果。exposure 每個動作的警戒、risk 依標籤改失敗率（all 是全部）、stage 只有第幾關（從 0 算）才有效、
  // alert 起始警戒、hidden 第一關的隱藏解法先知道、bad 對玩家不利（紀錄的顏色）。
  S2.mapEvents = [
    { id: 'fog', themes: ['street', 'site', 'yard'], quick: { exposure: -1 } },          // 大霧：守衛和攝影機少看一格
    { id: 'rain', themes: ['street', 'site', 'yard'], quick: { exposure: -1, risk: { climb: 0.1, run: 0.1 } } },         // 大雨：聲音傳得近一格，無人機少看一格
    { id: 'drill', themes: ['office'], quick: { risk: { door: -0.1, data: -0.1 } } },                         // 停電演練：攝影機前三回合都關著
    { id: 'shift', themes: ['office', 'yard', 'site', 'tunnel'], quick: { stage: 1, risk: { all: -0.15 } } }, // 換班：第三回合結束時，守衛聚在一起聊兩回合
    { id: 'crowd', themes: ['street'], quick: { risk: { social: -0.1 } } },                         // 散場人潮：街上多了三個藏身的地方
    { id: 'trolley', themes: ['office', 'home'], quick: { risk: { door: -0.1 } } },               // 清潔推車：多一個藏身處
    { id: 'kennel', themes: ['yard', 'site', 'street'], minRank: 1, quick: { bad: true, risk: { patrol: 0.1, dog: 0.1 } } }, // 加派警犬
    { id: 'sweep', themes: ['street', 'site', 'yard', 'office', 'tunnel'], minRank: 2, quick: { bad: true, alert: 8 } }, // 加強巡邏：多一架無人機
    { id: 'echo', themes: ['street', 'site', 'yard', 'office', 'tunnel'], quick: { hidden: true } }, // Echo 的低語：開場就看得到巡邏路線
  ];

  // 每種行動用哪一張地圖、T 格是什麼目標。擴充安全屋（談租約）沒有地圖，只能快速結算。
  S2.opMaps = {
    tower: { map: 'site', obj: 'box' },
    broadcast: { map: 'office', obj: 'antenna' },
    rescue: { map: 'compound' },
    raid: { map: 'safehouse' },
    recruit: {
      rescue: { map: 'compound' },
      erase_score: { map: 'office', obj: 'terminal' },
      recover: { map: 'market', obj: 'terminal' },
      debt: { map: 'office', obj: 'terminal' },
      broadcast: { map: 'office', obj: 'antenna' },
      protect: { map: 'street', obj: 'terminal' },
      search: { map: 'tunnels', obj: 'person' },
    },
    // 主線任務分兩段：approach 是第一段（潛入：穿過街區、碼頭、隧道），main 是第二段（主要目標；用文字冒險的時候不用地圖）。
    // obj: 'none' 代表這一段只要穿過去，地圖上的 T 格當成地板。
    approach: {
      m2: { map: 'market', obj: 'none' },
      m3: { map: 'market', obj: 'terminal' },
      m4: { map: 'wharf', obj: 'none' },
      m5: { map: 'wharf', obj: 'box' },
      m7: { map: 'street', obj: 'box' },
      m8: { map: 'tunnels', obj: 'none' },
    },
    main: {
      m2: { map: 'site', obj: 'box' },
      m3: { map: 'compound' },
      m4: { map: 'office', obj: 'terminal' },
      m5: { map: 'tunnels', obj: 'terminal' },
      m7: { map: 'office', obj: 'terminal' },
      m8: { map: 'office', obj: 'terminal' },
    },
    // 今晚的機會（content-s2/ops.js 的 jobs）。crate 是物資箱（搬重物的人比較快）、wall 是要噴漆的牆。
    // turns：限時的機會在地圖上有幾回合（沒寫的話等於文字關卡的步數）。
    jobs: {
      convoy: { map: 'wharf', obj: 'crate', turns: 9 },
      erase: { map: 'office', obj: 'terminal' },
      meds: { map: 'market', obj: 'crate' },
      mural: { map: 'street', obj: 'wall' },
      trail: { map: 'market', obj: 'terminal' },
      tap: { map: 'site', obj: 'antenna' },
      intel: { map: 'office', obj: 'terminal' },
      evac: { map: 'tunnels', obj: 'person', turns: 8 },
    },
  };
})(window.ECHO = window.ECHO || {});
