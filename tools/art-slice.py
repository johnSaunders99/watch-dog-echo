# 第三季的圖片前處理：把圖像模型畫的「綠底合集圖」去背、切開、縮小，排成一張透明底的圖集，
# 另外產生一個 JS 清單（每張小圖在圖集裡的位置、旋轉中心、身體半徑），給 js/s3/render.js 用。
#
# 這是製作素材時才用的工具，遊戲本身和 node tools/check.js 都不需要它。需要 Pillow 和 numpy：
#   python tools/art-slice.py
# 原圖放在專案旁邊的 watchdogs-echo-art-src/（不進版本庫），輸出到 assets/s3/ 和 content-s3/atlas.js。
# 俯視合集用純綠色（#00FF00）背景，每格一個物件、全部朝右。預設 4×4，其他排列見 grid。
# 事件插圖和頭像是另一種合集圖：一張幾格（事件 2×2、頭像 3×3），中間用黑線隔開，切開之後各存一張 JPEG。
import json
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.normpath(os.path.join(ROOT, '..', 'watchdogs-echo-art-src'))
OUT = os.path.join(ROOT, 'assets', 's3')

# 每張合集圖：檔名、輸出的圖集、每一格的名字（由左到右、由上到下）、旋轉中心怎麼算。
# anchor：'body' 用身體最寬的那一段的中心（人和機器，槍不算）；'box' 用外框的中心（道具）。
SHEETS = [
    {'file': 'sprites-1.png', 'atlas': 'actors', 'anchor': 'body', 'scale': 0.5,
     'names': ['hacker', 'physical', 'social', 'specialist', 'guard', 'rusher', 'shield', 'sniper',
               'bomber', 'jammer', 'heavy', 'drone', 'hound', 'turret', 'bulldog', 'carrier']},
    {'file': 'props-1.png', 'atlas': 'props', 'anchor': 'box', 'scale': 0.5,
     'names': ['car', 'forklift', 'crate', 'barrel', 'junction', 'vent', 'bollard', 'pylon',
               'camera', 'speaker', 'spider', 'mine', 'med', 'data', 'cache', 'sergei']},
    # 上排：扳手的巨鎚、謝爾蓋、工人的貨運無人機。下排：達西的固定翼無人機（兩格只轉旋翼）、我方蜘蛛機器人。
    {'file': 'gear-3.png', 'atlas': 'gear', 'anchor': 'box', 'scale': 0.4, 'grid': (3, 2),
     'names': ['smash', 'sergei', 'cargo', 'eagle', 'eagle2', 'spider']},
]

# 用黑線隔開的格子圖：檔名、幾欄幾列、每一格的名字（由左到右、由上到下）。square：切成正方形（頭像）。
PANELS = [
    # 前三格已改用同名的獨立插圖；不可用舊格子蓋過 pictures() 的輸出。
    {'file': 'events-1.png', 'grid': (2, 2), 'names': [None, None, None, 'ev-marcus']},
    # None：這一格不用（ev-tarot 改成單獨的一張 ev-tarot.png）。
    {'file': 'events-2.png', 'grid': (2, 2), 'names': ['ev-bluedoor', 'ev-cat', None, 'ev-vending']},
    {'file': 'events-3.png', 'grid': (2, 2), 'names': ['ev-terminal', 'ev-courier', 'ev-dealer', 'ev-bagley']},
    {'file': 'portraits-1.png', 'grid': (3, 3), 'square': True,
     'names': ['pt-bagley', 'pt-echo', 'pt-maya', 'pt-harlow', 'pt-keystone', 'pt-hastings', 'pt-kahn', 'pt-hale', 'pt-cassie']},
]

# 主角的紙娃娃（切法見 dolls()）：身體 4×2，全部光頭、朝右、兩手在胸前，衣服畫成洋紅（#FF00FF）、皮膚畫成青色（#00FFFF），
# 遊戲照每個人的頭像替衣服和皮膚上色，頭髮和帽子用程式畫；手上的東西 3×2，照一般道具切。
DOLLS = {'file': 'doll-1.png', 'atlas': 'doll', 'scale': 0.4, 'grid': (4, 2),
         'names': ['hoodie', 'tee', 'jacket', 'hivis', 'overalls', 'suit', 'waistcoat', 'coat'],
         'held': {'file': 'held-1.png', 'scale': 0.4, 'grid': (3, 2),
                  'names': ['pistol', 'taser', 'shotgun', 'nailgun', 'silenced', 'sledge']}}

# 舊合集留作對照，不當成單張插圖輸出。
RETIRED = {'gear-1.png', 'gear-2.png'}

# 這四張原圖一起換版。少一張就保留現有圖集和事件圖，不能先寫出不完整的清單。
GEAR_AND_CAMEOS = ('gear-3.png', 'ev-wrench.png', 'ev-darcy.png', 'ev-aiden.png')


def background(spill):
    """哪些像素是背景。背景是非常純的綠（spill 240 以上）；物件自己的綠色（急救包的十字、中繼器的燈）
    沒有那麼純（100 上下），所以用 200 當界線。再從背景往外長 3 個像素，把邊緣半綠半深色的那一圈也算進來。"""
    bg = spill > 200.0
    soft = spill > 30.0
    for _ in range(3):
        grow = bg.copy()
        grow[1:, :] |= bg[:-1, :]
        grow[:-1, :] |= bg[1:, :]
        grow[:, 1:] |= bg[:, :-1]
        grow[:, :-1] |= bg[:, 1:]
        bg = grow & soft
    return bg


def key_green(rgb):
    """綠底去背：只去掉純綠的背景和它邊緣的那一圈，越綠越透明，邊緣的綠光順便壓掉。
    回傳 float 的 RGBA（0～1，沒有預乘）。"""
    a = rgb.astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = g - np.maximum(r, b)
    bg = background(spill)
    alpha = np.where(bg, 1.0 - np.clip((spill - 30.0) / 90.0, 0.0, 1.0), 1.0)
    g2 = np.where(bg, np.maximum(r, b) + np.minimum(spill, 10.0) * alpha, g)
    return np.dstack([r, g2, b, alpha * 255.0]) / 255.0


def segments(profile, want, min_size=12):
    """把一條「每列有幾個不透明像素」的統計切成幾段。切不出剛好 want 段就回傳 None。"""
    on = profile > 2
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            segs.append([start, i])
            start = None
    if start is not None:
        segs.append([start, len(on)])
    segs = [s for s in segs if s[1] - s[0] >= min_size]
    # 段數太多：把間隔最小的兩段併起來（例如無人機的旋翼和機身之間有空隙）。
    while len(segs) > want:
        gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]
        i = int(np.argmin(gaps))
        segs[i] = [segs[i][0], segs[i + 1][1]]
        del segs[i + 1]
    return segs if len(segs) == want else None


def cells(alpha, ncols=4, nrows=4):
    """找出每一格（預設 4×4）的外框 (x0, y0, x1, y1)。找不到乾淨的間隔就退回等分。"""
    h, w = alpha.shape
    mask = alpha > 0.5
    rows = segments(mask.sum(axis=1), nrows) or [[i * h // nrows, (i + 1) * h // nrows] for i in range(nrows)]
    out = []
    for y0, y1 in rows:
        band = mask[y0:y1]
        cols = segments(band.sum(axis=0), ncols) or [[i * w // ncols, (i + 1) * w // ncols] for i in range(ncols)]
        for x0, x1 in cols:
            sub = mask[y0:y1, x0:x1]
            ys, xs = np.where(sub)
            if len(xs) == 0:
                out.append((x0, y0, x1, y1))
            else:
                out.append((x0 + xs.min(), y0 + ys.min(), x0 + xs.max() + 1, y0 + ys.max() + 1))
    return out


def anchor_of(alpha, kind):
    """旋轉中心和身體半徑（像素）。"""
    h, w = alpha.shape
    mask = alpha > 0.5
    if kind == 'box':
        return w / 2.0, h / 2.0, min(w, h) / 2.0
    thick = mask.sum(axis=0).astype(np.float32)      # 每一行（x）有多厚
    body = thick >= thick.max() * 0.62               # 身體：夠厚的那幾行；槍管很細，不算
    xs = np.arange(w)[body]
    ax = float((xs * thick[body]).sum() / thick[body].sum())
    ys = np.where(mask[:, body].any(axis=1))[0]
    ay = float((ys.min() + ys.max() + 1) / 2.0)
    return ax, ay, float(thick.max() / 2.0)


def resize_rgba(img, scale):
    """縮小：先預乘透明度再縮，邊緣才不會出現雜色。"""
    h, w = img.shape[:2]
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    pre = img.copy()
    pre[..., :3] *= pre[..., 3:4]
    im = Image.fromarray((pre * 255.0 + 0.5).astype(np.uint8), 'RGBA').resize((nw, nh), Image.LANCZOS)
    out = np.asarray(im).astype(np.float32) / 255.0
    a = np.maximum(out[..., 3:4], 1e-4)
    out = out.copy()
    out[..., :3] = np.clip(out[..., :3] / a, 0, 1)
    return out


def pack(atlas_name, sprites, cols=4):
    """排進圖集：每格一樣大。sprites：[(名稱, 圖, {ax, ay, r, …})]。回傳 atlas.js 裡的一項。"""
    cw = max(s[1].shape[1] for s in sprites) + 2
    ch = max(s[1].shape[0] for s in sprites) + 2
    rows = (len(sprites) + cols - 1) // cols
    atlas = np.zeros((rows * ch, cols * cw, 4), np.float32)
    items = {}
    for i, (name, img, meta) in enumerate(sprites):
        x, y = (i % cols) * cw + 1, (i // cols) * ch + 1
        h, w = img.shape[:2]
        atlas[y:y + h, x:x + w] = img
        items[name] = dict({'x': x, 'y': y, 'w': w, 'h': h}, **{k: round(float(v), 1) for k, v in meta.items()})
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, atlas_name + '.png')
    Image.fromarray((atlas * 255.0 + 0.5).astype(np.uint8), 'RGBA').save(out, optimize=True)
    print('%s: %d sprites, %dx%d, %d KB' % (atlas_name, len(sprites), atlas.shape[1], atlas.shape[0], os.path.getsize(out) // 1024))
    return {'src': 'assets/s3/' + atlas_name + '.png', 'items': items}


def build(sheet):
    path = os.path.join(SRC, sheet['file'])
    if not os.path.exists(path):
        print('skip (no source):', sheet['file'])
        return None
    rgba = key_green(np.asarray(Image.open(path).convert('RGB')))
    boxes = cells(rgba[..., 3], *sheet.get('grid', (4, 4)))
    sprites = []
    for name, (x0, y0, x1, y1) in zip(sheet['names'], boxes):
        crop = rgba[max(0, y0 - 3):y1 + 3, max(0, x0 - 3):x1 + 3]
        small = resize_rgba(crop, sheet['scale'])
        ax, ay, r = anchor_of(small[..., 3], sheet['anchor'])
        sprites.append((name, small, {'ax': ax, 'ay': ay, 'r': r}))
    return pack(sheet['atlas'], sprites)


def key_split(crop):
    """紙娃娃的身體：把兩個代表色換成灰階的明暗（純色 = 白），另外做出衣服（洋紅）和皮膚（青色）的遮罩。
    遊戲用 multiply 把遮罩範圍乘上這個人的衣服和膚色。回傳 (底圖 RGBA, 衣服遮罩, 皮膚遮罩)，都是 0～1。"""
    r, g, b, a = crop[..., 0], crop[..., 1], crop[..., 2], crop[..., 3]
    # 門檻低一點：跟黑色描邊混在一起的深洋紅（縫線、帽緣）也要算進衣服，不然深色衣服上會留下粉紅色的線。
    wc = np.clip((np.minimum(r, b) - g - 0.05) / 0.15, 0.0, 1.0)
    ws = np.clip((np.minimum(g, b) - r - 0.05) / 0.15, 0.0, 1.0)
    keep = (1.0 - wc - ws)[..., None]
    base = crop[..., :3] * keep + (np.maximum(r, b) * wc + np.maximum(g, b) * ws)[..., None]
    return np.dstack([base, a]), a * wc, a * ws


def mask_rgba(m):
    """遮罩存成白色、透明度 = 遮罩。"""
    one = np.ones_like(m)
    return np.dstack([one, one, one, m])


def head_and_hands(skin):
    """頭（最大的一塊皮膚）的中心和半徑，還有兩手（頭前面最遠的那一段皮膚）的中心。單位：原圖像素。"""
    from scipy import ndimage  # 只有紙娃娃要用（Anaconda 有）
    lab, n = ndimage.label(skin)
    if n == 0:
        return None
    sizes = ndimage.sum(skin, lab, range(1, n + 1))
    ys, xs = np.where(lab == int(np.argmax(sizes)) + 1)
    hx, hy, hr = xs.mean(), ys.mean(), np.sqrt(len(xs) / np.pi)
    Y, X = np.nonzero(skin)
    front = X > hx + hr * 1.05
    if not front.any():
        return hx, hy, hr, hx + hr * 2.0, hy
    tip = front & (X > X[front].max() - hr * 0.9)
    return hx, hy, hr, X[tip].mean(), Y[tip].mean()


def dolls():
    """主角的紙娃娃：每個身體切成底圖、衣服遮罩（.c）、皮膚遮罩（.s）三張，旋轉中心是頭的中心；
    hr 頭的半徑、gx gy 兩手之間（武器拿在這裡）。手上的東西（held-*）照一般道具切。回傳 atlas.js 裡的一項。"""
    path = os.path.join(SRC, DOLLS['file'])
    if not os.path.exists(path):
        print('skip (no source):', DOLLS['file'])
        return None
    sc = DOLLS['scale']
    rgba = key_green(np.asarray(Image.open(path).convert('RGB')))
    boxes = cells(rgba[..., 3], *DOLLS['grid'])
    sprites = []
    for name, (x0, y0, x1, y1) in zip(DOLLS['names'], boxes):
        crop = rgba[max(0, y0 - 3):y1 + 3, max(0, x0 - 3):x1 + 3]
        base, cloth, skin = key_split(crop)
        hx, hy, hr, gx, gy = head_and_hands(skin > 0.5)
        small = resize_rgba(base, sc)
        r = anchor_of(small[..., 3], 'body')[2]
        same = {'ax': hx * sc, 'ay': hy * sc, 'r': r}
        sprites.append((name, small, dict(same, hr=hr * sc, gx=gx * sc, gy=gy * sc)))
        sprites.append((name + '.c', resize_rgba(mask_rgba(cloth), sc), same))
        sprites.append((name + '.s', resize_rgba(mask_rgba(skin), sc), same))
    held = DOLLS['held']
    hpath = os.path.join(SRC, held['file'])
    if os.path.exists(hpath):
        rgba = key_green(np.asarray(Image.open(hpath).convert('RGB')))
        boxes = cells(rgba[..., 3], *held['grid'])
        for name, (x0, y0, x1, y1) in zip(held['names'], boxes):
            crop = rgba[max(0, y0 - 3):y1 + 3, max(0, x0 - 3):x1 + 3]
            small = resize_rgba(crop, held['scale'])
            ax, ay, r = anchor_of(small[..., 3], 'box')
            sprites.append(('held-' + name, small, {'ax': ax, 'ay': ay, 'r': r}))
    else:
        print('skip (no source):', held['file'])
    return pack(DOLLS['atlas'], sprites, cols=6)


def gutters(gray, axis, parts):
    """格子圖的黑線在哪裡：在每個等分點附近找最暗的那一列（axis 0）或那一行（axis 1）。
    回傳切點，頭尾也算：[0, 第一條線, …, 邊長]。"""
    n = gray.shape[axis]
    dark = gray.mean(axis=1 - axis)
    cuts = [0]
    for i in range(1, parts):
        lo, hi = int(n * (i / parts - 0.04)), int(n * (i / parts + 0.04))
        cuts.append(lo + int(np.argmin(dark[lo:hi])))
    return cuts + [n]


def trim(gray):
    """一格圖四邊的黑線有幾個像素（最多切掉 4%）：整列都很暗的就算黑線。回傳 (上, 下, 左, 右)。"""
    def run(profile):
        n = 0
        while n < len(profile) * 0.04 and profile[n] < 26.0:
            n += 1
        return n + 2 if n else 0
    rows, cols = gray.mean(axis=1), gray.mean(axis=0)
    return run(rows), run(rows[::-1]), run(cols), run(cols[::-1])


def panels():
    """把格子圖（事件、頭像）一格一格切開，各存成 JPEG。回傳 { 名稱: 路徑 }。"""
    out = {}
    for sheet in PANELS:
        path = os.path.join(SRC, sheet['file'])
        if not os.path.exists(path):
            print('skip (no source):', sheet['file'])
            continue
        im = Image.open(path).convert('RGB')
        gray = np.asarray(im.convert('L')).astype(np.float32)
        cols, rows = sheet['grid']
        ys, xs = gutters(gray, 0, rows), gutters(gray, 1, cols)
        boxes = [(xs[c], ys[r], xs[c + 1], ys[r + 1]) for r in range(rows) for c in range(cols)]
        for name, (x0, y0, x1, y1) in zip(sheet['names'], boxes):
            if not name:
                continue
            t, b, l, r = trim(gray[y0:y1, x0:x1])
            crop = im.crop((x0 + l, y0 + t, x1 - r, y1 - b))
            if sheet.get('square'):
                # 頭像：取正中間的正方形。
                side = min(crop.width, crop.height)
                ox, oy = (crop.width - side) // 2, (crop.height - side) // 2
                crop = crop.crop((ox, oy, ox + side, oy + side))
            dest = os.path.join(OUT, name + '.jpg')
            crop.save(dest, quality=86, optimize=True, progressive=True)
            out[name] = 'assets/s3/' + name + '.jpg'
            print('%s: %dx%d, %d KB' % (name, crop.width, crop.height, os.path.getsize(dest) // 1024))
    return out


def pictures():
    """插圖（首領、事件、標題）：素材資料夾裡不是合集圖的 PNG，縮小之後存成 JPEG。
    檔名開頭決定寬度：ev- 事件 960、pt- 頭像 512，其他 1280。回傳 { 名稱: 路徑 }。"""
    out = {}
    sheets = set(s['file'] for s in SHEETS) | set(s['file'] for s in PANELS) | RETIRED | {DOLLS['file'], DOLLS['held']['file']}
    for f in sorted(os.listdir(SRC)):
        name, ext = os.path.splitext(f)
        if ext.lower() != '.png' or f in sheets:
            continue
        im = Image.open(os.path.join(SRC, f)).convert('RGB')
        w = 960 if name.startswith('ev-') else 512 if name.startswith('pt-') else 1280
        w = min(w, im.width)
        im = im.resize((w, int(round(im.height * w / float(im.width)))), Image.LANCZOS)
        path = os.path.join(OUT, name + '.jpg')
        im.save(path, quality=84, optimize=True, progressive=True)
        out[name] = 'assets/s3/' + name + '.jpg'
        print('%s: %dx%d, %d KB' % (name, im.width, im.height, os.path.getsize(path) // 1024))
    return out


def main():
    missing = [name for name in GEAR_AND_CAMEOS if not os.path.isfile(os.path.join(SRC, name))]
    if missing:
        print('Art sources missing (no outputs changed):', ', '.join(missing), file=sys.stderr)
        return 1
    atlases = {}
    os.makedirs(OUT, exist_ok=True)
    for sheet in SHEETS:
        made = build(sheet)
        if made:
            atlases[sheet['atlas']] = made
    made = dolls()
    if made:
        atlases[DOLLS['atlas']] = made
    pics = pictures()
    pics.update(panels())
    js = ('// 第三季的圖片清單。atlas：俯視圖的圖集，每張小圖的位置（x, y, w, h）、旋轉中心（ax, ay）和身體半徑（r），單位是像素。\n'
          '// pictures：插圖（首領、事件、標題）的路徑。\n'
          '// 由 tools/art-slice.py 產生，不要手改；圖是請圖像模型畫的原創素材，沒有用到任何遊戲的圖。\n'
          '(function (E) {\n  const S3 = (E.s3 = E.s3 || {});\n  S3.atlas = %s;\n  S3.pictures = %s;\n})(window.ECHO = window.ECHO || {});\n')
    dump = lambda o: json.dumps(o, indent=2, ensure_ascii=False).replace('\n', '\n  ')
    with open(os.path.join(ROOT, 'content-s3', 'atlas.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(js % (dump(atlases), dump(pics)))
    print('wrote content-s3/atlas.js')


if __name__ == '__main__':
    sys.exit(main())
