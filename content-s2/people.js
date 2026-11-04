// 第二季路人生成用的三語資料表。每一筆都帶 en（英文）、tc（繁中）、sc（簡中）。
// 原則：
// - 姓名照各族裔的真實拼法音譯；華人姓名在三種語言中都是「姓在前」。
// - 祕密與麻煩以整句為單位，三語分開撰寫，不逐字拼接，避免量詞與語序錯誤。
// - 句子裡不用代名詞，只用 {name}，所以不需要處理性別。
// 社群可以直接往這些表裡加資料（見 CONTRIBUTING.md），自動測試會檢查三語是否齊全。
(function (E) {
  const S2 = (E.s2 = E.s2 || {});
  const n = (en, tc, sc) => ({ en, tc, sc: sc || tc });

  // ===== 姓名 =====
  // order：given-first（名在前）或 family-first（姓在前）
  const heritages = {
    british: {
      order: 'given-first',
      given: [n('Tom', '湯姆', '汤姆'), n('Sophie', '蘇菲', '苏菲'), n('Jack', '傑克', '杰克'), n('Emily', '艾蜜莉', '艾米莉'),
        n('Harry', '哈利'), n('Grace', '葛蕾絲', '格蕾丝'), n('Oliver', '奧利佛', '奥利弗'), n('Chloe', '克蘿伊', '克洛伊'),
        n('Lucy', '露西'), n('George', '喬治', '乔治'), n('Amelia', '艾米莉亞', '艾米莉娅'), n('Callum', '卡勒姆'), n('Isla', '艾拉'), n('Ryan', '萊恩', '瑞安'), n('Poppy', '波比'), n('Sam', '山姆')],
      family: [n('Briggs', '布里格斯'), n('Taylor', '泰勒'), n('Hughes', '休斯'), n('Clarke', '克拉克'),
        n('Bennett', '班奈特', '贝内特'), n('Cooper', '庫珀', '库珀'), n('Fletcher', '弗萊徹', '弗莱彻'), n('Holloway', '霍洛威'),
        n('Walker', '沃克'), n('Price', '普萊斯', '普莱斯'), n('Turner', '特納', '特纳'), n('Shaw', '蕭', '肖')],
    },
    irish: {
      order: 'given-first',
      given: [n('Niamh', '妮芙'), n('Ciaran', '奇蘭', '奇兰'), n('Orla', '奧拉', '奥拉'), n('Declan', '德克蘭', '德克兰'),
        n('Roisin', '羅欣', '罗欣'), n('Sean', '尚恩', '肖恩'), n('Maeve', '梅芙'), n('Liam', '連恩', '利亚姆'),
        n('Aoife', '伊法'), n('Conor', '康納', '康纳'), n('Saoirse', '瑟夏'), n('Padraig', '帕德里格'), n('Ciara', '琪拉'), n('Eoin', '歐恩', '欧恩'), n('Grainne', '葛蘭妮', '格兰妮'), n('Darragh', '達拉', '达拉')],
      family: [n('Murphy', '墨菲'), n("O'Brien", '歐布萊恩', '奥布赖恩'), n('Kelly', '凱利', '凯利'), n('Byrne', '伯恩'),
        n('Doyle', '多伊爾', '多伊尔'), n('Walsh', '沃什'), n('Quinn', '奎因'), n('Gallagher', '加拉格爾', '加拉格尔'),
        n('Brennan', '布倫南', '布伦南'), n('Fitzgerald', '費茲傑羅', '菲茨杰拉德'), n('Nolan', '諾蘭', '诺兰'), n('Kavanagh', '卡瓦納', '卡瓦纳')],
    },
    caribbean: {
      order: 'given-first',
      given: [n('Jerome', '傑羅姆', '杰罗姆'), n('Keisha', '琪莎', '基莎'), n('Andre', '安德烈'), n('Shanice', '夏妮絲', '莎妮丝'),
        n('Winston', '溫斯頓', '温斯顿'), n('Tanya', '坦雅', '塔尼娅'), n('Delroy', '德爾羅伊', '德尔罗伊'), n('Monique', '莫妮克'),
        n('Marcus', '馬可斯', '马库斯'), n('Jada', '潔達', '洁达'), n('Leroy', '勒羅伊', '勒罗伊'), n('Kemar', '凱馬', '凯马'), n('Simone', '西蒙娜'), n('Tyrone', '泰隆'), n('Precious', '普蕾雪絲', '普蕾雪丝'), n('Errol', '艾洛', '埃罗尔')],
      family: [n('Campbell', '坎貝爾', '坎贝尔'), n('Brown', '布朗'), n('Thompson', '湯普森', '汤普森'), n('Grant', '格蘭特', '格兰特'),
        n('Francis', '法蘭西斯', '弗朗西斯'), n('Henry', '亨利'), n('Morgan', '摩根'), n('Bailey', '貝利', '贝利'),
        n('Williams', '威廉斯'), n('Clarke', '克拉克'), n('Reid', '里德'), n('Gayle', '蓋爾', '盖尔')],
    },
    west_african: {
      order: 'given-first',
      given: [n('Chidi', '奇迪'), n('Adaeze', '阿達澤', '阿达泽'), n('Kwame', '夸梅'), n('Ama', '阿瑪', '阿玛'),
        n('Tunde', '通德'), n('Folake', '芙拉珂', '弗拉克'), n('Kofi', '科菲'), n('Zainab', '扎伊納布', '扎伊纳布'),
        n('Emeka', '埃梅卡'), n('Yaa', '雅雅'), n('Femi', '費米', '费米'), n('Ngozi', '恩戈齊', '恩戈齐'), n('Kwabena', '夸貝納', '夸贝纳'), n('Abena', '阿貝娜', '阿贝娜'), n('Segun', '塞貢', '塞贡'), n('Efua', '埃芙亞', '埃芙娅')],
      family: [n('Okonkwo', '奧孔科', '奥孔科'), n('Mensah', '門薩', '门萨'), n('Adeyemi', '阿德耶米'), n('Owusu', '歐烏蘇', '奥乌苏'),
        n('Eze', '埃澤', '埃泽'), n('Bello', '貝洛', '贝洛'), n('Asante', '阿桑特'), n('Nwosu', '恩沃蘇', '恩沃苏'),
        n('Boateng', '博阿滕'), n('Obi', '奧比', '奥比'), n('Danso', '丹索'), n('Okafor', '奧卡福', '奥卡福')],
    },
    south_asian: {
      order: 'given-first',
      given: [n('Priya', '普莉雅', '普丽娅'), n('Arjun', '阿瓊', '阿琼'), n('Aisha', '艾莎'), n('Imran', '伊姆蘭', '伊姆兰'),
        n('Kiran', '基蘭', '基兰'), n('Rahul', '拉胡爾', '拉胡尔'), n('Nadia', '娜迪亞', '娜迪娅'), n('Sunil', '蘇尼爾', '苏尼尔'),
        n('Ravi', '拉維', '拉维'), n('Fatima', '法蒂瑪', '法蒂玛'), n('Vikram', '維克拉姆', '维克拉姆'), n('Anjali', '安潔莉', '安洁莉'), n('Zain', '贊恩', '赞恩'), n('Meera', '米拉'), n('Tariq', '塔里克'), n('Leela', '莉拉')],
      family: [n('Shah', '沙阿'), n('Patel', '帕特爾', '帕特尔'), n('Khan', '汗'), n('Rahman', '拉赫曼'),
        n('Singh', '辛格'), n('Hussain', '侯賽因', '侯赛因'), n('Chaudhry', '喬杜里', '乔杜里'), n('Ahmed', '艾哈邁德', '艾哈迈德'),
        n('Gupta', '古普塔'), n('Mistry', '米斯特里'), n('Iqbal', '伊克巴爾', '伊克巴尔'), n('Kaur', '考爾', '考尔')],
    },
    hongkong: {
      order: 'family-first',
      given: [n('Mei-ling', '美玲'), n('Ka-wai', '嘉慧'), n('Chi-keung', '志強', '志强'), n('Wing-yan', '詠欣', '咏欣'),
        n('Ho-yin', '浩賢', '浩贤'), n('Siu-man', '少文'), n('Tsz-kin', '子健'), n('Hoi-yan', '凱欣', '凯欣'),
        n('Wai-man', '偉文', '伟文'), n('Pui-yee', '佩儀', '佩仪'), n('Kwok-wing', '國榮', '国荣'), n('Sze-wan', '思韻', '思韵'), n('Chun-hei', '俊熙'), n('Man-yi', '敏儀', '敏仪'), n('Tak-ming', '德明'), n('Yan-ting', '欣婷')],
      family: [n('Wong', '黃', '黄'), n('Chan', '陳', '陈'), n('Lee', '李'), n('Cheung', '張', '张'),
        n('Lau', '劉', '刘'), n('Ng', '吳', '吴'), n('Ho', '何'), n('Leung', '梁'),
        n('Tang', '鄧', '邓'), n('Yip', '葉', '叶'), n('Tse', '謝', '谢'), n('Kwok', '郭')],
    },
    mainland: {
      order: 'family-first',
      given: [n('Lei', '磊'), n('Xinyi', '欣怡'), n('Hao', '浩'), n('Yuting', '雨婷'),
        n('Jun', '俊'), n('Siyu', '思雨'), n('Bo', '博'), n('Jiahui', '佳慧'),
        n('Yifan', '一帆'), n('Mengqi', '夢琪', '梦琪'), n('Tao', '濤', '涛'), n('Shuang', '爽'), n('Zihan', '子涵'), n('Wei', '偉', '伟'), n('Ruoxi', '若曦'), n('Kai', '凱', '凯')],
      family: [n('Wang', '王'), n('Zhang', '張', '张'), n('Liu', '劉', '刘'), n('Zhou', '周'),
        n('Sun', '孫', '孙'), n('Zhao', '趙', '赵'), n('Xu', '徐'), n('Lin', '林'),
        n('Huang', '黃', '黄'), n('Wu', '吳', '吴'), n('Ma', '馬', '马'), n('Gao', '高')],
    },
  };

  // ===== 行政區 =====
  // heritage：各族裔的出現權重，大致對應倫敦各區的人口組成。
  const districts = {
    camden: {
      name: n('Camden', '康登', '卡姆登'),
      heritage: { british: 40, irish: 12, caribbean: 14, west_african: 10, south_asian: 14, hongkong: 5, mainland: 5 },
    },
    soho: {
      name: n('Chinatown & Soho', '唐人街與蘇豪', '唐人街与苏豪'),
      heritage: { british: 28, irish: 6, caribbean: 6, west_african: 6, south_asian: 8, hongkong: 28, mainland: 18 },
    },
    isle_of_dogs: {
      name: n('Isle of Dogs', '狗島', '狗岛'),
      heritage: { british: 34, irish: 6, caribbean: 8, west_african: 12, south_asian: 22, hongkong: 8, mainland: 10 },
    },
    rotherhithe: {
      name: n('Rotherhithe & Southwark', '羅瑟希德與南岸', '罗瑟希德与南岸'),
      heritage: { british: 30, irish: 12, caribbean: 16, west_african: 22, south_asian: 10, hongkong: 5, mainland: 5 },
    },
    westminster: {
      name: n('Westminster', '西敏', '威斯敏斯特'),
      heritage: { british: 46, irish: 10, caribbean: 8, west_african: 8, south_asian: 14, hongkong: 7, mainland: 7 },
    },
  };

  // ===== 職業專長 =====
  const perks = {
    backdoor: { name: n('Backdoor', '後門', '后门'), desc: n('Once a night, a hack costs no bandwidth.', '每晚一次，駭入不消耗頻寬。', '每晚一次，入侵不消耗带宽。') },
    network_access: { name: n('Network access', '內網權限', '内网权限'), desc: n('Can hack office systems without raising exposure.', '駭入公司系統時不增加曝光。', '入侵公司系统时不增加暴露。') },
    broadcast: { name: n('Live stream', '直播', '直播'), desc: n('Can broadcast evidence to thousands of viewers.', '可以把證據直播給上萬人看。', '可以把证据直播给上万人看。') },
    botnet: { name: n('Botnet', '殭屍網路', '僵尸网络'), desc: n('Can jam drones for one turn.', '可以干擾無人機一回合。', '可以干扰无人机一回合。') },
    site_pass: { name: n('Site pass', '工地門卡', '工地门卡'), desc: n('Walks straight into any construction site.', '可以直接進出任何工地。', '可以直接进出任何工地。') },
    building_access: { name: n('Delivery access', '送貨通行', '送货通行'), desc: n('Gets into residential blocks without questions.', '進出住宅大樓不會被盤問。', '进出住宅楼不会被盘问。') },
    heavy_lift: { name: n('Heavy lifting', '搬重物', '搬重物'), desc: n('Can clear blocked routes.', '可以搬開擋路的障礙。', '可以搬开挡路的障碍。') },
    climb: { name: n('Climbing', '攀爬', '攀爬'), desc: n('Can take routes over rooftops and walls.', '可以走屋頂和翻牆的路線。', '可以走屋顶和翻墙的路线。') },
    sprint: { name: n('Sprint', '衝刺', '冲刺'), desc: n('Can outrun a patrol on foot.', '可以甩開徒步巡邏的追兵。', '可以甩开徒步巡逻的追兵。') },
    river_route: { name: n('River route', '水路', '水路'), desc: n('Can move between riverside districts by boat.', '可以搭船往來沿河的行政區。', '可以坐船往来沿河的行政区。') },
    bail: { name: n('Bail', '保釋', '保释'), desc: n('Can get an arrested teammate released.', '可以把被捕的隊員保出來。', '可以把被捕的队员保出来。') },
    press: { name: n('Press', '見報', '见报'), desc: n('Can make evidence front-page news.', '可以讓證據登上頭版。', '可以让证据登上头版。') },
    gossip: { name: n('Gossip', '打聽', '打听'), desc: n('Hears things nobody is supposed to know.', '能打聽到不該外流的消息。', '能打听到不该外传的消息。') },
    smooth_talk: { name: n('Smooth talker', '能言善道', '能言善道'), desc: n('Can talk past a guard.', '可以用嘴騙過守衛。', '可以靠嘴骗过守卫。') },
    distraction: { name: n('Distraction', '製造騷動', '制造骚动'), desc: n('Can pull a crowd and the drones with it.', '可以引來人群，連無人機也一起引開。', '可以引来人群，连无人机也一起引开。') },
    disguise: { name: n('Disguise', '喬裝', '乔装'), desc: n('Can pass as staff for one scene.', '可以假扮成工作人員混過一個場景。', '可以假扮成工作人员混过一个场景。') },
    heal: { name: n('First aid', '急救', '急救'), desc: n('Can treat an injured teammate overnight.', '可以在一晚內治好受傷的隊員。', '可以在一晚内治好受伤的队员。') },
    lockpick: { name: n('Lockpicking', '開鎖', '开锁'), desc: n('Opens any mechanical lock.', '可以打開任何機械鎖。', '可以打开任何机械锁。') },
    getaway: { name: n('Getaway driver', '接應撤離', '接应撤离'), desc: n('A failed mission ends without an arrest.', '任務失敗時不會有人被捕。', '任务失败时不会有人被捕。') },
    unsuspicious: { name: n('Unsuspicious', '沒人懷疑', '没人怀疑'), desc: n('Threat score never goes up.', '威脅評分不會上升。', '威胁评分不会上升。') },
  };

  // ===== 職業 =====
  // category：hacker 駭客／physical 身體／social 社交／specialist 專長
  // districts：在哪些區比較常見（未列出的區權重為 1）
  const occupations = [
    { id: 'programmer', name: n('Programmer', '程式設計師', '程序员'), category: 'hacker', perk: 'backdoor', age: [22, 45], districts: { isle_of_dogs: 3 } },
    { id: 'it_support', name: n('IT support', 'IT 支援人員', 'IT 支持人员'), category: 'hacker', perk: 'network_access', age: [20, 50], districts: { isle_of_dogs: 2, westminster: 2 } },
    { id: 'streamer', name: n('Streamer', '遊戲實況主', '游戏主播'), category: 'hacker', perk: 'broadcast', age: [18, 30], districts: { camden: 3 } },
    { id: 'cs_student', name: n('Computer science student', '資工系學生', '计算机系学生'), category: 'hacker', perk: 'botnet', age: [18, 24], districts: { camden: 2 } },
    { id: 'builder', name: n('Builder', '建築工人', '建筑工人'), category: 'physical', perk: 'site_pass', age: [20, 60], districts: { isle_of_dogs: 2, rotherhithe: 2 } },
    { id: 'courier', name: n('Delivery rider', '外送員', '外卖骑手'), category: 'physical', perk: 'building_access', age: [18, 50], districts: { soho: 3, camden: 2 } },
    { id: 'removals', name: n('Removals worker', '搬家工人', '搬家工人'), category: 'physical', perk: 'heavy_lift', age: [20, 55], districts: { rotherhithe: 2 } },
    { id: 'firefighter', name: n('Firefighter', '消防員', '消防员'), category: 'physical', perk: 'climb', age: [22, 50], districts: {} },
    { id: 'trainer', name: n('Personal trainer', '健身教練', '健身教练'), category: 'physical', perk: 'sprint', age: [20, 40], districts: { westminster: 2 } },
    { id: 'docker', name: n('Dock worker', '碼頭工人', '码头工人'), category: 'physical', perk: 'river_route', age: [25, 60], districts: { rotherhithe: 3, isle_of_dogs: 2 } },
    { id: 'lawyer', name: n('Lawyer', '律師', '律师'), category: 'social', perk: 'bail', age: [26, 65], districts: { westminster: 3 } },
    { id: 'journalist', name: n('Journalist', '記者', '记者'), category: 'social', perk: 'press', age: [24, 60], districts: { westminster: 2, soho: 1 } },
    { id: 'bartender', name: n('Bartender', '酒保', '调酒师'), category: 'social', perk: 'gossip', age: [20, 45], districts: { soho: 3, camden: 2 } },
    { id: 'salesperson', name: n('Salesperson', '業務員', '销售员'), category: 'social', perk: 'smooth_talk', age: [22, 55], districts: { isle_of_dogs: 2 } },
    { id: 'busker', name: n('Busker', '街頭藝人', '街头艺人'), category: 'social', perk: 'distraction', age: [18, 60], districts: { camden: 3, soho: 2 } },
    { id: 'actor', name: n('Stage actor', '劇場演員', '话剧演员'), category: 'social', perk: 'disguise', age: [20, 60], districts: { soho: 3 } },
    { id: 'nurse', name: n('Nurse', '護理師', '护士'), category: 'specialist', perk: 'heal', age: [22, 60], districts: { rotherhithe: 2 } },
    { id: 'locksmith', name: n('Locksmith', '鎖匠', '锁匠'), category: 'specialist', perk: 'lockpick', age: [25, 70], districts: {} },
    { id: 'cabbie', name: n('Cab driver', '計程車司機', '出租车司机'), category: 'specialist', perk: 'getaway', age: [30, 70], districts: { westminster: 2 } },
    { id: 'teacher', name: n('Retired teacher', '退休教師', '退休教师'), category: 'specialist', perk: 'unsuspicious', age: [62, 80], districts: { rotherhithe: 2, camden: 1 } },
  ];

  // 少見的職業：出現機率較低，Profiler 上會標示。
  for (const id of ['firefighter', 'locksmith', 'cabbie', 'teacher']) occupations.find((o) => o.id === id).tier = 'uncommon';

  // ===== 稀有人物 =====
  // 約 5% 的路人是稀有人物：職業本身就是一張王牌。格式和一般職業相同，另外帶 rare: true。
  const rares = [
    { id: 'drone_op', rare: true, name: n('Ex-Lionheart drone pilot', '前獅心防務無人機操作員', '前狮心防务无人机操作员'), category: 'hacker', perk: 'take_over', age: [24, 40], threat: 20 },
    { id: 'pigeon', rare: true, name: n('Pigeon keeper', '養鴿人', '养鸽人'), category: 'specialist', perk: 'pigeon_post', age: [50, 80] },
    { id: 'cobol', rare: true, name: n('Retired COBOL engineer', '退休 COBOL 工程師', '退休 COBOL 工程师'), category: 'hacker', perk: 'legacy', age: [70, 85], threatCap: 5 },
    { id: 'radio', rare: true, name: n('Pirate radio host', '地下電台主持人', '地下电台主持人'), category: 'social', perk: 'pirate_radio', age: [25, 60] },
    { id: 'cleaner', rare: true, name: n('Night cleaner', '夜班清潔工', '夜班清洁工'), category: 'specialist', perk: 'master_keys', age: [30, 65] },
    { id: 'parkour', rare: true, name: n('Teen free-runner', '跑酷少年', '跑酷少年'), category: 'physical', perk: 'rooftops', age: [16, 19] },
  ];
  Object.assign(perks, {
    take_over: { name: n('Take over', '接管', '接管'), desc: n('Once per operation, take control of a patrol drone. Alert −30.', '每次行動一次，接管一架巡邏無人機。警戒 −30。', '每次行动一次，接管一架巡逻无人机。警戒 −30。') },
    pigeon_post: { name: n('Pigeon post', '信鴿', '信鸽'), desc: n('At data stages, a pigeon flies the drive out. No alert.', '遇到資料關卡時，讓鴿子把隨身碟送出去，不增加警戒。', '遇到数据关卡时，让鸽子把U盘送出去，不增加警戒。') },
    legacy: { name: n('Legacy systems', '老系統', '老系统'), desc: n('Hacks raise no alert and work far more often. Drones never rate this person a threat.', '駭入不增加警戒，成功率大幅提高。無人機永遠不把這個人當成威脅。', '入侵不增加警戒，成功率大幅提高。无人机永远不把这个人当成威胁。') },
    pirate_radio: { name: n('Pirate radio', '地下電台', '地下电台'), desc: n('Broadcast operations win twice the support.', '插播行動得到的民心加倍。', '插播行动得到的民心加倍。') },
    master_keys: { name: n('Master keys', '萬能鑰匙', '万能钥匙'), desc: n('Opens any door. No alert.', '整棟大樓的門都能開，不增加警戒。', '整栋大楼的门都能开，不增加警戒。') },
    rooftops: { name: n('Rooftops', '走屋頂', '走屋顶'), desc: n('At patrol stages, goes over the top. Climbing is much safer.', '遇到巡邏關卡時可以走屋頂繞過去，攀爬也安全得多。', '遇到巡逻关卡时可以走屋顶绕过去，攀爬也安全得多。') },
  });

  // ===== 特質：每個人兩個，每個特質是一張招式卡 =====
  // kind：active 主動（玩家打出）、react 反應（事情發生時詢問）、passive 被動（一直有效）。
  // effect 由夜間行動引擎（js/engine/night.js）實作。
  const card = (kind, effect, name, desc) => ({ kind, effect, name, desc });
  const traits = [
    { id: 'calm', name: n('Calm', '冷靜', '冷静'), tags: ['steady'],
      card: card('react', 'reroll', n('Steady', '穩住', '稳住'), n('Turn one failure into a success. The alert still counts.', '一次失敗改判成功，警戒照算。', '一次失败改判成功，警戒照算。')) },
    { id: 'fast', name: n('Fast runner', '跑得快', '跑得快'), tags: ['run'],
      card: card('react', 'escape', n('Get away', '甩開', '甩开'), n('When about to be arrested, escape to the safe house instead.', '本來要被捕時，改成逃回安全屋。', '本来要被捕时，改成逃回安全屋。')) },
    { id: 'connected', name: n('Knows everyone', '人脈廣', '人脉广'), tags: ['contacts'],
      card: card('active', 'summon', n('Call someone', '叫人', '叫人'), n('A local joins for this operation, and can be recruited afterwards.', '叫一個路人來幫忙這次行動，結束後可以直接招募。', '叫一个路人来帮忙这次行动，结束后可以直接招募。')) },
    { id: 'memory', name: n('Photographic memory', '過目不忘', '过目不忘'), tags: ['memory'],
      card: card('active', 'reveal', n('Memorise', '記下來', '记下来'), n("Reveal this stage's hidden approach.", '看穿這一關的隱藏解法。', '看穿这一关的隐藏解法。')) },
    { id: 'unremarkable', name: n('Unremarkable', '毫不起眼', '毫不起眼'), tags: ['low_profile'],
      card: card('active', 'ghost', n('Nobody looks', '沒人注意', '没人注意'), n("This person's next action raises no alert.", '這個人的下一個動作不增加警戒。', '这个人的下一个动作不增加警戒。')) },
    { id: 'silver', name: n('Silver-tongued', '口才好', '口才好'), tags: ['persuade'],
      card: card('active', 'talkdown', n('Talk it down', '圓過去', '圆过去'), n('Alert −15.', '警戒 −15。', '警戒 −15。')) },
    { id: 'nightowl', name: n('Night owl', '夜貓子', '夜猫子'), tags: ['night'],
      card: card('passive', 'nightowl', n('Small hours', '後半夜', '后半夜'), n('+15% success from the third stage on.', '第三關起，成功率 +15%。', '第三关起，成功率 +15%。')) },
    { id: 'nimble', name: n('Nimble hands', '手很巧', '手很巧'), tags: ['dexterity'],
      card: card('active', 'pickpocket', n('Lift it', '順手牽羊', '顺手牵羊'), n('Lift a keycard off a guard. The team can swipe it at every door tonight.', '從守衛身上摸走門卡，今晚每一道門都能刷。', '从守卫身上摸走门卡，今晚每一道门都能刷。')) },
    { id: 'strong', name: n('Strong', '力氣大', '力气大'), tags: ['strength'],
      card: card('active', 'force', n('Force it', '硬闖', '硬闯'), n('The next physical approach ignores its skill requirement.', '下一個身體類解法不看能力門檻。', '下一个身体类解法不看能力门槛。')) },
    { id: 'driver', name: n('Can drive', '會開車', '会开车'), tags: ['drive'],
      card: card('passive', 'pickup', n('Pick-up', '接應', '接应'), n('The getaway stage always succeeds.', '撤離關卡自動成功。', '撤离关卡自动成功。')) },
    { id: 'cheerful', name: n('Cheerful', '樂天', '乐天'), tags: ['morale'],
      card: card('active', 'boost', n('Pep talk', '打氣', '打气'), n('+15% success for the whole team on this stage.', '這一關全隊成功率 +15%。', '这一关全队成功率 +15%。')) },
    { id: 'careful', name: n('Careful', '謹慎', '谨慎'), tags: ['careful'],
      card: card('active', 'cover', n('Back-up plan', '留後路', '留后路'), n("If this person's next action fails, nothing bad happens.", '這個人的下一個動作就算失敗，也沒有任何後果。', '这个人的下一个动作就算失败，也没有任何后果。')) },
  ];

  // ===== 弱點：約六成五的人有一個 =====
  // blocks 封鎖某類解法；exposure 每個動作多加的警戒；risk 失敗率；riskTags 特定解法的失敗率。
  // event 是任務中會發生的出包事件，由夜間行動引擎觸發。
  // level 是嚴重程度（1 輕微、2 中等、3 嚴重），越嚴重越少見（見 js/engine/people.js 的 FLAW_WEIGHT）。
  const flaws = [
    { id: 'acrophobia', level: 1, name: n('Afraid of heights', '懼高', '恐高'), blocks: ['climb'] },
    { id: 'loudmouth', level: 2, name: n('Loudmouth', '大嘴巴', '大嘴巴'), exposure: 2, event: 'brag' },
    { id: 'record', level: 3, name: n('Has a record', '有前科', '有前科'), threat: 25, startAlert: 5 },
    { id: 'bad_knees', level: 2, name: n('Bad knees', '膝蓋不好', '膝盖不好'), blocks: ['run', 'climb'] },
    { id: 'nervous', level: 2, name: n('Nervous', '容易緊張', '容易紧张'), risk: 0.15, event: 'freeze' },
    { id: 'no_sense', level: 1, name: n('No sense of direction', '路痴', '路痴'), blocks: ['navigate'], event: 'lost' },
    { id: 'dark', level: 1, name: n('Afraid of the dark', '怕黑', '怕黑'), blocks: ['tunnel'], event: 'panic' },
    { id: 'phone', level: 2, name: n('Glued to their phone', '手機成癮', '手机成瘾'), exposure: 1, event: 'phone' },
    { id: 'clumsy', level: 2, name: n('Butterfingers', '笨手笨腳', '笨手笨脚'), riskTags: { hands: 0.2 } },
    { id: 'honest', level: 1, name: n("Can't lie", '不會說謊', '不会说谎'), blocks: ['lie'] },
    { id: 'hothead', level: 2, name: n('Short fuse', '脾氣差', '脾气差'), event: 'fight' },
    { id: 'allergic', level: 1, name: n('Allergies', '過敏', '过敏'), event: 'sneeze' },
  ];
  const noFlaw = { id: 'none', name: n('None', '沒有', '没有') };

  // ===== 小習慣：每個人兩個，是個性，也接上一點機制 =====
  // risk：對帶有某個標籤的解法或關卡調整失敗率（負數是比較容易成功）。
  // weight：出現的權重（預設 1）。兩隊球迷各只有一半，免得德比戰太常見。
  const quirks = [
    { id: 'cantonese', name: n('Speaks Cantonese', '會講粵語', '会讲粤语') },
    { id: 'man_utd', name: n('Man United fan', '曼聯球迷', '曼联球迷'), rival: 'liverpool', weight: 0.5 },
    { id: 'liverpool', name: n('Liverpool fan', '利物浦球迷', '利物浦球迷'), rival: 'man_utd', weight: 0.5 },
    { id: 'dogs_fear', name: n('Scared of dogs', '怕狗', '怕狗'), risk: { dog: 0.3 } },
    { id: 'dogs_love', name: n('Dog person', '愛狗', '爱狗'), risk: { dog: -0.3 } },
    { id: 'mahjong', name: n('Mahjong every Saturday', '每週六打麻將', '每周六打麻将'), risk: { social: -0.1 } },
    { id: 'night_shift', name: n('Works nights', '上夜班', '上夜班'), startAlert: -5 },
    { id: 'smoker', name: n('Heavy smoker', '菸癮很重', '烟瘾很重'), event: 'smoke' },
    { id: 'marathon', name: n('Runs marathons', '跑馬拉松', '跑马拉松'), risk: { run: -0.15 } },
    { id: 'gamer', name: n('Hardcore gamer', '電玩高手', '电玩高手'), risk: { hack: -0.1 } },
    { id: 'knitting', name: n('Always has knitting needles', '隨身帶毛線針', '随身带毛线针'), risk: { hands: -0.1 } },
    { id: 'birdwatcher', name: n('Birdwatcher', '賞鳥', '观鸟'), risk: { patrol: -0.1 } },
    { id: 'cyclist', name: n('Cycles everywhere', '騎單車通勤', '骑单车通勤'), risk: { exit: -0.15 } },
    { id: 'ex_army', name: n('Ex-army', '當過兵', '当过兵'), risk: { physical: -0.1 }, threat: 10 },
    { id: 'choir', name: n('Sings in a choir', '唱詩班', '唱诗班'), risk: { social: -0.1 } },
    { id: 'tea', name: n('Ten cups of tea a day', '一天十杯茶', '一天十杯茶') },
  ];

  // ===== 關係：路人之間互相認識 =====
  const relations = {
    family: { name: n('Family', '家人', '家人') },
    coworker: { name: n('Coworker', '同事', '同事') },
    ex: { name: n('Ex', '前任', '前任') },
    rival: { name: n('Rival', '死對頭', '死对头') },
    friend: { name: n('Friend', '朋友', '朋友') }, // 白天一起混出來的交情（js/engine/days.js）
  };

  // ===== 傷疤：這一輪發生過的事改變這個人 =====
  const scars = {
    inside: { name: n('Been inside', '進去過一次', '进去过一次'), desc: n('Threat +15, but anger makes every action 10% more likely to work.', '威脅評分 +15，但恨意讓每個動作的成功率 +10%。', '威胁评分 +15，但恨意让每个动作的成功率 +10%。') },
    veteran: { name: n('Veteran', '老手', '老手'), desc: n('Three successful operations. Every action is 10% more likely to work.', '成功完成三次行動，每個動作的成功率 +10%。', '成功完成三次行动，每个动作的成功率 +10%。') },
    old_wound: { name: n('Old wound', '舊傷', '旧伤'), desc: n('Running and climbing are 15% more likely to fail.', '跑和爬的失敗率 +15%。', '跑和爬的失败率 +15%。') },
  };

  // ===== 默契組合：特定的兩個人同隊 =====
  const combos = [
    { id: 'con_duo', name: n('One talks, one lifts', '一個聊天一個摸', '一个聊天一个摸'),
      desc: n('Silver-tongued + Nimble hands: a new way through every door.', '口才好＋手很巧：每一道門都多一種解法。', '口才好＋手很巧：每一道门都多一种解法。') },
    { id: 'photo_hack', name: n('Seen it once', '看一眼就記住', '看一眼就记住'),
      desc: n('Photographic memory + a hacker: hacks cost no bandwidth.', '過目不忘＋駭客：駭入不耗頻寬。', '过目不忘＋黑客：入侵不耗带宽。') },
    { id: 'cantonese_pair', name: n('Cantonese whispers', '粵語密語', '粤语密语'),
      desc: n('Two Cantonese speakers: every action raises 1 less alert.', '兩個會講粵語的人：每個動作少 1 點警戒。', '两个会讲粤语的人：每个动作少 1 点警戒。') },
    { id: 'derby', name: n('Derby day', '德比戰', '德比战'),
      desc: n('Man United fan + Liverpool fan: they argue all night. Everyone 10% more likely to fail; on the map they bicker now and then.', '曼聯球迷＋利物浦球迷：吵了一整晚，全隊失敗率 +10%；在地圖上偶爾會吵起來。', '曼联球迷＋利物浦球迷：吵了一整晚，全队失败率 +10%；在地图上偶尔会吵起来。') },
    { id: 'friends', name: n('Good friends', '好朋友同隊', '好朋友同队'),
      desc: n('Two friends on one team: each is 10% more likely to succeed, and on the map a friend within 2 squares pulls the other away from a guard once.', '兩個朋友同隊：各自成功率 +10%；在地圖上，朋友在兩格內時會把被追上的人拉開一次。', '两个朋友同队：各自成功率 +10%；在地图上，朋友在两格内时会把被追上的人拉开一次。') },
    { id: 'feud', name: n('Bad blood', '死對頭同隊', '死对头同队'),
      desc: n('Two rivals on one team: each is 10% more likely to fail, and on the map they bicker now and then.', '兩個死對頭同隊：各自失敗率 +10%，在地圖上偶爾會吵起來。', '两个死对头同队：各自失败率 +10%，在地图上偶尔会吵起来。') },
  ];

  // ===== 祕密：Profiler 上的一句人生 =====
  const secrets = [
    n("Hasn't paid rent in three months.", '已經三個月沒付房租。', '已经三个月没交房租了。'),
    n('Visits an ex’s dog every Saturday without telling anyone.', '每週六偷偷去探望前任的狗。', '每周六偷偷去看前任的狗。'),
    n('Writes a serial novel online under a fake name. Twenty thousand followers.', '在網路上用假名寫連載小說，有兩萬人追。', '在网上用笔名写连载小说，有两万人追更。'),
    n('Has a resignation letter saved on their phone. Never sent.', '手機裡存著一封從沒寄出的辭職信。', '手机里存着一封从没发出去的辞职信。'),
    n('Was flagged by the threat score once. Hasn’t gone out after dark since.', '上個月被威脅評分標記過一次，從此不敢在晚上出門。', '上个月被威胁评分标记过一次，从此不敢晚上出门。'),
    n('Cleaned Stillwater’s offices for two years. Remembers every back door.', '替靜域打掃過兩年大樓，記得每一扇後門。', '给静域打扫过两年大楼，记得每一扇后门。'),
    n('Keeps three beehives on a rooftop. Unlicensed.', '偷偷在屋頂養了三箱蜜蜂。', '偷偷在楼顶养了三箱蜜蜂。'),
    n('Speaks five languages. Has never left London.', '會說五種語言，卻從來沒離開過倫敦。', '会说五种语言，却从没离开过伦敦。'),
    n('Gives half of their lunch to the man outside the station every day.', '每天都把午餐分一半給車站外的流浪漢。', '每天都把午饭分一半给车站外的流浪汉。'),
    n('Used to be in DedSec. Left after an argument nobody talks about.', '以前是 DedSec 的成員，因為一場沒人願意提的爭吵退出了。', '以前是 DedSec 的成员，因为一场没人愿意提的争吵退出了。'),
    n('Owes money to the wrong people.', '欠了不該欠的人一筆錢。', '欠了不该欠的人一笔钱。'),
    n('Has failed the civil service exam four times. Sitting it again in spring.', '公務員考試考了四次都沒過，明年春天要考第五次。', '公务员考试考了四次都没过，明年春天考第五次。'),
    n('Has the drone patrol schedule pinned to the kitchen wall.', '廚房牆上貼著無人機的巡邏時刻表。', '厨房墙上贴着无人机的巡逻时刻表。'),
    n('Secretly filmed a drone stop-and-search. Never posted it.', '偷偷錄下了一次無人機盤查，一直沒敢發出去。', '偷偷录下了一次无人机盘查，一直没敢发出去。'),
    n('Is convinced Bagley is a real person doing a voice.', '一直相信 Bagley 是真人假扮的。', '一直相信 Bagley 是真人假扮的。'),
    n('Switches the lights off at 22:01 every night. Has never broken curfew.', '每晚 22:01 準時關燈，從來沒有違反過宵禁。', '每晚 22:01 准时关灯，从来没有违反过宵禁。'),
    n('Went on three dates with someone from Lionheart Defence.', '和一個獅心防務的員工約會過三次。', '和一个狮心防务的员工约会过三次。'),
    n('Their grandfather was on the picket lines in the seventies.', '祖父七〇年代參加過罷工糾察線。', '祖父七十年代参加过罢工纠察队。'),
    n('Wanted to be an astronaut. Still has the poster.', '小時候想當太空人，海報到現在還貼著。', '小时候想当宇航员，海报到现在还贴着。'),
    n('Collects old Tube tickets. Over two hundred so far.', '收集了兩百多張倫敦地鐵的舊車票。', '收集了两百多张伦敦地铁的旧车票。'),
    n('Was knocked out of a TV talent show in the first round.', '曾經在選秀節目的第一輪就被淘汰。', '曾经在选秀节目第一轮就被淘汰了。'),
    n('Knows a way home that no camera can see.', '知道一條沒有任何攝影機的回家路線。', '知道一条没有任何摄像头的回家路线。'),
    n('Reads the same detective novel every winter.', '每年冬天都會重讀同一本偵探小說。', '每年冬天都会重读同一本侦探小说。'),
    n('Has been learning the violin for twenty years. Still bad at it.', '學了二十年小提琴，還是拉得很難聽。', '学了二十年小提琴，还是拉得很难听。'),
  ];

  // ===== 麻煩：招募任務的起點 =====
  // mission 對應任務模板（之後在任務框架裡實作）。句子裡只用 {name}。
  const problems = [
    { id: 'rescue_family', mission: 'rescue',
      text: n("{name}'s brother was taken by a curfew drone last night. No word since.", '{name}的弟弟昨晚被宵禁無人機帶走了，到現在都沒有消息。', '{name}的弟弟昨晚被宵禁无人机带走了，到现在都没有消息。') },
    { id: 'erase_score', mission: 'erase_score',
      text: n("{name}'s threat score was pushed up by mistake. One more flag and the job is gone.", '{name}的威脅評分被錯誤調高，再被標記一次就會丟掉工作。', '{name}的威胁评分被错误调高，再被标记一次就会丢掉工作。') },
    { id: 'seized_phone', mission: 'recover',
      text: n("A Lionheart patrol confiscated {name}'s phone. There's something on it nobody can see.", '{name}的手機在盤查時被獅心防務扣下了，裡面有不能被看到的東西。', '{name}的手机在盘查时被狮心防务扣下了，里面有不能被看到的东西。') },
    { id: 'debt', mission: 'debt',
      text: n("{name} owes money, and the lenders have started knocking after curfew.", '{name}欠了一筆錢，債主開始在宵禁後上門。', '{name}欠了一笔钱，债主开始在宵禁后上门。') },
    { id: 'evidence', mission: 'broadcast',
      text: n('{name} filmed a drone getting it badly wrong and wants it out there, but has no idea how.', '{name}拍到了無人機出錯的畫面，想公開，卻不知道從何下手。', '{name}拍到了无人机出错的画面，想公开，却不知道从哪下手。') },
    { id: 'shop', mission: 'protect',
      text: n("The shop {name} works at has been marked 'high risk'. It gets shut down next week.", '{name}工作的店被列為「高風險場所」，下週就要被查封。', '{name}工作的店被列为“高风险场所”，下周就要被查封。') },
    { id: 'missing_friend', mission: 'search',
      text: n("{name}'s best friend went missing after curfew. Last location: next to a surveillance tower.", '{name}最好的朋友在宵禁後失蹤了，最後的定位在一座監控塔旁邊。', '{name}最好的朋友在宵禁后失踪了，最后的定位在一座监控塔旁边。') },
    { id: 'blackmail', mission: 'recover',
      text: n('Someone is blackmailing {name} with CCTV footage that should not exist.', '有人拿著一段不該存在的監控畫面勒索{name}。', '有人拿着一段不该存在的监控画面勒索{name}。') },
  ];

  // 弱點和小習慣的效果說明，顯示在 Profiler 上，讓玩家知道選人的取捨。
  const effects = {
    none: n('Nothing to worry about.', '沒什麼好擔心的。', '没什么好担心的。'),
    acrophobia: n("Can't climb.", '不能爬高。', '不能爬高。'),
    loudmouth: n('Every action +2 alert. Brags at the pub after a success.', '每個動作警戒 +2；成功後會去酒吧吹噓。', '每个动作警戒 +2；成功后会去酒吧吹嘘。'),
    record: n('Threat +25. Starting alert +5.', '威脅評分 +25；起始警戒 +5。', '威胁评分 +25；起始警戒 +5。'),
    bad_knees: n("Can't run or climb.", '不能跑，也不能爬。', '不能跑，也不能爬。'),
    nervous: n('+15% failure. May freeze before setting off.', '失敗率 +15%；出發時可能手抖。', '失败率 +15%；出发时可能手抖。'),
    no_sense: n("Can't lead the way. May take a wrong turn on the getaway.", '不能帶路；撤離時可能走錯路。', '不能带路；撤离时可能走错路。'),
    dark: n("Can't go into tunnels, and freezes in the dark unless someone calm is there.", '不能進隧道；在黑暗中會僵住，除非有冷靜的人陪著。', '不能进隧道；在黑暗中会僵住，除非有冷静的人陪着。'),
    phone: n('Every action +1 alert. The phone may light up at the worst moment.', '每個動作警戒 +1；手機可能在最糟的時候亮起來。', '每个动作警戒 +1；手机可能在最糟的时候亮起来。'),
    clumsy: n('Hand work is 20% more likely to fail.', '手上的工作失敗率 +20%。', '手上的工作失败率 +20%。'),
    honest: n("Can't lie or pose as anyone.", '不能說謊，也不能冒充別人。', '不能说谎，也不能冒充别人。'),
    hothead: n('Starts a row with the patrol when the alert hits 30.', '警戒到 30 時會跟巡邏員吵起來。', '警戒到 30 时会跟巡逻员吵起来。'),
    allergic: n('May sneeze at any stage. Alert +8.', '每一關都可能打噴嚏，警戒 +8。', '每一关都可能打喷嚏，警戒 +8。'),
    cantonese: n('With another Cantonese speaker, every action raises 1 less alert.', '和另一個會講粵語的人同隊時，每個動作少 1 點警戒。', '和另一个会讲粤语的人同队时，每个动作少 1 点警戒。'),
    man_utd: n('Argues all night with Liverpool fans.', '和利物浦球迷同隊會吵一整晚。', '和利物浦球迷同队会吵一整晚。'),
    liverpool: n('Argues all night with Man United fans.', '和曼聯球迷同隊會吵一整晚。', '和曼联球迷同队会吵一整晚。'),
    dogs_fear: n('30% more likely to fail where there are dogs.', '有狗的關卡失敗率 +30%。', '有狗的关卡失败率 +30%。'),
    dogs_love: n('30% more likely to succeed where there are dogs.', '有狗的關卡成功率 +30%。', '有狗的关卡成功率 +30%。'),
    mahjong: n('Knows every auntie in Camden. Social +10%.', '認識康登的每一個阿姨，社交成功率 +10%。', '认识卡姆登的每一个阿姨，社交成功率 +10%。'),
    night_shift: n('Has a night-work permit. Starting alert −5.', '有夜間工作證，起始警戒 −5。', '有夜间工作证，起始警戒 −5。'),
    smoker: n('Might light up mid-operation. Alert +5.', '行動中可能忍不住點菸，警戒 +5。', '行动中可能忍不住点烟，警戒 +5。'),
    marathon: n('Running +15%.', '跑步成功率 +15%。', '跑步成功率 +15%。'),
    gamer: n('Hacking +10%.', '駭入成功率 +10%。', '入侵成功率 +10%。'),
    knitting: n('Hand work +10%.', '手上的工作成功率 +10%。', '手上的工作成功率 +10%。'),
    birdwatcher: n('Carries binoculars. Patrol stages +10%.', '帶著望遠鏡，巡邏關卡成功率 +10%。', '带着望远镜，巡逻关卡成功率 +10%。'),
    cyclist: n('Getaway +15%.', '撤離成功率 +15%。', '撤离成功率 +15%。'),
    ex_army: n('Physical +10%. Threat +10.', '身體類成功率 +10%；威脅評分 +10。', '身体类成功率 +10%；威胁评分 +10。'),
    choir: n('Social +10%.', '社交成功率 +10%。', '社交成功率 +10%。'),
    tea: n('Just really likes tea.', '就只是很愛喝茶。', '就只是很爱喝茶。'),
  };
  for (const x of flaws.concat(quirks, [noFlaw])) x.desc = effects[x.id];

  // 戰術地圖上的效果：顯示在 Profiler 上「地圖」那一行，和上面的快速結算效果分開寫。
  const tacFx = {
    // 專長
    backdoor: n('Once per operation, a hack costs no bandwidth.', '每次行動一次，駭入不花頻寬。', '每次行动一次，入侵不花带宽。'),
    network_access: n('Hacks raise no alert. Inside offices they cost no bandwidth.', '駭入不增加警戒；在辦公室裡不花頻寬。', '入侵不增加警戒；在办公室里不花带宽。'),
    broadcast: n('Can hack, and sets up the transmitter for 1 AP.', '會駭入；架設發射器只要 1 點行動點。', '会入侵；架设发射器只要 1 点行动点。'),
    botnet: n('Hack range +2. A jammed drone loops for 3 turns.', '駭入距離 +2；干擾的無人機重播 3 回合。', '入侵距离 +2；干扰的无人机重播 3 回合。'),
    site_pass: n('Opens locked doors quietly (1 AP).', '安靜地打開上鎖的門（1 點）。', '安静地打开上锁的门（1 点）。'),
    building_access: n('Opens locked doors quietly (1 AP).', '安靜地打開上鎖的門（1 點）。', '安静地打开上锁的门（1 点）。'),
    heavy_lift: n('Forces doors and pulls down fences without a sound.', '撞門、拆圍欄都不會發出聲音。', '撞门、拆围栏都不会发出声音。'),
    climb: n('Climbs fences.', '翻得過圍欄。', '翻得过围栏。'),
    sprint: n('Moves 1 square further, and shakes off a guard once.', '多走一格；被追上時可以甩開一次。', '多走一格；被追上时可以甩开一次。'),
    river_route: n('Takes a guard down even face to face.', '正面也能制伏守衛。', '正面也能制服守卫。'),
    bail: n('Talks down guards who are already giving chase. Once per operation, steps in when a teammate is caught.', '追過來的守衛也講得聽；每次行動一次，隊友被追上時出面擋下來。', '追过来的守卫也讲得听；每次行动一次，队友被追上时出面挡下来。'),
    press: n('Talks guards away, and sets up the transmitter for 1 AP.', '會搭話引開守衛；架設發射器只要 1 點。', '会搭话引开守卫；架设发射器只要 1 点。'),
    gossip: n('The whole team sees the patrol routes. Conversations last a turn longer.', '全隊看得到巡邏路線；搭話多拖一回合。', '全队看得到巡逻路线；搭话多拖一回合。'),
    smooth_talk: n('Talk range +1, conversations last 2 turns longer, and it works on guards giving chase.', '搭話距離 +1、多拖兩回合，連追過來的守衛都講得聽。', '搭话距离 +1、多拖两回合，连追过来的守卫都讲得听。'),
    distraction: n('Talks from 4 squares away, and can draw a drone off with the crowd.', '四格外就能搭話，還能用人群把無人機引開。', '四格外就能搭话，还能用人群把无人机引开。'),
    disguise: n('Poses as staff for 5 turns.', '偽裝成工作人員 5 回合。', '伪装成工作人员 5 回合。'),
    heal: n('Patches up an injured teammate standing next to them.', '替旁邊受傷的隊友急救。', '替旁边受伤的队友急救。'),
    lockpick: n('Picks locked doors quietly (1 AP).', '安靜地撬開上鎖的門（1 點）。', '安静地撬开上锁的门（1 点）。'),
    getaway: n('Once per operation, calls the cab: the square they stand on becomes an exit.', '每次行動一次叫車：站的那一格變成撤離點。', '每次行动一次叫车：站的那一格变成撤离点。'),
    unsuspicious: n('When spotted, nobody gives chase and the alert rises by half (until the alert reaches 60).', '被看到時沒人追，警戒只加一半（警戒 60 以前）。', '被看到时没人追，警戒只加一半（警戒 60 以前）。'),
    take_over: n('A hacked drone is taken over for good (alert −10). A hacked camera stays off all night.', '駭進的無人機整架接管（警戒 −10）；駭掉的攝影機整晚都不會再開。', '入侵的无人机整架接管（警戒 −10）；关掉的摄像头整晚都不会再开。'),
    pigeon_post: n('Once per operation, a pigeon completes any one objective on the map.', '每次行動一次，讓鴿子完成地圖上任何一個目標。', '每次行动一次，让鸽子完成地图上任何一个目标。'),
    legacy: n('Hacks are free and silent, and objectives can be hacked from a distance.', '駭入不花頻寬、不增加警戒，目標也能遠端駭。', '入侵不花带宽、不增加警戒，目标也能远程入侵。'),
    pirate_radio: n('Once per operation, every guard on the map listens to the show for 2 turns.', '每次行動一次，全區守衛聽節目聽兩回合。', '每次行动一次，全区守卫听节目听两回合。'),
    master_keys: n('Opens any door. Guards and cameras take them for the cleaner unless right next to them.', '每扇門都開得了；守衛和攝影機只當是打掃的人，除非貼身。', '每扇门都开得了；守卫和摄像头只当是打扫的人，除非贴身。'),
    rooftops: n('Moves 2 squares further, and vaults fences for free.', '多走兩格；翻圍欄不花行動點。', '多走两格；翻围栏不花行动点。'),
    // 特質（招式卡）
    calm: n('The first time anyone spots them, they stand still and are taken for a passer-by.', '第一次被看到時站著不動，被當成路人。', '第一次被看到时站着不动，被当成路人。'),
    fast: n('Moves 1 square further, and shakes off a guard once.', '多走一格；被追上時可以甩開一次。', '多走一格；被追上时可以甩开一次。'),
    connected: n('Card: call a local in (1 AP). They play like a teammate this operation, and can be recruited free afterwards.', '卡：叫一個路人來（1 點）。這次行動像隊友一樣操作，結束後免費招募。', '卡：叫一个路人来（1 点）。这次行动像队友一样操作，结束后免费招募。'),
    memory: n('The team sees the patrol routes. Card: remembers a door code and opens a locked door in sight (1 AP).', '全隊看得到巡邏路線。卡：記得門禁密碼，打開看得到的一扇上鎖的門（1 點）。', '全队看得到巡逻路线。卡：记得门禁密码，打开看得到的一扇上锁的门（1 点）。'),
    unremarkable: n('Guards and cameras have to come 1 square closer. Card: nobody looks twice, this turn and next (free).', '守衛和攝影機要再近一格才會發現。卡：這一回合和下一回合沒人多看一眼（不花行動點）。', '守卫和摄像头要再近一格才会发现。卡：这一回合和下一回合没人多看一眼（不花行动点）。'),
    silver: n('Talk range +1, and it works on guards giving chase. Card: talk it down: alert −15, nearby chasers go back to patrol (1 AP).', '搭話距離 +1，追過來的守衛也講得聽。卡：圓過去，警戒 −15，附近追來的守衛回去巡邏（1 點）。', '搭话距离 +1，追过来的守卫也讲得听。卡：圆过去，警戒 −15，附近追来的守卫回去巡逻（1 点）。'),
    nightowl: n('In the dark, not even a guard right next to them notices.', '站在暗處，連貼身的守衛都看不到。', '站在暗处，连贴身的守卫都看不到。'),
    nimble: n('Climbs fences. Card: lifts a keycard off a guard from behind, and the whole team opens locked doors quietly (1 AP).', '翻得過圍欄。卡：從背後摸走守衛的門卡，全隊安靜開門（1 點）。', '翻得过围栏。卡：从背后摸走守卫的门卡，全队安静开门（1 点）。'),
    strong: n('Takes guards down even face to face; forces doors for 1 AP. Card: tears a fence open (1 AP, noisy).', '正面也能制伏守衛，撞門只要 1 點。卡：扯開一段圍欄（1 點，會發出聲音）。', '正面也能制服守卫，撞门只要 1 点。卡：扯开一段围栏（1 点，会发出声音）。'),
    driver: n('Card: calls the car, and the square they stand on becomes an exit (1 AP).', '卡：叫車，站的那一格變成撤離點（1 點）。', '卡：叫车，站的那一格变成撤离点（1 点）。'),
    cheerful: n('Card: pep talk. Teammates within 2 squares get +1 AP this turn (free).', '卡：打氣，兩格內的隊友這一回合各多 1 點行動點（不花行動點）。', '卡：打气，两格内的队友这一回合各多 1 点行动点（不花行动点）。'),
    careful: n('Never makes a noise. Card: sets up a hiding spot where they stand (1 AP).', '做什麼都不會發出聲音。卡：在腳下佈置一個藏身處（1 點）。', '做什么都不会发出声音。卡：在脚下布置一个藏身处（1 点）。'),
    // 弱點
    acrophobia: n("Can't climb fences.", '不能翻圍欄。', '不能翻围栏。'),
    loudmouth: n('Every noise they make carries 2 squares further.', '發出的聲音傳得遠兩格。', '发出的声音传得远两格。'),
    record: n('Guards and cameras recognise them from 1 square further.', '守衛和攝影機遠一格就認得出來。', '守卫和摄像头远一格就认得出来。'),
    bad_knees: n('Moves 1 square less. Climbing costs 2 AP.', '少走一格；翻圍欄要 2 點。', '少走一格；翻围栏要 2 点。'),
    nervous: n('−1 AP on a turn that starts with a guard within 2 squares.', '回合開始時守衛在兩格內，少 1 點行動點。', '回合开始时守卫在两格内，少 1 点行动点。'),
    no_sense: n('On a long walk, sometimes stops a square short.', '走遠路時有時會少走一格。', '走远路时有时会少走一格。'),
    dark: n('−1 AP on a turn that starts in the dark, unless someone calm is next to them.', '回合開始時站在暗處，少 1 點行動點，除非旁邊有冷靜的人。', '回合开始时站在暗处，少 1 点行动点，除非旁边有冷静的人。'),
    phone: n('12% chance each turn that the phone goes off (noise).', '每回合 12% 手機會響（發出聲音）。', '每回合 12% 手机会响（发出声音）。'),
    clumsy: n('25% chance that a climb, takedown or lift goes wrong.', '翻圍欄、制伏、偷東西有 25% 會失手。', '翻围栏、制服、偷东西有 25% 会失手。'),
    honest: n('No disguises. Conversations end a turn sooner.', '不能偽裝；搭話少拖一回合。', '不能伪装；搭话少拖一回合。'),
    hothead: n('Alert +5 more whenever a guard spots them.', '被守衛看到時，警戒多加 5。', '被守卫看到时，警戒多加 5。'),
    allergic: n('10% chance each turn of a sneeze (noise).', '每回合 10% 會打噴嚏（發出聲音）。', '每回合 10% 会打喷嚏（发出声音）。'),
    // 小習慣
    cantonese: n('With another Cantonese speaker on the map, each time either is spotted the alert rises 3 less.', '和另一個會講粵語的人同隊，被看到時警戒少加 3。', '和另一个会讲粤语的人同队，被看到时警戒少加 3。'),
    man_utd: n('Guards love a chat about football (+1 turn). With a Liverpool fan on the map, they bicker now and then (noise).', '守衛很愛聊球（搭話多拖一回合）；和利物浦球迷同隊，偶爾會吵起來（發出聲音）。', '守卫很爱聊球（搭话多拖一回合）；和利物浦球迷同队，偶尔会吵起来（发出声音）。'),
    liverpool: n('Guards love a chat about football (+1 turn). With a Man United fan on the map, they bicker now and then (noise).', '守衛很愛聊球（搭話多拖一回合）；和曼聯球迷同隊，偶爾會吵起來（發出聲音）。', '守卫很爱聊球（搭话多拖一回合）；和曼联球迷同队，偶尔会吵起来（发出声音）。'),
    dogs_fear: n('Guard dogs smell them from 1 square further. −1 AP on a turn that starts with a dog within 2 squares.', '守衛犬遠一格就聞得到；回合開始時狗在兩格內，少 1 點行動點。', '守卫犬远一格就闻得到；回合开始时狗在两格内，少 1 点行动点。'),
    dogs_love: n('Guard dogs never bark at them, and a pat on the head (1 AP) quiets a dog for good.', '守衛犬不會對著叫；摸摸頭（1 點）就讓狗整晚安靜。', '守卫犬不会对着叫；摸摸头（1 点）就让狗整晚安静。'),
    mahjong: n('Conversations last a turn longer.', '搭話多拖一回合。', '搭话多拖一回合。'),
    night_shift: n('+1 AP on the first turn.', '第一回合多 1 點行動點。', '第一回合多 1 点行动点。'),
    smoker: n('10% chance each turn of a coughing fit (noise).', '每回合 10% 會咳嗽（發出聲音）。', '每回合 10% 会咳嗽（发出声音）。'),
    marathon: n('Moves 1 square further.', '多走一格。', '多走一格。'),
    gamer: n('Hack range +1.', '駭入距離 +1。', '入侵距离 +1。'),
    knitting: n('Picks a locked door with a knitting needle (2 AP, quiet).', '用毛線針撬開上鎖的門（2 點，安靜）。', '用毛线针撬开上锁的门（2 点，安静）。'),
    birdwatcher: n('A drone has to be right on top of them to notice.', '無人機要飛到頭頂旁邊才會發現。', '无人机要飞到头顶旁边才会发现。'),
    cyclist: n('Once the objectives are done, rides off: moves 2 squares further.', '目標都完成之後騎車走人：多走兩格。', '目标都完成之后骑车走人：多走两格。'),
    ex_army: n('Takes guards down even face to face.', '正面也能制伏守衛。', '正面也能制服守卫。'),
    choir: n('Can talk guards away. Talk range +1.', '會搭話引開守衛，距離 +1。', '会搭话引开守卫，距离 +1。'),
    tea: n('Offers a guard a cuppa: keeps them busy for a turn (anyone who already talks well, a turn longer).', '請守衛喝杯茶：拖住守衛一回合（本來就會搭話的人多拖一回合）。', '请守卫喝杯茶：拖住守卫一回合（本来就会搭话的人多拖一回合）。'),
  };
  for (const k in tacFx) {
    if (perks[k]) perks[k].tac = tacFx[k];
    const tr = traits.find((x) => x.id === k);
    if (tr) tr.card.tac = tacFx[k];
  }
  for (const x of flaws.concat(quirks, [noFlaw])) x.tac = tacFx[x.id];

  // 外圍效果：住在自己家、不佔床位的外圍成員，靠職業專長提供的被動幫助。
  const networkFx = {
    gossip: n("Reveals the first stage's hidden approach on every operation.", '每次行動，第一關的隱藏解法都會先被打聽出來。', '每次行动，第一关的隐藏解法都会先被打听出来。'),
    heal: n('Injured teammates recover a night sooner.', '受傷的隊員少休養一晚。', '受伤的队员少休养一晚。'),
    bail: n('Arrested teammates are transferred two nights later.', '被捕的隊員晚兩晚才會被轉移。', '被捕的队员晚两晚才会被转移。'),
    press: n('Broadcast operations win 5 more support.', '插播行動的民心 +5。', '插播行动的民心 +5。'),
    broadcast: n('Broadcast operations win 5 more support.', '插播行動的民心 +5。', '插播行动的民心 +5。'),
    getaway: n('Once a night, a cab can pick the team up at the getaway stage.', '每晚一次，撤離時可以叫車來接。', '每晚一次，撤离时可以叫车来接。'),
    unsuspicious: n('Vouches for the neighbourhood. Heat drops 3 more each night.', '替整個街區作保，熱度每晚多退 3。', '替整个街区作保，热度每晚多退 3。'),
    pirate_radio: n('Broadcast operations win twice the support, even from home.', '人在家裡，插播行動的民心照樣加倍。', '人在家里，插播行动的民心照样加倍。'),
  };
  for (const k in networkFx) perks[k].network = networkFx[k];

  // 第一季的老朋友：完成主線任務後加入，名字和個性都是固定的。bio 取代一般路人的秘密。
  const specials = {
    homan: { person: {
      fixedName: n('Chan Ho-man', '陳浩文', '陈浩文'), heritage: 'hongkong', given: 0, family: 0, age: 41, occupation: 'courier',
      traits: ['driver', 'nimble'], flaw: null, quirks: ['cantonese', 'mahjong'], skills: { hack: 0, physical: 2, social: 3 }, threat: 45,
      bio: n('Still delivering. Still keeps a photo of Hiu-ching on the handlebars. Knows every back door in Chinatown.', '還在送外賣，車把上還貼著曉晴的照片。唐人街的每一扇後門都認得他。', '还在送外卖，车把上还贴着晓晴的照片。唐人街的每一扇后门都认得他。'),
    } },
    maya: { person: {
      fixedName: n('Maya Okafor', '瑪雅・奧卡福', '玛雅·奥卡福'), heritage: 'west_african', given: 0, family: 0, age: 29, occupation: 'programmer',
      traits: ['calm', 'memory'], flaw: 'record', quirks: ['night_shift', 'gamer'], skills: { hack: 3, physical: 1, social: 1 }, threat: 70,
      bio: n('The DedSec hacker who broke Echo out. Spent the last year hiding in plain sight on the Isle of Dogs.', '當年把 Echo 救出來的 DedSec 駭客。這一年都躲在狗島，就在獅心防務的眼皮底下。', '当年把 Echo 救出来的 DedSec 黑客。这一年都躲在狗岛，就在狮心防务的眼皮底下。'),
    } },
    eileen: { person: {
      fixedName: n('Eileen Walsh', '艾琳・沃什', '艾琳·沃什'), heritage: 'irish', given: 0, family: 0, age: 74, occupation: 'teacher',
      traits: ['careful', 'memory'], flaw: null, quirks: ['tea', 'knitting'], skills: { hack: 1, physical: 1, social: 2 }, threat: 5,
      bio: n('Her grandmother dug the tunnels under Rotherhithe. Eileen has the notebook, and opinions about everything.', '她的祖母挖過羅瑟希德底下的隧道。筆記本在艾琳手上，意見也是。', '她的祖母挖过罗瑟希德底下的隧道。笔记本在艾琳手上，意见也是。'),
    } },
  };

  S2.people = { heritages, districts, perks, occupations, rares, traits, flaws, noFlaw, quirks, relations, scars, combos, secrets, problems, specials };
})(window.ECHO = window.ECHO || {});
