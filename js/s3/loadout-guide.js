(function(E){
  'use strict';
  const S=E.s3,D=S.data,I=E.i18n,B=S.loadoutIndex,$=id=>document.getElementById(id);
  const text={
    intro:['選你常用的武器或招式，看看哪些漏洞能幫上忙。','选你常用的武器或招式，看看哪些漏洞能帮上忙。','Pick a weapon or move you like and see which exploits work with it.'],
    shared:['通用漏洞','通用漏洞','Shared exploits'],personal:['職業專屬','职业专属','Private exploits'],q:['搜尋','搜索','Search'],hint:['名稱或關鍵字，如「吸血」「導彈」','名称或关键词，如“吸血”“导弹”','Name or keyword, e.g. lifesteal, mortar'],action:['武器、招式或裝備','武器、招式或装备','Weapon, move or gadget'],owner:['誰能學','谁能学','Who can learn it'],all:['全部','全部','All'],anyone:['全部職業','全部职业','All professions'],anygear:['全部招式與裝備','全部招式与装备','All moves and equipment'],
    groups:['想加強什麼','想加强什么','What to improve'],attack:['傷害','伤害','Damage'],gun:['槍械','枪械','Guns'],melee:['近戰','近战','Melee'],blast:['爆破','爆破','Blast'],dot:['持續傷害','持续伤害','Damage over time'],summon:['召援','召援','Summons'],hack:['駭入','入侵','Hacks'],control:['控制','控制','Control'],stealth:['潛行','潜行','Stealth'],dodge:['閃避','闪避','Dodge'],defence:['防禦','防御','Defence'],resist:['減傷','减伤','Mitigation'],heal:['治療','治疗','Healing'],resource:['資源','资源','Resources'],
    direct:['作用於','作用于','Applies to'],duration:['延長','延长','Duration'],damage:['增傷','增伤','Damage'],range:['擴大範圍','扩大范围','Reach'],pool:['資源','资源','Resource'],both:['增傷與半徑','增伤与半径','Damage and radius'],trigger:['觸發條件','触发条件','Triggered by'],conditional:['符合條件後增傷','符合条件后增伤','Then boosts'],kill:['擊倒才觸發','击倒才触发','On a kill by'],cost:['代價','代价','Trade-off'],enables:['開啟','开启','Enables'],
    arms:['手持武器','手持武器','Handheld weapons'],tools:['裝備','装备','Gadgets'],moves:['動作與判定','动作与判定','Moves and conditions'],props:['設施','设施','Installations'],
    clear:['清除篩選','清除筛选','Clear filters'],found:['項漏洞','项漏洞','exploits'],empty:['沒有符合的漏洞。試試其他判定，或清除篩選。','没有符合的漏洞。试试其他判定，或清除筛选。','No matching exploits. Try another interaction or clear the filters.'],intrinsic:['這件裝備靠自身等級成長，沒有直接修改它的漏洞。','这件装备靠自身等级成长，没有直接修改它的漏洞。','This gadget scales with its own rank; no exploit directly modifies it.'],
    details:['適用招式與細節','适用招式与细节','What it works with'],list:['列出個別招式','列出各个招式','Show individual moves'],ranks:['各級數值','各级数值','Stats by rank'],cd:['冷卻（秒）','冷却（秒）','Cooldown (s)'],base:['基礎傷害','基础伤害','Base damage'],rushBase:['衝撞額外傷害','冲撞额外伤害','Extra rush damage'],
    rules:['哪些是全隊共用的？OMNI 怎麼升級？','哪些是全队共用的？OMNI 怎么升级？','What does the squad share? How does OMNI work?'],
    ruleText:["通用漏洞全隊都能用。帶特殊職業去黑市，就能買那一職的兩個專屬漏洞；同職兩種打法都能用。","通用漏洞全队都能用。带特殊职业去黑市，就能买那一职的两个专属漏洞；同职两种打法都能用。","Shared exploits work for everyone. Bring a specialist to the black market to buy either private exploit for their profession. Both kits for that profession can use them."],
    omni:["這裡列的是戰役等級。OMNI 每過 30 房，就能比原本多升一級。超過戰役上限後，每升一級會強化同類能力 10%；目前已滿級再拿則是 5%。例如槍械漏洞會加槍傷，職業專屬則加那一職的體力上限。","这里列的是战役等级。OMNI 每过 30 房，就能比原本多升一级。超过战役上限后，每升一级会强化同类能力 10%；目前已满级再拿则是 5%。例如枪械漏洞会加枪伤，职业专属则加那一职的体力上限。","These are campaign ranks. In OMNI you unlock one extra rank every 30 rooms. Ranks beyond the campaign limit boost a related stat by 10%; another copy at the current cap gives 5%. Gun exploits boost gun damage, for example. Private exploits boost that profession’s maximum health."]
  };
  const facets='all attack gun melee blast dot summon hack control stealth dodge defence resist heal resource'.split(' '),langs=['zh-Hant','zh-Hans','en'],word=k=>text[k][langs.indexOf(I.lang)];
  const aliases={strike:'導彈 导弹 轟炸 轰炸 missile bombardment mortar',execute:'掛載手榴彈 挂载手榴弹 槍掛榴彈 枪挂榴弹 榴彈 榴弹 grenade launcher underbarrel',reprieve:'吸血 lifesteal drain',rush:'衝鋒 冲锋 撞人',sledge:'工地鎚 工地锤 大錘 大锤',hiveguard:'護蜂 护蜂',anyF:'制服 制伏 處決 处决 takedown execution'};
  const norm=v=>String(v).trim().toLocaleLowerCase(), roman=n=>['','I','II','III'][n], splitLabel=()=>I.lang==='en'?', ':'、';
  const actions={
    moves:['anyF','heavyF','finishF','jab','dash','focus','ordinaryHit','incoming','medpack','burning','scrap','hijacked','clearRoom','bail'],
    arms:Object.keys(D.weapons),tools:Object.keys(D.gadgets),props:['junction','barrel','vent','car','bollard','camera','speaker','pylon']
  };
  const params=new URLSearchParams(location.search);
  const state={action:params.get('action')||'',owner:params.get('owner')||'',q:params.get('q')||'',facet:params.get('type')||'all'};
  const validAction=id=>Object.values(actions).some(list=>list.includes(id));
  if(!validAction(state.action))state.action='';
  if(!['','shared','personal',...Object.keys(S.ops.profiles)].includes(state.owner))state.owner='';
  if(!facets.includes(state.facet))state.facet='all';
  let lang=params.get('lang');if(!langs.includes(lang)){try{lang=localStorage.getItem('watchdogs-echo.lang');}catch(e){/* file pages may have no storage */}}
  I.set(langs.includes(lang)?lang:'zh-Hant');$('query').value=state.q;
  function el(tag,txt,cls){const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n;}
  function option(parent,id,label){const n=el('option',label);n.value=id;parent.append(n);}
  const exName=id=>I.t('s3.ex.'+id+'.n'), ownerName=id=>I.pick(S.ops.profiles[id].name);
  const groupOrder=['gun','blast','shock','puppet','body','net',...Object.keys(S.ops.profiles)];
  const leaves=id=>B.terms[id]?.children.length?B.terms[id].children.flatMap(leaves):[id];
  // A group can match its descendants; siblings only share effects that name their common group.
  const matchesAction=(id,action)=>B.related(id,action)||B.related(action,id)||leaves(action).some(k=>B.related(id,k));
  function selectLanguage(){
    document.title=I.t('s3.loadout.open')+' · ZERO DAY';$('title').textContent=I.t('s3.loadout.open');$('game').href='s3.html?lang='+I.lang;
    for(const [id,k] of Object.entries({intro:'intro','shared-label':'shared','private-label':'personal','q-label':'q','action-label':'action','owner-label':'owner',clear:'clear','rules-title':'rules','rules-text':'ruleText','omni-text':'omni'}))$(id).textContent=word(k);
    $('query').placeholder=word('hint');$('facets').setAttribute('aria-label',word('groups'));
    $('shared-count').textContent=D.exploits.filter(x=>!x.owner).length;$('private-count').textContent=S.ops.xp.length;
    document.querySelectorAll('[data-lang]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.lang===I.lang)));
    const a=$('action');a.replaceChildren();option(a,'',word('anygear'));for(const [k,ids] of Object.entries(actions)){
      const g=el('optgroup');g.label=word(k);for(const id of ids)option(g,id,B.label(id));a.append(g);
    }a.value=state.action;
    const o=$('owner');o.replaceChildren();option(o,'',word('anyone'));option(o,'shared',word('shared'));option(o,'personal',word('personal'));
    for(const id of Object.keys(S.ops.profiles))option(o,id,word('personal')+' · '+ownerName(id));o.value=state.owner;
    $('facets').replaceChildren(...facets.map(k=>{const b=el('button',word(k));b.dataset.type=k;return b;}));paint();
  }
  function relationship(row,id){return row.routes.some(r=>r.targets.some(k=>matchesAction(k,id)));}
  function equipment(){
    const a=state.action,g=D.gadgets[a],w=D.weapons[a],box=$('gear');box.replaceChildren();box.hidden=!(g||w);if(box.hidden)return;
    box.append(el('h2',B.label(a)),el('p',I.t((g?'s3.gad.':'s3.wp.')+a+'.d')));
    if(g){const levels=[1,2,3],parts=[];
      if(g.perRank)parts.push(word(a==='rush'?'rushBase':'base')+' '+levels.map(i=>D.baseImpact(a,i)).join(' / '));
      parts.push(word('cd')+' '+levels.map(i=>Number(D.gearCooldown(a,i).toFixed(1))).join(' / '));
      const more=el('details',null,'individual');more.append(el('summary',word('ranks')),el('small','I / II / III　·　'+parts.join('　·　')));box.append(more);
    }
  }
  function paint(){
    const q=norm(state.q), exact=q && Object.values(actions).flat().find(a=>norm(B.label(a))===q || norm(a)===q || (aliases[a]||'').toLowerCase().split(' ').includes(q));
    const results=D.exploits.filter(x=>{
      const r=B.rows[x.id],o=state.owner;
      if(o && (o==='shared'?!!x.owner:o==='personal'?!x.owner:x.owner!==o))return false;
      if(state.facet!=='all' && !r.facets.includes(state.facet) || state.action && !relationship(r,state.action))return false;
      if(!q)return true;if(exact)return relationship(r,exact);
      const names=r.routes.flatMap(line=>line.targets.flatMap(k=>[B.label(k),...leaves(k).map(B.label)]));
      return norm([x.id,exName(x.id),x.owner?ownerName(x.owner):'',I.t('s3.ex.'+x.id+'.d'),aliases[x.id]||'',...names,...r.facets.map(word)].join(' ')).includes(q);
    });
    const out=document.createDocumentFragment();for(const key of groupOrder){
      const xs=results.filter(x=>(x.owner||x.tag)===key);if(!xs.length)continue;const priv=!!xs[0].owner;
      const section=el('section',null,'section'+(priv?' private':'')),h=el('h2',priv?ownerName(key):I.t('s3.tag.'+key));
      h.append(el('span',(priv?word('personal'):word('shared'))+' · '+xs.length));section.append(h);
      for(const x of xs){
        const r=B.rows[x.id],article=el('article',null,'entry'),left=el('div'),body=el('div');article.id='x-'+x.id;article.dataset.id=x.id;
        left.append(el('h3',exName(x.id)),el('span',x.max===1?'I':'I–'+roman(x.max),'rank'));body.append(el('p',I.t('s3.ex.'+x.id+'.d')));
        const more=el('details',null,'individual');more.append(el('summary',word('details')));
        for(const line of r.routes){const detail=el('div',null,'route');detail.append(el('b',word(line.role)));
          line.targets.forEach((k,i)=>{if(i)detail.append(splitLabel());detail.append(el('span',B.label(k),(state.action||exact)&&matchesAction(k,state.action||exact)?'match':null));});more.append(detail);
        }
        if(r.note)more.append(el('p',I.pick(r.note),'note'));
        const families=r.routes.filter(line=>line.targets.some(k=>B.terms[k]?.children.length));
        if(families.length){
          const full=el('details',null,'individual');full.append(el('summary',word('list')));
          for(const line of families){const move=el('div',null,'route');move.append(el('b',word(line.role)));
            const ids=new Set(line.targets.flatMap(leaves));move.append([...ids].map(B.label).join(splitLabel()));full.append(move);}
          more.append(full);
        }
        if(r.note || families.length || r.routes.length>1)body.append(more);
        article.append(left,body);section.append(article);
      }out.append(section);
    }
    if(!results.length)out.append(el('p',state.action && D.gadgets[state.action] && !D.exploits.some(x=>relationship(B.rows[x.id],state.action))?word('intrinsic'):word('empty'),'empty'));
    $('entries').replaceChildren(out);$('count').textContent=results.length+' / '+D.exploits.length+' '+word('found');
    $('clear').hidden=!(state.q||state.action||state.owner||state.facet!=='all');equipment();
    for(const b of $('facets').children)b.setAttribute('aria-pressed',String(b.dataset.type===state.facet));
  }
  function update(){
    const p=new URLSearchParams({lang:I.lang});if(state.action)p.set('action',state.action);if(state.owner)p.set('owner',state.owner);if(state.q)p.set('q',state.q);if(state.facet!=='all')p.set('type',state.facet);
    try{history.replaceState(null,'','?'+p);}catch(e){/* Some file origins disallow URL edits. Filters still work. */}paint();
  }
  $('query').addEventListener('input',e=>{state.q=e.target.value;update();});for(const k of ['owner','action'])$(k).addEventListener('change',e=>{state[k]=e.target.value;update();});
  $('facets').addEventListener('click',e=>{if(e.target.dataset.type){state.facet=e.target.dataset.type;update();}});
  $('clear').addEventListener('click',()=>{state.q=state.action=state.owner='';state.facet='all';$('action').value=$('owner').value=$('query').value='';update();});
  document.querySelectorAll('[data-lang]').forEach(n=>n.addEventListener('click',()=>{I.set(n.dataset.lang);selectLanguage();update();}));
  selectLanguage();
})(window.ECHO);
