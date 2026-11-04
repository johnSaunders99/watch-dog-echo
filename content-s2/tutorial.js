// 第二季戰術地圖的教學關：Bagley 做的模擬，不存檔，被看到、被追上都不算數。
// 三個固定的人（駭客、身體、社交），一步一步教：走路、駭攝影機、結束回合、駭門、翻圍欄、從背後制伏、完成目標、搭話引開守衛、撤離。
// 每一步：who 是要動手的人（畫面會先幫玩家選好），mark 是地圖上要亮起來的格子，ui 是要亮起來的按鈕，done 是這一步做完了沒有。
// milestone 的步驟（完成目標、撤離）做完了，前面還沒做的步驟就跳過（玩家用自己的方法也可以）。
// 教學文字是 tut.step.<id>，三語在 content-s2/tutorial-locales.js。
(function (E) {
  const S2 = (E.s2 = E.s2 || {});
  const n = (en, tc, sc) => ({ en, tc, sc: sc || tc });

  // 後巷：左邊的小房間是出發點，右邊的房間有目標和站崗的守衛，下面的通道盡頭是撤離點，另一個守衛盯著通道。
  S2.maps.training = {
    obj: 'terminal',
    theme: 'street',
    rows: [
      '#############',
      '#...=......,#',
      '#S..D......T#',
      '#S..#.......#',
      '#S..=...H...#',
      '######...####',
      '#.H...,,....#',
      '#.....,,...X#',
      '#############',
    ],
    // 兩個守衛都站著不動：一個面向終端機（背對玩家進來的方向），一個面向通道。
    guards: [{ route: [[9, 2]] }, { route: [[10, 6]], face: [-1, 0] }],
    cams: [{ x: 5, y: 0, faces: [[0, 1]] }],
  };

  const camOff = (t) => t.foes.some((f) => f.kind === 'cam' && (f.off > 0 || f.down));
  const guardAt = (t, i) => t.foes.filter((f) => f.kind === 'guard')[i];
  const pos = (f) => (f ? [[f.x, f.y]] : []);

  S2.tutorial = {
    map: 'training',
    name: n('Training: Bagley\'s back alley', '教學：Bagley 的後巷模擬', '教学：Bagley 的后巷模拟'),
    // 照開場自願者的順序（駭客、身體、社交）換成固定的職業和特質，沒有弱點，好讓每一步都照教的做得到。
    people: [
      { role: 'hacker', occupation: 'programmer', traits: ['calm', 'nightowl'] },
      { role: 'physical', occupation: 'firefighter', traits: ['fast', 'calm'] },
      { role: 'social', occupation: 'journalist', traits: ['silver', 'calm'] },
    ],
    steps: [
      { id: 'move', who: 'hacker', mark: () => [[3, 2]], done: (t, R) => (R.hacker.x === 3 && R.hacker.y === 2) || camOff(t) },
      { id: 'cam', who: 'hacker', mark: () => [[5, 0]], done: (t) => camOff(t) },
      { id: 'end', ui: 'end', name: 'hacker', done: (t) => t.turn >= 2 },
      { id: 'door', who: 'hacker', mark: () => [[4, 2]], done: (t) => t.map[2][4] !== 'D' },
      { id: 'climb', who: 'physical', mark: () => [[4, 4]], done: (t, R) => R.physical.x >= 5 },
      { id: 'takedown', who: 'physical', mark: (t) => pos(guardAt(t, 0)), done: (t) => guardAt(t, 0).down },
      { id: 'obj', who: 'hacker', mark: (t) => t.objs.map((o) => [o.x, o.y]), done: (t) => t.objs.every((o) => o.done), milestone: true },
      { id: 'talk', who: 'social', mark: (t) => pos(guardAt(t, 1)), done: (t) => guardAt(t, 1).state === 'distracted' || guardAt(t, 1).down },
      { id: 'exit', mark: () => [[11, 7]], done: () => false, milestone: true },
    ],
    // 教學完成之後的重點整理（tut.tip.<id>）。
    tips: ['alert', 'caught', 'route', 'roles', 'dog', 'cards'],
  };
})(window.ECHO = window.ECHO || {});
