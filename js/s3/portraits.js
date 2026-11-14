// 《零時差》路人頭像：零件只決定筆觸，選哪一件、染什麼顏色都讀戰場紙娃娃的 look。
(function (E) {
  const S3 = E.s3, atlas = S3.portraitParts;
  const moods = { grin: 'smile', smile: 'smile', calm: 'neutral', neutral: 'neutral', smirk: 'smirk', cross: 'frown', worried: 'frown' };
  function partsOf(p, L = E.faces.look(p)) {
    const o = L.o;
    return {
      face: 'face-' + (p.age < 35 ? 'y' : p.age < 55 ? 'm' : 'o') + '-' + moods[L.mood],
      hair: L.style === 'bald' ? null : 'hair-' + L.style,
      beard: L.beardKind ? 'beard-' + L.beardKind : null,
      outfit: 'outfit-' + o.top, hat: o.hat ? 'hat-' + o.hat : null,
      skin: L.skin, iris: L.iris, hairC: L.hairC, cloth: o.col, hatCol: o.hat === 'hood' ? o.col : o.hatCol,
    };
  }
  const channels = id => id.startsWith('face-') ? ['skin', 'iris'] : ['tint'];
  const file = (id, channel) => atlas.path + id + (channel ? '.' + channel : '') + '.png';
  let loaded = null, scenes = new WeakMap(), serial = 0;
  function prepare(load) {
    loaded = new Map();
    const invalidate = () => { scenes = new WeakMap(); };
    invalidate();
    for (const id of Object.keys(atlas ? atlas.items : {})) {
      loaded.set(id, ['', ...channels(id)].map(ch => {
        const img = load(file(id, ch));
        if (!img.complete) {
          img.addEventListener('load', invalidate, { once: true });
          img.addEventListener('error', invalidate, { once: true });
        }
        return img;
      }));
    }
  }
  const available = id => !!(id && atlas && atlas.items[id] &&
    (!loaded || loaded.get(id).every(img => img.complete && img.naturalWidth)));
  const group = (transform, g) => g ? `<g transform="${transform}">${g}</g>` : '';
  const vector = (id, g) => `<g data-vector-part="${id}">${g}</g>`;
  const solidCaps = new Set(['hardhat','firehelmet','bikehelmet','cap','flatcap','beanie']);
  const flood = (id, col) => `<filter id="@p-${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feFlood flood-color="${col}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`;
  const backdrop = '<linearGradient id="@p-bg" x2=".94" y2=".45"><stop stop-color="#54283e"/><stop offset=".42" stop-color="#1f2437"/><stop offset="1" stop-color="#19434b"/></linearGradient>';
  const rim = '<filter id="@p-rim" x="-10%" y="-8%" width="120%" height="116%" color-interpolation-filters="sRGB">'
    + '<feOffset in="SourceAlpha" dx="-.65" dy="-.15" result="left"/><feFlood flood-color="#fa73aa"/><feComposite in2="left" operator="in" result="pink"/>'
    + '<feOffset in="SourceAlpha" dx=".8" dy="-.3" result="right"/><feFlood flood-color="#79eee9"/><feComposite in2="right" operator="in" result="cyan"/>'
    + '<feMerge><feMergeNode in="pink"/><feMergeNode in="cyan"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  function layer(id, tints) {
    const [x, y, w, h] = atlas.items[id].box.map(n => n * 100 / atlas.size);
    const image = (ch, fx) => {
      const path = file(id, ch), url = S3.assets ? S3.assets.url(path) : path;
      return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${url}"${fx ? ` filter="url(#@p-${fx})" style="mix-blend-mode:multiply"` : ''}/>`;
    };
    return `<g data-part="${id}" style="isolation:isolate">` + image('') + channels(id).map((ch, i) => image(ch, tints[i])).join('') + '</g>';
  }
  function compose(p, L, ink) {
    const P = partsOf(p, L);
    if (!available(P.face)) return ''; // 沒有對的年齡或表情就用完整舊頭像，不偷換另一張臉。
    const [lx, ly, rx, ry, mouth] = atlas.items[P.face].features;
    const eyesX = (lx + rx) / 2, eyesY = (ly + ry) / 2;
    const alignEyes = `translate(${eyesX} ${eyesY}) rotate(${Math.atan2(ry-ly, rx-lx)*180/Math.PI}) scale(${(rx-lx)/13} 1) translate(-50 -43.5)`;
    const H = P.hair && !available(P.hair) && ink.hair[L.style];
    // 全罩帽讓側髮、長辮從帽緣下露出；不讓髮頂穿過帽殼。頭帶、耳機、兜帽仍露出髮線。
    const capped = solidCaps.has(L.o.hat);
    const underCap = g => capped && g ? `<g clip-path="url(#@p-brim)">${g}</g>` : g;
    // 後髮先墊在肩膀後；上衣蓋住脖子下緣；瀏海、帽子和眼鏡在臉前。
    let g = H && H.back ? underCap(H.back(P.hairC)) : '';
    g += layer(P.face, ['skin', 'iris']);
    const clothIsPainted = available(P.outfit);
    g += clothIsPainted ? layer(P.outfit, ['cloth']) + ink.extra(L.o) : group('translate(0 -6)', vector(P.outfit, ink.top(L.o)) + ink.extra(L.o));
    if (L.freckles) g += group(alignEyes, ink.spots(E.faces.tone(P.skin, -.28)));
    if (L.earring) g += group(`translate(50 ${eyesY+7.8}) scale(1.13 .85) translate(-50 -51.5)`, ink.studs);
    if (P.beard) {
      if (available(P.beard)) g += layer(P.beard, ['hair']);
      else {
        // 舊鬍子原本在嘴巴下面畫。留下唇線的位置，不要把新臉的表情蓋掉。
        let beard = ink.beard(L.beardKind, P.hairC);
        if (L.beardKind === 'beard') beard = '<defs><clipPath id="@p-lips"><path clip-rule="evenodd" d="M0 0H100V100H0Z M44 54Q50 51 56 54Q50 58 44 54Z"/></clipPath></defs><g clip-path="url(#@p-lips)" opacity=".89">' + beard + '</g>';
        g += group(`translate(50 ${mouth}) scale(.98 .92) translate(-50 -54)`, vector(P.beard, beard));
      }
    }
    if (P.hair) g += underCap(H ? vector(P.hair, H.front(P.hairC)) : layer(P.hair, ['hair']));
    if (L.specs) g += group(alignEyes, ink.glasses);
    if (P.hat) g += available(P.hat) ? layer(P.hat, ['hat']) : vector(P.hat, ink.hat(L.o));
    const defs = backdrop + rim + flood('skin', P.skin) + flood('iris', P.iris) + flood('hair', P.hairC) + flood('cloth', P.cloth)
      + (P.hat ? flood('hat', P.hatCol) : '')
      + (capped ? '<clipPath id="@p-brim"><path d="M0 36 Q50 27 100 36 V105 H0Z"/></clipPath>' : '');
    // 高聳的爆炸頭／髮髻也要留在取景框內。只調鏡頭，零件和眼睛的位置關係不動。
    let zoom = 1.3;
    const eyeLine = eyesY * zoom - 9;
    for (const id of [P.hair, P.hat]) if (available(id)) {
      const top = atlas.items[id].box[1] * 100 / atlas.size;
      if (top < eyesY) zoom = Math.min(zoom, (eyeLine - 2.5) / (eyesY - top));
    }
    return `<defs>${defs}</defs><rect width="100" height="100" fill="url(#@p-bg)"/>`
      + '<path d="M0 76L100 10V22L0 88Z M0 91L100 25V27L0 93Z" fill="#c8e8f3" opacity=".035"/>'
      + `<g transform="translate(${(1-zoom)*50} ${eyeLine-eyesY*zoom}) scale(${zoom})"><g filter="url(#@p-rim)">${g}</g></g>`;
  }
  function paint(p, L, ink, tier, opt) {
    if (!scenes.has(L)) scenes.set(L, compose(p, L, ink));
    const scene = scenes.get(L);
    if (!scene) return '';
    // 同一人可同時在名冊和 HUD；不能讓可見的 SVG 引到隱藏畫面的濾鏡或剪裁。
    const id = 'p5-' + (++serial);
    return ink.framed(scene.replace(/@p/g, id), tier, opt, id + '-clip');
  }
  S3.portraits = { partsOf, prepare };
  E.faces.useIllustrator(paint);
})(window.ECHO);
