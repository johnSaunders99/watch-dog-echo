"""Register Claude's keyed portrait plates, extract ink and tint masks, then publish the inventory.

Run with Anaconda Python (Pillow, NumPy, SciPy). Inputs are read-only. --project lets
an art trial write an independent output tree instead of replacing the game's inventory.
The named PNG renditions in assets/s3/portraits are generated outputs; do not paint there.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = Path(__file__).resolve().parents[1]
WORK, SIZE = 640, 320
PARTS = {
    'face': [a + '-' + m for a in 'ymo' for m in ('neutral', 'smile', 'smirk', 'frown')],
    'hair': 'crop side curly afro locs bob long ponytail bun braids mohawk'.split(),
    'beard': 'stubble moustache beard'.split(),
    'outfit': 'hoodie polo tee hivis jacket overalls turnout sport suit blazer waistcoat denim coat scrubs workshirt cardigan tactical sweater'.split(),
    'hat': 'headset hardhat bikehelmet cap firehelmet headband beanie flatcap visor hood'.split(),
}


def plate(path):
    with Image.open(path) as im:
        if abs(im.width / im.height - 1) > .08:
            raise ValueError('canvas is not square')
        return im.convert('RGB').resize((WORK, WORK), Image.LANCZOS)


def keys(im):
    rgb = np.asarray(im, dtype=np.float32) / 255
    r, g, b = rgb.transpose(2, 0, 1)
    return rgb, (g - np.maximum(r, b)), (np.minimum(g, b) - r), (np.minimum(r, b) - g), (np.minimum(r, g) - b)


def skull(im):
    # The black ink separates the central cyan skull from the ears and neck.
    # Ignore antialiasing along fine ear outlines, which can join an ear to the skull.
    labels, count = nd.label(keys(im)[2] > .42)
    if not count:
        raise ValueError('no cyan head')
    areas = np.bincount(labels.ravel()); areas[0] = 0
    y, x = nd.find_objects(labels, int(areas.argmax()))[-1]
    if x.stop - x.start < WORK * .22 or y.stop - y.start < WORK * .28:
        raise ValueError('cyan head is too small to register')
    return np.array([x.start, y.start, x.stop, y.stop], dtype=float)


def register(im, target):
    src = skull(im)
    ratio = (target[2:] - target[:2]) / (src[2:] - src[:2])
    scale = np.clip(ratio, .92, 1.08)
    shift = (target[:2] + target[2:] - scale * (src[:2] + src[2:])) / 2
    # PIL takes the inverse (output -> input). Outside the original canvas is still chroma green.
    sx, sy = 1 / scale
    im = im.transform((WORK, WORK), Image.AFFINE, (sx, 0, -shift[0]*sx, 0, sy, -shift[1]*sy),
                      Image.BICUBIC, fillcolor=(0, 255, 0))
    error = np.abs(src * np.tile(scale, 2) + np.tile(shift, 2) - target)
    if max(error) > .0125 * WORK:
        raise ValueError('head still misses template by %.1f px at %d; check the painting' % (max(error)*SIZE/WORK, SIZE))
    return im, max(error) * SIZE / WORK


def bounded_tint(score, value):
    # The mask includes deep coloured shadows but not black ink, white highlights or teeth.
    return np.clip((score / np.maximum(value, .04) - .045) / .24, 0, 1)


def feature_anchors(yellow, rgb, chin):
    eyes = []
    for half in (slice(WORK//4, WORK//2), slice(WORK//2, WORK*3//4)):
        y, x = np.where(yellow[WORK//4:int(chin), half] > .30)
        if len(x) < 8:
            raise ValueError('missing yellow iris')
        eyes.append(((np.median(x) + half.start) / WORK * 100, (np.median(y) + WORK//4) / WORK * 100))
    ey = sum(p[1] for p in eyes) * WORK / 200
    lo, hi = int(ey + .47*(chin-ey)), int(ey + .77*(chin-ey))
    ink = rgb[lo:hi, int(WORK*.435):int(WORK*.565)].max(axis=2) < .21
    mouth = (lo + int(ink.sum(axis=1).argmax())) * 100 / WORK
    return [round(v, 2) for v in (*eyes[0], *eyes[1], mouth)]


def extract(im, kind, target):
    err = None
    if kind == 'face':
        im, err = register(im, target)
    rgb, green, cyan, magenta, yellow = keys(im)
    val = rgb.max(axis=2)
    fg = green < .17
    anchors = None
    if kind == 'face':
        anchors = feature_anchors(yellow, rgb, target[3])
        # Stop above the grey shoulder seam. Continue the actual painted neck down under V-necks;
        # neither the template's grey shoulders nor its horizontal neckline belong to the face.
        row = int(target[3] + .032 * WORK)
        neck = np.where(cyan[row] > .18)[0]
        if not len(neck):
            raise ValueError('no neck below the chin')
        left, right = neck[0]-int(.011*WORK), neck[-1]+int(.011*WORK)+1
        fg[row:, :] = False
        end = int(.81*WORK)
        fg[row:end, left:right] = green[row:row+1, left:right] < .17
        for a in (rgb, cyan, yellow, val):
            a[row:end] = a[row:row+1]
        masks = {'skin': bounded_tint(cyan, val), 'iris': bounded_tint(yellow, val)}
    else:
        seed = (magenta > .08) & (bounded_tint(magenta, val) > .45)
        if seed.sum() < 10:
            raise ValueError('no magenta part')
        # Keep touching outlines and enclosed neutral detail (zipper, stitching, helmet badges).
        # A black template outline touching the part must not bring along the whole bald head.
        near = nd.distance_transform_edt(~seed) <= .0105*WORK
        ink = near & fg & (cyan < .10)
        if kind == 'outfit':
            y0 = np.where(seed.any(axis=1))[0][0]
            ink[max(y0+int(.08*WORK), int(.71*WORK)):] = (fg & (cyan < .10))[max(y0+int(.08*WORK), int(.71*WORK)):]
        filled = nd.binary_fill_holes(ink)
        fg = (ink | filled) & fg & (cyan < .10)
        masks = {'tint': bounded_tint(magenta, val)}
    # Pure keys become white in light, gray in shadow; neutral ink keeps its original value.
    # Work at 2x output size; downsample both transparent plates and masks with antialiasing.
    lum = rgb @ np.array([.299, .587, .114], dtype=np.float32)
    weight = np.maximum.reduce(list(masks.values()))
    lum = lum*(1-weight) + val*weight
    byte = lambda x: np.uint8(np.clip(x*255+.5, 0, 255))
    base = Image.fromarray(byte(lum), 'L').convert('LA')
    base.putalpha(Image.fromarray(byte(fg), 'L'))
    base = base.resize((SIZE, SIZE), Image.LANCZOS)
    box = base.getchannel('A').getbbox()
    if not box:
        raise ValueError('empty layer after keying')
    layers = {'base': base.crop(box)}
    for channel, m in masks.items():
        alpha = Image.fromarray(byte(m*fg), 'L').resize((SIZE, SIZE), Image.LANCZOS).crop(box)
        mask = Image.new('LA', alpha.size, (255, 0)); mask.putalpha(alpha)
        layers[channel] = mask
    return layers, [box[0], box[1], box[2]-box[0], box[3]-box[1]], anchors, err


def build(src, project):
    if not (src / 'template.png').is_file():
        print('No template.png; existing outputs unchanged.'); return
    target = skull(plate(src / 'template.png'))
    dest = project / 'assets' / 's3' / 'portraits'
    dest.mkdir(parents=True, exist_ok=True)
    present = {p.name for p in src.glob('*.png')}  # Plates delivered during this batch wait for the next run.
    items, missing, size = {}, [], 0
    for kind, names in PARTS.items():
        for name in names:
            key = kind + '-' + name
            path = src / (key + '.png')
            if path.name not in present:
                missing.append(key); continue
            try:
                layers, box, anchors, err = extract(plate(path), kind, target)
            except (OSError, ValueError) as exc:
                print('SKIP %s: %s' % (key, exc)); missing.append(key); continue
            for suffix, layer in layers.items():
                file = dest / (key + ('' if suffix == 'base' else '.' + suffix) + '.png')
                layer.save(file, optimize=True)
                size += file.stat().st_size
            items[key] = {'box': box}
            if anchors:
                items[key]['features'] = anchors
            print(key + (' (skull residual %.2f px at %d)' % (err, SIZE) if err is not None else ''))
    manifest = project / 'content-s3' / 'portrait-parts.js'
    manifest.parent.mkdir(parents=True, exist_ok=True)
    data = {'size': SIZE, 'path': 'assets/s3/portraits/', 'items': items}
    with manifest.open('w', encoding='utf-8', newline='\n') as f:
        f.write('// Generated by tools/portrait-parts.py from the available plates.\n')
        f.write('window.ECHO.s3.portraitParts = ' + json.dumps(data, indent=2) + ';\n')
    # Retire only our fixed output names, after publishing the new inventory. Never touch the source.
    for key in missing:
        for suffix in (('', '.skin', '.iris') if key.startswith('face-') else ('', '.tint')):
            old = dest / (key + suffix + '.png')
            if old.is_file():
                old.unlink()
    total = size + manifest.stat().st_size
    print('Published %d parts, %d bytes including manifest. Missing (%d): %s' %
          (len(items), total, len(missing), ', '.join(missing)))
    if total > 1500000:
        print('Above the 1.5 MB portrait budget; review output resolution before shipping.')


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--sources', type=Path, default=ROOT.parent / 'watchdogs-echo-art-src' / 'parts')
    cli.add_argument('--project', type=Path, default=ROOT)
    args = cli.parse_args()
    build(args.sources, args.project)
