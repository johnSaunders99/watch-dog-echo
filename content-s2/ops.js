// 第二季原型：康登的夜間行動。
// 一次行動是一串關卡（stage），每一關有好幾種解法（approach），每種解法適合不同的人。
// 解法欄位：
//   needs     門檻：skill 能力、perk 職業專長、ability 一般能力（弱點可能封鎖它）、item 道具
//   tags      分類：hack／physical／social／hands／climb／run／lie／navigate／tunnel……，弱點、小習慣、默契依此判斷
//   risk      基礎失敗率；sure: true 代表一定成功（例如刷門卡）
//   exposure  成功時增加的警戒；失敗時再多加 fail（預設 10）
//   injure    失敗時受傷的機率
//   bandwidth 消耗的頻寬
//   perkBonus 特定職業專長的失敗率調整，例如鎖匠開鎖
//   ok        成功時的句子，只用 {name}
// 每一關還有一個 hidden 隱藏解法，要「過目不忘」才看得到。
(function (E) {
  const S2 = (E.s2 = E.s2 || {});
  const n = (en, tc, sc) => ({ en, tc, sc: sc || tc });

  const stages = {
    fence: {
      art: 'dock', tags: ['door'],
      name: n('Site fence', '工地圍欄', '工地围栏'),
      desc: n('The tower stands in the middle of a building site. Lionheart signs hang on the fence.', '監控塔立在一片工地中間，圍欄上掛著獅心防務的牌子。', '监控塔立在一片工地中间，围栏上挂着狮心防务的牌子。'),
      approaches: [
        { id: 'climb_fence', name: n('Climb the fence', '翻過圍欄', '翻过围栏'), needs: { skill: { physical: 1 }, ability: 'climb' }, tags: ['physical', 'climb'], risk: 0.3, exposure: 6, injure: 0.3,
          ok: n('{name} is over the fence before the floodlight swings back.', '探照燈轉回來之前，{name}已經翻過圍欄了。', '探照灯转回来之前，{name}已经翻过围栏了。') },
        { id: 'site_pass', name: n('Swipe a site pass', '刷工地門卡', '刷工地门卡'), needs: { perk: 'site_pass' }, tags: ['door'], sure: true, exposure: 0,
          ok: n('{name} swipes in like it is any other Tuesday.', '{name}刷卡進門，就像平常上工一樣。', '{name}刷卡进门，就像平常上工一样。') },
        { id: 'padlock', name: n('Pick the padlock', '撬開掛鎖', '撬开挂锁'), tags: ['hands'], risk: 0.45, exposure: 4, perkBonus: { lockpick: -0.35 },
          ok: n('The padlock clicks open in {name}\'s hands.', '掛鎖在{name}手裡喀的一聲開了。', '挂锁在{name}手里咔的一声开了。') },
        { id: 'hack_gate', name: n('Hack the gate', '駭入門禁', '入侵门禁'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.25, exposure: 8, bandwidth: 1,
          ok: n('The gate light turns green. {name} doesn\'t even look up from the phone.', '門禁燈變綠了，{name}連頭都沒抬。', '门禁灯变绿了，{name}连头都没抬。') },
      ],
      hidden: { id: 'loose_panel', name: n('The loose panel round the back', '後面那片沒鎖的圍欄', '后面那片没锁的围栏'), tags: [], risk: 0.1, exposure: 2,
        ok: n('{name} remembered the panel nobody bolted down. It slides right open.', '{name}記得後面有一片圍欄沒鎖，一推就開。', '{name}记得后面有一片围栏没锁，一推就开。') },
    },

    patrol_drone: {
      art: 'arches', tags: ['patrol'],
      name: n('Patrol drone', '巡邏無人機', '巡逻无人机'),
      desc: n('A Nightwatch drone hangs overhead, its red light sweeping the street.', '一架守夜人無人機停在半空，紅燈掃過整條街。', '一架守夜人无人机停在半空，红灯扫过整条街。'),
      approaches: [
        { id: 'wait_out', name: n('Wait it out', '等它飛走', '等它飞走'), tags: ['patience'], risk: 0.35, exposure: 10,
          ok: n('{name} holds still in a doorway until the drone drifts off.', '{name}在門洞裡一動不動，直到無人機飛走。', '{name}在门洞里一动不动，直到无人机飞走。') },
        { id: 'jam_drone', name: n('Jam the drone', '干擾無人機', '干扰无人机'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 2, perkBonus: { botnet: -0.25 },
          ok: n('The drone\'s light stutters. {name} has fed it ten minutes of an empty street.', '無人機的燈閃了一下。{name}餵給它十分鐘的空街畫面。', '无人机的灯闪了一下。{name}喂给它十分钟的空街画面。') },
        { id: 'distract', name: n('Draw it away', '把它引開', '把它引开'), needs: { skill: { social: 1 } }, tags: ['social'], risk: 0.3, exposure: 8, perkBonus: { distraction: -0.25 },
          ok: n('{name} starts a scene two streets over. The drone goes to have a look.', '{name}在兩條街外鬧了起來，無人機飛過去看熱鬧。', '{name}在两条街外闹了起来，无人机飞过去看热闹。') },
        { id: 'sprint_across', name: n('Sprint across', '衝過去', '冲过去'), needs: { skill: { physical: 1 }, ability: 'run' }, tags: ['physical', 'run'], risk: 0.35, exposure: 6, injure: 0.2, perkBonus: { sprint: -0.2 },
          ok: n('{name} crosses the open street in four seconds flat.', '{name}四秒鐘就衝過了整條空街。', '{name}四秒钟就冲过了整条空街。') },
      ],
      hidden: { id: 'blind_spot', name: n('The blind spot', '鏡頭的死角', '镜头的死角'), tags: [], risk: 0.1, exposure: 3,
        ok: n('The drone swings back every forty seconds. {name} counted. {name} walks through the gap.', '無人機每四十秒轉回去一次。{name}數過了，從空檔走了過去。', '无人机每四十秒转回去一次。{name}数过了，从空档走了过去。') },
    },

    tower_box: {
      art: 'station', tags: ['climb'],
      name: n('Control box', '塔頂控制箱', '塔顶控制箱'),
      desc: n('The control box sits twenty metres up. There is a maintenance terminal at the base.', '控制箱在塔身二十米高的地方，底下有一台維修用的終端。', '控制箱在塔身二十米高的地方，底下有一台维修用的终端。'),
      approaches: [
        { id: 'climb_tower', name: n('Climb up and pull the cables', '爬上去拔線', '爬上去拔线'), needs: { skill: { physical: 1 }, ability: 'climb' }, tags: ['physical', 'climb', 'hands'], risk: 0.35, exposure: 4, injure: 0.35, perkBonus: { climb: -0.25 },
          ok: n('Twenty metres up, {name} yanks the bundle. Every camera on the street goes dark.', '在二十米高的地方，{name}一把扯斷整束線，整條街的鏡頭同時熄滅。', '在二十米高的地方，{name}一把扯断整束线，整条街的镜头同时熄灭。') },
        { id: 'hack_terminal', name: n('Shut it down from the terminal', '從終端關掉它', '从终端关掉它'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 8, bandwidth: 2, perkBonus: { network_access: -0.15 },
          ok: n('{name} types one line. The tower thinks it is being serviced, and switches itself off.', '{name}輸入一行指令，監控塔以為自己在維修，自動關機了。', '{name}输入一行指令，监控塔以为自己在维修，自动关机了。') },
        { id: 'cut_power', name: n('Cut the power', '剪斷電源', '剪断电源'), tags: ['hands'], risk: 0.4, exposure: 12,
          ok: n('Sparks, a bang, then silence. {name} cut the right cable.', '一陣火花和一聲巨響之後，一片安靜。{name}剪對了線。', '一阵火花和一声巨响之后，一片安静。{name}剪对了线。') },
      ],
      hidden: { id: 'service_code', name: n('The code taped to the terminal', '貼在終端上的維修密碼', '贴在终端上的维修密码'), tags: [], risk: 0.1, exposure: 2,
        ok: n('Someone taped the service code to the screen. {name} reads it and types it in.', '有人把維修密碼貼在螢幕旁邊。{name}照著打了進去。', '有人把维修密码贴在屏幕旁边。{name}照着输了进去。') },
    },

    getaway: {
      art: 'arches', tags: ['exit'],
      name: n('Getaway', '撤離', '撤离'),
      desc: n('Lionheart patrol cars are converging on the block. Time to go.', '獅心防務的巡邏車開始往這裡集中，該走了。', '狮心防务的巡逻车开始往这里集中，该走了。'),
      approaches: [
        { id: 'run_back', name: n('Run for it', '跑回安全屋', '跑回安全屋'), needs: { ability: 'run' }, tags: ['physical', 'run'], risk: 0.3, exposure: 4, injure: 0.2, perkBonus: { sprint: -0.2 },
          ok: n('{name} takes the stairs down to the safe house three at a time.', '{name}一步三階跑下安全屋的樓梯。', '{name}一步三阶跑下安全屋的楼梯。') },
        { id: 'backstreets', name: n('Take the back streets', '走小巷', '走小巷'), needs: { ability: 'navigate' }, tags: ['navigate'], risk: 0.25, exposure: 6,
          ok: n('{name} knows which alleys have no cameras. The team walks home.', '{name}知道哪幾條小巷沒有鏡頭，大家走回了家。', '{name}知道哪几条小巷没有镜头，大家走回了家。') },
        { id: 'blend_in', name: n('Blend in with the night shift', '混進下班的人群', '混进下班的人群'), needs: { skill: { social: 1 } }, tags: ['social'], risk: 0.3, exposure: 5, perkBonus: { unsuspicious: -0.2 },
          ok: n('{name} falls in with a crowd of hospital cleaners heading for the night bus.', '{name}混進一群要搭夜班公車的醫院清潔工裡。', '{name}混进一群要坐夜班公交的医院清洁工里。') },
        { id: 'cab', name: n('Call the cab', '叫車', '叫车'), needs: { perk: 'getaway' }, tags: [], sure: true, exposure: 0,
          ok: n('A black cab pulls up with the light off. {name} drives everyone home.', '一輛熄了燈的黑色計程車停在路邊，{name}把大家載回家。', '一辆熄了灯的黑色出租车停在路边，{name}把大家载回家。') },
      ],
      hidden: { id: 'towpath', name: n('The canal towpath', '運河邊的步道', '运河边的步道'), tags: [], risk: 0.1, exposure: 2,
        ok: n('No streetlights, no cameras. {name} leads them home along the canal.', '沒有路燈，也沒有鏡頭。{name}帶大家沿著運河走回去。', '没有路灯，也没有镜头。{name}带大家沿着运河走回去。') },
    },

    lobby: {
      art: 'flat', tags: ['door'],
      name: n('Tower block lobby', '公寓大廳', '公寓大厅'),
      desc: n('This block has the tallest antenna in Camden. The lobby door photographs every face.', '這棟公寓的頂樓有全康登最高的天線，大廳的門禁會拍下每一張臉。', '这栋公寓的顶楼有全卡姆登最高的天线，大厅的门禁会拍下每一张脸。'),
      approaches: [
        { id: 'delivery', name: n('Pose as a delivery', '假裝送外賣', '假装送外卖'), tags: ['social', 'lie'], risk: 0.35, exposure: 4, perkBonus: { building_access: -0.35 },
          ok: n('"Flat 14, pad thai." The door buzzes. {name} is in.', '「14 樓，泰式炒河粉。」門開了，{name}進去了。', '“14 楼，泰式炒河粉。”门开了，{name}进去了。') },
        { id: 'hack_door', name: n('Hack the door', '駭入門禁', '入侵门禁'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.25, exposure: 6, bandwidth: 1,
          ok: n('The camera records {name} as a resident of twelve years.', '門禁攝影機把{name}記成住了十二年的住戶。', '门禁摄像头把{name}记成住了十二年的住户。') },
        { id: 'tailgate', name: n('Tailgate a resident', '跟著住戶進去', '跟着住户进去'), needs: { skill: { social: 1 } }, tags: ['social'], risk: 0.3, exposure: 5,
          ok: n('{name} holds the door for an old man with shopping, and walks in behind him.', '{name}幫提著購物袋的老先生扶住門，跟著走了進去。', '{name}帮提着购物袋的老先生扶住门，跟着走了进去。') },
      ],
      hidden: { id: 'fire_door', name: n('The broken fire door', '壞掉的安全門', '坏掉的安全门'), tags: [], risk: 0.1, exposure: 2,
        ok: n('The fire door latch has been broken for months. {name} just pulls.', '安全門的門閂壞了好幾個月，{name}一拉就開。', '安全门的门闩坏了好几个月，{name}一拉就开。') },
    },

    antenna: {
      art: 'flat', tags: ['climb'],
      name: n('Rooftop antenna', '頂樓天線', '顶楼天线'),
      desc: n('The antenna is bolted to the water tank. It is very windy up here.', '天線架在水塔上面，風很大。', '天线架在水塔上面，风很大。'),
      approaches: [
        { id: 'climb_tank', name: n('Climb the tank and splice in', '爬上水塔接線', '爬上水塔接线'), needs: { skill: { physical: 1 }, ability: 'climb' }, tags: ['physical', 'climb', 'hands'], risk: 0.35, exposure: 3, injure: 0.3, perkBonus: { climb: -0.25 },
          ok: n('Wind tearing at the jacket, {name} gets the clamp on.', '頂著大風，{name}把夾子夾上了天線。', '顶着大风，{name}把夹子夹上了天线。') },
        { id: 'remote_tap', name: n('Tap in from the junction box', '從配線箱遠端接入', '从配线箱远程接入'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 2,
          ok: n('{name} finds the junction box on the landing and patches in from there.', '{name}在樓梯間找到配線箱，從那裡接了進去。', '{name}在楼梯间找到配线箱，从那里接了进去。') },
      ],
      hidden: { id: 'hatch', name: n('The service hatch', '水塔的維修孔', '水塔的维修孔'), tags: ['hands'], risk: 0.1, exposure: 2,
        ok: n('There is a hatch on the side of the tank. {name} does not have to climb at all.', '水塔側面有一個維修孔，{name}根本不用爬。', '水塔侧面有一个维修孔，{name}根本不用爬。') },
    },

    broadcast: {
      art: 'station', tags: ['broadcast', 'data'],
      name: n('On air', '插播', '插播'),
      desc: n('You are on the signal. For ninety seconds, every screen in Camden plays whatever you send.', '訊號接上了。接下來的九十秒，康登每一塊螢幕都會播你送出去的東西。', '信号接上了。接下来的九十秒，卡姆登每一块屏幕都会播你送出去的东西。'),
      approaches: [
        { id: 'speech', name: n('Speak to camera', '對著鏡頭說話', '对着镜头说话'), needs: { skill: { social: 2 } }, tags: ['social'], risk: 0.3, exposure: 10, perkBonus: { press: -0.2, broadcast: -0.2 },
          ok: n('{name} looks into the lens. "They scored us. Tonight we score them."', '{name}看著鏡頭說：「他們替我們打分數。今晚換我們替他們打分數。」', '{name}看着镜头说：“他们给我们打分。今晚换我们给他们打分。”') },
        { id: 'footage', name: n('Run the drone footage', '播出無人機出錯的畫面', '播出无人机出错的画面'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.25, exposure: 8, bandwidth: 1, perkBonus: { broadcast: -0.2 },
          ok: n('Every screen in Camden shows a drone tasering a man for jaywalking. {name} loops it.', '康登每一塊螢幕都在播無人機電擊一個闖紅燈的人。{name}讓它重播了一遍又一遍。', '卡姆登每一块屏幕都在播无人机电击一个闯红灯的人。{name}让它重播了一遍又一遍。') },
      ],
      hidden: { id: 'emergency', name: n('The emergency channel', '緊急廣播頻道', '紧急广播频道'), tags: [], risk: 0.1, exposure: 4,
        ok: n('Nobody monitors the emergency channel. {name} goes out on every phone in the borough.', '緊急廣播頻道沒有人在監看。{name}的訊息出現在全區每一支手機上。', '紧急广播频道没有人在监看。{name}的消息出现在全区每一部手机上。') },
    },

    holding_yard: {
      art: 'dock', tags: ['patrol', 'dog'],
      name: n('Holding centre yard', '拘留中心外圍', '拘留中心外围'),
      desc: n('The holding centre is a converted car park. Dogs patrol the fence.', '臨時拘留中心是一座舊停車場改的，圍欄邊有巡邏犬。', '临时拘留中心是一座旧停车场改的，围栏边有巡逻犬。'),
      approaches: [
        { id: 'sneak', name: n('Sneak round the patrol', '繞過巡邏', '绕过巡逻'), needs: { skill: { physical: 1 } }, tags: ['physical'], risk: 0.35, exposure: 6,
          ok: n('{name} moves between the parked vans, always one behind the dog.', '{name}在停著的廂型車之間移動，始終和巡邏犬隔著一輛車。', '{name}在停着的面包车之间移动，始终和巡逻犬隔着一辆车。') },
        { id: 'kill_cams', name: n('Kill the perimeter cameras', '關掉外圍攝影機', '关掉外围摄像头'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 1,
          ok: n('{name} puts the perimeter cameras on a loop.', '{name}讓外圍的攝影機一直重播同一段畫面。', '{name}让外围的摄像头一直重播同一段画面。') },
        { id: 'visitor', name: n('Pose as a visitor', '假裝來探視', '假装来探视'), needs: { skill: { social: 1 } }, tags: ['social', 'lie'], risk: 0.35, exposure: 5, perkBonus: { bail: -0.3, disguise: -0.25 },
          ok: n('{name} waves a form at the gate. The guard is too tired to read it.', '{name}對著門口揮了揮一張表格，守衛累得根本沒看。', '{name}对着门口挥了挥一张表格，守卫累得根本没看。') },
      ],
      hidden: { id: 'shift_change', name: n('The shift change', '換班的空檔', '换班的空档'), tags: [], risk: 0.1, exposure: 2,
        ok: n('At 02:00 the shift changes and the yard is empty for three minutes. {name} uses all three.', '凌晨兩點換班，外圍有三分鐘沒人。{name}把三分鐘都用上了。', '凌晨两点换班，外围有三分钟没人。{name}把三分钟都用上了。') },
    },

    side_door: {
      art: 'dock', tags: ['door'],
      name: n('Side door', '側門', '侧门'),
      desc: n('The side door still has an old mechanical lock.', '側門用的還是老式的機械鎖。', '侧门用的还是老式的机械锁。'),
      approaches: [
        { id: 'pick', name: n('Pick the lock', '撬鎖', '撬锁'), tags: ['hands'], risk: 0.45, exposure: 4, perkBonus: { lockpick: -0.35 },
          ok: n('{name} has it open in under a minute.', '{name}不到一分鐘就把鎖撬開了。', '{name}不到一分钟就把锁撬开了。') },
        { id: 'shoulder', name: n('Shoulder it open', '撞開', '撞开'), needs: { skill: { physical: 2 } }, tags: ['physical'], risk: 0.35, exposure: 12, injure: 0.25, perkBonus: { heavy_lift: -0.2 },
          ok: n('One hit from {name}. The frame gives before the lock does.', '{name}一撞，門框比門鎖先垮了。', '{name}一撞，门框比门锁先垮了。') },
        { id: 'staff', name: n('Pose as staff', '冒充工作人員', '冒充工作人员'), needs: { skill: { social: 1 } }, tags: ['social', 'lie'], risk: 0.35, exposure: 5, perkBonus: { disguise: -0.3 },
          ok: n('{name} knocks, sighs about the rota, and gets let in.', '{name}敲了敲門，抱怨了一句排班表，就被放了進去。', '{name}敲了敲门，抱怨了一句排班表，就被放了进去。') },
      ],
      hidden: { id: 'brick', name: n('The door propped open with a brick', '被磚頭頂住的門', '被砖头顶住的门'), tags: [], risk: 0.1, exposure: 2,
        ok: n('A guard on a smoke break left the door propped on a brick. {name} slips in.', '出來抽菸的守衛用一塊磚頭把門頂住了。{name}溜了進去。', '出来抽烟的守卫用一块砖头把门顶住了。{name}溜了进去。') },
    },

    cells: {
      art: 'station', tags: ['cell'],
      name: n('Holding cells', '拘留室', '拘留室'),
      desc: n('A row of cages. The person you came for is in the last one.', '一排鐵籠。你要找的人就在最裡面那一格。', '一排铁笼。你要找的人就在最里面那一格。'),
      approaches: [
        { id: 'unlock', name: n('Hack the cell locks', '駭開電子鎖', '入侵电子锁'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 8, bandwidth: 2,
          ok: n('Every cage on the row clicks open at once. {name} only meant to open one.', '整排鐵籠同時打開了。{name}本來只想開一格。', '整排铁笼同时打开了。{name}本来只想开一格。') },
        { id: 'paperwork', name: n('Walk them out with paperwork', '用文件把人帶走', '用文件把人带走'), needs: { skill: { social: 2 } }, tags: ['social', 'lie'], risk: 0.35, exposure: 6, perkBonus: { bail: -0.3 },
          ok: n('{name} signs a release form with a confident scribble. Nobody checks it.', '{name}在釋放單上自信地簽了一個名，沒有人檢查。', '{name}在释放单上自信地签了一个名，没有人检查。') },
        { id: 'cutters', name: n('Cut the cage', '剪斷鐵籠', '剪断铁笼'), needs: { skill: { physical: 1 } }, tags: ['physical', 'hands'], risk: 0.4, exposure: 12,
          ok: n('{name} leans on the bolt cutters until the bar snaps.', '{name}用全身的重量壓著剪鉗，直到鐵條斷開。', '{name}用全身的重量压着剪钳，直到铁条断开。') },
      ],
      hidden: { id: 'wrong_number', name: n('The wrong cell number', '登記錯的編號', '登记错的编号'), tags: ['data'], risk: 0.1, exposure: 4,
        ok: n('The system has the prisoner under the wrong number. {name} just "releases" that number.', '系統把人登記在錯的編號下，{name}直接把那個編號「釋放」了。', '系统把人登记在错的编号下，{name}直接把那个编号“释放”了。') },
    },

    terminal: {
      art: 'station', tags: ['data', 'office'],
      name: n('Scoring terminal', '評分終端', '评分终端'),
      desc: n('A community centre basement has a terminal wired into the threat-score system.', '社區中心的地下室裡，有一台連著威脅評分系統的終端。', '社区中心的地下室里，有一台连着威胁评分系统的终端。'),
      approaches: [
        { id: 'edit_score', name: n('Edit the score', '改掉那一筆評分', '改掉那一笔评分'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 1, perkBonus: { network_access: -0.2 },
          ok: n('{name} changes one number. Somewhere, a file stops being red.', '{name}改了一個數字。某個檔案不再是紅色的了。', '{name}改了一个数字。某个档案不再是红色的了。') },
        { id: 'appeal', name: n('Use the appeals process', '走申訴程序', '走申诉程序'), needs: { skill: { social: 2 } }, tags: ['social'], risk: 0.4, exposure: 2, perkBonus: { bail: -0.3 },
          ok: n('{name} files an appeal so dull that the system approves it to make it stop.', '{name}提交了一份無聊到極點的申訴，系統為了結案直接批准了。', '{name}提交了一份无聊到极点的申诉，系统为了结案直接批准了。') },
      ],
      hidden: { id: 'admin_note', name: n('The admin password on a sticky note', '便條上的管理員密碼', '便条上的管理员密码'), tags: [], risk: 0.1, exposure: 2,
        ok: n('The admin password is on a sticky note by the screen. {name} sighs and logs in.', '管理員密碼就寫在螢幕旁的便條上。{name}嘆了口氣，登入了。', '管理员密码就写在屏幕旁的便条上。{name}叹了口气，登录了。') },
    },

    lockers: {
      art: 'arches', tags: ['door', 'data'],
      name: n('Evidence lockers', '證物櫃', '证物柜'),
      desc: n('Confiscated phones sit in lockers behind the patrol post.', '被沒收的手機都鎖在巡邏站後面的證物櫃裡。', '被没收的手机都锁在巡逻站后面的证物柜里。'),
      approaches: [
        { id: 'pick_locker', name: n('Pick the locker', '撬開櫃子', '撬开柜子'), tags: ['hands'], risk: 0.4, exposure: 4, perkBonus: { lockpick: -0.3 },
          ok: n('{name} finds the right locker on the second try.', '{name}第二次就找對了櫃子。', '{name}第二次就找对了柜子。') },
        { id: 'wipe', name: n('Wipe the phone remotely', '遠端清掉手機', '远程清掉手机'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 2,
          ok: n('{name} wipes the phone from the street. Nobody inside will ever see what was on it.', '{name}在街上就把手機清空了，裡面的人永遠不會看到那些東西。', '{name}在街上就把手机清空了，里面的人永远不会看到那些东西。') },
        { id: 'claim', name: n('Claim it as the owner', '假裝來領回', '假装来领回'), needs: { skill: { social: 1 } }, tags: ['social', 'lie'], risk: 0.4, exposure: 4,
          ok: n('{name} shows the duty officer a lock screen photo. Close enough.', '{name}給值班員看了一張鎖定畫面的照片。差不多就行了。', '{name}给值班员看了一张锁屏照片。差不多就行了。') },
      ],
      hidden: { id: 'unlocked', name: n('The locker nobody locked', '忘了鎖的那一格', '忘了锁的那一格'), tags: [], risk: 0.1, exposure: 2,
        ok: n('One locker was never locked. {name} just opens it.', '有一格櫃子根本沒鎖，{name}直接打開了。', '有一格柜子根本没锁，{name}直接打开了。') },
    },

    loan_office: {
      art: 'teahouse', tags: ['social'],
      name: n("The lender's back room", '放貸人的後屋', '放贷人的后屋'),
      desc: n('The lender works out of the back of a closed launderette.', '放貸的人在一間關了門的洗衣店後面辦公。', '放贷的人在一间关了门的洗衣店后面办公。'),
      approaches: [
        { id: 'negotiate', name: n('Negotiate', '談判', '谈判'), needs: { skill: { social: 2 } }, tags: ['social'], risk: 0.35, exposure: 2, perkBonus: { smooth_talk: -0.25, bail: -0.2 },
          ok: n('{name} talks for twenty minutes. The debt is suddenly "a misunderstanding".', '{name}講了二十分鐘，那筆債突然變成了「一場誤會」。', '{name}讲了二十分钟，那笔债突然变成了“一场误会”。') },
        { id: 'dig_dirt', name: n('Dig up dirt on the lender', '找出對方的把柄', '找出对方的把柄'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.3, exposure: 4, bandwidth: 1, perkBonus: { gossip: -0.25 },
          ok: n('{name} slides a printout across the desk. The lender goes pale.', '{name}把一張列印出來的紙推過桌面，對方臉色發白。', '{name}把一张打印出来的纸推过桌面，对方脸色发白。') },
        { id: 'lean_on', name: n('Lean on them', '嚇嚇對方', '吓吓对方'), needs: { skill: { physical: 2 } }, tags: ['physical'], risk: 0.35, exposure: 8,
          ok: n('{name} does not say anything. {name} just stands very close.', '{name}什麼都沒說，只是站得非常近。', '{name}什么都没说，只是站得非常近。') },
      ],
      hidden: { id: 'no_licence', name: n('The lender has a threat score too', '對方也怕被評分', '对方也怕被评分'), tags: [], risk: 0.1, exposure: 2,
        ok: n('{name} mentions that unlicensed lending is a scoring offence. The debt disappears.', '{name}提了一句無照放貸會被扣分，那筆債就消失了。', '{name}提了一句无照放贷会被扣分，那笔债就消失了。') },
    },

    shopfront: {
      art: 'gerrard', tags: ['patrol'],
      name: n('The shop', '店面', '店面'),
      desc: n('Lionheart are coming to seal the shop first thing tomorrow.', '獅心防務明天一早就要來貼封條。', '狮心防务明天一早就要来贴封条。'),
      approaches: [
        { id: 'fix_record', name: n('Change the risk record', '改掉風險紀錄', '改掉风险记录'), needs: { skill: { hack: 2 } }, tags: ['hack', 'data'], risk: 0.3, exposure: 6, bandwidth: 1,
          ok: n('{name} downgrades the shop from "high risk" to "noodles".', '{name}把店的風險等級從「高風險」改成了「麵店」。', '{name}把店的风险等级从“高风险”改成了“面馆”。') },
        { id: 'rally', name: n('Get the neighbours out', '找街坊來撐場', '找街坊来撑场'), needs: { skill: { social: 1 } }, tags: ['social'], risk: 0.3, exposure: 10, perkBonus: { distraction: -0.2, gossip: -0.15 },
          ok: n('By dawn, forty neighbours are standing outside the shop. {name} brought tea.', '天亮前，店門口站了四十個街坊。{name}還帶了茶。', '天亮前，店门口站了四十个街坊。{name}还带了茶。') },
      ],
      hidden: { id: 'bribe_log', name: n("The inspector's bribes", '稽查員收錢的紀錄', '稽查员收钱的记录'), tags: [], risk: 0.1, exposure: 3,
        ok: n('The inspector took money from the chain store next door. {name} has the receipts.', '稽查員收過隔壁連鎖店的錢，{name}手上有收據。', '稽查员收过隔壁连锁店的钱，{name}手上有收据。') },
    },

    canal: {
      art: 'embankment', tags: ['dog', 'navigate'],
      name: n('Canal side', '運河邊', '运河边'),
      desc: n('The last ping came from under a tower by the canal. Someone is walking a dog along here.', '最後的定位在運河邊的監控塔下。有人在這附近遛狗。', '最后的定位在运河边的监控塔下。有人在这附近遛狗。'),
      approaches: [
        { id: 'trace', name: n('Trace the phone', '追蹤手機訊號', '追踪手机信号'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 1,
          ok: n('{name} gets a ping. The phone is underground, two hundred metres east.', '{name}收到一次回應：手機在地下，往東兩百米。', '{name}收到一次回应：手机在地下，往东两百米。') },
        { id: 'dog_walker', name: n('Ask the dog walker', '跟遛狗的人打聽', '跟遛狗的人打听'), needs: { skill: { social: 1 } }, tags: ['social', 'dog'], risk: 0.3, exposure: 3, perkBonus: { gossip: -0.2 },
          ok: n('The dog walker saw a van stop by the service tunnel. {name} gives the dog a biscuit.', '遛狗的人看到一輛廂型車停在維修隧道口。{name}餵了狗一塊餅乾。', '遛狗的人看到一辆面包车停在维修隧道口。{name}喂了狗一块饼干。') },
        { id: 'search_bank', name: n('Search the bank', '沿著岸邊找', '沿着岸边找'), needs: { ability: 'navigate' }, tags: ['physical', 'navigate'], risk: 0.4, exposure: 6,
          ok: n('{name} finds footprints in the mud leading under the bridge.', '{name}在泥地裡找到一串通往橋下的腳印。', '{name}在泥地里找到一串通往桥下的脚印。') },
      ],
      hidden: { id: 'drone_log', name: n("The drone's flight log", '無人機的飛行紀錄', '无人机的飞行记录'), tags: ['data'], risk: 0.1, exposure: 3,
        ok: n('A drone landed here once, for six minutes. {name} knows exactly where.', '有一架無人機在這裡降落過一次，停了六分鐘。{name}知道確切的位置。', '有一架无人机在这里降落过一次，停了六分钟。{name}知道确切的位置。') },
    },

    tunnel: {
      art: 'tunnels', tags: ['tunnel'],
      name: n('Service tunnel', '維修隧道', '维修隧道'),
      desc: n('Footprints lead into a disused service tunnel. It is completely dark.', '腳印一路通向一條廢棄的維修隧道，裡面一片漆黑。', '脚印一路通向一条废弃的维修隧道，里面一片漆黑。'),
      approaches: [
        { id: 'go_in', name: n('Go in', '走進去', '走进去'), needs: { ability: 'tunnel' }, tags: ['physical', 'tunnel'], risk: 0.3, exposure: 3,
          ok: n('{name} goes in with a phone torch. At the end of the tunnel, someone calls out.', '{name}打著手機手電筒走了進去。隧道盡頭，有人在喊。', '{name}打着手机手电筒走了进去。隧道尽头，有人在喊。') },
        { id: 'toy_drone', name: n('Send a toy drone in first', '先派玩具無人機進去', '先派玩具无人机进去'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.3, exposure: 4, bandwidth: 1,
          ok: n("{name}'s toy drone finds them: tied up, scared, alive.", '{name}的玩具無人機找到了人：被綁著、很害怕，但還活著。', '{name}的玩具无人机找到了人：被绑着、很害怕，但还活着。') },
        { id: 'rubble', name: n('Clear the rubble', '搬開坍方', '搬开塌方'), needs: { skill: { physical: 2 } }, tags: ['physical'], risk: 0.35, exposure: 4, injure: 0.25, perkBonus: { heavy_lift: -0.3 },
          ok: n('{name} shifts the last slab. There is a way through.', '{name}搬開最後一塊水泥板，路通了。', '{name}搬开最后一块水泥板，路通了。') },
      ],
      hidden: { id: 'old_map', name: n('The 1970s maintenance map', '1970 年代的維修圖', '1970 年代的维修图'), tags: [], risk: 0.1, exposure: 2,
        ok: n('The old map shows a second entrance with a light switch. {name} finds it.', '舊維修圖上有另一個有電燈開關的入口，{name}找到了。', '旧维修图上有另一个有电灯开关的入口，{name}找到了。') },
    },
  };

  // ===== 行動 =====
  // kind：district 行政區行動（提高民心）、rescue 救出被捕的隊員、recruit 招募任務（幫路人解決麻煩）。
  const ops = {
    tower: { kind: 'district', stages: ['fence', 'patrol_drone', 'tower_box', 'getaway'], reward: { support: 20 },
      name: n('Take down a surveillance tower', '拆掉一座監控塔', '拆掉一座监控塔'),
      desc: n('Every tower down is one less eye on the curfew.', '每拆掉一座塔，宵禁就少一隻眼睛。', '每拆掉一座塔，宵禁就少一只眼睛。') },
    broadcast: { kind: 'district', stages: ['lobby', 'antenna', 'broadcast', 'getaway'], reward: { support: 15 }, tags: ['broadcast'],
      name: n('Hijack the screens', '插播反宣傳', '插播反宣传'),
      desc: n('Ninety seconds on every screen in Camden.', '康登每一塊螢幕，九十秒。', '卡姆登每一块屏幕，九十秒。') },
    rescue: { kind: 'rescue', stages: ['holding_yard', 'side_door', 'cells', 'getaway'], reward: { support: 5 },
      name: n('Break {name} out', '救出{name}', '救出{name}'),
      desc: n('Three nights, then they move prisoners somewhere nobody can find.', '三個晚上之後，人就會被轉移到沒有人找得到的地方。', '三个晚上之后，人就会被转移到没有人找得到的地方。') },
  };
  // 招募任務：依路人的麻煩（problems 的 mission）決定關卡。
  const recruit = {
    rescue: ['holding_yard', 'cells', 'getaway'],
    erase_score: ['side_door', 'terminal', 'getaway'],
    recover: ['patrol_drone', 'lockers', 'getaway'],
    debt: ['loan_office', 'getaway'],
    broadcast: ['antenna', 'broadcast', 'getaway'],
    protect: ['shopfront', 'getaway'],
    search: ['canal', 'tunnel', 'getaway'],
  };
  const recruitOp = {
    kind: 'recruit', reward: { support: 5 },
    name: n('Help {name}', '幫{name}一個忙', '帮{name}一个忙'),
  };

  // 由道具、稀有人物、特質和默契組合帶來的解法。引擎會在符合條件的關卡加上它們。
  const special = {
    keycard: { id: 'keycard', name: n('Swipe the stolen keycard', '刷偷來的門卡', '刷偷来的门卡'), tags: ['door'], sure: true, exposure: 1,
      ok: n('{name} swipes the stolen card. The light blinks green.', '{name}刷了偷來的門卡，燈閃成了綠色。', '{name}刷了偷来的门卡，灯闪成了绿色。') },
    master_keys: { id: 'master_keys', name: n('Master keys', '萬能鑰匙', '万能钥匙'), tags: ['door'], sure: true, exposure: 0,
      ok: n('{name} picks one key off a ring of forty without looking. It fits.', '{name}看都沒看，從四十把鑰匙裡挑出一把。剛好就是這一把。', '{name}看都没看，从四十把钥匙里挑出一把。刚好就是这一把。') },
    pigeon_post: { id: 'pigeon_post', name: n('Pigeon post', '放信鴿', '放信鸽'), tags: [], sure: true, exposure: 0,
      ok: n('{name} clips the drive to a pigeon. It is over the rooftops before the drones look up.', '{name}把隨身碟綁在鴿子腳上。無人機還沒反應過來，鴿子已經飛過屋頂了。', '{name}把U盘绑在鸽子脚上。无人机还没反应过来，鸽子已经飞过屋顶了。') },
    rooftops: { id: 'rooftops', name: n('Over the rooftops', '走屋頂', '走屋顶'), needs: { ability: 'climb' }, tags: ['physical', 'climb'], risk: 0.1, exposure: 2,
      ok: n('{name} runs the rooftops, jumps the gap, and is waiting on the other side.', '{name}在屋頂上一路奔跑，跳過缺口，已經在另一頭等著了。', '{name}在屋顶上一路奔跑，跳过缺口，已经在另一头等着了。') },
    pirate_radio: { id: 'pirate_radio', name: n('Go live on pirate radio', '用地下電台開麥', '用地下电台开麦'), tags: ['social'], risk: 0.05, exposure: 4,
      ok: n('"Good evening, Camden." Half the borough already knows the voice of {name}.', '「晚安，康登。」半個康登的人都認得{name}的聲音。', '“晚上好，卡姆登。”半个卡姆登的人都认得{name}的声音。') },
    pickup: { id: 'pickup', name: n('Bring the car round', '把車開過來', '把车开过来'), tags: [], sure: true, exposure: 0,
      ok: n('{name} pulls up at the end of the alley, lights off. Everyone piles in.', '{name}熄著燈把車停在巷口，大家擠了上去。', '{name}熄着灯把车停在巷口，大家挤了上去。') },
    con_duo: { id: 'con_duo', name: n('One talks, one lifts', '一個聊天，一個摸門卡', '一个聊天，一个摸门卡'), tags: ['social', 'hands'], risk: 0.1, exposure: 2,
      ok: n('While the guard laughs at a joke, {name} lifts the card and opens the door.', '守衛還在笑隊友講的笑話，{name}已經摸走門卡，把門打開了。', '守卫还在笑队友讲的笑话，{name}已经摸走门卡，把门打开了。') },
  };

  S2.ops = { stages, ops, recruit, recruitOp, special };
})(window.ECHO = window.ECHO || {});
