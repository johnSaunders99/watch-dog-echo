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
        n('Harry', '哈利'), n('Grace', '葛蕾絲', '格蕾丝'), n('Oliver', '奧利佛', '奥利弗'), n('Chloe', '克蘿伊', '克洛伊')],
      family: [n('Briggs', '布里格斯'), n('Taylor', '泰勒'), n('Hughes', '休斯'), n('Clarke', '克拉克'),
        n('Bennett', '班奈特', '贝内特'), n('Cooper', '庫珀', '库珀'), n('Fletcher', '弗萊徹', '弗莱彻'), n('Holloway', '霍洛威')],
    },
    irish: {
      order: 'given-first',
      given: [n('Niamh', '妮芙'), n('Ciaran', '奇蘭', '奇兰'), n('Orla', '奧拉', '奥拉'), n('Declan', '德克蘭', '德克兰'),
        n('Roisin', '羅欣', '罗欣'), n('Sean', '尚恩', '肖恩'), n('Maeve', '梅芙'), n('Liam', '連恩', '利亚姆')],
      family: [n('Murphy', '墨菲'), n("O'Brien", '歐布萊恩', '奥布赖恩'), n('Kelly', '凱利', '凯利'), n('Byrne', '伯恩'),
        n('Doyle', '多伊爾', '多伊尔'), n('Walsh', '沃什'), n('Quinn', '奎因'), n('Gallagher', '加拉格爾', '加拉格尔')],
    },
    caribbean: {
      order: 'given-first',
      given: [n('Jerome', '傑羅姆', '杰罗姆'), n('Keisha', '琪莎', '基莎'), n('Andre', '安德烈'), n('Shanice', '夏妮絲', '莎妮丝'),
        n('Winston', '溫斯頓', '温斯顿'), n('Tanya', '坦雅', '塔尼娅'), n('Delroy', '德爾羅伊', '德尔罗伊'), n('Monique', '莫妮克')],
      family: [n('Campbell', '坎貝爾', '坎贝尔'), n('Brown', '布朗'), n('Thompson', '湯普森', '汤普森'), n('Grant', '格蘭特', '格兰特'),
        n('Francis', '法蘭西斯', '弗朗西斯'), n('Henry', '亨利'), n('Morgan', '摩根'), n('Bailey', '貝利', '贝利')],
    },
    west_african: {
      order: 'given-first',
      given: [n('Chidi', '奇迪'), n('Adaeze', '阿達澤', '阿达泽'), n('Kwame', '夸梅'), n('Ama', '阿瑪', '阿玛'),
        n('Tunde', '通德'), n('Folake', '芙拉珂', '弗拉克'), n('Kofi', '科菲'), n('Zainab', '扎伊納布', '扎伊纳布')],
      family: [n('Okonkwo', '奧孔科', '奥孔科'), n('Mensah', '門薩', '门萨'), n('Adeyemi', '阿德耶米'), n('Owusu', '歐烏蘇', '奥乌苏'),
        n('Eze', '埃澤', '埃泽'), n('Bello', '貝洛', '贝洛'), n('Asante', '阿桑特'), n('Nwosu', '恩沃蘇', '恩沃苏')],
    },
    south_asian: {
      order: 'given-first',
      given: [n('Priya', '普莉雅', '普丽娅'), n('Arjun', '阿瓊', '阿琼'), n('Aisha', '艾莎'), n('Imran', '伊姆蘭', '伊姆兰'),
        n('Kiran', '基蘭', '基兰'), n('Rahul', '拉胡爾', '拉胡尔'), n('Nadia', '娜迪亞', '娜迪娅'), n('Sunil', '蘇尼爾', '苏尼尔')],
      family: [n('Shah', '沙阿'), n('Patel', '帕特爾', '帕特尔'), n('Khan', '汗'), n('Rahman', '拉赫曼'),
        n('Singh', '辛格'), n('Hussain', '侯賽因', '侯赛因'), n('Chaudhry', '喬杜里', '乔杜里'), n('Ahmed', '艾哈邁德', '艾哈迈德')],
    },
    hongkong: {
      order: 'family-first',
      given: [n('Mei-ling', '美玲'), n('Ka-wai', '嘉慧'), n('Chi-keung', '志強', '志强'), n('Wing-yan', '詠欣', '咏欣'),
        n('Ho-yin', '浩賢', '浩贤'), n('Siu-man', '少文'), n('Tsz-kin', '子健'), n('Hoi-yan', '凱欣', '凯欣')],
      family: [n('Wong', '黃', '黄'), n('Chan', '陳', '陈'), n('Lee', '李'), n('Cheung', '張', '张'),
        n('Lau', '劉', '刘'), n('Ng', '吳', '吴'), n('Ho', '何'), n('Leung', '梁')],
    },
    mainland: {
      order: 'family-first',
      given: [n('Lei', '磊'), n('Xinyi', '欣怡'), n('Hao', '浩'), n('Yuting', '雨婷'),
        n('Jun', '俊'), n('Siyu', '思雨'), n('Bo', '博'), n('Jiahui', '佳慧')],
      family: [n('Wang', '王'), n('Zhang', '張', '张'), n('Liu', '劉', '刘'), n('Zhou', '周'),
        n('Sun', '孫', '孙'), n('Zhao', '趙', '赵'), n('Xu', '徐'), n('Lin', '林')],
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

  // ===== 專長與弱點 =====
  // tags 給任務框架判斷用：專長提供能力，弱點封鎖能力或帶來代價。
  const traits = [
    { id: 'calm', name: n('Calm', '冷靜', '冷静'), tags: ['steady'] },
    { id: 'fast', name: n('Fast runner', '跑得快', '跑得快'), tags: ['run'] },
    { id: 'connected', name: n('Knows everyone', '人脈廣', '人脉广'), tags: ['contacts'] },
    { id: 'memory', name: n('Photographic memory', '過目不忘', '过目不忘'), tags: ['memory'] },
    { id: 'unremarkable', name: n('Unremarkable', '毫不起眼', '毫不起眼'), tags: ['low_profile'] },
    { id: 'silver', name: n('Silver-tongued', '口才好', '口才好'), tags: ['persuade'] },
    { id: 'nightowl', name: n('Night owl', '夜貓子', '夜猫子'), tags: ['night'] },
    { id: 'nimble', name: n('Nimble hands', '手很巧', '手很巧'), tags: ['dexterity'] },
  ];

  const flaws = [
    { id: 'acrophobia', name: n('Afraid of heights', '懼高', '恐高'), blocks: ['climb'] },
    { id: 'loudmouth', name: n('Loudmouth', '大嘴巴', '大嘴巴'), exposure: 2 },
    { id: 'record', name: n('Has a record', '有前科', '有前科'), threat: 25 },
    { id: 'bad_knees', name: n('Bad knees', '膝蓋不好', '膝盖不好'), blocks: ['run', 'climb'] },
    { id: 'nervous', name: n('Nervous', '容易緊張', '容易紧张'), risk: 0.15 },
    { id: 'no_sense', name: n('No sense of direction', '路痴', '路痴'), blocks: ['navigate'] },
    { id: 'dark', name: n('Afraid of the dark', '怕黑', '怕黑'), blocks: ['tunnel'] },
    { id: 'phone', name: n('Glued to their phone', '手機成癮', '手机成瘾'), exposure: 1 },
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

  S2.people = { heritages, districts, perks, occupations, traits, flaws, secrets, problems };
})(window.ECHO = window.ECHO || {});
