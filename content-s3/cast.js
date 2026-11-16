// 《零時差》新登場的特殊職業。A–D 是畫單的左上、右上、左下、右下，不隨陣容或模板重新編號。
(function (S) {
  const name = (en, tc, sc) => ({ en, tc, sc });
  const face = (style, hairC, skin, mood, detail = {}) => ({ style, hairC, skin, mood, ...detail });
  const role = (kit, traits, quirks) => ({ kit, traits, quirks });
  const member = (slot, fixedName, age, kit, traits, quirks, look, flaw = null, key = slot) =>
    ({ slot, key, fixedName, age, ...role(kit, traits, quirks), look, flaw });

  // 聯絡人仍是原本的十人；名字、插畫與背景沿用 operatives.js。
  const leads = {
    hitman:       role('contract',   ['calm','careful'],         ['ex_army','tea']),
    spy:          role('spotter',    ['memory','unremarkable'],  ['birdwatcher','mahjong']),
    drone_expert: role('flightdeck', ['nimble','calm'],          ['gamer','night_shift']),
    hooligan:     role('terrace',    ['strong','connected'],     ['liverpool','marathon']),
    beekeeper:    role('apiary',     ['careful','nimble'],       ['birdwatcher','knitting']),
    statue:       role('plinth',     ['unremarkable','calm'],    ['night_shift','choir']),
    hypnotist:    role('watch',      ['silver','careful'],       ['tea','choir']),
    anarchist:    role('bottle',     ['fast','nimble'],          ['cyclist','mahjong']),
    paramedic:    role('station',    ['driver','calm'],          ['night_shift','tea']),
    barrister:    role('chambers',   ['memory','silver'],        ['mahjong','birdwatcher']),
  };

  const peers = {
    hitman: [
      member('a', name('Marc Bellamy','馬克・貝拉米','马克·贝拉米'), 27, 'runner', ['fast','nimble'], ['cyclist','knitting'], face('crop','#201919','#815339','cross'), null, 'marc-bellamy'),
      member('b', name('Felix Ward','菲利克斯・沃德','费利克斯·沃德'), 31, 'contract', ['calm','memory'], ['birdwatcher','night_shift'], face('side','#282426','#cc997e','neutral'), 'dark'),
      member('c', name('June Mercer','瓊・默瑟','琼·默瑟'), 33, 'contract', ['careful','unremarkable'], ['tea','ex_army'], face('bob','#c2b8a7','#e4b69b','neutral')),
      member('d', name('Ravi Shah','拉維・沙阿','拉维·沙阿'), 32, 'runner', ['strong','driver'], ['marathon','dogs_love'], face('crop','#29201c','#ab7554','cross',{beardKind:'beard'}), 'hothead'),
    ],
    spy: [
      member('a', name('Lena Hui','許琳娜','许琳娜'), 30, 'undercover', ['silver','nimble'], ['cantonese','mahjong'], face('bob','#251e27','#dca88a','smirk',{o:{col:'#dbcfc0',extra:'scarf',scarf:'#205b50',stripe:'#205b50',tie:'#205b50'}}), 'phone'),
      member('b', name('Quentin Price','昆廷・普萊斯','昆廷·普莱斯'), 32, 'spotter', ['calm','careful'], ['ex_army','choir'], face('crop','#241b1b','#784d38','grin',{beardKind:'moustache',o:{col:'#ddd3bc'}}), 'honest'),
      member('c', name('Ivo March','伊沃・馬奇','伊沃·马奇'), 29, 'undercover', ['memory','connected'], ['birdwatcher','tea'], face('curly','#c8ad88','#c69675','smirk',{o:{col:'#ddd2c0',extra:'scarf',scarf:'#343451',stripe:'#343451',tie:'#343451'}}), null, 'ivo-march'),
      member('d', name('Toby Fen','托比・芬','托比·芬'), 26, 'spotter', ['fast','unremarkable'], ['gamer','cyclist'], face('curly','#986044','#e1b29b','grin',{freckles:true})),
    ],
    beekeeper: [
      member('a', name('Ada Mensah','艾達・門薩','艾达·门萨'), 68, 'apiary', ['nimble','memory'], ['birdwatcher','cyclist'], face('braids','#afaaa2','#795039','smile')),
      member('b', name('Ellis Frost','埃利斯・弗羅斯特','埃利斯·弗罗斯特'), 72, 'veilguard', ['careful','driver'], ['tea','dogs_love'], face('side','#bab4ac','#be9479','neutral',{beardKind:'stubble'}), 'acrophobia'),
      member('c', name('Elsie Oakes','艾爾西・奧克斯','埃尔西·奥克斯'), 76, 'apiary', ['connected','calm'], ['knitting','choir'], face('curly','#d3c9c0','#deb899','smile'), 'loudmouth'),
      member('d', name('Samir Das','薩米爾・達斯','萨米尔·达斯'), 64, 'veilguard', ['strong','fast'], ['marathon','night_shift'], face('crop','#c2b6a8','#a3724f','neutral',{beardKind:'beard'})),
    ],
    drone_expert: [
      member('a', name('Arun Patel','阿倫・帕特爾','阿伦·帕特尔'), 25, 'flightdeck', ['nimble','fast'], ['gamer','cyclist'], face('curly','#2d211c','#a5704f','smile')),
      member('b', name('Billie Holt','比莉・霍爾特','比莉·霍尔特'), 28, 'gunship', ['careful','memory'], ['birdwatcher','night_shift'], face('side','#83738e','#d7a788','cross'), 'honest'),
      member('c', name('Winnie Beck','溫妮・貝克','温妮·贝克'), 34, 'gunship', ['calm','connected'], ['ex_army','tea'], face('crop','#29232b','#734b37','grin'), null, 'winnie-beck'),
      member('d', name('Jo Tan','陳喬','陈乔'), 24, 'flightdeck', ['nightowl','driver'], ['gamer','mahjong'], face('bob','#201d23','#dcaa86','neutral',{freckles:true}), 'no_sense'),
    ],
    hooligan: [
      member('a', name('Mick Doyle','米克・多伊爾','米克·多伊尔'), 24, 'turnstile', ['strong','fast'], ['man_utd','marathon'], face('crop','#241e23','#d7aa8d','grin'), 'hothead'),
      member('b', name('Reuben King','魯本・金','鲁本·金'), 29, 'terrace', ['connected','driver'], ['liverpool','cyclist'], face('braids','#302522','#81553d','smirk',{beardKind:'stubble'}), null, 'reuben-king'),
      member('c', name('Fergus Duffy','費格斯・達菲','弗格斯·达菲'), 32, 'turnstile', ['cheerful','nimble'], ['choir','knitting'], face('crop','#ad573b','#dfac8d','grin',{beardKind:'moustache'}), null, 'fergus-duffy'),
      member('d', name('Eddie Shaw','艾迪・蕭','埃迪·肖'), 46, 'terrace', ['silver','strong'], ['man_utd','tea'], face('side','#756a60','#c99978','grin',{beardKind:'stubble'}), 'bad_knees'),
    ],
    statue: [
      member('a', name('Alex Finch','亞歷克斯・芬奇','亚历克斯·芬奇'), 26, 'plinth', ['calm','strong'], ['ex_army','birdwatcher'], face('side','#977742','#c6a45e','neutral')),
      member('b', name('Nina Saye','妮娜・賽伊','妮娜·赛伊'), 31, 'encore', ['silver','nightowl'], ['choir','night_shift'], face('side','#977852','#c09d68','neutral'), 'acrophobia'),
      member('c', name('Basil Pike','巴茲爾・派克','巴兹尔·派克'), 53, 'plinth', ['careful','memory'], ['tea','knitting'], face('side','#ac8b54','#d2b478','neutral',{beardKind:'moustache'}), 'bad_knees'),
      member('d', name('Rosa Marin','羅莎・馬林','罗莎·马林'), 29, 'encore', ['cheerful','fast'], ['cyclist','mahjong'], face('braids','#956835','#ba9055','grin')),
    ],
    hypnotist: [
      member('a', name('Nell Quill','奈爾・奎爾','内尔·奎尔'), 29, 'watch', ['memory','unremarkable'], ['tea','knitting'], face('bob','#2b2029','#e1ad92','neutral')),
      member('b', name('Farid Noor','法里德・努爾','法里德·努尔'), 38, 'beat', ['calm','nimble'], ['night_shift','gamer'], face('side','#332521','#ab7657','cross',{beardKind:'moustache'}), 'dark'),
      member('c', name('Celia Baptiste','西莉亞・巴蒂斯特','西莉亚·巴蒂斯特'), 57, 'watch', ['silver','connected'], ['choir','birdwatcher'], face('curly','#c7c2bd','#784e38','smile'), 'record'),
      member('d', name('Jasper Rowe','賈斯珀・羅','贾斯珀·罗'), 36, 'beat', ['nightowl','strong'], ['marathon','tea'], face('ponytail','#93573a','#cda183','smirk')),
    ],
    anarchist: [
      member('a', name('Imani Ford','伊瑪妮・福特','伊玛妮·福特'), 24, 'bottle', ['fast','connected'], ['cyclist','dogs_love'], face('braids','#282026','#7d503b','smirk',{earring:true})),
      member('b', name('Kit Moss','基特・莫斯','基特·莫斯'), 22, 'fuse', ['nimble','nightowl'], ['gamer','night_shift'], face('crop','#dfd3af','#deb79c','smirk'), 'phone'),
      member('c', name('Fran Keane','法蘭・基恩','弗兰·基恩'), 27, 'fuse', ['memory','driver'], ['knitting','tea'], face('mohawk','#425aaf','#c49173','smirk')),
      member('d', name('Tariq Amin','塔里克・阿明','塔里克·阿明'), 26, 'bottle', ['strong','careful'], ['ex_army','mahjong'], face('crop','#302525','#a16b51','cross',{beardKind:'stubble',earring:true}), 'record'),
    ],
    paramedic: [
      member('a', name('Finn Lowe','芬恩・洛','芬恩·洛'), 26, 'stretcher', ['fast','driver'], ['marathon','night_shift'], face('crop','#493732','#d8ac91','smile')),
      member('b', name('Nadine Ellis','娜汀・艾利斯','娜丁·埃利斯'), 34, 'station', ['strong','calm'], ['dogs_love','knitting'], face('bun','#271f20','#80523a','smirk')),
      member('c', name('Hazel Kemp','海柔・肯普','黑兹尔·肯普'), 43, 'station', ['memory','careful'], ['tea','ex_army'], face('side','#968067','#c89c7f','neutral',{freckles:true}), 'bad_knees', 'hazel-kemp'),
      member('d', name('Tess Byrne','泰絲・伯恩','泰丝·伯恩'), 28, 'stretcher', ['nimble','cheerful'], ['cyclist','choir'], face('curly','#92492c','#e1b098','smile',{freckles:true}), 'no_sense'),
    ],
    barrister: [
      member('a', name('Audrey Blake','奧黛麗・布萊克','奥黛丽·布莱克'), 41, 'circuit', ['silver','fast'], ['marathon','choir'], face('crop','#272021','#714533','smile')),
      member('b', name('Benedict Cross','班尼迪克特・克羅斯','本尼迪克特·克罗斯'), 48, 'chambers', ['careful','strong'], ['birdwatcher','knitting'], face('side','#534239','#d6a487','cross'), 'honest'),
      member('c', name('Sylvia Tang','鄧思瑋','邓思玮'), 58, 'chambers', ['memory','connected'], ['cantonese','mahjong'], face('bun','#645955','#d8a788','smirk',{specs:true})),
      member('d', name('Malik Latif','馬利克・拉蒂夫','马利克·拉蒂夫'), 46, 'circuit', ['calm','driver'], ['tea','ex_army'], face('crop','#51443f','#a27152','neutral',{beardKind:'beard'}), 'acrophobia'),
    ],
  };
  // These actors already have service records in older saves. Only a former teammate can be called back.
  const retired = {
    hitman: [member('a', name('Mara Bellamy','瑪拉・貝拉米','玛拉·贝拉米'), 28, 'runner', ['fast','nimble'], ['cyclist','knitting'], face('curly','#201919','#815339','cross'))],
    spy: [member('c', name('Ines March','伊內絲・馬奇','伊内丝·马奇'), 63, 'undercover', ['memory','connected'], ['birdwatcher','tea'], face('bun','#aa9f88','#d4a183','neutral'))],
    drone_expert: [member('c', name('Winston Beck','溫斯頓・貝克','温斯顿·贝克'), 64, 'gunship', ['calm','connected'], ['ex_army','tea'], face('crop','#ccc6bc','#734b37','grin',{beardKind:'moustache'}))],
    hooligan: [
      member('b', name('Rochelle King','羅雪兒・金','罗谢尔·金'), 32, 'terrace', ['connected','driver'], ['liverpool','cyclist'], face('braids','#302522','#81553d','smirk')),
      member('c', name('Fern Duffy','芬・達菲','芬·达菲'), 48, 'turnstile', ['cheerful','nimble'], ['choir','knitting'], face('curly','#934f38','#dfac8d','smile')),
    ],
    paramedic: [member('c', name('Hugh Kemp','休・肯普','休·肯普'), 62, 'station', ['memory','careful'], ['tea','ex_army'], face('side','#bbb3a6','#c89c7f','smile'), 'bad_knees')],
  };
  S.casting = { leads, peers, retired };
})(window.ECHO.s3);
