// 第三季《零時差》的自動測試，由 tools/check.js 呼叫（node tools/check.js 會一起跑）。
// 檢查：三語文字、資料表、房間生成、戰鬥規則、一整趟的流程、機器人的勝率、音效。
// 戰鬥的模擬不碰畫面也不用 Math.random，所以在 Node 裡可以一步一步跑，結果每次都一樣。
const fs = require('fs');
const path = require('path');

module.exports = function checkS3({ sandbox, fail, section, storage, root }) {
  const html = fs.readFileSync(path.join(root, 's3.html'), 'utf8');
  // 照 s3.html 的順序載入；畫面相關的（插畫、canvas、主程式）不載。
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/ui\/art|s3\/render|s3\/main/.test(f));
  const page = sandbox(scripts);
  const E = page.E, S3 = E.s3, D = S3.data, sim = S3.sim, A = sim.api, R = S3.run;
  const LANGS = ['zh-Hant', 'zh-Hans', 'en'];
  const T = sim.T;
  const ST = S3.story;
  const storyLines = [...ST.linesFor(Object.values(ST.beats).flat(), {}), ...ST.endings.flatMap(e => e.lines), ...Object.values(ST.hub).flat()];

  // ===== 頭像與紙娃娃共用的外觀，包含尚未交付的零件 =====
  section('零時差：頭像零件與缺件備援');
  {
    const P = S3.portraits, catalog = S3.portraitParts, allowed = new Set();
    const hairs = 'crop side curly afro locs bob long ponytail bun braids mohawk bald'.split(' ');
    const tops = 'hoodie polo tee hivis jacket overalls turnout sport suit blazer waistcoat denim coat scrubs workshirt cardigan tactical sweater'.split(' ');
    const hats = 'headset hardhat bikehelmet cap firehelmet headband beanie flatcap visor hood'.split(' ');
    const beards = ['stubble', 'moustache', 'beard'];
    const p = E.people.generate('portrait-test', 'camden', 0), L = E.faces.look(p);
    const ck = (v, msg) => { if (!v) fail('s3 portraits: ' + msg); };
    for (const [age, band] of [[18,'y'],[34,'y'],[35,'m'],[54,'m'],[55,'o'],[80,'o']]) {
      for (const [mood, expression] of Object.entries({ neutral:'neutral', calm:'neutral', smile:'smile', grin:'smile', worried:'frown', cross:'frown', smirk:'smirk' })) {
        const id = 'face-' + band + '-' + expression; allowed.add(id);
        ck(P.partsOf({age}, {...L,mood}).face === id, age + '/' + mood);
      }
    }
    for (const style of hairs) {
      const id = style === 'bald' ? null : 'hair-' + style; if (id) allowed.add(id);
      ck(P.partsOf(p,{...L,style}).hair === id, style);
    }
    for (const b of [null,...beards]) {
      const id = b && 'beard-' + b; if (id) allowed.add(id);
      ck(P.partsOf(p,{...L,beardKind:b}).beard === id, 'beard/' + b);
    }
    for (const top of tops) {
      allowed.add('outfit-' + top);
      ck(P.partsOf(p,{...L,o:{...L.o,top}}).outfit === 'outfit-' + top, top);
    }
    for (const hat of [null,...hats]) {
      const id = hat && 'hat-' + hat; if (id) allowed.add(id);
      const v = P.partsOf(p,{...L,o:{...L.o,hat,hatCol:'#ffd23f',col:'#336677'}});
      ck(v.hat === id && v.hatCol === (hat === 'hood' ? '#336677' : '#ffd23f'), 'hat/' + hat);
    }
    for (const o of Object.values(E.faces.OUTFIT)) ck(tops.includes(o.top) && (!o.hat || hats.includes(o.hat)), 'unmapped occupation outfit');
    for (const [id, item] of Object.entries(catalog.items)) {
      const face = id.startsWith('face-'), [x,y,w,h] = item.box;
      ck(allowed.has(id) && x>=0 && y>=0 && w>0 && h>0 && x+w<=catalog.size && y+h<=catalog.size, id + ' crop');
      if (face) ck(item.features.length===5 && item.features.every(n=>n>0 && n<100), id + ' anchor points');
      for (const suffix of face ? ['','.skin','.iris'] : ['','.tint']) {
        const png = path.join(root,catalog.path,id+suffix+'.png');
        if (!fs.existsSync(png)) { fail('s3 portraits: missing ' + png); continue; }
        const data = fs.readFileSync(png);
        ck(data.readUInt32BE(16)===w && data.readUInt32BE(20)===h, id + suffix + ' does not match its crop');
      }
    }
    let pairCount=0, lo=Infinity, hi=-Infinity;
    for (const [id,f] of Object.entries(catalog.items).filter(([id])=>id.startsWith('face-'))) {
      ck(f.chin>54 && f.chin<66,id+' measured chin');
      for (const top of tops) {
        const outfit=catalog.items['outfit-'+top], collar=outfit?outfit.collar:71;
        ck(collar>60 && collar<88,top+' measured collar');
        const fit=P.neckFit(f.chin,collar), visible=collar-(f.chin+fit.drop);
        ck(visible>=4.74 && visible<=7.76,id+' / '+top+' neck '+visible);
        lo=Math.min(lo,visible);hi=Math.max(hi,visible);pairCount++;
      }
    }
    console.log(pairCount+' chin/collar combinations; visible neck '+lo.toFixed(2)+'–'+hi.toFixed(2)+' on a 100-unit portrait');
    const alt = {...p, age:72, flaw:'hothead', traits:[]};
    ck(E.faces.look(alt) !== L && E.faces.look(alt).mood === 'cross' && E.faces.look({...p}) === L, 'same district/id across campaigns');

    // 可重複的五層樣本，不假設 Claude 已經交付哪個 PNG；也試清單有底圖、但某個遮罩讀不到。
    const sample = E.people.crowd('layer-test','camden',0,180).find(p => {
      const a=P.partsOf(p); return a.hair && a.beard && a.hat;
    });
    const a = P.partsOf(sample), look = E.faces.look(sample), ids = [a.face,a.hair,a.beard,a.outfit,a.hat];
    const test = sandbox(['js/engine/rng.js','js/engine/people.js','content-s2/people.js','content-s3/data.js','js/ui/faces.js']);
    test.E.s3.portraitParts = {path:'parts/',size:320,items:Object.fromEntries(ids.map(id=>[id,{box:[0,0,320,320],features:[42,40,58,40,52],chin:61,collar:76}]))};
    require('vm').runInContext(fs.readFileSync(path.join(root,'js/s3/portraits.js'),'utf8'),test.ctx);
    const F = test.E.faces, renderer = test.E.s3.portraits;
    const draw = (missing, round) => {
      renderer.prepare(path => ({complete:true,naturalWidth: missing && path.includes(missing) ? 0 : 320}));
      return F.of(sample,{round});
    };
    const art = draw(null,false), circle = F.of(sample,{round:true});
    ck(ids.every(id=>art.includes('data-part="' + id + '"')) && [look.skin,look.iris,look.hairC,look.o.col,a.hatCol].every(c=>art.includes('flood-color="' + c + '"')), 'full selection or tint');
    const parts = art.split('<g transform="translate(0 ' + renderer.neckFit(61,76).drop + ')">');
    ck(parts.length === 3 && parts[1].includes('data-part="' + a.face + '"') && parts[1].includes('</g></g><g data-part="' + a.outfit + '"')
      && [a.hair,a.beard,a.hat].every(id=>parts[2].includes('data-part="' + id + '"')), 'both head layers must move together around a fixed collar');
    ck(circle.includes('<clipPath') && !art.includes('undefined') && !art.includes('NaN'), 'broken square or round portrait');
    const firstIds = new Set([...art.matchAll(/ id="([^"]+)"/g)].map(m=>m[1]));
    ck(![...circle.matchAll(/ id="([^"]+)"/g)].some(m=>firstIds.has(m[1])), 'duplicate filter IDs between coexisting portraits');
    for (const id of ids.slice(1)) {
      const partial = draw(id+'.tint',false);
      ck(!partial.includes('data-part="' + id + '"') && partial.includes('data-vector-part="' + id + '"') &&
        ids.filter(x=>x!==id).every(x=>partial.includes('data-part="' + x + '"')), id + ' must use its vector without obscuring healthy layers');
    }
    const legacy = draw(a.face+'.iris',true);
    ck(!legacy.includes('<image') && legacy.includes('<path') && legacy.includes('<clipPath'), 'whole-face fallback for a missing iris mask');
    ck(!F.of(sample,{round:true}).includes(legacy.match(/<clipPath id="([^"]+)"/)[1]+'"'), 'fallback round portraits share a clip');
    delete test.E.s3.portraitParts.items[a.hair];
    const absent = draw(null,false);
    ck(!absent.includes('data-part="' + a.hair + '"') && absent.includes('data-part="' + a.face + '"'), 'unpublished hair should retain the painted face');
    console.log(Object.keys(catalog.items).length + '/54 published parts; all names, mask sizes, shared colours, square/round and missing layers checked');
  }

  // ===== 文字 =====
  section('第三季：三語文字');
  {
    const src = ['js/s3/main.js', 's3.html'].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
    const want = new Set();
    for (const m of src.matchAll(/['"`](s3\.[\w.]+)['"`]/g)) if (!m[1].endsWith('.')) want.add(m[1]);
    const add = (pre, ids, tails = ['']) => { for (const id of ids) for (const t of tails) want.add(pre + id + t); };
    add('s3.ex.', D.exploits.map((x) => x.id), ['.n', '.d']);
    add('s3.tpl.',Object.values(S3.ops.templates).flat().map(k=>k.id),['.n','.d']);
    add('s3.field.',['book','intro','kit','private','signal','remote','patrol','stage','stageReady','order']);
    add('s3.gad.', Object.keys(D.gadgets), ['.n', '.d']);
    add('s3.wp.', Object.keys(D.weapons), ['.n', '.d']);
    add('s3.en.', Object.keys(D.enemies), ['.n', '.d']);
    add('s3.prop.', Object.keys(D.props).filter((k) => D.props[k].hack && k !== 'pylon'), ['.n', '.d']);
    add('s3.mod.', Object.keys(D.mods), ['.n', '.d']);
    add('s3.sec.', D.sectors.map((s) => s.id), ['.n', '.d']);
    add('s3.boss.', Object.keys(D.bosses), ['.n']);
    add('s3.perk.', D.perks.map((p) => p.id), ['.n', '.d']);
    const families=[...new Set(D.exploits.map(x=>x.tag))];
    add('s3.tag.', [...families, 'gadget']);
    add('s3.omni.effect.', families);
    add('s3.rar.', ['c', 'u', 'r']);
    add('s3.node.', ['fight', 'elite', 'shop', 'safe', 'event', 'boss', 'cells'], ['', '.d']);
    add('s3.rw.', ['exploit', 'gadget', 'data', 'heal', 'max', 'rescue']);
    add('s3.rw.got.', ['data', 'heal', 'max']);
    add('s3.hack.', [...new Set([...Object.values(D.props).map((p) => p.hack).filter(Boolean), ...Object.keys(D.hacks)])]);
    add('s3.why.', ['range', 'bw', 'jam', 'firewall', 'cool']);
    add('s3.trait.', Object.keys(D.traitFx));
    add('s3.flaw.', Object.keys(D.flawFx));
    add('s3.quirk.', Object.keys(D.quirkFx));
    add('s3.ctl.', ['move', 'aim', 'fire', 'hack', 'dash', 'focus', 'melee', 'swap', 'gadget', 'reload', 'pause'], ['', '.k']);
    add('s3.ctl.', ['take', 'order', 'order.k']);
    add('s3.tip.', ['stealth', 'doors', 'hack', 'takedown', 'spotted', 'swap', 'fieldSwap', 'trap']);
    add('s3.stat.', ['rooms', 'kills', 'hacks', 'takedowns', 'silent', 'bosses', 'rescued', 'captured']);
    add('s3.team.',['intercepts','take','fallen','deploy','relay','field','relayText','fieldText','aidText','follow','hold','focus','aid','guard','entry','close','ready','beatShot','execCD']);
    add('s3.common.',Object.keys(S3.ops.profiles));want.add('s3.field.armed');
    add('s3.job.', Object.keys(D.jobFx));
    add('s3.mark.', Object.keys(D.imprints));
    // 劇本：每一句台詞（含依前兩季結局換掉的那幾句）、說話的人、結局、無線電、安全屋的閒聊。
    const lineKeys = (l) => [l.k].concat(...['v1', 's2', 'ally'].map((f) => Object.values(l[f] || {})));
    for (const l of storyLines) for (const k of lineKeys(l)) want.add(k);
    for (const b of Object.values(ST.bossBeats)) for (const k of b.again) want.add(k);
    for (const c of Object.values(ST.comms)) for (const k of c.k) want.add(k);
    add('s3.who.', Object.keys(ST.speakers));
    add('s3.end.', ST.endings.map((e) => e.id), ['.t', '.c', '.d']);
    add('s3.safe.', ['rest', 'tune', 'train'], ['', '.d']);
    for (const ev of D.events) {
      add('s3.ev.' + ev.id, ['.t', '.x', '.c0', '.c1']);
      ev.choices.forEach((c, i) => { if (c.roll) for (const r of c.roll) want.add(`s3.ev.${ev.id}.r${i}.${r[2]}`); else want.add(`s3.ev.${ev.id}.r${i}`); });
    }
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const code of LANGS) {
      const table = page.tables[code] || {};
      for (const k of want) if (table[k] === undefined) fail(`s3 text: ${code} is missing ${k}`);
      for (const k of Object.keys(table)) {
        if (!k.startsWith('s3.')) continue;
        if (!want.has(k)) fail(`s3 text: ${code} has ${k}, which nothing uses`);
        if (page.tables['zh-Hant'][k] !== undefined && vars(table[k]) !== vars(page.tables['zh-Hant'][k])) fail(`s3 text: ${code} ${k} has different {variables}`);
        if (!table[k].trim()) fail(`s3 text: ${code} ${k} is empty`);
      }
    }
    // 簡體的表裡不該出現只有繁體才用的字（整批取代時最容易漏）。
    const trad = /[駭頻寬體資訊號擊傷這個們鎖門響報區設電暈彈槍裝備標記擋關開機樁還沒發現戰鬥點選]/;
    for (const [k, v] of Object.entries(page.tables['zh-Hans'])) if (k.startsWith('s3.') && trad.test(v)) fail(`s3 text: zh-Hans ${k} contains a Traditional character (${v.match(trad)[0]})`);
    console.log(`${want.size} keys in three languages, none missing, none unused`);
  }

  section('零時差：CM-26 退件單、核心通話與四個結局');
  {
    const ck = (ok, why) => { if (!ok) fail('s3 CM-26: ' + why); };
    const sequence = lines => lines.map(l => l.who + ':' + l.k).join('|');
    const keys = (base, pairs) => pairs.map(([who, k]) => who + ':' + base + k).join('|');
    const cb = 's3.st.carrier.', carrier = ST.beats.carrier_down.slice(-3);
    ck(sequence(carrier) === keys(cb, [['echo','d4'],['bagley','slip'],['maya','d5']]) && carrier[0].v1.stay === cb + 'd4.stay', 'room 13, including stay');
    const base = 's3.st.choice.';
    const inner = keys(base, [['console','receipt'],['','live'],['echo','thumb'],['mina','button'],['echo','echo'],['mina','line']]);
    const before = ':' + base + '1', after = 'bagley:' + base + '2';
    const whole = [before, inner, after].join('|');
    // 既有結局、核心和母機的紀錄不是這通電話的已讀旗標。
    const m = R.meta();
    Object.assign(m, { endings: { return: 1 }, wins: 1, story: { carrier_down: 1, core_meet: 1, ended: 'return' } });
    R.saveMeta(m);
    const old = R.meta();
    const finale = ST.linesFor(ST.beats.choice, old.story);
    ck(sequence(finale) === whole && sequence(ST.linesFor([ST.minaReveal], old.story)) === inner, 'old winner sees the entire call in either entry');
    for (const line of finale.slice(0, -2)) ck(!ST.completeLine(old.story, line), 'early read mark: ' + line.k);
    ck(sequence(ST.linesFor(ST.beats.choice, old.story)) === whole && !R.meta().story.mina_reveal, 'interrupted call stays unread');
    ck(ST.completeLine(old.story, finale[6]) && !ST.completeLine(old.story, finale[6]), 'complete exactly once on last line');
    R.saveMeta(old);
    const again = R.meta();
    ck(again.story.mina_reveal && again.endings.return && again.story.core_meet &&
      sequence(ST.linesFor(ST.beats.choice, again.story)) === [before, after].join('|') &&
      !ST.linesFor([ST.minaReveal], again.story).length, 'read state survives reload; only the call is omitted');
    storage.clear();

    const endings = [
      ['return', '', 'call', '4', null], ['burn', 'mina', 'slip', '3', '4'],
      ['open', '', 'post', '2', '3'], ['teach', '', 'wire', '4', '5'],
    ];
    for (const [id, who, k, prev, next] of endings) {
      const e = ST.endings.find(e => e.id === id), prefix = 's3.end.' + id + '.';
      const i = e.lines.findIndex(l => l.k === prefix + k && l.who === who);
      ck(e.lines[i-1]?.k === prefix + prev && e.lines[i+1]?.k === (next ? prefix + next : undefined), 'ending cue: ' + id);
    }
    ck(ST.endings.find(e => e.id === 'teach').need === 3, 'teach rescue threshold');

    const test = sandbox([...scripts, 'js/ui/art.js']), S = test.E.s3;
    const img = { complete: true, naturalWidth: 512 }, silhouette = test.E.art.avatar('crowd');
    S.assets = { img: () => img, url: p => p };
    const pt = S.pictures['pt-mina'];
    ck(pt === 'assets/s3/pt-mina.jpg' && S.portraits.speaker('mina').includes('src="' + pt + '"'), 'published silhouette');
    img.naturalWidth = 0;
    ck(S.portraits.speaker('mina') === silhouette, 'broken file must fall back to a faceless silhouette');
    delete S.pictures['pt-mina'];
    ck(S.portraits.speaker('mina') === silhouette, 'unlisted portrait must also fall back');
    console.log('room 13, six ordered cues on a prior winner, interrupted/completed reads, four ending cues, published/broken/unlisted portrait');
  }

  // ===== 資料表 =====
  section('第三季：資料表');
  {
    for (const l of storyLines) if (l.who && !ST.speakers[l.who]) fail(`s3 story: unknown speaker ${l.who}`);
    for (const [id, b] of Object.entries(ST.bossBeats)) {
      if (!D.bosses[id]) fail(`s3 story: lines for unknown boss ${id}`);
      for (const k of [b.meet, b.down]) if (k && !ST.beats[k]) fail(`s3 story: boss ${id} points at missing beat ${k}`);
      if (!ST.speakers[b.who] || !b.again.length) fail(`s3 story: boss ${id} needs a speaker and at least one repeat line`);
    }
    for (const id of D.sectors.map((x) => x.boss)) if (!ST.bossBeats[id]) fail(`s3 story: boss ${id} has no lines`);
    for (const [sec, k] of Object.entries(ST.sectorBeats)) if (!D.sectors.some((x) => x.id === sec) || !ST.beats[k]) fail(`s3 story: sector beat ${sec} is broken`);
    for (const c of Object.values(ST.comms)) if (!ST.speakers[c.who]) fail(`s3 story: radio line from unknown speaker ${c.who}`);
    for (const p of [...E.s2.people.occupations, ...E.s2.people.rares]) if (!D.jobFx[p.perk]) fail(`s3 data: job ${p.id} (${p.perk}) does nothing in Season 3`);
    // 圖片清單裡的每個檔案都要在；首領一定要有登場插圖。
    for (const [k, p] of Object.entries(S3.pictures || {})) if (!fs.existsSync(path.join(root, p))) fail(`s3 art: picture ${k} points at a missing file (${p})`);
    for (const [k, a] of Object.entries(S3.atlas || {})) if (!fs.existsSync(path.join(root, a.src))) fail(`s3 art: sprite sheet ${k} is missing (${a.src})`);
    for (const id of Object.keys(D.bosses)) if (!(S3.pictures || {})['boss-' + id]) fail(`s3 art: boss ${id} has no illustration`);
    const P = E.s2.people;
    const exIds = new Set(D.exploits.map((x) => x.id));
    // Load the actual standalone manual, not a duplicate list of the game's scripts.
    const bookHtml=fs.readFileSync(path.join(root,'s3-loadouts.html'),'utf8'), book=sandbox([...bookHtml.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]).filter(f=>!f.endsWith('loadout-guide.js')));
    const idx=book.E.s3.loadoutIndex,rows=Object.keys(idx.rows);
    if(rows.length!==exIds.size || rows.some(id=>!exIds.has(id)))fail('s3 loadout index: missing or stale exploit');
    const links=(xp,action)=>idx.rows[xp].routes.some(line=>line.targets.some(k=>idx.related(k,action)));
    for(const action of [...Object.keys(D.weapons),'execute','strike','barrel','pipebomb','escort']){
      const round=!!D.weapons[action],firearm=round||action==='execute';
      for(const xp of ['hollow','glasscannon','hoard','reflex','reprieve','silencer'])if(links(xp,action)!==firearm)fail('s3 personal gunfire: '+xp+' / '+action);
      for(const xp of ['rapid','extmag','pierce','ricochet','shockrounds','crit','incendiary'])if(links(xp,action)!==round)fail('s3 bullet only: '+xp+' / '+action);
    }
    for(const [xp,yes,no] of [['hollow','execute','strike'],['crit','rifle','execute'],['salvage','execute','lure'],['salvage','strike','mask'],['impactDrive','sledge','brawl'],['medic','medbeacon','bail'],['threadNeedle','rush','injunction'],['hiveDose','hiveguard','burning'],['incendiary','shotgun','molotov'],['triage','medbeacon','medpack']]){
      if(!links(xp,yes)||links(xp,no))fail('s3 loadout links: '+xp+' / '+yes+' / '+no);
    }
    for(const lang of LANGS){
      book.E.i18n.set(lang);const valid=k=>!!k && !k.includes('⟦');
      const describe=book.E.s3.exploitText;
      for(const x of D.exploits)for(let rank=1;rank<=x.max;rank++){
        const copy=describe(x.id,rank);
        if(!valid(copy)||/\[\[|\]\]|\uFFFD|undefined/.test(copy))fail('s3 ranked card text: '+lang+' '+x.id+' '+rank);
      }
      if(!describe('reprieve').includes('3%')||!describe('reprieve').includes('5%')||describe('reprieve',1).includes('5%')||!describe('reprieve',2).includes('5%')||describe('reprieve',2).includes('3%')||describe('reprieve',8)!==describe('reprieve',2))fail('s3 Berserk: guide / offer / overflow rank '+lang);
      if(!describe('medic',2).includes('12')||!describe('medic',2).includes('40%')||describe('medic',2).includes('20%'))fail('s3 medical card: both quantities must use offered rank '+lang);
      for(const id of [...Object.keys(D.weapons),...Object.keys(D.gadgets),...Object.keys(idx.terms)])if(!valid(idx.label(id)))fail('s3 loadout index: '+lang+' '+id);
      for(const [id,row] of Object.entries(idx.rows)){
        if(!valid(book.E.i18n.t('s3.ex.'+id+'.d')) || !row.routes.length)fail('s3 loadout index: '+id);
        for(const {targets} of row.routes)for(const k of targets)if(!valid(idx.label(k)))fail('s3 loadout target: '+id+'/'+k);
      }
      for(const t of Object.values(idx.terms))for(const id of t.children)if(!valid(idx.label(id)))fail('s3 loadout group: '+id);
    }
    if (exIds.size !== D.exploits.length) fail('s3 data: duplicate exploit id');
    for (const x of D.exploits) {
      if (!'cur'.includes(x.rar) || !(x.max >= 1)) fail(`s3 data: exploit ${x.id} has a bad rarity or max`);
      for (const k of Object.keys(x.mods)) if (!(k in D.baseStats)) fail(`s3 data: exploit ${x.id} changes unknown stat ${k}`);
    }
    for (const [cat, kit] of Object.entries(D.kits)) {
      for (const g of kit.gadget) if (!D.gadgets[g]) fail(`s3 data: kit ${cat} has unknown gadget ${g}`);
      for (const x of kit.exploit) if (!exIds.has(x)) fail(`s3 data: kit ${cat} has unknown exploit ${x}`);
    }
    for (const cat of ['hacker', 'physical', 'social', 'specialist']) if (!D.kits[cat] || !D.weapons[D.weaponByCategory[cat]]) fail(`s3 data: no kit or weapon for ${cat}`);
    for (const w of Object.values(D.weaponByJob)) if (!D.weapons[w]) fail(`s3 data: unknown weapon ${w}`);
    for (const t of P.traits) if (!D.traitFx[t.id]) fail(`s3 data: trait ${t.id} does nothing in Season 3`);
    for (const f of P.flaws) if (!D.flawFx[f.id]) fail(`s3 data: flaw ${f.id} does nothing in Season 3`);
    for (const [name, table] of [['trait', D.traitFx], ['flaw', D.flawFx], ['quirk', D.quirkFx]]) {
      for (const [id, fx] of Object.entries(table)) for (const k of Object.keys(fx.mods || {})) if (!(k in D.baseStats)) fail(`s3 data: ${name} ${id} changes unknown stat ${k}`);
    }
    for (const ev of D.events) {
      if (ev.choices.length !== 2) fail(`s3 data: event ${ev.id} needs two choices`);
      for (const c of ev.choices) for (const fx of c.roll ? c.roll.map((r) => r[1]) : [c.fx]) {
        if (fx.gadget && !D.gadgets[fx.gadget]) fail(`s3 data: event ${ev.id} gives unknown gadget ${fx.gadget}`);
        if (fx.exploit && !exIds.has(fx.exploit)) fail(`s3 data: event ${ev.id} gives unknown exploit ${fx.exploit}`);
        if (fx.curse && !D.mods[fx.curse]) fail(`s3 data: event ${ev.id} uses unknown room condition ${fx.curse}`);
      }
      if (ev.choices.some((c) => c.roll && c.roll[c.roll.length - 1][0] !== 1)) fail(`s3 data: event ${ev.id}: the last roll must be 1`);
    }
    for (const p of D.perks) if (p.cost.length !== p.max) fail(`s3 data: perk ${p.id} needs one cost per level`);
    for (const s of D.sectors) {
      if (!D.bosses[s.boss] || !P.districts[s.district]) fail(`s3 data: sector ${s.id} has an unknown boss or district`);
      for (const k of Object.keys(s.props)) if (!D.props[k]) fail(`s3 data: sector ${s.id} places unknown prop ${k}`);
    }
    // 能力值：疊加的方向正確（加的用加、乘的用乘）。
    const base = sim.stats({ skills: { hack: 0, physical: 0, social: 0 }, exploits: {} }).st;
    const more = sim.stats({ skills: { hack: 3, physical: 3, social: 3 }, traits: ['fast'], flaw: 'bad_knees', quirks: ['gamer'], exploits: { overclock: 3, kevlar: 2, fiber: 2 }, extra: { maxHp: 8, bwMax: 1 } });
    if (more.st.bwMax !== base.bwMax + 3 + 3 + 1) fail(`s3 stats: bandwidth ${more.st.bwMax}`);
    if (more.st.maxHp !== base.maxHp + 36 + 40 + 8) fail(`s3 stats: health ${more.st.maxHp}`);
    if (Math.abs(more.st.bwRegen - base.bwRegen * 1.25 * 1.25) > 1e-9) fail('s3 stats: bandwidth recovery should multiply per stack');
    if (!(more.st.dashCd > base.dashCd) || !(more.st.speed > base.speed) || !(more.st.critChance > base.critChance)) fail('s3 stats: trait, flaw or quirk not applied');
    console.log(`${D.exploits.length} exploits, ${Object.keys(D.gadgets).length} gadgets, ${Object.keys(D.enemies).length} enemies, ${D.events.length} encounters, ${D.perks.length} permanent upgrades`);
  }

  // ===== 房間生成 =====
  section('第三季：房間生成');
  {
    const G = S3.gen;
    let rooms = 0;
    const kinds = new Set(), propKinds = new Set();
    for (let seed = 0; seed < 12; seed++) for (let si = 0; si < D.sectors.length; si++) for (const depth of [0, 2, D.sectors[si].rooms - 1]) for (const type of ['fight', 'elite']) {
      const roomNo = si * 7 + depth + 1, node = { type, mod: seed % 3 || roomNo < D.mods.kennel.from ? null : 'kennel', reward: 'exploit' };
      const spec = G.room('gen-' + seed, si, depth, roomNo, node, 1 + (seed % 3));
      const again = G.room('gen-' + seed, si, depth, roomNo, node, 1 + (seed % 3));
      if (JSON.stringify(spec) !== JSON.stringify(again)) fail(`s3 gen: seed ${seed} sector ${si} depth ${depth} is not repeatable`);
      rooms++;
      const occ = new Array(G.GW * G.GH).fill(0), used = new Set();
      for (const pr of spec.props) {
        propKinds.add(pr.kind);
        const wall = pr.kind === 'camera' || pr.kind === 'speaker';
        for (let y = pr.ty; y < pr.ty + pr.h; y++) for (let x = pr.tx; x < pr.tx + pr.w; x++) {
          const i = y * G.GW + x;
          if (x < 0 || y < 0 || x >= G.GW || y >= G.GH) fail(`s3 gen: ${pr.kind} is outside the room`);
          if (!!spec.tiles[i] !== wall) fail(`s3 gen: ${pr.kind} at ${x},${y} is ${wall ? 'not on a wall' : 'inside a wall'}`);
          if (used.has(i)) fail(`s3 gen: two props share ${x},${y}`);
          used.add(i);
          if (D.props[pr.kind].solid) occ[i] = 1;
        }
      }
      // 每一塊地板都走得到，設施沒有把路堵死。
      const dist = G.flood(spec.tiles, occ);
      for (let i = 0; i < spec.tiles.length; i++) if (!spec.tiles[i] && !occ[i] && dist[i] < 0) { fail(`s3 gen: seed ${seed} sector ${si} depth ${depth}: floor ${i % G.GW},${Math.floor(i / G.GW)} cannot be reached`); break; }
      for (const d of spec.doors) if (dist[1 * G.GW + d.tx] < 0) fail('s3 gen: a door cannot be reached');
      if (spec.doors.length !== 1 + (seed % 3)) fail('s3 gen: wrong number of doors');
      if (spec.enemies.length < 3) fail(`s3 gen: only ${spec.enemies.length} enemies`);
      for (const e of spec.enemies) {
        kinds.add(e.kind);
        if (spec.tiles[e.ty * G.GW + e.tx] || occ[e.ty * G.GW + e.tx]) fail(`s3 gen: ${e.kind} starts inside something`);
        if (Math.hypot(e.x - spec.entry.x, e.y - spec.entry.y) < 4 * T) fail(`s3 gen: ${e.kind} starts ${Math.round(Math.hypot(e.x - spec.entry.x, e.y - spec.entry.y))}px from the entrance`);
        if (D.enemies[e.kind].from > roomNo) fail(`s3 gen: ${e.kind} appears too early (room ${roomNo})`);
      }
      for (const w of spec.waves) for (const e of w) kinds.add(e.kind);
      if (type === 'elite' && !spec.enemies.some((e) => e.elite)) fail('s3 gen: an elite room has no elite');
      if (node.mod === 'kennel' && spec.enemies.filter((e) => e.kind === 'hound').length < 2) fail('s3 gen: the dog unit brought no hounds');
      if (!spec.gates.length) fail('s3 gen: no entry points for reinforcements');
      // 一進門不會馬上被看到：站在入口不動一秒，沒有任何人或攝影機開始注意。
      const st = sim.createRoom(spec, { weapon: 'pistol', skills: { hack: 1, physical: 1, social: 0 }, exploits: {}, gadgets: [] });
      for (let i = 0; i < 60; i++) sim.step(st, { mx: 0, my: 0, ax: 800, ay: 0 });
      if (node.mod !== 'sweep' && (st.en.some((e) => e.aware > 0 || e.state !== 'calm') || st.props.some((p) => p.aware > 0))) fail(`s3 gen: seed ${seed} sector ${si} depth ${depth}: seen within a second of walking in`);
    }
    for (const k of Object.keys(D.enemies)) if (!kinds.has(k)) fail(`s3 gen: ${k} never appears`);
    for (const k of ['junction', 'vent', 'barrel', 'car', 'bollard', 'camera', 'speaker', 'crate']) if (!propKinds.has(k)) fail(`s3 gen: ${k} never appears`);
    D.sectors.forEach((sec, si) => {
      const spec = G.room('gen-boss', si, sec.rooms, 20, { type: 'boss' }, 1);
      if (spec.boss !== sec.boss || spec.enemies[0].kind !== 'boss') fail(`s3 gen: sector ${sec.id} has no boss`);
      const pylons = spec.props.filter((p) => p.kind === 'pylon').length;
      if (pylons !== (D.bosses[sec.boss].pylons || 0)) fail(`s3 gen: ${sec.boss} has ${pylons} relays`);
    });
    console.log(`${rooms} rooms: repeatable, every floor square reachable, props placed legally, enemies away from the entrance, every enemy and prop kind appears`);
  }

  // ===== 戰鬥規則 =====
  section('第三季：戰鬥規則');
  // 空的場地，自己擺東西進去。
  function arena(o = {}) {
    const tiles = new Array(32 * 18).fill(0);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 32; x++) if (!x || !y || x === 31 || y === 17) tiles[y * 32 + x] = 1;
    return {
      seed: o.seed || 7, sector: 0, depth: 0, roomNo: 1, theme: 'docks', type: 'fight', mod: o.mod || null, scale: 1, dataMul: 1,
      doors: [{ tx: 15, x: 800, y: 50 }], entry: { x: 800, y: 775 }, boss: null, waves: o.waves || [], supply: false,
      tiles, props: o.props || [], enemies: o.enemies || [], gates: [{ tx: 2, ty: 3, x: 125, y: 175 }],
    };
  }
  const build = (o = {}) => Object.assign({ weapon: 'pistol', skills: { hack: 1, physical: 1, social: 0 }, traits: [], flaw: null, quirks: [], exploits: {}, gadgets: [], extra: {} }, o);
  const pad = (o = {}) => Object.assign({ mx: 0, my: 0, ax: 800, ay: 0, fire: false, focus: false, dash: false, hack: false, melee: false, g1: false, g2: false, reload: false }, o);
  const go = (s, n, inp) => { const seen = []; for (let i = 0; i < n; i++) { sim.step(s, typeof inp === 'function' ? inp(i) : inp || pad()); for (const ev of s.ev) seen.push(ev.k); s.ev.length = 0; } return seen; };
  // 房間一開始，離入口近的守衛會背對入口；測試要人面對玩家時用 face 轉回來。
  const room = (o, b) => sim.createRoom(arena(o), build(b));
  const face = (s, ang) => { for (const e of s.en) e.ang = e.base = ang; return s; };
  const UP = -Math.PI / 2, DOWN = Math.PI / 2;
  {
    // 從背後靠近不會被發現，可以直接制伏；沒響警報就清場算「無聲」。
    let s = room({ enemies: [{ kind: 'guard', x: 800, y: 600, ang: UP }] });
    go(s, 120);
    if (s.en[0].state !== 'calm' || s.en[0].aware > 0) fail('s3 fight: a guard facing away noticed the player');
    go(s, 28, pad({ my: -1 }));
    if (sim.takedownTarget(s) !== s.en[0]) fail('s3 fight: no takedown from behind');
    const seen = go(s, 3, (i) => pad({ melee: i === 0 }));
    go(s, 3);
    if (!seen.includes('takedown') || !s.cleared || !s.silent || s.alert) fail(`s3 fight: takedown did not clear the room silently (${seen.join(',')})`);
    if (!s.cache || s.cache.taken) fail('s3 fight: no reward cache after clearing');

    // 正面被看到：先是發現，叫人要 CALL 秒，叫完才響警報、增援才會來。
    s = face(room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: DOWN }], waves: [[{ kind: 'rusher' }]] }), DOWN);
    go(s, 20);
    if (s.en[0].state === 'combat') fail('s3 fight: spotted instantly');
    const ev = go(s, 50);
    if (s.en[0].state !== 'combat' || !(s.en[0].call > 0) || s.alert || !ev.includes('spotted')) fail('s3 fight: a guard who sees the player should start calling it in');
    go(s, Math.ceil(sim.CALL * 60) + 5);
    if (!s.alert) fail('s3 fight: no alarm after the call');
    go(s, 60 * 5);
    if (!s.en.some((e) => e.kind === 'rusher')) fail('s3 fight: reinforcements never came');
    // 叫完之前放倒，就不會響警報，增援也不會來。
    s = face(room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: DOWN }], waves: [[{ kind: 'rusher' }]] }), DOWN);
    go(s, 70);
    A.kill(s, s.en[0], { by: 'gun' });
    go(s, 200);
    if (s.alert || !s.cleared || !s.silent) fail('s3 fight: killing the caller in time should keep the room quiet');

    // 槍聲會驚動附近的人；滅音手槍不會。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: UP }] });
    go(s, 40);
    go(s, 2, pad({ fire: true, ax: 800, ay: 900 }));
    if (s.en[0].state !== 'combat') fail('s3 fight: a gunshot 275px away went unheard');
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 500, ang: UP }] }, { weapon: 'silenced' });
    go(s, 40);
    go(s, 2, pad({ fire: true, ax: 800, ay: 900 }));
    if (s.en[0].state !== 'calm') fail('s3 fight: the silenced pistol was heard');

    // 配電箱：花 2 頻寬，頓一下之後放電；還沒發現你的守衛直接倒下，不會響警報。太遠、頻寬不夠都會說原因。
    s = room({ props: [{ kind: 'junction', tx: 16, ty: 8, w: 1, h: 1 }, { kind: 'junction', tx: 2, ty: 2, w: 1, h: 1 }], enemies: [{ kind: 'guard', x: 900, y: 425, ang: UP }] });
    const victim = s.en[0];
    let h = sim.pickHack(s, 825, 425);
    if (!h || h.act !== 'overload' || h.cost !== 2 || !h.ok) fail('s3 hack: junction box not offered');
    if (sim.pickHack(s, 125, 125).why !== 'range') fail('s3 hack: a far junction box should be out of range');
    const bw = s.p.bw;
    go(s, 1, pad({ hack: true, ax: 825, ay: 425 }));
    if (Math.abs(bw - s.p.bw - 2) > 0.05) fail(`s3 hack: overload cost ${bw - s.p.bw}`);
    go(s, 40);
    if (!victim.dead || s.alert) fail('s3 hack: an overload should put down a guard who has not seen the player, with no alarm');
    h = sim.pickHack(s, 825, 425);
    if (h && h.prop) fail('s3 hack: a used junction box should not be offered again');
    s.p.bw = 0;
    s.p.x = 200; s.p.y = 200;
    if (sim.pickHack(s, 125, 125).why !== 'bw') fail('s3 hack: no bandwidth should be the reason');

    // 盾兵：正面擋子彈；盾牌被癱瘓就打得到。
    s = face(room({ enemies: [{ kind: 'shield', x: 800, y: 450, ang: DOWN }] }), DOWN);
    A.raise(s);
    const shield = s.en[0];
    let clang = go(s, 50, pad({ fire: true, ax: 800, ay: 450 }));
    if (shield.hp < shield.maxHp || !clang.includes('clang')) fail('s3 fight: the shield did not block from the front');
    h = sim.pickHack(s, shield.x, shield.y);
    if (!h || h.act !== 'dropShield') fail('s3 hack: shield trooper should offer the shield hack');
    shield.noShield = 5;
    go(s, 40, (i) => pad({ fire: true, ax: shield.x, ay: shield.y }));
    if (!(shield.hp < shield.maxHp)) fail('s3 fight: no damage with the shield down');

    // 劫持無人機：會幫忙打，時間到就燒掉。
    s = room({ enemies: [{ kind: 'drone', x: 700, y: 500, ang: DOWN }, { kind: 'heavy', x: 900, y: 400, ang: DOWN }] });
    A.raise(s);
    const drone = s.en[0], heavy = s.en[1];
    go(s, 1, pad({ hack: true, ax: drone.x, ay: drone.y }));
    if (!(drone.ally > 0)) fail('s3 hack: the drone was not hijacked');
    const hp0 = heavy.hp;
    go(s, 240);
    if (!(heavy.hp < hp0)) fail('s3 hack: the hijacked drone did not attack');
    go(s, 60 * 10);
    if (!drone.dead) fail('s3 hack: the hijacked drone never burned out');

    // 無人車：往車頭方向衝，撞倒路上的人，撞到牆才停。
    s = room({ props: [{ kind: 'car', tx: 10, ty: 8, w: 2, h: 1, dir: 0 }], enemies: [{ kind: 'guard', x: 725, y: 425, ang: UP }] });
    go(s, 1, pad({ hack: true, ax: 550, ay: 425 }));
    go(s, 150);
    const car = s.props[0];
    if (!car.used || car.moving || car.tx !== 29) fail(`s3 hack: the car stopped at ${car.tx}`);
    if (s.stats.kills !== 1) fail('s3 hack: the car did not run the guard over');

    // 車會往敵人多的那一頭衝（車頭跟著轉過去），撞到牆會爆炸。
    s = room({ props: [{ kind: 'car', tx: 10, ty: 8, w: 2, h: 1, dir: 0 }], enemies: [{ kind: 'guard', x: 300, y: 425, ang: UP }] });
    if (sim.carPath(s, s.props[0]).dir !== 2) fail('s3 hack: the car should pick the end with the enemy in its lane');
    let crash = go(s, 1, pad({ hack: true, ax: 550, ay: 425 }));
    crash = crash.concat(go(s, 150));
    if (s.props[0].dir !== 2 || s.props[0].tx > 2 || s.stats.kills !== 1 || !crash.includes('crash') || !s.zones.some((z) => z.k === 'fire')) fail(`s3 hack: the car should turn round, run the guard over and explode at the wall (tx ${s.props[0].tx})`);

    // 陷阱的規則：還沒發現你的一般敵人直接倒下；精英和重裝兵受三倍傷害；警報響了之後就是普通的傷害。
    s = room({ enemies: [{ kind: 'guard', x: 400, y: 300, ang: UP }, { kind: 'heavy', x: 1200, y: 300, ang: UP }] });
    go(s, 5);
    const [unaware, heavyOne] = s.en;
    A.trapHurt(s, unaware, 1, { by: 'env' });
    const heavyHp = heavyOne.hp;
    A.trapHurt(s, heavyOne, 10, { by: 'env' });
    if (!unaware.dead || s.alert) fail('s3 trap: a trap should put down a guard who has not seen the player');
    if (heavyOne.dead || Math.abs(heavyHp - heavyOne.hp - 30) > 0.01) fail('s3 trap: a heavy should take triple damage and stay up');
    s = room({ enemies: [{ kind: 'guard', x: 400, y: 300, ang: UP }] });
    A.raise(s);
    const awake = s.en[0], awakeHp = awake.hp;
    A.trapHurt(s, awake, 10, { by: 'env' });
    if (awake.dead || Math.abs(awakeHp - awake.hp - 10) > 0.01) fail('s3 trap: after the alarm a trap should do only its normal damage');

    // 急救包：全隊都滿血的時候留在地上，不會被吸過來；有人受傷才撿，先補場上的人，多的給場下傷得最重的人。
    {
      const crew3 = { squad: [build(), build(), build()], active: 0 };
      s = sim.createRoom(arena({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }), crew3);
      go(s, 30);
      const mx = s.p.x + 60;
      s.picks.push({ k: 'med', x: mx, y: s.p.y, v: 15, vx: 0, vy: 0, t: 1 });
      go(s, 60);
      const kit = s.picks.find((k) => k.k === 'med');
      if (!kit || Math.abs(kit.x - mx) > 1) fail('s3 pickup: a medkit was pulled in while everyone was at full health');
      s.team[1].hp = s.team[1].maxHp - 30;
      s.p.hp = s.p.maxHp - 5;
      go(s, 60);
      if (s.picks.some((k) => k.k === 'med') || s.p.hp !== s.p.maxHp || s.team[1].hp !== s.team[1].maxHp - 20) fail('s3 pickup: the medkit should top up the active member first, then the most hurt teammate');
    }

    // 燒傷不會讓還沒發現你的敵人發現你：會起疑、從火裡走出來，但不會叫人。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 300, ang: UP }] });
    s.p.cloak = 1e9;
    const burnt = s.en[0], burntHp = burnt.hp;
    s.zones.push({ k: 'fire', x: 800, y: 300, r: 70, t: 2, burn: 8, tick: 0 });
    const burnEv = go(s, 90);
    if (!(burnt.hp < burntHp) || burnt.state === 'combat' || s.alert || burnEv.includes('spotted')) fail('s3 trap: burning should hurt a guard without giving the player away');
    if (Math.hypot(burnt.x - 800, burnt.y - 300) < 70) fail('s3 trap: a burning guard should walk out of the fire');
    // 去查看爆炸的人停在火的外圍，不會自己走進去。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 250, ang: UP }] });
    s.p.cloak = 1e9;
    const looker = s.en[0];
    s.zones.push({ k: 'fire', x: 800, y: 500, r: 70, t: 10, burn: 8, tick: 0 });
    A.noise(s, 800, 500, 600);
    let closest = 1e9;
    for (let i = 0; i < 300; i++) { go(s, 1); closest = Math.min(closest, Math.hypot(looker.x - 800, looker.y - 500)); }
    if (closest < 70 || looker.hp < looker.maxHp || s.alert) fail(`s3 trap: a guard checking the explosion walked into the fire (closest ${Math.round(closest)})`);

    // 蒸汽：裡面的敵人暈頭轉向，正面也能制伏，隔一小段也能撲過去。
    s = face(room({ enemies: [{ kind: 'guard', x: 800, y: 450, ang: DOWN }] }), DOWN);
    s.zones.push({ k: 'steam', x: 800, y: 450, r: 130, t: 6, burn: 0, tick: 0 });
    s.p.x = 800; s.p.y = 530;
    const steamed = s.en[0];
    if (sim.takedownTarget(s) !== steamed) fail('s3 fight: a guard in steam should be open to a takedown from the front');
    go(s, 2, (i) => pad({ melee: i === 0 }));
    if (!steamed.dead || s.alert) fail('s3 fight: the takedown in steam did not land quietly');
    // 警報之後，用干擾耳機電暈，再撲過去制伏；中間有牆就撲不過去。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 470, ang: DOWN }] });
    A.raise(s);
    s.p.x = 800; s.p.y = 600;
    const dazed = s.en[0];
    go(s, 1, pad({ hack: true, ax: dazed.x, ay: dazed.y }));
    if (!(dazed.stun > 1.5)) fail(`s3 hack: the earpiece stun is too short to close in (${dazed.stun.toFixed(2)}s)`);
    if (sim.takedownTarget(s) !== dazed) fail('s3 fight: a stunned guard within lunge range should be open to a takedown');
    go(s, 2, (i) => pad({ melee: i === 0 }));
    if (!dazed.dead || Math.hypot(s.p.x - dazed.x, s.p.y - dazed.y) > dazed.r + s.p.r + 10) fail('s3 fight: the lunge takedown did not land');
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 470, ang: DOWN }] });
    A.raise(s);
    s.p.x = 800; s.p.y = 600;
    s.solid[A.idx(16, 10)] = 1;
    A.stun(s, s.en[0], 2);
    if (sim.takedownTarget(s)) fail('s3 fight: lunged through a wall');
    // 清場之後房間就安全了：剩下的火、油桶都不會再傷到人。
    s = room({ enemies: [{ kind: 'guard', x: 800, y: 300, ang: UP }] });
    A.kill(s, s.en[0], { by: 'gun' });
    go(s, 5);
    s.p.inv = 0;
    if (!s.cleared || A.hitPlayer(s, 50) !== false || s.p.hp !== s.p.maxHp) fail('s3 fight: the player was hurt after the room was clear');

    // 路樁：升起來擋子彈，不擋視線；時間到會降下去。
    s = room({ props: [{ kind: 'bollard', tx: 15, ty: 12, w: 3, h: 1, horiz: true }], enemies: [{ kind: 'guard', x: 825, y: 300, ang: UP }] });
    if (!A.clear(s, 800, 775, 825, 300, true)) fail('s3 hack: lowered bollards should not block bullets');
    go(s, 1, pad({ hack: true, ax: 825, ay: 625 }));
    if (A.clear(s, 800, 775, 825, 300, true) || !A.clear(s, 800, 775, 825, 300)) fail('s3 hack: raised bollards should block bullets but not sight');
    go(s, 60 * 9);
    if (!A.clear(s, 800, 775, 825, 300, true)) fail('s3 hack: bollards never went back down');

    // 干擾兵：範圍裡的東西駭不了；有「越獄」就可以。
    const jam = { props: [{ kind: 'junction', tx: 16, ty: 7, w: 1, h: 1 }], enemies: [{ kind: 'jammer', x: 800, y: 450, ang: DOWN }] };
    s = room(jam);
    A.raise(s);
    if (sim.pickHack(s, 825, 375).why !== 'jam') fail('s3 hack: the jammer did not block the hack');
    s = room(jam, { exploits: { jailbreak: 1 } });
    A.raise(s);
    if (!sim.pickHack(s, 825, 375).ok) fail('s3 hack: jailbreak should ignore the jammer');

    // 衝刺的瞬間不會受傷；「重新同步」只救一次；「謹慎」擋掉每間的第一下。
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { exploits: { secondwind: 1 } });
    go(s, 60);
    go(s, 1, pad({ dash: true, mx: 1 }));
    if (A.hitPlayer(s, 10) !== false) fail('s3 fight: hurt in the middle of a dash');
    go(s, 40);
    if (A.hitPlayer(s, 10) !== true || !(s.p.hp < s.p.maxHp)) fail('s3 fight: a hit after the dash did nothing');
    go(s, 40);
    A.hitPlayer(s, 999);
    if (s.over || !s.usedRevive || s.p.hp !== Math.round(s.p.maxHp * 0.4)) fail('s3 fight: resync did not bring the player back');
    go(s, 150);
    A.hitPlayer(s, 999);
    if (s.over !== 'dead') fail('s3 fight: resync worked twice');
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { traits: ['careful'] });
    go(s, 60);
    A.hitPlayer(s, 20);
    if (s.p.hp !== s.p.maxHp) fail('s3 fight: careful should block the first hit');
    go(s, 60);
    A.hitPlayer(s, 20);
    if (!(s.p.hp < s.p.maxHp)) fail('s3 fight: careful blocked twice');

    // 過敏：還沒被發現時會打噴嚏。
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { flaw: 'allergic' });
    if (!go(s, 60 * 40).includes('sneeze')) fail('s3 fight: no sneeze in 40 seconds');

    // 專注：時間變慢，專注條會掉；放開會回來。
    s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] });
    const t0 = s.t;
    go(s, 60, pad({ focus: true }));
    if (!(s.t - t0 < 0.5) || !(s.p.focus < s.st.focusMax)) fail('s3 fight: focus did not slow time');
    const f0 = s.p.focus;
    go(s, 60);
    if (!(s.p.focus > f0)) fail('s3 fight: focus did not recover');


    // ===== 小隊：一次一個人上場，隨時可以換；倒下的人被抓走，下一個人自動補上 =====
    {
      const three = { squad: [build({ weapon: 'pistol', traits: ['fast'] }), build({ weapon: 'shotgun', skills: { hack: 0, physical: 3, social: 0 } }), build({ weapon: 'silenced', job: 'disguise' })], active: 0 };
      s = sim.createRoom(arena({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }), three, { hp: [50, 70, 30] });
      if (s.team.length !== 3 || s.p.hp !== 50 || s.build.weapon !== 'pistol') fail('s3 squad: the first member should be on the field with their own health and weapon');
      go(s, 30);
      const bw = s.p.bw, x = s.p.x;
      go(s, 1, pad({ swap: 1 }));
      if (s.active !== 1 || s.p.hp !== 70 || s.build.weapon !== 'shotgun' || s.p.maxHp !== s.team[1].maxHp) fail('s3 squad: swapping did not bring in the second member');
      if (s.team[0].hp !== 50 || s.p.x !== x || s.p.bw > bw + 0.1 || s.p.bw > s.st.bwMax) fail('s3 squad: swapping should keep the position, the bandwidth and the first member\'s health');
      go(s, 1, pad({ swap: 0 }));
      if (s.active !== 1) fail('s3 squad: swapped again before the cooldown');
      go(s, Math.ceil(sim.SWAP_CD * 60) + 2);
      go(s, 1, pad({ swap: 2 }));
      if (s.active !== 2 || !(s.p.cloak > 0)) fail('s3 squad: the actor should come in disguised while the room is calm');
      // 倒下：被抓走，下一個還站著的人補上；全倒才算輸。
      go(s, 60);
      A.hitPlayer(s, 999);
      if (s.over || !s.team[2].down || s.active === 2 || s.p.hp <= 0) fail('s3 squad: when one member goes down the next should step in');
      const state = sim.teamState(s);
      if (!state[2].down || state[2].hp !== 0 || state[0].hp !== 50) fail('s3 squad: team state after a capture is wrong');
      go(s, 120);
      A.hitPlayer(s, 999);
      go(s, 120);
      A.hitPlayer(s, 999);
      if (s.over !== 'dead' || !s.team.every((m) => m.down)) fail('s3 squad: the run should end only when everyone is down');
      // 被抓的人不能換上來。
      s = sim.createRoom(arena({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }), three, { hp: [50, 0, 30] });
      go(s, 1, pad({ swap: 1 }));
      if (s.active !== 0) fail('s3 squad: swapped to a captured member');
      // 拘留室救出來的人：同一個房間裡就能補上倒下的人的位置，也能換上場；場上那個人不能被換掉。
      if (!sim.setMember(s, 1, build({ weapon: 'nailgun' }), 40) || s.team[1].down || s.team[1].hp !== 40) fail('s3 squad: a rescued teammate could not join the room');
      go(s, Math.ceil(sim.SWAP_CD * 60) + 2);
      go(s, 1, pad({ swap: 1 }));
      if (s.active !== 1 || s.build.weapon !== 'nailgun' || s.p.hp !== 40) fail('s3 squad: could not swap to the teammate who joined mid-room');
      if (sim.setMember(s, s.active, build(), 10)) fail('s3 squad: replaced the member on the floor');
    }

    // ===== 職業專長 =====
    {
      const jb = { props: [{ kind: 'junction', tx: 16, ty: 8, w: 1, h: 1 }, { kind: 'car', tx: 10, ty: 12, w: 2, h: 1, dir: 0 }], enemies: [{ kind: 'guard', x: 900, y: 425, ang: UP }, { kind: 'turret', x: 700, y: 600, ang: UP }] };
      // 後門：每間第一次駭入不用錢。
      s = room(jb, { job: 'backdoor' });
      if (sim.pickHack(s, 825, 425).cost !== 0) fail('s3 job: backdoor should make the first hack free');
      go(s, 1, pad({ hack: true, ax: 825, ay: 425 }));
      if (sim.pickHack(s, 900, 425).cost === 0) fail('s3 job: backdoor is only for the first hack');
      // 老系統：每次駭入少花一點；內網權限：砲塔便宜；水路：開車只要一點。
      if (sim.pickHack(room(jb, { job: 'legacy' }), 825, 425).cost !== 1) fail('s3 job: legacy systems should cut hack costs');
      if (sim.pickHack(room(jb, { job: 'network_access' }), 700, 600).cost !== S3.data.hacks.hijackTurret.cost - 1) fail('s3 job: network access should make turrets cheaper');
      if (sim.pickHack(room(jb, { job: 'river_route' }), 550, 625).cost !== 1) fail('s3 job: the docker should start cars for 1');
      // 工地門卡：自己不會被炸傷；消防員：不怕火。
      s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { job: 'site_pass' });
      go(s, 60);
      A.blast(s, s.p.x, s.p.y, 100, 0, { self: 30 });
      if (s.p.hp !== s.p.maxHp) fail('s3 job: the builder was hurt by a blast');
      const plain = sim.stats(build()).st, nurse = sim.stats(build({ job: 'heal' })), climber = sim.stats(build({ job: 'climb' }));
      if (climber.st.maxHp !== plain.maxHp + 20 || !climber.fl.fireproof || !nurse.fl.nurse) fail('s3 job: firefighter or nurse perk missing');
      // 接應撤離：每趟一次從必倒的一下裡脫身。
      s = room({ enemies: [{ kind: 'turret', x: 200, y: 200, ang: UP }] }, { job: 'getaway' });
      go(s, 60);
      A.hitPlayer(s, 999);
      if (s.over || s.p.hp !== 1) fail('s3 job: the cab driver should get away once');
      go(s, 150);
      A.hitPlayer(s, 999);
      if (s.over !== 'dead') fail('s3 job: the getaway worked twice');
      for (const o of E.s2.people.occupations.concat(E.s2.people.rares)) if (!S3.data.jobFx[o.perk]) fail(`s3 job: ${o.id} (${o.perk}) does nothing in Season 3`);
    }

    // 同一個房間、同一串輸入，結果要一模一樣。
    const play = () => {
      const spec = S3.gen.room('same', 1, 3, 10, { type: 'fight', mod: 'rain', reward: 'exploit' }, 2);
      const st = sim.createRoom(spec, build({ exploits: { chain: 1 }, gadgets: [{ id: 'eagle', lv: 1 }] }));
      const bot = S3.bot.create('same');
      for (let i = 0; i < 1500 && !st.over && !st.cleared; i++) { sim.step(st, bot.act(st)); st.ev.length = 0; }
      return [st.tick, st.p.hp.toFixed(3), st.p.x.toFixed(2), st.stats.kills, st.stats.hacks, st.en.length].join('|');
    };
    const a = play(), b = play();
    if (a !== b) fail(`s3 fight: the same room played twice differs (${a} vs ${b})`);
    console.log('stealth and takedowns, the call before the alarm, gun noise, junction boxes, traps on unaware enemies, shields, hijacking, cars, medkits, fire and steam that stay quiet, steam and lunge takedowns, a safe room after clearing, bollards, jammers, dash, resync, focus, squads, swapping and mid-room joins, job perks, repeatable results');
  }

  // ===== 一整趟的流程 =====
  section('第三季：流程');
  const newMeta = (perks = {}) => ({ echoes: 0, perks, runs: 0, wins: 0, best: 0, seen: {}, roster: [], vol: 0, story: {}, rescued: 0, seed: 'ci' });
  {
    const crew = R.crewFor('flow');
    const cat = (p) => E.people.occupationOf(p).category;
    if (crew.length !== 3 || new Set(crew.map(cat)).size !== 3) fail('s3 run: a crew of three different kinds expected');
    if (JSON.stringify(R.crewFor('flow')) !== JSON.stringify(crew)) fail('s3 run: the crew is not repeatable');
    const plain = R.start('flow', crew, newMeta()), buffed = R.start('flow', crew, newMeta({ hp: 2, bw: 1, stash: 2, reroll: 1 }));
    if (plain.squad.length !== 3 || plain.squad.some((m) => !D.weapons[m.weapon] || !D.gadgets[m.gadget.id] || (!D.jobFx[m.job] && !S3.ops.templateOf(m.p)) || m.hp <= 0)) fail('s3 run: a member starts without a full kit');
    if (buffed.squad[0].hp !== plain.squad[0].hp + 16 || buffed.data !== 50 || buffed.rerolls !== plain.rerolls + 1) fail('s3 run: permanent upgrades not applied at the start');
    if (R.statsOf(buffed, 0).st.bwMax !== R.statsOf(plain, 0).st.bwMax + 1) fail('s3 run: the bandwidth upgrade did nothing');
    for (const p of crew) for (const code of LANGS) { E.i18n.set(code); if (!E.i18n.pick(E.people.name(p))) fail('s3 run: a crew member has no name'); }
    E.i18n.set('zh-Hant');

    // 打一間：門的數量在進房間時就知道，而且和打完之後的那批門一樣多。
    const run = R.start('flow', crew, newMeta());
    if (run.options.length !== 2 || run.options.some((o) => o.type !== 'fight')) fail('s3 run: the first choice should be two fights');
    const clearRoom = (r, i = 0, hurt) => {
      const spec = R.enter(r, i);
      const st = sim.createRoom(spec, R.simBuild(r), R.carry(r));
      if (hurt) hurt(st);
      for (const e of st.en.slice()) A.kill(st, e, { by: 'gun' });
      st.waves = [];
      sim.step(st, pad());
      st.cache.taken = true;
      return { spec, s: st, rw: R.finishRoom(r, st) };
    };
    let res = clearRoom(run);
    if (run.phase !== 'reward' || !res.rw) fail('s3 run: no reward after a room');
    const before = JSON.stringify(run.build.exploits);
    if (res.rw.picks) { R.take(run, res.rw.picks[0]); if (res.rw.kind === 'exploit' && JSON.stringify(run.build.exploits) === before) fail('s3 run: the exploit was not added'); } else R.take(run, null);
    R.advance(run);
    if (run.options.length !== res.spec.doors.length) fail(`s3 run: the room had ${res.spec.doors.length} doors but ${run.options.length} choices followed`);
    if (run.depth !== 1 || run.roomNo !== 1) fail('s3 run: depth or room count wrong after one room');
    // 存檔再讀回來，接下來的門和房間都一樣。
    const copy = JSON.parse(JSON.stringify(run));
    if (JSON.stringify(R.enter(copy, 0)) !== JSON.stringify(R.enter(run, 0))) fail('s3 run: a saved run continues differently');

    // 每一種獎勵都領得到；治療是全隊的。
    for (const kind of ['exploit', 'gadget', 'data', 'heal', 'max']) {
      const r = R.start('rw-' + kind, crew, newMeta());
      r.options = [{ type: 'fight', reward: kind, mod: null }];
      r.squad.forEach((m) => { m.hp = 20; });
      const out = clearRoom(r);
      const data = r.data, hp = r.squad.map((m) => m.hp), top = r.squad.map((m, i) => R.maxHp(r, i)), gear = JSON.stringify([r.gear, r.squad.map((m) => m.gadget)]);
      if (out.rw.kind !== kind) fail(`s3 run: asked for ${kind}, got ${out.rw.kind}`);
      R.take(r, out.rw.picks ? out.rw.picks[0] : null);
      if (kind === 'data' && !(r.data > data)) fail('s3 run: data reward gave nothing');
      if (kind === 'heal' && !r.squad.every((m, i) => m.hp > hp[i])) fail('s3 run: healing should reach the whole squad');
      if (kind === 'max' && !r.squad.every((m, i) => R.maxHp(r, i) === top[i] + 12)) fail('s3 run: max health reward gave nothing');
      if (kind === 'gadget' && JSON.stringify([r.gear, r.squad.map((m) => m.gadget)]) === gear) fail('s3 run: gadget reward gave nothing');
      if (r.phase !== 'doors') fail('s3 run: after a reward the doors should open');
    }
    // 裝備：隊上已經有的會升級（最多 3 級）；沒有的放進共用的那一格。
    {
      const r = R.start('gad', crew, newMeta());
      const mine = r.squad[1].gadget.id, other = Object.keys(D.gadgets).find((g) => !r.squad.some((m) => m.gadget.id === g));
      R.addGadget(r, mine); R.addGadget(r, mine); R.addGadget(r, mine);
      if (r.squad[1].gadget.lv !== 3 || r.gear) fail('s3 run: a member\'s own gadget should level up to 3');
      R.addGadget(r, other);
      if (!r.gear || r.gear.id !== other || R.buildOf(r, 0).gadgets.length !== 2) fail('s3 run: a new gadget should go to the shared slot');
      R.addGadget(r, other);
      if (r.gear.lv !== 2) fail('s3 run: the shared gadget should level up');
    }
    {
      const peers=S3.ops.colleagues.spy.map(d=>S3.ops.colleague(d)).filter(p=>p.template==='spotter');
      const r=R.start('two-spotters',[...peers,crew[0]],newMeta());r.squad[0].gadget.lv=3;
      r.rerolls=40;r.pending={kind:'gadget',picks:[]};
      while(!r.pending.picks.includes('strike') && r.rerolls)R.reroll(r);
      if(!r.pending.picks.includes('strike') || R.gadgetOwner(r,'strike').i!==1)fail('s3 gadget: a capped mortar hid the other spotter');
      R.take(r,'strike');
      if(r.squad[0].gadget.lv!==3 || r.squad[1].gadget.lv!==2 || r.gear)fail('s3 gadget: upgrading a second mortar replaced a different slot');
    }
    // 有人倒下：下一間還是打得下去，全倒才結束。
    {
      const r = R.start('down', crew, newMeta());
      // 一定打得倒：先拿掉無敵、謹慎的那一下，還有接應撤離。
      const drop = (st) => { st.p.inv = 0; st.p.guard = 0; st.team.forEach((m) => { m.escaped = true; m.guard = 0; }); A.hitPlayer(st, 999); };
      let out = clearRoom(r, 0, drop);
      if (!out.rw || !r.squad[0].down || r.active === 0 || r.stats.captured !== 1) fail('s3 run: one capture should not end the run');
      R.take(r, out.rw.picks ? out.rw.picks[0] : null);
      R.advance(r);
      const spec = R.enter(r, 0), st = sim.createRoom(spec, R.simBuild(r), R.carry(r));
      if (st.active === 0 || !st.team[0].down) fail('s3 run: the captured member came back');
      for (let i = 0; i < 3 && !st.over; i++) { for (let k = 0; k < 150; k++) sim.step(st, pad()); drop(st); }
      if (R.finishRoom(r, st) !== null || r.phase !== 'dead') fail('s3 run: the run should end when the whole squad is down');
    }
    // 黑市、安全屋。
    {
      const r = R.start('shop', crew, newMeta());
      r.options = [{ type: 'shop' }];
      r.data = 900; r.squad.forEach((m) => { m.hp = 10; });
      R.enter(r, 0);
      if (r.phase !== 'shop' || r.shop.items.length < 4) fail('s3 run: the black market is empty');
      r.shop.items.forEach((it, i) => {
        const data = r.data;
        if (!R.buy(r, i) || r.data !== data - it.price || !it.sold) fail(`s3 run: could not buy ${it.k} ${it.id || ''}`);
        if (R.buy(r, i)) fail('s3 run: bought the same thing twice');
      });
      if (!r.squad.every((m) => m.hp > 10)) fail('s3 run: the medkit should treat the whole squad');
      r.data = 0;
      if (R.restock(r)) fail('s3 run: restocked with no data');
      for (const choice of ['rest', 'train', 'tune']) {
        const q = R.start('safe-' + choice, crew, newMeta());
        q.options = [{ type: 'safe' }];
        q.squad.forEach((m) => { m.hp = 10; });
        R.enter(q, 0);
        const bwMax = R.statsOf(q, 0).st.bwMax;
        R.safe(q, choice);
        if (choice === 'rest' && !q.squad.every((m) => m.hp > 10)) fail('s3 run: rest did nothing');
        if (choice === 'train' && R.statsOf(q, 0).st.bwMax !== bwMax + 1) fail('s3 run: adding bandwidth did nothing');
        if (choice === 'tune') {
          if (q.phase !== 'reward' || q.pending.picks.some((id) => R.exploitDef(id).rar === 'c')) fail('s3 run: tuning should offer uncommon or better');
          R.take(q, q.pending.picks[0]);
        }
        if (q.phase !== 'done') fail(`s3 run: safe room ${choice} did not finish`);
      }
    }
    // 事件：每個選項、每種擲骰結果都走得到，文字存在，效果有發生。
    for (const def of D.events) def.choices.forEach((c, i) => {
      const wantKeys = new Set(c.roll ? c.roll.map((r) => `s3.ev.${def.id}.r${i}.${r[2]}`) : [`s3.ev.${def.id}.r${i}`]);
      const got = new Set();
      for (let n = 0; n < 60 && got.size < wantKeys.size; n++) {
        const r = R.start('ev-' + def.id, crew, newMeta());
        r.phase = 'event';
        r.event = { id: def.id, result: null };
        r.data = 100; r.squad.forEach((m) => { m.hp = 50; }); r.rng = 1000 + n * 7919;
        r.build.exploits.hollow = 1; r.build.exploits.fiber = 1;
        const snap = () => JSON.stringify([r.data, r.squad.map((m) => [m.hp, m.gadget, m.p.imprints]), r.build, r.gear, r.rerolls, r.curse, r.pending]);
        const was = snap();
        const out = R.choose(r, i);
        if (!out) { fail(`s3 event ${def.id}: choice ${i} refused`); break; }
        got.add(out.key);
        if (page.tables['zh-Hant'][out.key] === undefined) fail(`s3 event ${def.id}: no text for ${out.key}`);
        const fx = c.roll ? c.roll.find((x) => out.key.endsWith('.' + x[2]))[1] : c.fx;
        if ((Object.keys(fx).length || c.cost) && snap() === was) fail(`s3 event ${def.id}: ${out.key} changed nothing`);
        if (r.phase === 'reward') R.take(r, r.pending.picks[0]);
        if (r.phase !== 'done') fail(`s3 event ${def.id}: did not finish (${r.phase})`);
        r.squad.forEach((m, k) => { if (m.hp < 1 || m.hp > R.maxHp(r, k)) fail(`s3 event ${def.id}: health ${m.hp} out of range`); });
      }
      for (const k of wantKeys) if (!got.has(k)) fail(`s3 event ${def.id}: ${k} never happens`);
    });
    {
      const r = R.start('poor', crew, newMeta());
      r.phase = 'event'; r.event = { id: 'vending', result: null }; r.data = 0;
      if (R.canChoose(r, 0) || R.choose(r, 0)) fail('s3 event: paid for the vending machine with no data');
    }
    console.log(`a crew of three, permanent upgrades, rooms and doors, saving, all rewards, gadgets, captures, black market, safe room, ${D.events.length} encounters with every outcome`);
  }

  // ===== 名冊：招募、被捕、救人 =====
  section('第三季：名冊');
  {
    storage.clear();
    const m = R.meta();
    m.seed = 'roster';
    const joined = R.ensureRoster(m);
    if (joined.length !== 4 || m.roster.length !== 4 || m.roster.some((x) => x.status !== 'ready')) fail('s3 roster: a new save should start with four people');
    if (R.ensureRoster(m).length) fail('s3 roster: people were added when nobody was needed');
    const vols = R.volunteers(m);
    if (vols.length !== 2 || vols.some((p) => m.roster.some((x) => x.p.id === p.id && x.p.district === p.district))) fail('s3 roster: volunteers should be two new people');
    if (R.recruit(m, 0)) fail('s3 roster: recruited with no echoes');
    m.echoes = 10;
    if (!R.recruit(m, 0) || m.roster.length !== 5 || m.echoes !== 10 - R.RECRUIT_COST) fail('s3 roster: recruiting a volunteer failed');
    if (JSON.stringify(R.volunteers(m)) === JSON.stringify(vols)) fail('s3 roster: the volunteers should change after recruiting');
    // 一趟打輸：倒下的人被關；下一趟到拘留室把人救出來。
    const squad = m.roster.slice(0, 3).map((x) => x.p);
    const run = R.start('night-1', squad, m);
    run.squad[0].down = true; run.squad[0].hp = 0;
    run.squad[1].down = true; run.squad[1].hp = 0;
    run.squad[2].down = true; run.squad[2].hp = 0;
    run.stats.rooms = 4; run.stats.bosses = 0; run.roomNo = 5;
    const end = R.finish(run, false, m);
    if (end.captured.length !== 3 || m.roster.filter((x) => x.status === 'held').length !== 3 || end.earned !== 4) fail('s3 roster: the captured squad was not recorded');
    const fresh = R.ensureRoster(m);
    if (m.roster.filter((x) => x.status === 'ready').length < 3 || !fresh.length) fail('s3 roster: there should always be three people ready');
    const next = R.start('night-2', m.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p), m);
    if (next.held !== 3) fail('s3 roster: the run should know how many people are held');
    // 有人被關：每個區段到第四間前一定看得到拘留室。
    let sawCells = false;
    for (let d = 1; d <= 3 && !sawCells; d++) { next.depth = d; next.roomNo = d; sawCells = R.route(next).some((o) => o.type === 'cells'); }
    if (!sawCells) fail('s3 roster: no holding cells offered while people are held');
    next.options = [{ type: 'cells', reward: 'rescue', mod: null }];
    const spec = R.enter(next, 0);
    if (!spec.cells || !spec.enemies.some((e) => e.elite)) fail('s3 roster: the holding cells should be guarded by elites');
    const st = sim.createRoom(spec, R.simBuild(next), R.carry(next));
    st.p.inv = 0; st.p.guard = 0; st.team.forEach((t) => { t.escaped = true; }); // 剛進房間有一小段無敵；謹慎和接應撤離也先拿掉
    A.hitPlayer(st, 999);
    for (const e of st.en.slice()) A.kill(st, e, { by: 'gun' });
    st.waves = [];
    sim.step(st, pad());
    st.cache.taken = true;
    const rw = R.finishRoom(next, st);
    if (!rw || rw.kind !== 'rescue') fail('s3 roster: the holding cells should end in a rescue');
    const lost = next.squad[0].p;
    const saved = R.rescue(next, m);
    if (!saved || !saved.known || !saved.joined || next.squad[0].down || next.squad[0].p.id !== saved.p.id) fail('s3 roster: the rescued teammate should take the empty place in the squad');
    if (m.roster.filter((x) => x.status === 'held').length !== 2 || m.rescued !== 1 || next.phase !== 'doors') fail('s3 roster: the rescue was not recorded');
    // 被換下來的人還是被抓走了。
    const end2 = R.finish(next, false, m);
    if (!end2.captured.some((p) => p.id === lost.id) || m.roster.find((x) => x.p.id === lost.id && x.p.district === lost.district).status !== 'held') fail('s3 roster: the replaced member should be recorded as captured');
    // 沒有人被關的時候，拘留室救出來的是願意加入的陌生人。
    const m2 = R.meta();
    m2.seed = 'roster2'; m2.roster = []; m2.rescued = 0;
    R.ensureRoster(m2);
    const r3 = R.start('night-3', m2.roster.slice(0, 3).map((x) => x.p), m2);
    r3.pending = { kind: 'rescue' };
    const stranger = R.rescue(r3, m2);
    if (stranger.known || stranger.joined || m2.roster.length !== 5) fail('s3 roster: a freed stranger should join the roster');
    // 律師：到安全屋把倒下的隊友保出來，一趟一次。
    const law = R.start('bail', squad, newMeta());
    law.squad[0].job = 'bail';
    law.squad[1].down = true; law.squad[1].hp = 0;
    law.options = [{ type: 'safe' }];
    R.enter(law, 0);
    if (law.squad[1].down || !(law.squad[1].hp > 0) || !law.bailUsed) fail('s3 roster: the lawyer did not bail the teammate out');
    law.squad[2].down = true;
    if (R.bail(law)) fail('s3 roster: bail worked twice');
    // 打通：所有被關的人都放出來。
    const win = R.start('night-4', m.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p), m);
    win.stats.rooms = 17; win.stats.bosses = 3;
    const end3 = R.finish(win, true, m);
    if (m.roster.some((x) => x.status === 'held') || !(end3.freed > 0) || m.wins !== 1) fail('s3 roster: winning should free everyone');
    // 打完《宵禁》（盟友帶來的結局）：那一輪的隊伍跟過來，還在的人進名冊、被抓走的人關在基石；過世的人不會來。
    // 時間到、全滅不算；同一輪只接一次；名冊有上限。
    storage.clear();
    const curfewCrew = ['camden', 'soho', 'rotherhithe', 'westminster', 'isle_of_dogs', 'camden'].map((d, i) => E.people.generate('curfew-ci', d, i));
    const curfewSave = (ended, seed) => storage.set('watchdogs-echo.s2.proto', JSON.stringify({ v: 6, data: { seed, ended, roster: { members: curfewCrew.map((p, i) => ({ person: p, status: ['active', 'injured', 'network', 'arrested', 'lost', 'dead'][i] })) } } }));
    const mc = R.meta();
    mc.seed = 'carry';
    curfewSave('curfew', 'c1');
    if (R.inherit(mc)) fail('s3 carry: a curfew that ran out of time should not bring its crew over');
    curfewSave('deal', 'c1');
    const carried = R.inherit(mc);
    if (!carried || carried.ready.length !== 3 || carried.held.length !== 2 || mc.roster.filter((x) => x.veteran).length !== 5 || mc.roster.filter((x) => x.status === 'held').length !== 2) fail('s3 carry: the Curfew crew did not come over as expected');
    if (R.inherit(mc)) fail('s3 carry: the same Curfew crew came over twice');
    if (R.meta().campaign !== 'active') fail('s3 carry: saved veterans must be resumable');
    R.ensureRoster(mc);
    const vetRun = R.start('vet-night', mc.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p), mc);
    if (vetRun.held !== 2) fail('s3 carry: held veterans should send the squad to the holding cells');
    while (mc.roster.length < R.rosterMax(mc)) mc.roster.push({ p: E.people.generate('filler', 'soho', 100 + mc.roster.length), status: 'ready', runs: 0 });
    const others = curfewCrew.map((p, i) => E.people.generate('curfew-ci-2', p.district, i));
    storage.set('watchdogs-echo.s2.proto', JSON.stringify({ v: 6, data: { seed: 'c2', ended: 'dawn', roster: { members: others.map((p) => ({ person: p, status: 'active' })) } } }));
    R.inherit(mc);
    if (mc.roster.length > R.rosterMax(mc)) fail('s3 carry: the carry-over went past the roster limit');

    // 永久強化：殘響夠才買得到，買滿就不能再買。
    storage.clear();
    const m3 = R.meta();
    if (R.buyPerk(m3, 'hp')) fail('s3 meta: bought an upgrade with no echoes');
    m3.echoes = 100;
    for (let i = 0; i < 3; i++) if (!R.buyPerk(m3, 'hp')) fail('s3 meta: could not buy an upgrade');
    if (R.buyPerk(m3, 'hp') || R.perkLv(R.meta(), 'hp') !== 3 || R.meta().echoes !== 100 - 6 - 10 - 15) fail('s3 meta: upgrade levels or cost wrong');
    storage.set('watchdogs-echo.s3.meta', JSON.stringify({ v: 1, data: { echoes: 7, perks: { hp: 1 } } }));
    const old = R.meta();
    if (old.echoes !== 7 || !Array.isArray(old.roster) || old.perks.hp !== 1) fail('s3 meta: an older save did not migrate');
    storage.clear();
    console.log('four people to start, volunteers, captures recorded, holding cells and rescues, strangers joining, bail, everyone freed on a win, the Curfew crew carried over, older saves');
  }

  section('第三季：開局、重開、全名冊被捕');
  {
    storage.clear();
    const CURFEW = 'watchdogs-echo.s2.proto', META = 'watchdogs-echo.s3.meta', RUN = 'watchdogs-echo.s3.run';
    const put = (key, v, data) => storage.set(key, JSON.stringify({ v, data }));
    const json = JSON.stringify, ready = (m) => m.roster.filter((x) => x.status === 'ready');
    const squad = (m) => ready(m).slice(0, R.SQUAD).map((x) => x.p);
    const down = (r) => r.squad.forEach((x) => { x.down = true; x.hp = 0; });
    const from = (ended, members) => put(CURFEW, 6, { seed: 'curfew', ended, roster: { members } });
    const members = ['lost', 'network', 'active', 'dead', 'injured', 'arrested', 'away', 'injured', 'lost', 'arrested', 'active', 'active']
      .map((status, i) => ({ status, person: E.people.generate('old-crew', 'soho', 70 + i) }));
    const freshFields = (m) => !m.echoes && !m.runs && !m.wins && !m.best && !m.vol && !m.rescued && !m.squad &&
      json(m.perks) === '{}' && json(m.story) === '{}' && json(m.seen) === '{}' && json(m.unlocks) === '{"jobs":[],"events":[]}';
    if (R.inheritance().reason !== 'missing' || R.newGame('inherit', 'none') || storage.size) fail('s3 campaign: missing save was accepted or modified');
    from('dawn', members);
    const prevSource = storage.get(CURFEW);
    const curfewOnly = R.newGame('inherit', 'curfew-only').meta;
    if (S3.omni.connect('too-early', squad(curfewOnly), curfewOnly)) fail('s3 campaign: a Curfew victory alone opened OMNI');
    // 含同名候選人的種子：直接比《宵禁》真正的開場名單，而不只比職業分類。
    const N = sandbox(['js/engine/rng.js', 'js/engine/people.js', 'content-s2/people.js', 'js/engine/roster.js', 'js/engine/night.js']).E.night;
    for (const seed of ['zero-day', 'camden-ci-30', 'whitehall']) {
      const city = N.create(seed, { skipStory: true }), people = city.volunteers.map((id) => city.people[id]);
      const { meta: m, vets } = R.newGame('random', seed);
      if (vets || m.imported || m.roster.length !== 4 || ready(m).length !== 4 || m.roster.some((x) => x.veteran) || json(m.roster.map((x) => x.p)) !== json(people))
        fail('s3 campaign: random opening differs from Curfew or inherited automatically: ' + seed);
      const loaded = R.meta(); R.ensureRoster(loaded);
      if (json(loaded) !== json(m) || storage.get(CURFEW) !== prevSource) fail('s3 campaign: visiting the safehouse changed the crew or the Curfew source');
    }
    if (/\bR\.inherit\s*\(/.test(fs.readFileSync(path.join(root, 'js/s3/main.js'), 'utf8'))) fail('s3 campaign: UI merged the Curfew save outside the chosen new-game source');
    const prev = R.meta();
    Object.assign(prev, { echoes: 40, perks: { hp: 2 }, runs: 8, wins: 2, best: 17, rescued: 3, vol: 5, squad: ['old'],
      endings: { return: 1 }, story: { ended: 'return' }, seen: { hack: 1 }, unlocks: { jobs: ['fixture-job'], events: ['fixture-event'] } });
    R.saveMeta(prev); R.save(R.start('interrupted', squad(prev), prev));
    const savedMeta = storage.get(META), savedRun = storage.get(RUN);
    for (const ended of [null, 'curfew', 'wiped']) {
      from(ended, members);
      if (R.inheritance().reason !== 'unfinished' || R.newGame('inherit', 'nope')) fail('s3 campaign: incomplete Curfew save was accepted');
    }
    put(CURFEW, 6, { ended: 'deal' });
    if (R.inheritance().reason !== 'unreadable' || R.newGame('inherit', 'nope')) fail('s3 campaign: missing Curfew roster was accepted');
    const memberIds = (list) => list.map((p) => p.id).join(',');
    for (const ended of ['dawn', 'cage', 'wild', 'deal']) {
      from(ended, [null, { status: 'active', person: {} }, members[2], ...members]);
      const info = R.inheritance();
      if (info.reason || memberIds(info.ready) !== memberIds([2, 10, 11, 4, 7].map((i) => members[i].person)) ||
        memberIds(info.held) !== memberIds([5, 9, 0].map((i) => members[i].person))) fail('s3 campaign: preview priority, duplicates or limits: ' + ended);
    }
    if (storage.get(META) !== savedMeta || storage.get(RUN) !== savedRun) fail('s3 campaign: preview or failed inheritance discarded existing progress');
    const src = storage.get(CURFEW), plan = R.inheritance(), replaced = R.newGame('inherit', 'new-seed').meta;
    if (!freshFields(replaced) || !replaced.endings.return || replaced.roster.length !== 8 || !replaced.roster.every((x) => x.veteran) ||
      memberIds(replaced.roster.map((x) => x.p)) !== memberIds(plan.ready.concat(plan.held)) || R.load() || storage.get(CURFEW) !== src)
      fail('s3 campaign: confirmed restart did not replace only the campaign or did not honour the preview');
    // 舊老兵即使全在拘留室，也不會因為開啟舊存檔而回溯判定全滅。
    const legacy = Object.assign({}, prev, { imported: 'curfew:dawn', roster: replaced.roster.map((x) => Object.assign({}, x, { status: 'held', runs: 5 })) });
    delete legacy.campaign; delete legacy.unlocks;
    put(META, 3, legacy); storage.set(RUN, savedRun);
    const oldBytes = storage.get(META), old = R.meta();
    if (old.campaign !== 'active' || json(old.roster) !== json(legacy.roster) || old.wins !== 2 || old.echoes !== 40 || old.imported !== legacy.imported ||
      old.perks.hp !== 2 || !old.endings.return || old.unlocks.jobs.length || old.unlocks.events.length || !R.load() || storage.get(META) !== oldBytes)
      fail('s3 campaign: legacy veterans/progress changed on read');
    if (R.ensureRoster(old).length !== 3 || old.roster.filter((x) => x.veteran && x.status === 'held').length !== 8) fail('s3 campaign: a legacy all-held roster could not resume');
    const captive = E.people.generate('fill', 'camden', 1000);
    from('cage', [{ status: 'arrested', person: captive }]);
    const m = R.newGame('inherit', 'fill').meta;
    if (m.roster.length !== 4 || ready(m).length !== 3 || !m.roster[0].veteran || m.roster[0].status !== 'held' ||
      ready(m).some((x) => x.veteran || x.p.rare || x.p.district !== 'camden' || x.p.id === captive.id)) fail('s3 campaign: no deployable squad alongside the imported prisoner');
    let r = R.start('before-first-win', squad(m), m); down(r); r.stats.rooms = 2;
    const first = R.finish(r, false, m);
    if (first.wiped || first.meta.echoes !== 2 || ready(m).length || R.ensureRoster(m).length !== 3) fail('s3 wipe: total capture before a first win must allow replacements');
    r = R.start('win', squad(m), m); const victory = R.finish(r, true, m);
    if (victory.wiped || victory.freed !== 4 || m.wins !== 1 || ready(m).length !== 7) fail('s3 wipe: victory should free the holding cells');
    r = R.start('squad-not-roster', squad(m), m); down(r);
    if (R.finish(r, false, m).wiped || ready(m).length !== 4) fail('s3 wipe: three lost with reserves must not wipe');
    r = R.start('retreat', squad(m), m); r.squad[0].down = true;
    if (R.finish(r, false, m).wiped || ready(m).length !== 3) fail('s3 wipe: surviving operatives must return from retreat');
    // 本輪最後三人，又在拘留室中換下一個人：結算必須先處理 run.lost，再檢查整份名冊。
    r = R.start('last-squad', squad(m), m); r.squad[0].down = true; r.pending = { kind: 'rescue' };
    if (!R.rescue(r, m).joined) fail('s3 wipe: rescue setup did not replace the captured operative');
    Object.assign(m, { perks: { hp: 2 }, unlocks: { jobs: ['fixture-job'], events: ['fixture-event'] }, seen: { hack: 1 }, story: { intro: 1 },
      squad: ['last'], echoes: 50, endings: { return: 1, open: 1 } });
    R.saveMeta(m); R.save(r); down(r);
    const end = R.finish(r, false, m), closed = R.meta();
    if (!end.wiped || end.captured.length !== 4 || end.earned || closed.campaign !== 'wiped' || !freshFields(closed) || closed.seed || closed.imported ||
      closed.roster.length || R.ensureRoster(closed).length || R.inherit(closed) || R.load() || json(closed.endings) !== '{"return":1,"open":1,"wipe":1}')
      fail('s3 wipe: terminal save retained campaign progress, refilled prisoners, or dropped an ending');
    const again = R.newGame('inherit', 'another-night').meta;
    if (again.campaign !== 'active' || !freshFields(again) || !again.endings.wipe || !again.roster[0].veteran || ready(again).length !== 3)
      fail('s3 wipe: could not pick the same Curfew crew for a fresh campaign');
    r = R.start('first-again', squad(again), again); down(r);
    if (R.finish(r, false, again).wiped) fail('s3 wipe: remembered endings must not remove first-win protection');
    from('dawn', []);
    const empty = R.newGame('inherit', 'empty-source').meta;
    if (ready(empty).length !== 3 || empty.roster.some((x) => x.veteran)) fail('s3 carry: a completed empty roster must still supply a squad');
    empty.roster = []; empty.wins = 1;
    if (R.finish(R.start('no-roster', R.crewFor('no-roster'), empty), false, empty).wiped) fail('s3 wipe: an empty roster is not a captured roster');
    storage.clear();
    console.log('Camden opening matches Curfew, explicit import and caps, read-only previews, restart, legacy progress, full-roster loss after victory, rescue replacements, endings and fresh unlocks');
  }

  section('第三季：無人機與裝備存檔');
  {
    const gad = (id, lv = 1) => ({ id, lv });
    const deploy = (s, x, y, shared = false) => sim.step(s, pad({ ax: x, ay: y, [shared ? 'g2' : 'g1']: true }));
    const near = (a, b) => Math.abs(a - b) < 0.04;
    const crew = R.crewFor('kit-save'), jobs = ['builder', 'docker', 'removals'];
    for (const job of jobs) if (R.memberOf(Object.assign({}, crew[0], { occupation: job })).gadget.id !== 'cargo') fail('s3 kits: missing worker cargo: ' + job);
    const common = { hacker: ['escort', 'kamikaze'], physical: ['sledge', 'mine'], social: ['lure', 'mask'], specialist: ['spider', 'mine'] };
    for (const [k, ids] of Object.entries(common)) if (String(D.kits[k].gadget) !== String(ids)) fail('s3 kits: incorrect defaults for ' + k);
    const people = [crew[0], Object.assign({}, crew[1], { occupation: 'builder' }), Object.assign({}, crew[2], { occupation: 'locksmith' })];
    const old = R.start('kit-save', people, newMeta()); old.v = 2;
    old.squad.forEach((m, i) => { m.gadget = gad(i ? 'sergei' : 'eagle', i ? 3 : 2); });
    const roster = old.squad.map((m, i) => ({ p: m.p, status: i === 2 ? 'held' : 'ready', runs: 4, gadget: m.gadget }));
    storage.set('watchdogs-echo.s3.meta', JSON.stringify({ v: 2, data: Object.assign(newMeta(), { roster }) }));
    const migrated = R.meta(), fresh = R.start('kit-loaded', people, migrated);
    const kit = (m) => m.gadget.id + ':' + m.gadget.lv;
    const expected = 'kamikaze:2,cargo:3,mine:3';
    if (migrated.roster.map(kit).join() !== expected || fresh.squad.map(kit).join() !== expected || migrated.roster[2].status !== 'held') fail('s3 save: old roster lost its loadouts or custody status');
    for (const id of ['eagle', 'sergei']) {
      old.gear = gad(id, 2); old.phase = 'reward'; old.pending = { kind: 'gadget', picks: ['hammer', 'blackout', id] };
      old.shop = { items: [{ k: 'gadget', id: 'hammer', price: 75 }] };
      storage.set('watchdogs-echo.s3.run', JSON.stringify({ v: 2, data: old }));
      const r = R.load();
      if (r.v !== 5 || r.squad.map(kit).join() !== expected || r.gear.id !== id || r.gear.lv !== 2 || r.phase !== old.phase || r.rng !== old.rng ||
        r.pending.picks.includes('hammer') || r.pending.picks.includes('blackout') || r.shop.items[0].id !== 'sledge') fail('s3 save: own, shared or unclaimed gear migrated incorrectly');
      sim.createRoom(arena(), R.simBuild(r), R.carry(r));
      R.save(r); if (JSON.stringify(R.load()) !== JSON.stringify(r)) fail('s3 save: converted run did not round-trip');
    }
    R.saveMeta(migrated);
    if (R.meta().roster.map(kit).join() !== expected) fail('s3 save: converted roster did not round-trip');
    storage.clear();
    // 房間獎勵和商店都不能提供還沒從事件拿到的專屬裝備。
    for (let i = 0; i < 16; i++) {
      const r = R.start('cameo-stock-' + i, crew, newMeta());
      r.options = [{ type: 'shop' }]; R.enter(r, 0);
      const exclusive = (id) => D.gadgets[id].cameo || D.gadgets[id].signature;
      if (r.shop.items.some((it) => it.k === 'gadget' && exclusive(it.id))) fail('s3 kits: unearned exclusive in shop');
      r.pending = { kind: 'gadget', picks: [] }; r.rerolls = 1; R.reroll(r);
      if (r.pending.picks.some(exclusive)) fail('s3 kits: unearned exclusive in reward');
    }
    // 跟隨機：掩體後不射擊。換人、移動之後能跟上並從新位置開火；蜘蛛留在原地。
    const companion = (id) => build({ gadgets: [gad(id)] });
    let s = sim.createRoom(arena({ enemies: [{ kind: 'heavy', x: 800, y: 475 }] }), { squad: [companion('escort'), companion('spider')] });
    s.solid[A.idx(15, 12)] = s.solid[A.idx(16, 12)] = 1;
    deploy(s, 800, 475); go(s, 20);
    const pet = s.pets[0];
    if (!pet || !near(pet.t, 7 - s.t) || s.en[0].hp !== s.en[0].maxHp || s.bul.some((b) => b.by === 'ally')) fail('s3 escort: duration or line of fire behind cover');
    sim.swapTo(s, 1); deploy(s, 800, 475);
    const spider = s.pets[1], origin = spider.x;
    go(s, 70, pad({ mx: 1 }));
    if (s.active !== 1 || pet.x < origin + 160 || Math.hypot(pet.x - s.p.x, pet.y - s.p.y) > 65 || spider.x !== origin || spider.t <= pet.t) fail('s3 escort: did not follow the new operative or spider moved');
    s.en[0].x = pet.x + 170; s.en[0].y = pet.y; s.en[0].stun = 20; s.pets = [pet];
    if (!go(s, 50).includes('pshot') || s.en[0].hp >= s.en[0].maxHp) fail('s3 escort: no effective fire on a visible enemy');
    go(s, 330); if (s.pets.length) fail('s3 escort: remained after battery expired');

    s = room({ enemies: [{ kind: 'heavy', x: 800, y: 375 }] }, { gadgets: [gad('kamikaze')] });
    deploy(s, 800, 375); const target = s.en[0];
    if (target.hp !== target.maxHp || !s.zones.some((z) => z.k === 'kamikaze')) fail('s3 kamikaze: no flight before impact');
    if (!go(s, 31).includes('shock') || target.hp >= target.maxHp || target.stun < 2 || s.recon) fail('s3 kamikaze: no impact damage or shock');

    const guard = { kind: 'heavy', x: 810, y: 380 };
    s = room({ enemies: [guard] }, { gadgets: [gad('cargo')] }); deploy(s, 810, 380); go(s, 43);
    const crate = s.props.find((p) => p.kind === 'crate');
    if (!crate || !near(crate.temp, 10) || A.solidAt(s, crate.x, crate.y) !== 3 || !s.en[0] || s.en[0].hp >= s.en[0].maxHp || s.en[0].confused) fail('s3 cargo: missing impact, ordinary cover or clean targeting');

    // 偵查機在真正到達前不能引爆。牆後也能標記，噪音的目的地不是玩家；偵查本身沒有傷害。
    const arenaRecon = arena({ enemies: [{ kind: 'guard', x: 980, y: 370 }], props: [{ kind: 'camera', tx: 16, ty: 6, w: 1, h: 1, dir: 1 }] });
    arenaRecon.tiles[A.idx(18, 7)] = 1;
    const withEagle = () => build({ gadgets: [gad('mine'), gad('eagle')] });
    s = sim.createRoom(arenaRecon, { squad: [withEagle(), withEagle()] });
    s.p.cloak = 20;
    deploy(s, 800, 375, true); deploy(s, 800, 375, true);
    if (!s.recon || s.recon.orbit || s.p.gad[1].cd) fail('s3 eagle: flight input exploded the scout or started cooldown early');
    const scoutGuard = s.en[0], scoutHp = scoutGuard.hp;
    const pulses = go(s, 138);
    if (!s.recon.orbit || scoutGuard.mark <= 0 || !scoutGuard.goal || scoutGuard.goal.x !== 800 || scoutGuard.goal.y !== 375 ||
      scoutGuard.hp !== scoutHp || pulses.includes('pshot') || pulses.filter(k=>k==='eagleLure').length<2 || pulses.filter((k) => k === 'noise').length < 2 || s.alert) fail('s3 eagle: did not scout and lure quietly through the wall');
    const drone = A.spawn(s, 'drone', 800, 330), jammer = A.spawn(s, 'jammer', 780, 365), ambush = A.spawn(s, 'guard', 855, 390);
    for (const e of [drone, jammer]) { e.hp = e.maxHp = 300; e.state = 'combat'; }
    sim.swapTo(s, 1); deploy(s, 800, 375, true);
    if (s.recon || !ambush.dead || !near(drone.stun, 4) || !near(jammer.stun, 1.5) || !near(s.props[0].down, 4) || A.jammed(s, jammer.x, jammer.y) ||
      s.team.some((m) => !near(m.gad[1].cd, 16)) || !s.ev.some((e) => e.k === 'shock' && S3.audio.fromEvent(e)[0]==='eaglePulse')) fail('s3 eagle: manual pulse, trap, machine outage or shared cooldown wrong');
    go(s, 100); if (jammer.stun > 0 || A.jammed(s, jammer.x, jammer.y) || s.props[0].aware) fail('s3 eagle: jammer electronics woke with the operator or camera spotted early');
    go(s, 145); if (!A.jammed(s, jammer.x, jammer.y) || s.props[0].down > 0) fail('s3 eagle: electronics did not recover');
    s = room({}, { gadgets: [gad('eagle', 2)] }); deploy(s, 2000, 775);
    if (s.recon.x !== s.p.x + 520) fail('s3 eagle: exceeded launch range');
    go(s, 504); if (!s.recon || !s.recon.orbit || s.p.gad[0].cd) fail('s3 eagle: level-two orbit ended early');
    go(s, 10); if (s.recon || !near(s.eagleCd, 12.8 - 0.05)) fail('s3 eagle: no timed detonation or wrong cooldown');

    // 先從投箱到命中，再觀察真正的敵人 AI；兩個交火目標之間放玩家，確認不會攔截干擾中的子彈。
    s = room({ enemies: [{ kind: 'turret', x: 675, y: 450 }, { kind: 'turret', x: 925, y: 450 }] }, { gadgets: [gad('sergei')] });
    s.p.cloak = 20; deploy(s, 800, 375); go(s, 43);
    const [left, right] = s.en; s.p.x = 800; s.p.y = 450;
    if (!s.props.some((p) => p.kind === 'crate') || !s.en.every((e) => e.confused > 5.9 && !e.ally && !e.call)) fail('s3 sergei: crate and scramble did not arrive together');
    go(s, 205);
    if (left.hp >= left.maxHp || right.hp >= right.maxHp || s.stats.hurt || s.alert || s.cleared) fail('s3 sergei: turrets did not trade real fire safely');
    s = room({ enemies: [{ kind: 'rusher', x: 730, y: 410 }, { kind: 'heavy', x: 920, y: 420 }] }, { gadgets: [gad('sergei')] });
    s.p.cloak = 20; deploy(s, 800, 530); go(s, 44);
    const [runner, heavy] = s.en; heavy.stun = 15;
    go(s, 120);
    if (runner.x <= 765 || heavy.hp >= heavy.maxHp || s.alert || s.stats.hurt) fail('s3 sergei: melee did not chase and damage the other enemy');
    go(s, 248); if (runner.confused > 0 || runner.call || s.alert || runner.state === 'combat') fail('s3 sergei: scrambled target did not recover to search');
    console.log('own and shared save migration, cameo sources, escort and swap, impact and cover, recon lure and manual/timed EMP, melee and machine crossfire');
  }

  section('零時差：特工邀約、高級客串與個人印記');
  {
    const ids = ['hitman', 'spy', 'drone_expert', 'hooligan', 'beekeeper', 'statue','hypnotist','anarchist','paramedic','barrister'];
    const endings = { return: 'aiden', burn: 'wrench', open: 'marcus', teach: 'darcy' };
    const contacts = Object.values(endings), ordinary = D.events.filter((e) => !e.premium);
    const crew = (m) => m.roster.filter((x) => x.status === 'ready').slice(0, 3).map((x) => x.p);
    const event = (r, id, i, m) => { r.phase = 'event'; r.event = { id, result: null }; return R.choose(r, i, m); };
    const draw = (r) => { r.options = [{ type: 'event' }]; R.enter(r, 0); return r.event.id; };
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!equal(Object.keys(S3.ops.profiles).sort(), ids.slice().sort()) || ordinary.length < 18 ||
      !equal(D.events.filter((e) => e.premium).map((e) => e.id).sort(), contacts.slice().sort())) fail('s3 contacts: incomplete pool');
    for (const id of ids) {
      const d = S3.ops.profiles[id], p = S3.ops.person(id);
      if (!equal(p, S3.ops.person(id)) || p.id !== 'elite-' + id || S3.ops.jobOf(p) !== d || !E.s2.people.districts[p.district] ||
        !['tc', 'sc', 'en'].every((k) => d.bio[k] && d.name[k] && E.people.name(p)[k]) ||
        !D.weapons[R.memberOf(p).weapon] || !D.gadgets[R.memberOf(p).gadget.id] || !S3.pictures[d.portrait]) fail('s3 fixed operative: ' + id);
    }
    const keys=new Set(),castIds=new Set(),names={tc:new Set(),sc:new Set(),en:new Set()};
    for(const id of ids){
      const kits=S3.ops.templates[id], xp=S3.ops.xp.filter(x=>x.owner===id);
      if(kits.length<2||kits.length>3||xp.length!==2||xp.some(x=>![2,3].includes(x.max)))fail('s3 kit count/ranks: '+id);
      for(const k of kits){if(keys.has(k.id)||!D.weapons[k.weapon]||!D.gadgets[k.gadget]?.signature||(!Object.keys({...k.mods,...k.flags}).length && kits.every(t=>t.gadget===k.gadget)))fail('s3 kit contract: '+k.id);keys.add(k.id);}
      const lead=S3.ops.person(id,'first'),defs=S3.ops.colleagues[id], people=defs.map(d=>S3.ops.colleague(d));
      if(!equal(lead,S3.ops.person(id,'another-save')) || defs.map(d=>d.slot).join('')!=='abcd' ||
        kits.some(k=>people.filter(p=>p.template===k.id).length!==2 || people.filter(p=>p.template===k.id && !p.flaw).length!==1) ||
        new Set(people.map(p=>p.traits.join()+'|'+p.quirks.join())).size!==4)fail('s3 fixed cast/kit distribution: '+id);
      for(const p of [lead,...people]){
        const k=S3.ops.templateOf(p), m=R.memberOf(p), q=E.people.quirksOf(p);
        if(castIds.has(p.id) || !k || m.weapon!==k.weapon || m.gadget.id!==k.gadget || new Set(p.traits).size!==2 || new Set(p.quirks).size!==2 ||
          !E.people.traitsOf(p).every(Boolean) || !E.people.flawOf(p) || !q.every(Boolean) || q[0]?.rival===q[1]?.id)fail('s3 cast data: '+p.id);
        castIds.add(p.id);
        for(const [lang,seen] of Object.entries(names)){
          const n=E.people.name(p)[lang];if(!n || seen.has(n))fail('s3 cast name: '+p.id+'/'+lang);seen.add(n);
        }
      }
      for(const def of defs){
        const p=S3.ops.colleague(def);p.traits.pop();p.quirks.pop();p.fixedName.en='changed';
        const saved=JSON.parse(JSON.stringify(S3.ops.colleague(def))), parts=S3.portraits.partsOf(saved);
        const key=S3.ops.profiles[id].portrait.replace('pt-elite-','pt-recruit-')+'-'+def.slot;
        if(saved.traits.length!==2 || saved.quirks.length!==2 || saved.fixedName.en==='changed' || S3.ops.colleagueOf(saved)!==def ||
          def.portrait!==key || S3.ops.lookOf(saved)!==def.look || parts.skin!==def.look.skin || parts.hair!=='hair-'+def.look.style ||
          parts.cloth!==def.look.o.col || S3.pictures[key]!=='assets/s3/'+key+'.jpg' || !fs.existsSync(path.join(root,S3.pictures[key])))fail('s3 published cast/portrait slot: '+def.id);
      }
      const picture=S3.pictures[S3.ops.profiles[id].portrait];
      if(!picture||!fs.existsSync(path.join(root,picture)))fail('s3 missing portrait: '+id);
    }
    for(const [job,rows] of Object.entries(S3.casting.retired))for(const row of rows){
      const old=S3.ops.colleagueOf({id:'peer-'+job+'-'+row.slot}), pathOld=S3.pictures[old?.portrait];
      if(!old?.retired || castIds.has(old.id) || S3.ops.colleagues[job].includes(old) || !pathOld || !fs.existsSync(path.join(root,pathOld)))fail('s3 retired identity/print: '+job+' '+row.slot);
    }
    const ada={...S3.ops.colleague(S3.ops.colleagues.beekeeper[0]),age:27};
    if(S3.ops.ageOf(ada)!==68 || !S3.portraits.partsOf(ada).face.startsWith('face-o-') || ada.age!==27)fail('s3 printed age vs original save seed');
    const support=S3.atlas.support, data=fs.readFileSync(path.join(root,support.src));
    for(const id of ['medbeacon','shockdrone','shockdrone-zap']){const v=support.items[id];
      if(!v || v.x+v.w>data.readUInt32BE(16) || v.y+v.h>data.readUInt32BE(20) || v.r<=0)fail('s3 support atlas: '+id);}
    // No image/pixel reads: a broken atlas should draw the beacon cross and four rotors on the real render path.
    {
      const test=sandbox([...scripts,'js/ui/art.js','js/s3/render.js']),S=test.E.s3, paints=new Set();
      const pen=new Proxy({createRadialGradient:()=>({addColorStop(){}}),measureText:()=>({width:20})},{
        get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>{if(k==='fillStyle')paints.add(v);o[k]=v;return true;}});
      const cv={style:{},closest:()=>({getBoundingClientRect:()=>({width:960,height:540})}),getContext:()=>pen};
      test.ctx.document.createElement=()=>cv;S.assets={img:p=>({src:p,complete:true,naturalWidth:0,addEventListener(){}}),url:p=>p};
      S.render.init(cv);
      const f=S.sim.createRoom(arena({enemies:[{kind:'guard',x:800,y:600}]}),build());
      f.installations.push({kind:'ward',x:700,y:600,r:115});f.shockDrone={x:800,y:570,ang:0,flash:.1};
      S.render.draw(f,{});if(!paints.has('#e6fff4') || !paints.has('#929fa6'))fail('s3 support objects disappear without atlas');
      for(const id of ['hypnotist','anarchist','paramedic','barrister'])if(!S.portraits.face(S.ops.person(id)).includes('<svg'))fail('s3 failed elite portrait has no fallback: '+id);
      const peers=S.ops.colleagues.hitman, p=S.ops.colleague(peers[0]), other=S.ops.colleague(peers[1]), key=peers[0].portrait;
      delete S.pictures[key];
      if(!S.portraits.face(p).includes(peers[0].look.skin) || !S.portraits.face(other).includes(peers[1].look.skin))fail('s3 missing print must keep own face');
      S.pictures[key]='assets/s3/test-cast-a.jpg';
      if(!S.portraits.face(p,{round:true}).includes(S.pictures[key]) || S.portraits.face(other).includes(S.pictures[key]))fail('s3 print registered to the wrong person');
    }
    for(const source of ['elite-2','drones-2'])if(fs.existsSync(path.join(root,'assets/s3',source+'.jpg')))fail('unintended unsliced panel: '+source);
    {
      const p0=E.people.generate('street','soho',77), street={...p0,occupation:'actor',rare:false},found=new Map();let n=0;
      for(let i=0;i<10240;i++){const p=S3.ops.street('corner-'+i,street);if(!p.signal)continue;n++;
        if(p.elite||p.flaw || !equal(S3.ops.street('corner-'+i,street),p) || !E.people.traitsOf(p).every(Boolean) || !E.people.quirksOf(p).every(Boolean) ||
           p.traits.length!==2 || R.memberOf(p).job!==E.people.occupationOf(p).perk || S3.portraits.partsOf(p).cloth!==S3.ops.lookOf(p).o.col)fail('s3 street alias '+p.signal);
        if(found.has(p.signal)&&!equal(found.get(p.signal),S3.portraits.partsOf(p)))fail('s3 changing signature');found.set(p.signal,S3.portraits.partsOf(p));}
      if(found.size!==3 || n<16 || n>68)fail('s3 street frequency '+n+'/10240');
      const pilot={...p0,occupation:'drone_op'}, prev={...S3.ops.person('statue'),traits:[],quirks:[]};delete prev.template;
      const oldMeta={...newMeta(),roster:[{p:pilot,status:'held',runs:3,gadget:{id:'escort',lv:2}},{p:prev,status:'ready',runs:8}],invitations:['spy']};
      const old=R.start('migration',[pilot,prev,street],newMeta());old.v=4;old.squad[0].p=pilot;old.squad[1].p=prev;old.squad[0].hp=13;old.squad[1].gadget={id:'hypnosis',lv:2};old.phase='reward';old.pending={kind:'gadget',picks:['hypnosis','cargo']};
      storage.set('watchdogs-echo.s3.meta',JSON.stringify({v:4,data:oldMeta}));storage.set('watchdogs-echo.s3.run',JSON.stringify({v:4,data:old}));
      const m=R.meta(),r=R.load(),p=m.roster[0].p;
      if(!equal(p,r.squad[0].p)||p.id!==pilot.id||p.occupation!=='drone_op'||p.elite!=='drone_expert'||m.roster[0].status!=='held'||m.roster[0].runs!==3||
         !equal(p.traits,pilot.traits)||r.squad[0].hp!==13||r.squad[1].gadget.id!=='performance'||r.squad[1].gadget.lv!==2||r.pending.picks.join()!=='performance,cargo'||m.roster[0].gadget.lv!==2||
         !equal(R.volunteers(m)[0],R.volunteers(R.meta())[0])||!S3.ops.templateOf(m.offers.spy))fail('s3 v4 → v5 identity, invitation or equipment');
      const past={seed:'old-London',ended:'dawn',roster:{members:[{person:pilot,status:'active'}]}};
      const pastKey='watchdogs-echo.s2.proto',before=JSON.stringify({v:6,data:past});storage.set(pastKey,before);
      const imported=R.inheritance({...newMeta(),roster:[]});const cur=imported.ready?.[0];
      if(!cur || cur.elite!=='drone_expert' ||cur.id!==pilot.id || !equal(cur.quirks,pilot.quirks) || storage.get(pastKey)!==before)fail('s3 pilot inheritance');
      const pilots=new Set();
      for(let i=0;i<80;i++){const p=S3.ops.street('street-'+i,pilot),def=S3.ops.colleagueOf(p);
        if(def?.job!=='drone_expert' || !equal(p,S3.ops.colleague(def)) || p.alumnus)fail('s3 fresh pilot identity');
        pilots.add(p.id);}
      if(pilots.size!==4)fail('s3 fresh pilots must come from the same four named people');
      console.log('street signals: '+n+'/10240 eligible pedestrians; three ordinary professions; stable colours, faces and positive traits');
    }
    {
      const r=R.start('private-shelves',[S3.ops.person('spy'),S3.ops.person('hitman'),S3.ops.person('hitman')],newMeta());r.data=9999;
      const shop=()=>{r.options=[{type:'shop'}];R.enter(r,0);return r.shop.items;};
      const items=shop(), shelves=items.filter(i=>i.owner);
      if(shelves.length!==2 || new Set(shelves.map(x=>x.owner)).size!==2 || shelves.some(x=>x.rank!==1 || R.exploitDef(x.id).owner!==x.owner))fail('s3 private stock per distinct profession');
      const it=shelves[0],idx=items.indexOf(it);
      if(!R.buy(r,idx)||R.buy(r,idx)||r.build.exploits[it.id]!==1||R.addExploit(r,'triage'))fail('s3 private purchase or wrong profession');
      for(const x of S3.ops.xp.filter(x=>x.owner==='spy'))r.build.exploits[x.id]=x.max;
      R.restock(r);if(!r.shop.items.some(i=>i.owner==='spy' && i.mastered && i.sold))fail('s3 exhausted shelf still buys ranks');
    }
    storage.clear();
    let m = R.newGame('random', 'safehouse-door').meta;
    if (m.roster.some((x) => R.isInvitation(x.p)) || R.volunteers(m).some(R.isInvitation) || m.unlocks.jobs.length || m.unlocks.events.length) fail('s3 contacts: not a clean start');
    const firstRun = R.start('first-invite', crew(m), m), mirror = JSON.parse(JSON.stringify(m));
    const first = R.finish(firstRun, true, m, 'return').unlocked, id = first.job;
    if (!equal(first, R.finish(firstRun, true, mirror, 'return').unlocked) || !first.events.includes('aiden') || m.unlocks.jobs.length !== 1) fail('s3 contacts: seed or guaranteed ending');
    for (let i = 1; i <= ids.length; i++) {
      const ending = Object.keys(endings)[i % 4], before = m.unlocks.jobs.slice();
      const u = R.finish(R.start('next-' + i, crew(m), m), true, m, ending).unlocked;
      if (!m.unlocks.events.includes(endings[ending]) || !m.endings[ending] ||
        (i < ids.length ? !ids.includes(u.job) || before.includes(u.job) || m.unlocks.jobs.length !== i + 1 : u.job !== null)) fail('s3 contacts: duplicate or missing win award ' + i);
    }
    if (!equal(m.invitations, m.unlocks.jobs) || new Set(m.unlocks.events).size !== 4) fail('s3 contacts: invitation ledger');
    const flags = new Set(), awarded = new Set();
    for (let i = 0; i < 48; i++) {
      const n = R.newGame('random', 'one-win-' + i).meta, ending = Object.keys(endings)[i % 4];
      const u = R.finish(R.start('ending-sample', crew(n), n), true, n, ending).unlocked;
      if (u.events[0] !== endings[ending] || u.events.length > 2 || new Set(u.events).size !== u.events.length) fail('s3 contacts: ending or extra not distinct ' + ending);
      flags.add(u.events.length); awarded.add(u.job);
    }
    if (flags.size !== 2 || awarded.size !== ids.length) fail('s3 contacts: extra not optional or operative cannot be drawn');
    // 名冊滿時，不消耗邀請。過夜、重讀後還在；免費領取一次，普通志願者仍收費。
    while (m.roster.length < R.rosterMax(m)) m.roster.push({ p: E.people.generate('reserves', 'soho', m.roster.length), status: 'ready', runs: 0 });
    m.vol++; m.echoes = 0; R.saveMeta(m); m = R.meta();
    if (R.recruit(m, 0) || R.volunteers(m)[0].elite !== id) fail('s3 contacts: lost a full-roster invitation');
    R.dismiss(m, m.roster.length - 1);
    if (!R.recruit(m, 0) || m.echoes !== 0 || m.invitations.includes(id) || R.volunteers(m).some((p) => R.isInvitation(p) && p.elite === id)) fail('s3 contacts: free recruitment or repeat invitation');
    const operative = m.roster.find((x) => x.p.elite === id);
    const captured = R.start('captured-contact', [operative.p, ...crew(m).slice(0, 2)], m);
    captured.squad[0].down = true;
    if (R.finish(captured, false, m).wiped || operative.status !== 'held' || m.invitations.length !== ids.length-1) fail('s3 contacts: capture with reserves');
    const rescue = R.start('rescue-contact', crew(m), m); rescue.pending = { kind: 'rescue' }; rescue.squad[1].down = true;
    const freed = R.rescue(rescue, m);
    if (!freed.known || !freed.joined || freed.p.elite !== id || rescue.squad[1].p.id !== operative.p.id || operative.status !== 'ready') fail('s3 contacts: rescue changed fixed identity');
    R.dismiss(m, m.roster.indexOf(operative));
    if (R.volunteers(m).some((p) => R.isInvitation(p) && p.elite === id)) fail('s3 contacts: dismissal reissued the invitation');
    m.roster = m.roster.slice(0, 3);
    const wipe = R.start('closed-book', crew(m), m); wipe.squad.forEach((x) => { x.down = true; });
    const wiped = R.finish(wipe, false, m);
    if (!wiped.wiped || R.meta().invitations.length || R.meta().unlocks.jobs.length || R.meta().unlocks.events.length || !R.meta().endings.teach) fail('s3 contacts: wipe did not close only this campaign’s book');

    m = R.newGame('random', 'pool').meta;
    let r = R.start('pool-draw', crew(m), m);
    for (let i = 0; i < 70; i++) if (R.eventDef(draw(r)).premium) fail('s3 contacts: locked guest drawn');
    const met = new Set(); let firstDraws = 0;
    m.unlocks.events = contacts.slice();
    r = R.start('all-contacts', crew(m), m);
    for (let i = 0; i < 600; i++) {
      r.seen = []; r.rng = E.rng.hash('lobby-deck:' + i);
      const pick = draw(r);
      if (R.eventDef(pick).premium) { met.add(pick); firstDraws++; }
    }
    if (met.size !== 4 || firstDraws < 10 || firstDraws > 60) fail('s3 contacts: rare first-draw weight or reachability ' + firstDraws);
    for (const contact of contacts) {
      m.unlocks.events = [contact]; r = R.start('one-contact-' + contact, crew(m), m);
      for (let i = 0; i < 1200 && !r.seen.includes(contact); i++) draw(r);
      if (!r.seen.includes(contact)) fail('s3 contacts: guest never appears after unlock: ' + contact);
      R.save(r); r = R.load();
      for (let i = 0; i < 45; i++) draw(r);
      if (!equal(r.seen.filter((key) => R.eventDef(key).premium), [contact])) fail('s3 contacts: wrong guest or second visit on resume');
    }
    // 第三階段已經抽到的客串、已到手的裝備要能讀。未設定 contacts 的舊趟不追溯抽卡。
    delete r.contacts; r.seen = ['marcus']; r.gear = { id: 'eagle', lv: 2 }; r.event = { id: 'marcus', result: null }; r.phase = 'event';
    R.save(r); r = R.load();
    if (!R.choose(r, 1) || r.gear.id !== 'eagle' || r.gear.lv !== 2) fail('s3 contacts: legacy in-flight cameo or owned gear lost');
    r.seen = [];
    for (let i = 0; i < 60; i++) if (R.eventDef(draw(r)).premium) fail('s3 contacts: backfilled an old night');
    // 存檔後隊員和名冊是不同的物件。四個印記只跟做決定的人走，直到下一趟、被抓和救出。
    const events = ['hotwash', 'lastferry', 'bellwire', 'seamstress'], marks = ['softstep', 'tidebreath', 'arcscar', 'lining'];
    m = R.newGame('random', 'lasting').meta; const people = crew(m), agent = people[1];
    r = R.start('lasting', people, m); r.active = 1; R.save(r); r = R.load(); m = R.meta();
    const base = R.statsOf(r, 1).st, baseline = JSON.stringify(R.statsOf(r, 0));
    for (const [i, ev] of events.entries()) {
      const res = event(r, ev, 0, m);
      if (res.fx.person.id !== agent.id || res.fx.imprint !== marks[i] || R.choose(r, 0, m)) fail('s3 marks: wrong recipient or claim repeated: ' + ev);
      if (ev === 'bellwire' && (R.maxHp(r, 1) !== base.maxHp - 6 || r.squad[1].hp > R.maxHp(r, 1))) fail('s3 marks: scar failed to clamp active HP');
    }
    if (!event(r, 'seamstress', 0, m).fx.known || agent.imprints || r.squad[1].p.imprints.length !== 4) fail('s3 marks: duplicate effect or leaked into the original input');
    R.save(r); r = R.load(); m = R.meta();
    const again = R.start('next-night', crew(m), m), st = R.statsOf(again, 1).st;
    if (!equal(r.squad[1].p.imprints, marks) || !equal(again.squad[1].p.imprints, marks) || again.squad.some((x, i) => i !== 1 && x.p.imprints) ||
      st.maxHp !== base.maxHp + 6 || st.meleeDmg !== base.meleeDmg + 10 || Math.abs(st.detectMul - .85 * base.detectMul) > 1e-8 ||
      Math.abs(st.focusRegen - 1.2 * base.focusRegen) > 1e-8 || JSON.stringify(R.statsOf(again, 0)) !== baseline) fail('s3 marks: personal mechanics did not survive the next night');
    again.squad[1].down = true; R.finish(again, false, m);
    r = R.start('rescue-marks', crew(m), m); r.pending = { kind: 'rescue' }; r.squad[0].down = true;
    if (!equal(R.rescue(r, m).p.imprints, marks) || R.maxHp(r, 0) !== st.maxHp) fail('s3 marks: custody lost personal history');
    storage.clear();
    console.log('ten unique invitations; paid/free, custody, wipe, seeded endings, legacy saves, four persistent personal marks; premium first draws: ' + firstDraws + '/600 with all four unlocked');
  }

  section('零時差：特工實戰與專屬裝備');
  {
    const crew = R.crewFor('field-partners');
    const field = (id, enemies, gear, kit, xp={}, props=[]) => {
      const p=S3.ops.person(id,'field',kit || (id==='drone_expert'?'gunship':S3.ops.templates[id][0].id));
      // Isolate kit effects from the contact's personal traits and habits.
      p.traits=[];p.quirks=[];
      const r = R.start('field-test', [p, ...crew.slice(0, 2)], newMeta());
      Object.assign(r.build.exploits,xp);
      if (gear) R.addGadget(r, gear);
      return sim.createRoom(arena({ enemies,props }), R.simBuild(r), R.carry(r));
    };
    const foe = (kind, x, y) => ({ kind, x, y });
    const cast = (s, x, y, shared) => sim.step(s, pad({ [shared ? 'g2' : 'g1']: true, ax: x, ay: y }));
    const near = (x, y, eps = 0.04) => Math.abs(x - y) < eps;
    let s = field('hitman', [foe('heavy', 800, 720)],null,'runner');
    s.p.ammo = 1; s.p.reload = 0.9;
    sim.step(s, pad({ dash: true }));
    if (s.p.reload || s.p.ammo !== D.weapons.carbine.mag || s.weapon !== D.weapons.carbine) fail('s3 hitman: carbine or dash reload');
    const W=D.weapons, sustained=w=>w.dmg*w.pellets*w.mag/(w.mag/w.rate+w.reload);
    if (Object.values(W).some(w=>w!==W.rifle && sustained(w)>=sustained(W.rifle)) || W.carbine.spread>=W.rifle.spread || W.carbine.dmg>=W.rifle.dmg ||
        W.rifle.noise<=W.carbine.noise || W.carbine.noise<=W.shotgun.noise || !S3.ops.templates.hitman.some(k=>k.weapon==='carbine')) fail('s3 arsenal: firepower, noise or carbine assignment');
    for (const w of ['rifle','carbine']) for (const silent of [false,true]) {
      const r=R.start('far-hearing',[S3.ops.person('hitman')],newMeta());r.squad[0].weapon=w;if(silent) r.build.exploits.silencer=1;
      const test=sim.createRoom(arena({enemies:[foe('guard',80,80),foe('turret',1500,100)]}),R.simBuild(r),R.carry(r));
      sim.step(test,pad({fire:true}));
      if(test.alert===silent || test.en.some(e=>(e.state==='combat')===silent) || !test.ev.some(e=>e.k==='shot' && e.suppressed===silent)) fail('s3 arsenal: full-room alarm / silencer '+w);
    }
    {
      const ps=[S3.ops.person('hitman'),S3.ops.person('spy'),crew[0]], r=R.start('old-rifles',ps,newMeta());
      r.v=3;r.active=1;r.phase='room';r.squad[0].weapon='match';r.squad[1].weapon='silenced';r.squad[0].hp=38;
      const roster=r.squad.map((m,i)=>({...m,status:i?'ready':'held',runs:4})), oldWeapon=r.squad[2].weapon;
      storage.set('watchdogs-echo.s3.meta',JSON.stringify({v:3,data:{...newMeta(),roster}}));
      storage.set('watchdogs-echo.s3.run',JSON.stringify({v:3,data:r}));
      const restored=R.load(), m=R.meta(), expected=[S3.ops.templateOf(restored.squad[0].p).weapon,'match',oldWeapon].join();
      if(restored.v!==5 || restored.active!==1 || restored.phase!=='room' || restored.rng!==r.rng || restored.squad[0].hp!==38 ||
        m.roster[0].status!=='held' || [restored.squad,m.roster].some(a=>a.map(x=>x.weapon).join()!==expected)) fail('s3 v3 roster/run weapon migration');
      R.save(restored);if(JSON.stringify(R.load())!==JSON.stringify(restored))fail('s3 v4 weapon round trip');
      storage.clear();
    }
    s = field('hitman', [Object.assign(foe('heavy', 800, 725), { elite: 'armored' }), foe('turret', 830, 728)]);
    const [victim, next] = s.en; victim.state = next.state = 'combat'; next.cd = 20;
    sim.step(s, pad({ melee: true }));
    if (!victim.dead || !near(s.team[0].execCd, 4) || sim.takedownTarget(s)) fail('s3 hitman: alert execution or immediate repeat');
    go(s, 244);
    if (sim.takedownTarget(s) !== next) fail('s3 hitman: execution never recovered');
    s = field('hitman', [Object.assign(foe('boss', 800, 710), { boss: 'bulldog' })]); s.en[0].state = 'combat';
    if (sim.takedownTarget(s)) fail('s3 hitman: executed a healthy, alert boss');

    s = field('spy', [foe('guard', 800, 665), foe('guard', 945, 665)]);
    s.en[0].ang = UP; s.en[1].ang = s.en[1].base = Math.PI;
    const spyTarget = s.en[0], witness = s.en[1];
    const normal = room({ enemies: [foe('guard', 800, 665)] }); normal.en[0].ang = UP;
    if (sim.takedownTarget(s) !== spyTarget || sim.takedownTarget(normal)) fail('s3 spy: ambush reach did not extend');
    sim.step(s, pad({ melee: true }));
    if (!spyTarget.dead || witness.state !== 'calm') fail('s3 spy: extended silent takedown alerted a distant witness');
    s = field('spy', [foe('turret', 800, 375)]);
    sim.step(s, pad({ fire: true }));
    if (!s.bul.some((b) => b.sneak === 4.5 && b.assassin) || s.weapon.noise || s.weapon!==W.match || s.p.mag!==14) fail('s3 spy: custom suppressed pistol and ambush multiplier');
    s = field('spy', [foe('turret', 800, 375), foe('turret', 1060, 375)]); const [at, away] = s.en;
    at.maxHp = at.hp = 400; at.cd = away.cd = 20;
    cast(s, 800, 375); const mark = s.zones[0];
    if (mark.k !== 'strike' || at.hp !== 400 || mark.x !== 800 || mark.y !== 375) fail('s3 spy: mortar did not mark the aimed point');
    const hits = go(s, 140, pad({ ax: 1060, ay: 375 })).filter((k) => k === 'boom').length;
    if (hits !== 3 || !near(at.hp, 400 - 3 * 90) || away.hp !== away.maxHp || s.zones.length) fail('s3 spy: three separate 90-damage impacts on the original mark');

    s = field('drone_expert', [foe('turret', 770, 550), foe('turret', 758, 450)]); s.p.cloak = 30;
    const [front, back] = s.en; front.stun = back.stun = 25; front.hp = back.hp = 400;
    cast(s, 770, 550); const pet = s.pets[0], shot = s.bul.find((b) => b.tracer);
    if (pet.kind !== 'expert' || !near(pet.t, 16) || !shot || shot.pierce !== 1 || !near(shot.dmg,12*1.12) || pet.rate !== 5) fail('s3 expert: heavy escort loadout');
    pet.cd = 25; go(s, 33);
    if (!near(front.hp,400-12*1.12) || !near(back.hp,400-12*1.12)) fail('s3 expert: first projectile did not pierce two targets');
    sim.swapTo(s, 1); go(s, 75, pad({ mx: 1 }));
    if (pet.x < 1000 || Math.hypot(s.p.x - pet.x, s.p.y - pet.y) > 65) fail('s3 expert: drone did not follow the new operative');
    go(s, 856); if (s.pets.length) fail('s3 expert: battery did not expire');

    s = field('hooligan', [foe('turret', 800, 655)]); s.en[0].stun = 15; s.en[0].hp = 5000;
    cast(s, 800, 655); const mates = s.pets;
    const replay = field('hooligan', [foe('turret', 800, 655)]); cast(replay, 800, 655);
    if (mates.length !== 3 || new Set(mates.map((m) => m.person.id)).size !== 3 || mates.some((m) => m.kind !== 'brawler' || m.dmg !== 22 || !near(m.t, 10)) ||
      JSON.stringify(mates.map((m) => m.person)) !== JSON.stringify(replay.pets.map((m) => m.person))) fail('s3 brawl: three deterministic civilian identities');
    const punches = go(s, 110).filter((k) => k === 'punch').length;
    if (punches < 3 || s.en[0].hp !== 5000 - 22 * punches || s.team.length !== 3) fail('s3 brawl: summoned people did not land real punches');
    go(s, 495); if (s.pets.length) fail('s3 brawl: crowd did not disperse');

    s = field('beekeeper', [foe('turret', 800, 450), foe('turret', 1040, 450)]); s.p.cloak = 20;
    const [inside, outside] = s.en; inside.hp=inside.maxHp=200; // survive the full marked swarm
    cast(s, 800, 450);
    if (!inside.bees || outside.bees > 0 || A.sightMul(s, inside) !== .38 || A.sightMul(s, outside) !== 1) fail('s3 swarm: did not shorten only vision inside the hive');
    go(s, 370);
    if (!near(inside.maxHp - inside.hp, 84*1.3) || outside.hp !== outside.maxHp || s.zones.length || inside.bees > 0) fail('s3 swarm: six-second damage, boundary or sight recovery');
    const shotAngle = (bees) => {
      const z = field('beekeeper', [foe('turret', 800, 660)]), t = z.en[0];
      t.bees = bees; t.state = 'combat'; t.ang = DOWN; t.atk = { k: 'burst', t: 0, n: 2 };
      sim.step(z, pad()); return z.ev.find((ev) => ev.k === 'eshot').ang;
    };
    if (near(shotAngle(0), shotAngle(1), 1e-5)) fail('s3 swarm: impaired gunfire still has the same aim');

    s=field('hypnotist',[foe('rusher',800,630),foe('guard',880,833),foe('turret',900,630)]);
    const [frozen,side,robot]=s.en; frozen.state='combat';cast(s,800,500);
    if(!near(frozen.trance,8)||side.trance>0||robot.trance>0||sim.takedownTarget(s)!==frozen)fail('s3 hypnosis: cone, machine exemption or frontal takedown');
    go(s,461);if(frozen.y!==630||frozen.trance<=0)fail('s3 hypnosis: target moved early');
    go(s,55);if(frozen.trance>0||frozen.y===630)fail('s3 hypnosis: trance did not end');
    s=field('hypnotist',[{...foe('heavy',800,685),elite:'armored'},foe('turret',1100,300)]);
    const heavy=s.en[0];heavy.ang=DOWN;heavy.state='combat';cast(s,heavy.x,heavy.y);
    if(!near(heavy.trance,4))fail('s3 hypnosis: elite duration');sim.step(s,pad({melee:true}));
    if(!heavy.dead)fail('s3 hypnosis: a tranced human elite should submit from the front');
    s=field('hypnotist',[Object.assign(foe('boss',800,620),{boss:'bulldog'})]);cast(s,800,600);
    if(s.en[0].trance>0)fail('s3 hypnosis: boss not exempt');

    s = field('spy', [foe('shield', 800, 675), foe('heavy', 800, 827), foe('turret', 950, 775)], 'eightball');
    const [shield, behind, wall] = s.en, ballHit=85+6*s.build.skills.physical; shield.ang = DOWN; s.solid[A.idx(17, 15)] = 1;
    cast(s, 800, 675, true);
    if (shield.hp !== shield.maxHp - ballHit || behind.hp !== behind.maxHp - ballHit || wall.hp !== wall.maxHp || !near(shield.stun, 2) ||
      !near(shield.noShield, 3) || s.p.gad[1].cd !== 7) fail('s3 eightball: circle, shield, wall or cooldown');
    sim.swapTo(s, 1); cast(s, 800, 675, true);
    if (shield.hp !== shield.maxHp - ballHit || s.p.gad[1].cd < 6.9) fail('s3 eightball: swapping bypassed the shared cooldown');
    // Specialists in a controlled arena: exercise inputs, not just registered passives.
    const ck=(ok,msg)=>{if(!ok)fail('s3 field: '+msg);};
    const anchor=()=>foe('turret',1350,250), guard=()=>foe('guard',800,610);
    s=field('statue',[guard(),{...foe('guard',990,700),elite:'armored'},anchor()],null,'encore',{wideStage:1,hatTips:2},[{kind:'junction',tx:13,ty:13,w:1,h:1}]);
    const [crowd,elite]=s.en;crowd.ang=DOWN;sim.step(s,pad({mx:1,g1:true}));ck(!s.show && !s.p.gad[0].cd,'cannot cast a moving performance');
    cast(s,800,610);const startDist=Math.hypot(crowd.x-s.p.x,crowd.y-s.p.y);
    ck(s.show?.r===470 && S3.field.audience(s,crowd) && !S3.field.audience(s,elite),'audience boundaries');
    s.p.bw=1;go(s,42);ck(!crowd.atk && !crowd.call && !crowd.aware && Math.hypot(crowd.x-s.p.x,crowd.y-s.p.y)<startDist && s.p.bw>2,'crowd actually approaches without spotting; earnings');
    s.p.bw=6;const box=s.props[0];sim.step(s,pad({hack:true,ax:box.x,ay:box.y}));ck(s.stats.hacks===1 && box.fuse>0 && s.show,'hack stays open on stage');
    sim.step(s,pad({fire:true}));ck(!s.show && crowd.stun>0 && s.p.shots===1,'shoot to close, encore stuns spectators');
    s=field('statue',[anchor()],null,'plinth');cast(s,800,700);ck(A.detectMul(s)===.25*s.st.detectMul,'plinth passive');sim.step(s,pad({mx:1}));ck(!s.show && A.detectMul(s)===s.st.detectMul,'walking leaves the stage');

    s=field('drone_expert',[guard(),foe('heavy',850,615),anchor()],null,'flightdeck',{puppet:1,salvage:1,coilTap:1,overcell:1});
    const stationary=s.p.x;cast(s,800,615);const d=s.shockDrone;
    ck(d && near(d.t,15*1.35*1.6) && near(d.dmg,18*1.35*1.6),'shock craft snapshots puppet and battery');
    const flights=go(s,25);ck(d.y<700 && flights.includes('arc') && s.en.slice(0,2).every(e=>e.stun>0),'tap patrol and arcing');
    go(s,12,pad({g1Hold:true}));const dx=d.x;go(s,15,pad({g1Hold:true,mx:1,fire:true}));ck(d.manual && d.x>dx+60 && s.p.x===stationary && !s.p.shots,'steer the craft, not the shooter');
    s.p.inv=0;s.p.guard=0;const hp=s.p.hp;A.hitPlayer(s,10);ck(s.p.hp<hp,'pilot body still takes damage');const release=d.x;sim.step(s,pad());ck(!d.manual && d.tx===release,'release sets patrol centre');
    d.t=.001;s.ev=[];sim.step(s,pad());ck(!s.shockDrone && s.ev.some(e=>e.k==='shock'),'retirement triggers salvage');

    s=field('hypnotist',[guard(),foe('guard',858,606),anchor()],null,'beat',{suggestion:1,velvet:2});cast(s,800,510);
    const candidates=s.en.slice(0,2);ck(candidates.every(e=>e.trance>5) && s.suggestion.r===480,'metronome cone and extended trance');
    cast(s,1020,620);const ordered=candidates.filter(e=>e.march);ck(ordered.length===1 && !s.suggestion.ready,'one walking order');
    if(ordered[0]){const x=ordered[0].x;go(s,30);ck(ordered[0].x>x+30,'ordered human walks');}
    s=field('hypnotist',[guard(),anchor()]);s.p.gad[0].lv=2;cast(s,800,610);cast(s,960,610);ck(!!s.en[0].march,'gear II also unlocks orders');

    for(const [kit,id] of [['bottle','molotov'],['fuse','pipebomb']]){
      s=field('anarchist',[foe('heavy',800,555),anchor()],null,kit,{longWick:2,fragments:1});const e=s.en[0];e.hp=800;e.stun=5;
      cast(s,800,555);ck(!s.zones.length && s.payloads[0]?.id===id && s.payloads[0].r===D.gadgets[id].r+45,'thrown '+id);
      go(s,46);ck(s.payloads.length===0 && s.zones.some(z=>z.k==='fire' && z.t>D.gadgets[id].dur+3) && e.hp<800,'impact and lingering fire '+id);
      if(kit==='bottle'){s.alert=true;e.hp=80;A.trapHurt(s,e,12);ck(e.hp===56,'double trap damage in combat');}
    }
    s=field('anarchist',[foe('drone',800,600),foe('heavy',870,590),anchor()],null,'fuse');s.p.bw=10;
    const machine=s.en[0],witness2=s.en[1];sim.step(s,pad({hack:true,ax:machine.x,ay:machine.y}));const before=witness2.hp;
    ck(machine.ally>0 && machine.scrapCharge===135,'charge armed by actual hijack');machine.ally=.001;sim.step(s,pad());ck(machine.dead && witness2.hp<before-30,'scrap explosion on expiry');

    s=field('paramedic',[anchor()],null,'station',{triage:1,wideWard:1});s.p.hp=45;cast(s,s.p.x,s.p.y);
    const ward=s.installations[0];ck(ward?.r===150 && ward.heal===11,'ward upgrades');go(s,60);ck(near(s.p.hp,56,.25),'heal inside beacon');
    const pellet=(x,y,vx,side)=>({x,y,vx,vy:0,r:3,dmg:14,side,life:2,bounce:0,pierce:0});
    s.p.inv=0;s.p.guard=0;const outer=pellet(s.p.x-ward.r-4,s.p.y,1500,'e'), insideShot=pellet(s.p.x-20,s.p.y,900,'e'),outbound=pellet(s.p.x+ward.r-4,s.p.y,1500,'p');
    s.bul.push(outer,insideShot,outbound);const hp0=s.p.hp;sim.step(s,pad());ck(!s.bul.includes(outer) && s.bul.includes(outbound) && s.p.hp<hp0-12,'shield admits outgoing and hostile shots already inside');
    const sniper=A.spawn(s,'sniper',s.p.x-240,s.p.y);sniper.state='combat';sniper.atk={k:'snipe',ang:0,t:.001};s.p.inv=0;const preSnipe=s.p.hp;
    sim.step(s,pad());ck(s.p.hp>=preSnipe && s.ev.some(e=>e.k==='snipe' && near(e.x2,ward.x-ward.r,1)),'outside sniper round stops at rim');sniper.stun=8;
    s.p.x-=230;const outsideHp=s.p.hp;go(s,10);ck(s.p.hp===outsideHp,'no healing outside');
    s=field('paramedic',[anchor()],null,'stretcher');cast(s,1100,500);const mobile=s.installations[0];go(s,12,pad({mx:1}));ck(mobile.x>830,'mobile ward follows caster');sim.swapTo(s,1);const parked=mobile.x;go(s,10,pad({mx:1}));ck(mobile.x===parked,'ward parked on swap');

    s=field('barrister',[foe('turret',790,575),foe('drone',865,600),foe('hound',890,650),anchor()],null,'chambers',{extension:2},[{kind:'camera',tx:15,ty:10,w:1,h:1,dir:1}]);
    const [tur,air,dog]=s.en;s.en.forEach(e=>{e.state='combat';e.cd=0;});cast(s,800,575);const law=s.installations[0];
    ck(law?.t>10 && s.props[0].down>0 && !tur.atk && S3.field.stayed(s,air) && !S3.field.isSubject(dog),'injunction disables camera, drone and turret, not hounds');
    const ax=air.x,ay=air.y;go(s,20);ck(!tur.atk && air.x===ax && air.y===ay,'disabled machines cannot move or aim');
    law.t=.001;go(s,20);ck(!s.installations.length && s.props[0].down<=0 && (air.x!==ax || air.y!==ay || tur.atk),'machines resume');

    // A closing flash needs a full pose, works on a visible resistant target but never through a wall.
    for(const kit of ['plinth','encore']){
      s=field('statue',[guard(),foe('heavy',870,680),anchor()],null,kit);
      const [fan,front]=s.en;fan.hp=front.hp=3000;front.elite='armored';
      cast(s,800,610);go(s,25);sim.step(s,pad({mx:1}));
      ck(!s.p.guard && front.hp===3000 && (kit==='plinth'?fan.aftershow>2.4:fan.stun>3.4),'early exit only releases the audience: '+kit);
      s.p.gad[0].cd=0;cast(s,800,610);go(s,53);ck(s.show?.ready && s.p.guard===1,'gold ring arms exactly one guard');
      const blind=A.spawn(s,'turret',1050,775);s.solid[A.idx(18,15)]=1;
      const hp=blind.hp,cd=s.p.gad[0].cd;sim.step(s,pad({mx:1}));
      ck(near(3000-front.hp,kit==='encore'?300:150) && blind.hp===hp && near(cd-s.p.gad[0].cd,kit==='encore'?4:0),'charged front row, refund and wall: '+kit);
    }
    const trapAfterCurtain=on=>{
      const f=field('statue',[foe('heavy',860,675),anchor()],null,'plinth',{},[{kind:'junction',tx:16,ty:13,w:1,h:1}]);
      f.alert=true;const e=f.en[0];e.stun=20;e.hp=3000;if(on)cast(f,825,675);
      sim.step(f,pad({hack:true,ax:825,ay:675}));sim.step(f,pad({mx:1}));go(f,40);
      return 3000-e.hp;
    };
    const baseTrap=trapAfterCurtain(false);ck(baseTrap>0 && near(trapAfterCurtain(true),2.5*baseTrap),'the fuse remembers when it was hacked');

    // Trance takedowns suppress the witness/noise event, including a loud operative's own noise.
    for(const kit of ['watch','beat']){
      s=field('hypnotist',[foe('guard',800,660),foe('guard',993,715),anchor()],null,kit);
      const [subject,witness]=s.en;witness.ang=Math.atan2(subject.y-witness.y,subject.x-witness.x);
      cast(s,800,650);witness.trance=0;witness.state='calm';witness.blind=5;s.fl.loud=1;s.p.hp=40;s.p.guard=0;s.ev=[];
      sim.step(s,pad({melee:true}));ck(subject.dead && witness.state==='calm' && !s.ev.some(ev=>ev.k==='noise') && s.p.hp===52 && s.p.guard===(kit==='watch'?1:0),'unwitnessed takedown and recovery: '+kit);
      s=field('hypnotist',[anchor()],null,kit);s.st.critChance=0;
      sim.step(s,pad({focus:true,fire:true,ax:1300,ay:775}));
      ck(near(s.bul.find(b=>b.side==='p')?.dmg,s.weapon.dmg*s.st.dmgMul*(kit==='watch'?3:2)),'focused shot: '+kit);
      s.p.guard=0;s.p.inv=0;const hp=s.p.hp;A.hitPlayer(s,20);
      ck(near(hp-s.p.hp,20*s.st.dmgTaken*(kit==='watch'?.5:1)),'focused defense: '+kit);
    }
    s=field('hypnotist',[foe('turret',800,705),foe('guard',1030,775)],null,'watch');
    const bot=S3.bot.create('trance-aim');const aimed=bot.act(s);ck(aimed.g1 && aimed.ax===1030 && !aimed.fire,'bot aims past an immune machine without shooting');
    sim.step(s,aimed);s.p.meleeCd=0;s.en[0].stun=0;const approach=bot.act(s);ck(!approach.fire && approach.mx>0,'bot approaches its subject instead of firing');

    // Owner identity survives a switch; floor fires from barrels and other people's charges remain hazards.
    for(const kit of ['bottle','fuse'])for(const swap of [false,true]){
      s=field('anarchist',[anchor()],null,kit);s.en[0].stun=60;cast(s,s.p.x,s.p.y);
      if(swap)sim.swapTo(s,1);s.p.inv=0;s.p.guard=0;const hp=s.p.hp;
      go(s,70);ck(swap?s.p.hp<hp:s.p.hp===hp,'own payload vs teammate: '+kit+'/'+swap);
      if(!swap){s.zones.push({k:'fire',x:s.p.x,y:s.p.y,r:40,t:1,burn:5,tick:0});go(s,1);ck(s.p.hp<hp,'unowned fire still burns: '+kit);}
    }
    s=field('anarchist',[anchor()],null,'fuse');s.en[0].hp=3000;
    {const e=s.en[0];A.blast(s,e.x,e.y,50,100,{breacher:2.5});ck(e.hp===2750,'shrapnel against a machine');}
    for(const kit of ['chambers','circuit']){
      s=field('barrister',[foe('turret',835,745),anchor()],null,kit,{},[{kind:'pylon',tx:16,ty:14,w:1,h:1}]);
      const e=s.en[0];e.hp=1000;cast(s,800,775);ck(s.props[0].down>0,'relay stayed during injunction');
      s.p.inv=0;s.p.guard=0;const hp=s.p.hp;A.hitPlayer(s,20);A.hurt(s,e,10);
      ck(near(hp-s.p.hp,8*s.st.dmgTaken) && near(1000-e.hp,kit==='chambers'?18:10),'protection and stationary filing: '+kit);
      s.installations[0].t=.001;go(s,5);ck(s.props[0].down<=0,'relay resumes when the order expires');
    }
    // A crashed car seals a gate against the border. The reinforcement still enters on reachable floor.
    s=field('statue',[anchor()],null,'plinth',{},[{kind:'car',tx:1,ty:11,w:2,h:1,dir:0}]);
    const reinforcement=A.spawn(s,'heavy',36,575,{wave:true}),grid=A.field(s,s.p.x,s.p.y);
    ck(!A.solidAt(s,reinforcement.x,reinforcement.y) && grid[A.idx(Math.floor(reinforcement.x/T),Math.floor(reinforcement.y/T))]>=0,'reinforcement at a blocked gate');

    for(const rank of [1,2,3]){
      s=field('hooligan',[anchor()],null,'terrace',{terraceFists:rank});const e=s.en[0];e.hp=2000;s.alert=true;
      A.hurt(s,e,10,{by:'melee'});cast(s,800,700);ck(e.hp===2000-10*(1+rank) && s.pets.every(m=>m.dmg===22*(1+rank)),'personal and summoned melee rank '+rank);
    }
    {
      const m=newMeta(),r=R.start('quotas',[S3.ops.person('hitman'),S3.ops.person('barrister'),crew[0]],m);
      r.build.exploits={reprieve:2,sidesteps:3,surety:1};
      const fight=()=>{r.node={type:'fight',reward:'data'};return sim.createRoom(arena({enemies:[anchor()]}),R.simBuild(r),R.carry(r));};
      s=fight();ck(s.st.dashCharges===4 && !s.team[1].fl.bloodReturn,'charges restricted to class');
      s.p.hp=10;A.hurt(s,s.en[0],20,{by:'gun',quiet:true});ck(near(s.p.hp,11),'rank II returns actual gun damage');
      s.p.inv=s.p.guard=0;A.hitPlayer(s,500);ck(s.team[0].down,'berserk has no lethal rescue');R.finishRoom(r,s,m);
      ck(!r.squad[0].down && r.squad[0].hp===Math.round(R.maxHp(r,0)*.75) && r.stats.captured===1,'senior bail at 75 percent');
      m.roster.push({p:crew[1],status:'held'});s=fight();R.finishRoom(r,s,m);ck(m.roster[0].status==='held','only one release per sector');
      r.node={type:'boss'};R.advance(r);s=fight();R.finishRoom(r,s,m);ck(m.roster[0].status==='ready','new sector releases safehouse detainee');
    }
    require('./check-s3-combat').kits({field,foe,anchor,pad,go,cast,sim,A});
    require('./check-s3-loadouts')({S3,sim,A,build,arena,foe,anchor,pad,go,field,cast});
    require('./check-s3-combat').ordnance({S3,sim,A,build,arena,foe,pad,go});
    require('./check-s3-combat').recruitDefense({S3,E,R,sim,A,field,foe,anchor,pad,go,build,room,crew,newMeta});
    require('./check-s3-combat').fireteam({S3,R,sim,A,arena,foe,anchor,pad,go,crew,newMeta});
    console.log('dash and execution; silent extended takedown and three marked impacts; two-target escort; three civilian punches; hive sight, aim and damage; cone, stillness and recovery; shared eight-ball');
  }

  // ===== 機器人打整趟 =====
  section('零時差：OMNI 轉運站、五十房窗口與封存');
  {
    const O=S3.omni, ck=(v,s)=>{if(!v)fail('s3 OMNI: '+s);}, crew=m=>m.roster.filter(x=>x.status==='ready').slice(0,3).map(x=>x.p);
    const active=()=>{storage.clear();const m=R.newGame('random','station-fixture').meta;m.endings={open:1};m.wins=1;return m;};
    for(const id of ['return','burn','open','teach'])ck(O.unlocked({endings:{[id]:1}}),'normal ending '+id);
    ck(!O.unlocked({endings:{wipe:1}}) && !O.unlocked({endings:{}}),'a wipe alone cannot open the station');
    storage.clear();
    const first=R.newGame('random','first-roster').meta;
    ck(!O.connect('locked',crew(first),first),'a fresh roster cannot enter without a career ending');
    R.finish(R.start('campaign',crew(first),first),true,first,'burn');
    const career=R.meta(), oldTrip=O.connect('old-trip',crew(career),career);
    oldTrip.roomNo=11;O.snapshot(oldTrip,career);R.saveMeta(career);
    R.newGame('random','second-roster');
    const restart=R.meta();
    ck(restart.wins===0 && !restart.omniRun && !restart.unlocks.jobs.length && restart.omniRecord.best===11 &&
      O.connect('new-trip',crew(restart),restart)?.roomNo===0,'manual restart keeps career access and depth, not the pending trip');
    let m=active(), people=crew(m);
    m.roster[0].status='station';ck(!O.connect('x',people,m),'station crew cannot deploy');m.roster[0].status='held';
    ck(!O.connect('x',people,m),'ordinary prisoners cannot deploy');m.roster[0].status='ready';
    ck(!O.connect('x',[people[0],people[0],people[1]],m),'three separate people required');
    R.save(R.start('ordinary',people,m));ck(!O.connect('x',people,m),'ordinary run is not overwritten');R.clear();
    let r=O.connect('station-signal',people,m);ck(r && !O.connect('again',people,m),'only one active journey');
    // An ordinary capture can be resolved only on the ordinary side. A new station loss is durable at once.
    m.roster[3].status='held';r.roomNo=8;O.capture(r,m,0);O.snapshot(r,m);R.saveMeta(m);m=R.meta();r=m.omniRun;
    ck(r.squad[0].down && m.roster[0].status==='station' && m.roster[0].omniBest===8 && !R.load(),'resume with a downed operative');
    r.pending={kind:'rescue'};let res=R.rescue(r,m);
    ck(!res.known && m.roster[0].status==='station' && m.roster[3].status==='held','same crew cannot release its own lost call sign');
    const normal=R.start('normal-cell',crew(m),m);normal.pending={kind:'rescue'};res=R.rescue(normal,m);
    ck(res.known && R.same(res.p,m.roster[3].p) && m.roster[0].status==='station','ordinary cell crossed custody ledgers');
    const lawyer=S3.ops.person('barrister','station-law','chambers');
    const other=O.create('second-crew',[lawyer,...crew(m).slice(0,2)],m);
    other.pending={kind:'rescue'};res=R.rescue(other,m);
    ck(res.known && !res.joined && R.same(res.p,people[0]) && m.roster[0].status==='ready','outside team releases directly to roster');
    ck(!R.bail(Object.assign(other,{bailUsed:false})), 'station doors do not accept bail');

    // Walk the production route/advance path. Tally only completed nodes, not opened doors or reward panels.
    m=active();r=O.connect('fifty',crew(m),m);m.roster[3].status='held';let saved,paid;
    for(let n=1;n<=150;n++){
      ck(r.phase==='route','route before '+n);
      const opt=r.options.findIndex(o=>o.type==='boss'), pos=O.position(n-1);
      ck(r.sector===pos.sector && r.depth===pos.depth && (opt>=0)===(n%10===0),'sector/boss '+n);
      const sp=R.enter(r,opt<0?0:opt);if(opt>=0)ck(sp.boss===D.sectors[pos.sector].boss && sp.omni && sp.scale===O.curve(n).scale,'boss spec '+n);
      if(n===30){const room=S3.sim.createRoom(sp,R.simBuild(r),R.carry(r));room.cleared=true;
        const prize=R.finishRoom(r,room,m);ck(prize.boss && O.cap(r,R.exploitDef('hollow'))===4,'third boss pick can already use the new cap');}
      if(n===50){r.data=319;O.capture(r,m,0);r.squad[1].p={...r.squad[1].p,imprints:['softstep']};}
      r.phase='doors';const ph=R.advance(r);O.snapshot(r,m);
      ck(O.cap(r,R.exploitDef('hollow'))===3+Math.floor(n/30),'cap at '+n);
      if(n%50){ck(ph==='route' && !O.decide(r,m,true),'no premature exit at '+n);continue;}
      ck(ph==='window' && !r.node && R.advance(r)==='window','window held after '+n);
      R.saveMeta(m);m=R.meta();r=m.omniRun;ck(r.phase==='window','saved window');
      if(n===50){saved=JSON.stringify(m);paid=O.payout(r);ck(paid===53,'data conversion');}
      const outcome=O.decide(r,m,n===150);ck(outcome && !O.decide(r,m,true),'single settlement '+n);
      if(n===50)ck(r.data===19 && m.echoes===53 && m.roster[1].p.imprints.includes('softstep') && !m.roster[0].omniExits,'banked when continuing');
    }
    ck(!m.omniRun && m.omniRecord.exits===1 && m.roster[0].status==='station' && m.roster[3].status==='held' &&
       !m.roster[0].omniExits && m.roster[1].omniExits===1 && m.wins===1 && m.unlocks.jobs.length===0,'exit does not free captives or mint a campaign win');
    m=JSON.parse(saved);r=m.omniRun;O.decide(r,m,false);r.roomNo=59;r.data=999;r.squad[1].p={...r.squad[1].p,imprints:['softstep','lining']};
    m.roster[3].status='ready';for(const i of R.alive(r))O.capture(r,m,i);O.snapshot(r,m);
    const loss=O.finish(r,m);ck(!loss.wiped && loss.meta.echoes===paid && !m.roster[1].p.imprints.includes('lining') &&
      m.omniRecord.best===59 && m.roster.filter(x=>x.status==='station').length===3 && !m.omniRun,'unbanked gains lost, records survive');
    m.roster[3].status='held';m=R.afterLoss(m);ck(m.campaign==='wiped' && O.unlocked(m) && m.endings.wipe && m.omniRecord.best===59,'mixed-custody wipe');
    m=R.newGame('random','after-wipe',m).meta;ck(O.unlocked(m) && !m.omniRun && m.omniRecord.best===59,'restart keeps career record and unlock');

    r=O.create('stacks',[lawyer,...R.crewFor('stacks').slice(0,2)],m);
    const x=R.exploitDef('hollow');for(let i=0;i<x.max;i++)R.addExploit(r,x.id);
    const base=R.statsOf(r,0).st.dmgMul;
    R.addExploit(r,x.id);ck(r.build.exploits.hollow===x.max && Math.abs(R.statsOf(r,0).st.dmgMul/base-1.05)<1e-6,'overflow has a real effect');
    r.omni.cleared=30;R.addExploit(r,x.id);ck(r.build.exploits.hollow===x.max+1 && Math.abs(R.statsOf(r,0).st.dmgMul/base-1.15)<1e-6,'extended rank and overflow coexist');
    const baseLaw=R.maxHp(r,0),baseOther=R.maxHp(r,1);
    R.addExploit(r,'surety');ck(R.maxHp(r,0)===Math.round(baseLaw*1.1) && R.maxHp(r,1)===baseOther,'surety is useful without unlocking a pod');
    for(const id of ['surety','extension'])while((r.build.exploits[id]||0)<O.cap(r,R.exploitDef(id)))R.addExploit(r,id);
    const hp0=R.maxHp(r,0), hp1=R.maxHp(r,1);
    r.options=[{type:'shop'}];R.enter(r,0);r.data=10000;
    const slot=r.shop.items.findIndex(x=>x.owner==='barrister');ck(slot>=0 && !r.shop.items[slot].sold && R.buy(r,slot) &&
      R.maxHp(r,0)>hp0 && R.maxHp(r,1)===hp1,'private shelf still sells a useful owner-only overflow');
    const p0=r.shop.items.find(x=>x.k==='heal').price;r.roomNo=130;r.options=[{type:'shop'}];R.enter(r,0);
    ck(r.shop.items.find(x=>x.k==='heal').price>p0 && !R.addExploit(r,'coilTap'),'shops scale; foreign private cards barred');
    O.capture(r,m,0);r.options=[{type:'shop'}];R.enter(r,0);
    ck(!r.shop.items.some(x=>x.owner==='barrister') && !R.addExploit(r,'surety'),'no unusable private sale to a captured owner');
    const sums=[];
    for(let i=0;i<900;i++){r.options=[{type:'event'}];R.enter(r,0);if(i===199||i===899)sums.push(JSON.stringify(r).length);}
    ck(r.seen.length<=D.events.length && new Set(r.seen).size===r.seen.length && Math.abs(sums[1]-sums[0])<1000,'bounded save with repeated events');
    const corner=S3.bot.playRun('omni-38',{omni:true,stopAt:6});
    ck(corner.run.omni.cleared===6 && !corner.rooms.some(x=>x.timeout),'projection wreck sealed its last guard behind a wall');
    ck(S3.pictures['ev-omni']==='assets/s3/ev-omni.jpg','station illustration');
    storage.clear();
    console.log('old ending, two custody ledgers, real returns, mixed wipe, rotating arenas, 50/100/150, atomic banking, overflow, owner-locked sales and bounded history');
  }


  if(process.env.S3_OMNI_40){
    section('OMNI：40 支普通小隊，窗口分岔');
    const rows=Array.from({length:40},(_,i)=>{
      const out=S3.bot.playRun('omni-'+i,{omni:true});
      if(out.rooms.some(x=>x.timeout))fail('OMNI bot timed out: '+i);
      return {seed:i,room:out.run.roomNo,completed:out.run.omni.cleared,phase:out.run.phase,windows:out.windows};
    });
    const order=rows.map(x=>x.room).sort((a,b)=>a-b);
    const q=[9,19,29].map(i=>(order[i]+order[i+1])/2);
    console.log('OMNI quartiles: '+q.join(' / '));
    for(const n of [50,100,150,200])console.log('OMNI '+n+': entered '+rows.filter(x=>x.room>=n).length+'/40; window '+rows.filter(x=>x.completed>=n).length+'/40');
    console.log('OMNI seeds: '+JSON.stringify(rows));
  }

  section('第三季：機器人');
  {
    const RUNS = 20;
    let wins = 0, reached = 0;
    const beaten = new Set(), nodes = new Set();
    for (let i = 0; i < RUNS; i++) {
      const out = S3.bot.playRun('ci-' + i, { held: i % 2 });
      if (out.run.squad.some((m) => R.isInvitation(m.p)) || out.run.seen.some((id) => R.eventDef(id).premium)) fail('s3 bot: collection content leaked into a fresh ordinary seed');
      if (out.won) wins++;
      reached += out.run.roomNo;
      for (const r of out.rooms) {
        if (r.timeout) fail(`s3 bot: seed ci-${i} room ${r.no} (${r.boss || r.type}) never ended`);
        if (r.boss && !r.dead) beaten.add(r.boss);
        nodes.add(r.type);
      }
      if (out.won !== (out.run.phase === 'won')) fail('s3 bot: result and phase disagree');
    }
    // 難度的界線：正常打法的機器人不該幾乎每次都贏，也不該幾乎贏不了。
    if (wins < RUNS * 0.3 || wins > RUNS * 0.8) fail(`s3 balance: the bot won ${wins}/${RUNS} (expected 30%–80%)`);
    if (reached / RUNS < 12) fail(`s3 balance: the bot only reaches room ${(reached / RUNS).toFixed(1)} on average`);
    for (const b of Object.keys(D.bosses)) if (!beaten.has(b)) fail(`s3 balance: nobody beat ${b}`);
    for (const t of ['fight', 'elite', 'boss', 'cells']) if (!nodes.has(t)) fail(`s3 bot: no ${t} room was played`);
    const again = S3.bot.playRun('ci-3', { held: 1 }), first = S3.bot.playRun('ci-3', { held: 1 });
    if (JSON.stringify(again.rooms) !== JSON.stringify(first.rooms)) fail('s3 bot: the same seed played twice differs');
    console.log(`the bot won ${wins}/${RUNS} runs, reaching room ${(reached / RUNS).toFixed(1)} on average; all three bosses beaten`);
    for (const [id,kits] of Object.entries(S3.ops.templates)) for(const kit of kits){
      const seed='operative-'+id, crew=[S3.ops.person(id,seed,kit.id),...R.crewFor(seed).slice(0,2)];
      const out=S3.bot.playRun(seed,{crew});
      if (!['won','dead'].includes(out.run.phase) || !out.rooms.length || out.rooms.some(r=>r.timeout || !Number.isFinite(r.hp+r.secs))) fail('s3 template bot: '+kit.id+' did not finish normally');
      console.log('KIT '+id+'/'+kit.id+': '+out.run.phase+', room '+out.run.roomNo+', captures '+out.run.stats.captured);
    }
    if(process.env.S3_BALANCE_120){
      let total=wins,timeout=0;for(let i=RUNS;i<120;i++){const out=S3.bot.playRun('ci-'+i,{held:i%2});total+=+out.won;timeout+=out.rooms.filter(r=>r.timeout).length;}
      if(timeout)fail('s3 extended bots timed out: '+timeout);console.log('BALANCE '+total+'/120, '+wins+'/20');
    }
  }

  // ===== 音效和音樂 =====
  section('第三季：音效');
  {
    const param = () => ({
      value: 0,
      setValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error('bad value'); },
      cancelScheduledValues() {},
      exponentialRampToValueAtTime(v, t) { if (!(v > 0) || !Number.isFinite(t)) throw new Error('exponential ramp to ' + v); },
      linearRampToValueAtTime(v, t) { if (!Number.isFinite(v) || !Number.isFinite(t)) throw new Error('bad ramp'); },
      setTargetAtTime(v, t, c) { if (!Number.isFinite(v) || !(c > 0)) throw new Error('bad target'); },
    });
    let nodes = 0;
    const node = (fields = []) => { nodes++; const n = { connect: (x) => x, start() {}, stop() {} }; for (const k of fields) n[k] = param(); return n; };
    class FakeAudio {
      constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = node(); }
      createGain() { return node(['gain']); }
      createOscillator() { return node(['frequency', 'detune']); }
      createBiquadFilter() { return node(['frequency', 'Q']); }
      createBufferSource() { return node(); }
      createConvolver() { return node(); }
      createDelay() { return node(['delayTime']); }
      createWaveShaper() { return node(); }
      createStereoPanner() { return node(['pan']); }
      createDynamicsCompressor() { return node(['threshold', 'knee', 'ratio', 'attack', 'release']); }
      createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
      resume() {}
      suspend() {}
    }
    page.ctx.AudioContext = FakeAudio;
    page.ctx.setTimeout = () => 0;
    page.ctx.clearTimeout = () => {};
    storage.delete('watchdogs-echo.muted');
    const X = E.sfx;
    X.unlock();
    const mine = X.names.filter((n) => n.startsWith('s3'));
    if (mine.length < 25) fail(`s3 sfx: only ${mine.length} sounds`);
    for (const name of mine) {
      const before = nodes;
      for (let i = 0; i < 8; i++) X.play(name);
      if (nodes === before) fail(`s3 sfx ${name}: built nothing (an error was swallowed?)`);
    }
    const text=fs.readFileSync(path.join(root,'js/s3/main.js'),'utf8');
    const audio=S3.audio, used=new Set(), recipe=ev=>{
      const r=audio.fromEvent(ev);if(!r)return null;used.add(r[0]);return [audio.byKey[r[0]]?.id,r[1]||0];
    };
    const ck=(v,msg)=>{if(!v)fail('s3 sfx: '+msg);};
    const oldCases=[], old=(ev,id,gap=0)=>{oldCases.push(ev);ck(String(recipe(ev))===String([id,gap]),JSON.stringify(ev)+' must play '+id+' / '+gap);};
    // 24343e4: fixed reference also works in a source export without Git history.
    for(const [key,id] of Object.entries({pistol:'s3gun',taser:'s3taser',shotgun:'s3shotgun',nailgun:'s3nail',silenced:'s3silenced',match:'s3silenced'}))
      for(const suppressed of [false,true])old({k:'shot',w:key,suppressed},id,40);
    for(const [key,id] of Object.entries({escort:'droneJam',kamikaze:'emp',eagle:'prof',blackout:'blackout',sergei:'sergei',
      hammer:'smash',sledge:'smash',mask:'dream',spider:'droneJam',lure:'s3shriek',mine:'lock',strike:'lock',expert:'droneJam',brawl:'s3wave',swarm:'s3shriek',hypnosis:'dream',eightball:'s3swing'}))
      old({k:'gadget',id:key},id);
    for(const id of [undefined,'ally','spider','expert','escort'])old({k:'pshot',id},'s3nail',90);
    const events={eshot:['s3eshot',70],hit:['s3hit',45],hurt:['s3hurt'],dead:['desync'],down:['desync'],swap:['s3dash'],getaway:['bleed'],dash:['s3dash'],
      hack:['s3hack',60],denied:['s3deny',150],boom:['s3boom',60],shock:['s3shock',60],zap:['s3zap',60],arc:['s3zap',60],steam:['s3steam'],spotted:['spotted',300],
      alarm:['alarm'],clang:['s3clang',60],takedown:['takedown'],melee:['s3swing',80],swing:['s3swing',80],leap:['s3swing',80],reload:['s3reload'],crash:['crash'],
      rev:['s3rev'],wave:['s3wave'],clear:['s3clear'],phase:['s3phase'],revive:['bleed'],snipe:['s3snipe'],lob:['s3lob',100],hijack:['droneJam'],
      raise:['lock'],breach:['camOff'],mark:['prof'],shriek:['s3shriek'],guard:['s3clang'],sneeze:['noise']};
    for(const [k,args] of Object.entries(events))old({k},...args);
    old({k:'kill'},'s3kill',50);old({k:'kill',boss:true},'s3bossdown',50);old({k:'kill',machine:true},'s3scrap',50);
    old({k:'pickup',what:'data'},'s3pick',40);old({k:'pickup',what:'med'},'gain',40);
    old({k:'shock',cue:'eaglePulse'},'s3shock',60);old({k:'shot',w:'unknown'},'s3gun',40);old({k:'gadget',id:'unknown'},'blip');
    const compareableCues=oldCases.length;
    for(const [k,defs] of [['shot',D.weapons],['gadget',D.gadgets]])for(const id of Object.keys(defs)){
      const ev={k,id,w:id};ck(recipe(ev)?.[0] && audio.fromEvent(ev)[0]!=='fallback','unrouted '+id);
      if(k==='shot' && defs[id].noise)recipe({...ev,suppressed:true});
    }
    for(const key of ['eagleLure','stageFlash','stageReady','order'])recipe({k:key});
    for(const [k,cue] of [['boom','cargoDrop'],['arc','droneArc'],['gadget','watch'],['hypnosis','metroTick'],['boom','molotovImpact'],['boom','pipeImpact']])recipe({k,cue});
    ck(!recipe({k:'arc',cue:false}) && !recipe({k:'punch'}),'silent extra arc and original visual-only punch');
    for(const w of ['rifle','carbine'])for(const suppressed of [false,true])
      ck(String(recipe({k:'shot',w,suppressed}))===String(['s3x_'+w+(suppressed?'Quiet':''),105]),'automatic '+w+' / '+suppressed);

    // Direct player controls and all authored encounter aliases belong to the same playback inventory.
    for(const m of text.matchAll(/\bplay\(([^;]*?)\)/g))for(const n of m[1].matchAll(/(?:^|[?:]\s*)'(\w+)'/g))used.add(n[1]);
    const vm=require('vm'), cameos=src=>vm.runInNewContext('('+src.match(/const EVENT_SOUND = (\{[^}]*\})/)[1]+')');
    const cameoIds=cameos(text);ck(JSON.stringify(cameoIds)===JSON.stringify({bluedoor:'dream',cat:'dream',wrench:'cameo',darcy:'cameo',aiden:'cameo',marcus:'cameo'}),'encounter aliases');
    Object.values(cameoIds).forEach(k=>used.add(k));
    const galleryHtml=fs.readFileSync(path.join(root,'tools/sfx-gallery.html'),'utf8');
    const gallery=sandbox([...galleryHtml.matchAll(/<script src="\.\.\/([^"]+)"/g)].map(m=>m[1]));
    const src=fs.readFileSync(path.join(root,'js/s3/sounds.js'),'utf8');
    function scores(source){
      const fns={};let log=[],state=1;
      const rnd=(a,b)=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return a+(b-a)*state/4294967296;};
      const kit={rnd,pick:a=>a[Math.floor(rnd(0,a.length))]};
      for(const k of ['osc','hiss','rotor','speak','keypad','burst'])kit[k]=(...args)=>{log.push([k,...args]);return k==='keypad'?args[0]+args[1]*.045:undefined;};
      vm.runInNewContext(source,{window:{ECHO:{sfx:{add(make){Object.assign(fns,make(kit));}}}}});
      return {fns,trace(id,seed){state=seed;log=[];fns[id]();return log;}};
    }
    const current=scores(src);
    // Old aliases must resolve to the identical audio ID before throttling, not just before synthesis.
    const playSource=text.slice(text.indexOf('  const lastPlayed ='),text.indexOf('  const EVENT_SOUND'));
    const played=[];let now=1000;
    const fire=vm.runInNewContext(playSource+'\nplay',{performance:{now:()=>now},S3,sfx:{play:id=>played.push(id)}});
    fire('zap',60);now+=10;fire('arc',60);now+=60;fire('arc',60);
    ck(String(played)==='s3zap,s3zap','shared legacy cooldown');

    const fresh=audio.cues.filter(c=>!c.restored), returned=audio.cues.filter(c=>c.restored);
    ck(new Set(fresh.map(c=>c.id)).size===fresh.length,'new material patches must not alias one another');
    for(const name of used)ck(X.names.includes(audio.byKey[name]?.id),'playback without a score: '+name);
    for(const c of audio.cues){
      ck(used.has(c.key),'unreachable gallery entry: '+c.key);
      ck(gallery.E.sfx.names.includes(c.id) && (!c.previous||gallery.E.sfx.names.includes(c.previous)),'gallery score: '+c.key);
      if(c.restored)ck(!c.previous && !c.id.startsWith('s3x_'),'a returned sound was replaced: '+c.key);
      else{
        const a=current.trace(c.id,3),b=current.trace(c.id,97);
        ck(a.length>1 && JSON.stringify(a)!==JSON.stringify(b),'empty/frozen patch: '+c.key);
        ck(!a.some(x=>x[0]==='speak'),'voice used for '+c.key);
        if(c.key==='cargo')ck(a.some(x=>x[0]==='rotor' && x[4].f<90),'cargo must use a load-bearing rotor');
      }
      for(const lang of LANGS){gallery.E.i18n.set(lang);const k=typeof c.label==='string'?c.label:c.label.weapon?'s3.wp.'+c.label.weapon+'.n':null;
        ck(k?!!gallery.tables[lang][k]:!!c.label[LANGS.indexOf(lang)],'gallery label: '+lang+' '+c.key);}
    }
    ck(audio.byKey.sergei.id==='sergei' && audio.byKey.cargo.id!==audio.byKey.sergei.id && !X.names.some(n=>n.startsWith('s3v6_')),'Sergei and cargo separated; comparison bank is gallery-only');
    // Optional historical audit: normal checks also work in a downloaded ZIP or shallow checkout.
    if(process.env.S3_AUDIO_HISTORY){
      const git=p=>require('child_process').execFileSync('git',['show','24343e4:'+p],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n');
      const archived=git('js/s3/sounds.js'), oldBank=scores(archived), main=git('js/s3/main.js');
      ck(git('js/ui/sfx.js')===fs.readFileSync(path.join(root,'js/ui/sfx.js'),'utf8').replace(/\r\n/g,'\n'),'shared prequel / Curfew engine differs from 24343e4');
      for(const id of Object.keys(oldBank.fns)){
        ck(returned.some(c=>c.id===id),'historical recipe not reachable: '+id);
        for(const seed of [1,23,1112])ck(JSON.stringify(current.trace(id,seed))===JSON.stringify(oldBank.trace(id,seed)),'historical score or mix: '+id);
      }
      const original=main.slice(main.indexOf('  const SHOT ='),main.indexOf('  // ===== 文字小工具'));
      let heard;const route=vm.runInNewContext(original+'\nsound',{play:(id,gap=0)=>{heard=[id,gap];}});
      for(const ev of oldCases){heard=null;route(ev);ck(String(heard)===String(recipe(ev)),'historical dispatch: '+JSON.stringify(ev));}
      ck(JSON.stringify(cameoIds)===JSON.stringify(cameos(main)),'historical encounters');
      console.log('24343e4: '+Object.keys(oldBank.fns).length+' local scores match with three draws; shared bank, encounter map and '+compareableCues+' dispatch cases match');
    }
    // Capture the actual simulation events, not just hand-made dispatch examples.
    const scene=(id,person)=>room({enemies:[{kind:'turret',x:120,y:110}]},{person,gadgets:[{id,lv:2}]});
    function perform(s,n,input=()=>({})) {
      const result=[];
      for(let i=0;i<n;i++){sim.step(s,pad(input(i)));for(const ev of s.ev){const r=recipe(ev);if(r)result.push([i,r[0]]);}s.ev.length=0;}
      return result;
    }
    const cast=i=>({g1:i===0,ax:880,ay:630});
    for(const [id,on,hit,delay] of [['cargo','s3x_cargo','s3x_cargoDrop',D.gadgets.cargo.fuse],
      ['sergei','sergei','s3boom',D.gadgets.sergei.fuse],['molotov','s3x_molotov','s3x_molotovImpact',D.gadgets.molotov.flight],
      ['pipebomb','s3x_pipebomb','s3x_pipeImpact',D.gadgets.pipebomb.flight]]){
      const calls=perform(scene(id),60,cast),land=calls.filter(([i,sound])=>sound===hit);
      ck(calls.some(([i,k])=>i===0 && k===on) && land.length===1 && Math.abs(land[0][0]-delay/sim.DT)<=1.1,id+' touchdown is timed to the actual payload');
      if(id!=='sergei')ck(!calls.some(([,k])=>k==='sergei'||k==='s3boom'),'unwanted voice / generic blast: '+id);
    }
    const show=perform(scene('performance'),60,i=>({...cast(i),mx:i===57?1:0})).map(x=>x[1]);
    ck(['s3x_performance','s3x_stageReady','s3x_stageFlash'].every(k=>show.includes(k)),'charged curtain call');
    const early=perform(scene('performance'),9,i=>({...cast(i),mx:i===7?1:0}));
    ck(!early.some(([,k])=>k==='s3x_stageFlash'),'no flash without a charge');
    const watch=S3.ops.person('hypnotist','ticking','watch');
    ck(perform(scene('hypnosis',watch),1,cast).some(([,k])=>k==='s3x_watch') && perform(scene('hypnosis'),1,cast).some(([,k])=>k==='dream'),'watch template versus legacy hypnosis');
    const borrowed=room({enemies:[{kind:'turret',x:120,y:110}]},{person:watch,gadgets:[{id:'mask',lv:1},{id:'hypnosis',lv:1}]});
    ck(perform(borrowed,1,()=>({g2:true})).some(([,k])=>k==='dream'),'borrowed hypnosis is not the signature pocket watch');
    ck(perform(scene('lure'),1,cast).filter(([,k])=>k==='s3shriek').length===2,'original speaker activation and emitted shriek');
    const beats=perform(scene('metronome'),94,cast).filter(([,k])=>k==='s3x_metronome'||k==='s3x_metroTick').map(x=>x[0]);
    ck(beats.length===3 && beats[0]===0 && Math.abs(beats[1]-43)<=1 && Math.abs(beats[2]-86)<=1,'three audible beats follow the trance pulses');
    // 音樂：三種情境的每一步都排得出來。
    if (X.now() !== 0) fail('s3 music: the clock should be readable once sound is on');
    for (const mode of ['calm', 'fight', 'boss']) {
      const before = nodes;
      for (let i = 0; i < 64; i++) S3.music.test(mode, i);
      if (nodes === before) fail(`s3 music: ${mode} scheduled nothing`);
    }
    S3.music.set('fight');
    if (S3.music.mode !== 'fight') fail('s3 music: mode not set');
    S3.music.set(null);
    console.log(`S3 audio: ${new Set(returned.map(c=>c.id)).size} restored recipes, ${fresh.length} new, ${audio.cues.length} named uses; physical cue timings and music in three moods checked`);
  }
};
