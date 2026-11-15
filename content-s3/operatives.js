// 《零時差》的六個聯絡人。這些人不進《宵禁》的路人生成池；同一個 id 永遠是同一個人。
(function (E) {
  const L = (en, tc, sc) => ({ en, tc, sc });
  const look = (style, hairC, skin, top, col, hat, hatCol) => ({ style, hairC, skin, o: { top, col, hat, hatCol } });
  const profiles = {
    hitman: {
      name: L('Hitman', '殺手', '杀手'), fixedName: L('Leon Voss', '里昂・沃斯', '利昂·沃斯'), age: 44, district: 'soho',
      bio: L('Soho. Voss used to take contracts on folded theatre tickets. The last ticket held a seat number and no name. Voss kept it. If a job turns loud, the assault rifle comes out.', '蘇豪。沃斯以前在摺好的戲票上接單。最後一張只有座位號，沒有人名。那張票至今還在西裝口袋裡。要是潛入變成交火，沃斯就換突擊步槍。', '苏豪。沃斯以前在折好的戏票上接单。最后一张只有座位号，没有人名。那张票至今还在西装口袋里。要是潜入变成交火，沃斯就换突击步枪。'),
      category: 'physical', skills: [1, 3, 1], portrait: 'pt-elite-hitman', look: look('bald', '#30251f', '#d9a77c', 'suit', '#2b2d33'),
    },
    spy: {
      name: L('Spy', '間諜', '间谍'), fixedName: L('Kit Arden', '基特・阿登', '基特·阿登'), age: 37, district: 'westminster',
      bio: L('Westminster. Arden counted the place settings at embassy dinners. An extra knife meant an unlisted guest. An extra driver meant trouble. The custom suppressed pistol stayed under the jacket.', '西敏。阿登以前替使館晚宴數餐具：多一把刀，是多一位沒登記的賓客；多一個司機，就該走了。訂製消音手槍始終藏在外套裡。', '威斯敏斯特。阿登以前替使馆晚宴数餐具：多一把刀，是多一位没登记的宾客；多一个司机，就该走了。定制消音手枪始终藏在外套里。'),
      category: 'social', skills: [2, 1, 3], portrait: 'pt-elite-spy', look: look('side', '#3a2618', '#f0cdb0', 'suit', '#1e2747'),
    },
    drone_expert: {
      name: L('Drone expert', '無人機專家', '无人机专家'), fixedName: L('Nia Okoro', '妮雅・奧科羅', '妮娅·奥科罗'), age: 29, district: 'isle_of_dogs',
      bio: L('Isle of Dogs. On foggy mornings Nia could land a survey drone by the pitch of its motors. The pink headset predates the guns.', '狗島。早班遇上河霧，妮雅光聽馬達聲就能讓測繪機降落。那副粉紅耳機比機上的槍還早服役。', '狗岛。早班遇上河雾，妮娅光听马达声就能让测绘机降落。那副粉红耳机比机上的枪还早服役。'),
      category: 'hacker', skills: [3, 1, 1], portrait: 'pt-elite-drone', look: look('curly', '#16110e', '#6e4229', 'jacket', '#3b4d5e', 'headset', '#ff2e88'),
    },
    hooligan: {
      name: L('Football hooligan', '足球流氓', '足球流氓'), fixedName: L('Red Malloy', '瑞德・馬洛伊', '雷德·马洛伊'), age: 32, district: 'camden',
      bio: L('Camden. One whistle used to save three seats on the away coach. These days the same three turn up without tickets.', '康登。以前吹一聲口哨，就有人在客場巴士上留三個位子。現在一聲哨響，老位子上的三個人還是會來。', '卡姆登。以前吹一声口哨，就有人在客场大巴上留三个位子。现在一声哨响，老位子上的三个人还是会来。'),
      category: 'physical', skills: [0, 3, 2], portrait: 'pt-elite-hooligan', look: look('crop', '#b4532a', '#f3d5c0', 'tee', '#c8102e'),
    },
    beekeeper: {
      name: L('Beekeeper', '養蜂人', '养蜂人'), fixedName: L('Iris Vale', '艾莉絲・維爾', '艾丽丝·韦尔'), age: 46, district: 'rotherhithe',
      bio: L('Rotherhithe. Vale kept hives on the roof of a printworks. When the presses stopped, the bees were the only things still on shift.', '羅瑟希德。維爾把蜂箱搭在印刷廠屋頂。印刷機停了好幾年，蜂群倒是一天都沒停工。', '罗瑟希德。韦尔把蜂箱搭在印刷厂屋顶。印刷机停了好几年，蜂群倒是一天都没停工。'),
      category: 'specialist', skills: [2, 2, 1], portrait: 'pt-elite-beekeeper', look: look('crop', '#39251c', '#c48a5e', 'jacket', '#efeadf', 'beekeeper', '#f7f3e7'),
    },
    statue: {
      name: L('Living statue', '行為藝術家', '行为艺术家'), fixedName: L('Sol Reed', '索爾・里德', '索尔·里德'), age: 41, district: 'westminster',
      bio: L('Westminster. A council camera once logged Reed as street furniture for a whole winter. The appeal is still pending.', '西敏。有一年冬天，市政攝影機整整三個月都把里德登記成街道設施。更正申請還在排隊。', '威斯敏斯特。有一年冬天，市政摄像头整整三个月都把里德登记成街道设施。更正申请还在排队。'),
      category: 'social', skills: [1, 2, 3], portrait: 'pt-elite-statue', look: look('bald', '#b8902f', '#c9a24a', 'coat', '#b8902f'),
    },
  };
  for (const [id, def] of Object.entries(profiles)) { def.id = id; def.perk = id; }
  function person(id) {
    const d = profiles[id], [hack, physical, social] = d.skills;
    return { id: 'elite-' + id, elite: id, occupation: id, district: d.district, fixedName: d.fixedName, age: d.age,
      skills: { hack, physical, social }, traits: [], quirks: [], flaw: null, threat: 48 };
  }
  E.s3.ops = { profiles, person, jobOf: (p) => profiles[p.elite] || E.people.occupationOf(p) };
})(window.ECHO);
