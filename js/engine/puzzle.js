// 手動駭入的小遊戲：訊號接線。
// 一張方格，每一格是一段線路：直線（I）、轉角（L）或三岔（T）。點一下順時針轉 90 度。
// 把左邊的訊號源接到右邊的目標就算解開。
// 生成時先走出一條一定存在的路線，再把所有格子打亂，所以每一題都解得開。
// 這裡只有規則和資料，畫面在 js/ui/s2.js。
(function (E) {
  const N = 1, EAST = 2, S = 4, W = 8;
  const BASE = { I: N | S, L: N | EAST, T: N | EAST | S };
  // [方向, 列的位移, 欄的位移, 相反方向]
  const DIRS = [[N, -1, 0, S], [EAST, 0, 1, W], [S, 1, 0, N], [W, 0, -1, EAST]];

  function rotate(mask, times) {
    let m = mask;
    for (let i = 0; i < ((times % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
    return m;
  }
  const openings = (cell) => rotate(BASE[cell.type], cell.rot);

  // 兩個相鄰格子之間的方向。
  function dirBetween(a, b) {
    for (const [bit, dr, dc] of DIRS) if (a[0] + dr === b[0] && a[1] + dc === b[1]) return bit;
    return 0;
  }
  // 一個需要的開口組合，換成（種類, 轉幾次）。
  function shapeFor(mask) {
    for (const type of ['I', 'L', 'T']) for (let r = 0; r < 4; r++) if (rotate(BASE[type], r) === mask) return { type, rot: r };
    return null;
  }

  function generate(seed, size) {
    const r = E.rng.create(seed);
    const w = size, h = size;
    const start = r.int(0, h - 1);

    // 一欄一欄往右走：每一欄先上下移動到某一列，再往右。路線不會重複經過同一格。
    const path = [];
    let row = start;
    for (let col = 0; col < w; col++) {
      const target = r.int(0, h - 1);
      const step = target >= row ? 1 : -1;
      for (let y = row; ; y += step) {
        path.push([y, col]);
        if (y === target) break;
      }
      row = target;
    }
    const end = row;

    const cells = [];
    for (let i = 0; i < w * h; i++) cells.push({ type: r.weighted({ I: 3, L: 4, T: 2 }), rot: r.int(0, 3) });
    const at = (y, x) => y * w + x;
    const solution = {};
    path.forEach((p, i) => {
      const inBit = i === 0 ? W : dirBetween(p, path[i - 1]);
      const outBit = i === path.length - 1 ? EAST : dirBetween(p, path[i + 1]);
      const shape = shapeFor(inBit | outBit);
      cells[at(p[0], p[1])] = { type: shape.type, rot: shape.rot };
      solution[at(p[0], p[1])] = shape.rot;
    });

    // 打亂：路線上的格子一定轉離正確位置，其他格子隨機。
    for (let i = 0; i < cells.length; i++) {
      cells[i].rot = i in solution ? (solution[i] + r.int(1, 3)) % 4 : r.int(0, 3);
    }
    const pz = { w, h, start, end, cells, path, solution };
    // 直線轉 180 度還是同一個形狀，可能剛好被打亂成已經接通；再轉一格。
    while (solved(pz)) cells[at(path[0][0], path[0][1])].rot = (cells[at(path[0][0], path[0][1])].rot + 1) % 4;
    return pz;
  }

  // 從訊號源出發，接得到的所有格子。
  function lit(pz) {
    const { w, h, cells } = pz;
    const first = pz.start * w;
    const out = new Set();
    if (!(openings(cells[first]) & W)) return out;
    const queue = [first];
    out.add(first);
    while (queue.length) {
      const i = queue.shift();
      const y = Math.floor(i / w), x = i % w;
      const m = openings(cells[i]);
      for (const [bit, dr, dc, opp] of DIRS) {
        const ny = y + dr, nx = x + dc;
        if (!(m & bit) || ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        const j = ny * w + nx;
        if (!out.has(j) && openings(cells[j]) & opp) { out.add(j); queue.push(j); }
      }
    }
    return out;
  }

  function solved(pz) {
    const last = pz.end * pz.w + pz.w - 1;
    return lit(pz).has(last) && !!(openings(pz.cells[last]) & EAST);
  }

  function turn(pz, i) {
    pz.cells[i].rot = (pz.cells[i].rot + 1) % 4;
    return solved(pz);
  }

  E.puzzle = { N, EAST, S, W, generate, openings, lit, solved, turn };
})(window.ECHO = window.ECHO || {});
