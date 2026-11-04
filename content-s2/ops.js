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

    // ----- 分頭行動的佯攻線：每成功一關，主力就多一層掩護 -----
    decoy_guard: {
      art: 'gerrard', tags: ['social'],
      name: n('Keep the guard busy', '拖住樓下的保全', '拖住楼下的保安'),
      desc: n('The night guard sits at the front desk with a view of the lift. Someone has to keep the guard looking the other way.', '值夜班的保全坐在櫃檯，正對著電梯。得有人讓保全一直看向別的地方。', '值夜班的保安坐在前台，正对着电梯。得有人让保安一直看向别的地方。'),
      approaches: [
        { id: 'complain', name: n('Complain about the bins', '去櫃檯投訴垃圾桶', '去前台投诉垃圾桶'), needs: { skill: { social: 1 } }, tags: ['social'], risk: 0.3, exposure: 4, perkBonus: { smooth_talk: -0.2 },
          ok: n('{name} spends ten minutes on the recycling rota. The guard never looks up at the lift.', '{name}花了十分鐘抱怨垃圾分類的排班，保全一次都沒抬頭看電梯。', '{name}花了十分钟抱怨垃圾分类的排班，保安一次都没抬头看电梯。') },
        { id: 'fake_alarm', name: n('Set off the car alarms', '弄響停車場的車子警報', '弄响停车场的汽车警报'), needs: { skill: { physical: 1 } }, tags: ['physical'], risk: 0.3, exposure: 8,
          ok: n('Six car alarms go off at once. {name} is already gone; the guard runs out to look.', '六台車的警報同時大響。{name}早就走了，保全跑出去查看。', '六辆车的警报同时大响。{name}早就走了，保安跑出去查看。') },
        { id: 'loop_lobby', name: n('Loop the lobby cameras', '讓大廳攝影機重播', '让大厅摄像头重播'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.25, exposure: 5, bandwidth: 1,
          ok: n("{name} loops the lobby feed. On the guard's screen, nobody ever takes the lift.", '{name}讓大廳的畫面一直重播。在保全的螢幕上，從來沒有人搭過電梯。', '{name}让大厅的画面一直重播。在保安的屏幕上，从来没有人坐过电梯。') },
      ],
      hidden: { id: 'football', name: n('The match on the radio', '收音機裡的球賽', '收音机里的球赛'), tags: [], risk: 0.1, exposure: 2,
        ok: n("The guard is listening to the match. {name} just asks for the score, and the guard won't stop talking.", '保全在聽球賽轉播。{name}只是問了一句比數，保全就說個不停。', '保安在听球赛转播。{name}只是问了一句比分，保安就说个不停。') },
    },
    decoy_drone: {
      art: 'arches', tags: ['patrol'],
      name: n('Pull the drones away', '把無人機引開', '把无人机引开'),
      desc: n('Two drones circle the block. If they look up at the roof, the whole thing is over.', '兩架無人機在附近盤旋。只要它們往屋頂看一眼，一切就結束了。', '两架无人机在附近盘旋。只要它们往屋顶看一眼，一切就结束了。'),
      approaches: [
        { id: 'flare', name: n('Light a flare two streets over', '在兩條街外點信號彈', '在两条街外点信号弹'), needs: { ability: 'run' }, tags: ['physical', 'run'], risk: 0.35, exposure: 10, injure: 0.2, perkBonus: { sprint: -0.2 },
          ok: n('{name} lights the flare and runs. Both drones swing after the red glow.', '{name}點燃信號彈就跑，兩架無人機都追著紅光飛走了。', '{name}点燃信号弹就跑，两架无人机都追着红光飞走了。') },
        { id: 'spoof', name: n('Spoof a fake intruder', '偽造一個入侵者訊號', '伪造一个入侵者信号'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 2, perkBonus: { botnet: -0.25 },
          ok: n('{name} plants a ghost on the drone network. Both drones go chasing nobody.', '{name}在無人機網路裡放了一個假人，兩架無人機都去追一個不存在的人。', '{name}在无人机网络里放了一个假人，两架无人机都去追一个不存在的人。') },
        { id: 'crowd', name: n('Start a street party', '在街角辦起派對', '在街角办起派对'), needs: { skill: { social: 2 } }, tags: ['social'], risk: 0.3, exposure: 12, perkBonus: { distraction: -0.3 },
          ok: n('Music, thirty people, and {name} in the middle of it. The drones hover over the party all night.', '音樂、三十個人，{name}在正中間。無人機整晚都盤旋在派對上空。', '音乐、三十个人，{name}在正中间。无人机整晚都盘旋在派对上空。') },
      ],
      hidden: { id: 'pigeons', name: n('The pigeons on the cables', '電線上的鴿子', '电线上的鸽子'), tags: [], risk: 0.1, exposure: 3,
        ok: n('Drones are programmed to avoid flocks. {name} scatters breadcrumbs under the roof edge.', '無人機被設定成要閃開鳥群。{name}在屋簷下撒了一把麵包屑。', '无人机被设定成要避开鸟群。{name}在屋檐下撒了一把面包屑。') },
    },

    // ----- 突襲安全屋（限時的防守行動） -----
    barricade: {
      art: 'basement', tags: ['door'],
      name: n('Hold the door', '堵住門口', '堵住门口'),
      desc: n('Boots on the stairs. Lionheart are thirty seconds from the basement door.', '樓梯傳來靴子聲。獅心防務離地下室的門只剩三十秒。', '楼梯传来靴子声。狮心防务离地下室的门只剩三十秒。'),
      approaches: [
        { id: 'furniture', name: n('Pile the furniture against it', '把家具全堆到門後', '把家具全堆到门后'), needs: { skill: { physical: 1 } }, tags: ['physical'], risk: 0.3, exposure: 4, perkBonus: { heavy_lift: -0.25 },
          ok: n('{name} drags the sofa, the fridge and the shelves against the door.', '{name}把沙發、冰箱和書架全拖到門後。', '{name}把沙发、冰箱和书架全拖到门后。') },
        { id: 'jam_lock', name: n('Jam the lock', '卡死門鎖', '卡死门锁'), tags: ['hands'], risk: 0.4, exposure: 2, perkBonus: { lockpick: -0.3 },
          ok: n('{name} snaps a key off in the lock. Nobody is opening that from outside.', '{name}把一把鑰匙折斷在鎖孔裡，外面的人打不開了。', '{name}把一把钥匙折断在锁孔里，外面的人打不开了。') },
        { id: 'fake_empty', name: n('Make it look abandoned', '讓這裡看起來沒人住', '让这里看起来没人住'), needs: { skill: { social: 1 } }, tags: ['social', 'lie'], risk: 0.35, exposure: 4, perkBonus: { disguise: -0.25 },
          ok: n('Lights off, a padlock on the outside. {name} makes the basement look empty for years.', '關燈，門外掛上大鎖。{name}讓地下室看起來已經空了好幾年。', '关灯，门外挂上大锁。{name}让地下室看起来已经空了好几年。') },
      ],
      hidden: { id: 'coal_hatch', name: n('The old coal hatch', '舊的運煤口', '旧的运煤口'), tags: [], risk: 0.1, exposure: 2,
        ok: n('{name} remembers the coal hatch. Someone can slip out and lead them the wrong way.', '{name}想起了舊的運煤口，可以先溜出去把他們引到別處。', '{name}想起了旧的运煤口，可以先溜出去把他们引到别处。') },
    },
    burn_files: {
      art: 'basement', tags: ['data'],
      name: n('Wipe everything', '銷毀所有資料', '销毁所有数据'),
      desc: n('Names, addresses, everyone you have ever recruited. None of it can be here when the door goes.', '名單、地址、所有招募過的人。門被撞開之前，這些都不能留在這裡。', '名单、地址、所有招募过的人。门被撞开之前，这些都不能留在这里。'),
      approaches: [
        { id: 'wipe', name: n('Run the wipe script', '執行清除程式', '执行清除程序'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.25, exposure: 2, bandwidth: 1,
          ok: n('{name} runs the wipe. Seven years of DedSec London become zeros.', '{name}執行了清除程式。DedSec London 七年的紀錄變成一串零。', '{name}执行了清除程序。DedSec London 七年的记录变成一串零。') },
        { id: 'smash', name: n('Smash the drives', '把硬碟全砸了', '把硬盘全砸了'), needs: { skill: { physical: 1 } }, tags: ['physical'], risk: 0.3, exposure: 6,
          ok: n('{name} takes a hammer to every drive in the room.', '{name}拿鐵鎚把房間裡每一顆硬碟都砸了。', '{name}拿铁锤把房间里每一块硬盘都砸了。') },
        { id: 'stash', name: n('Hide the drive in the wall', '把硬碟藏進牆裡', '把硬盘藏进墙里'), tags: ['hands'], risk: 0.35, exposure: 2,
          ok: n('{name} slides the only drive that matters behind a loose brick.', '{name}把唯一重要的那顆硬碟塞到一塊鬆動的磚頭後面。', '{name}把唯一重要的那块硬盘塞到一块松动的砖头后面。') },
      ],
      hidden: { id: 'bagley_wipe', name: n('Ask Bagley', '請 Bagley 處理', '请 Bagley 处理'), tags: [], risk: 0.05, exposure: 0,
        ok: n('"Already done," says Bagley. "I wiped it the moment I heard boots." {name} just unplugs the server.', '「已經處理好了，」Bagley 說，「我一聽到靴子聲就清掉了。」{name}只需要拔掉伺服器的電源。', '“已经处理好了，”Bagley 说，“我一听到靴子声就清掉了。”{name}只需要拔掉服务器的电源。') },
    },
    back_door: {
      art: 'tunnels', tags: ['exit', 'tunnel'],
      name: n('Out the back', '從後門撤離', '从后门撤离'),
      desc: n('Behind the boiler, a passage into the old sewer. It is dark and it floods.', '鍋爐後面有一條通往舊下水道的通道，很黑，還會淹水。', '锅炉后面有一条通往旧下水道的通道，很黑，还会淹水。'),
      approaches: [
        { id: 'sewer', name: n('Into the sewer', '鑽進下水道', '钻进下水道'), needs: { ability: 'tunnel' }, tags: ['physical', 'tunnel'], risk: 0.3, exposure: 3,
          ok: n('{name} leads everyone through knee-deep water and out under the canal.', '{name}帶著大家蹚過及膝的水，從運河底下鑽了出去。', '{name}带着大家蹚过及膝的水，从运河底下钻了出去。') },
        { id: 'rooftop_run', name: n('Up and over the roofs', '從屋頂逃走', '从屋顶逃走'), needs: { skill: { physical: 1 }, ability: 'climb' }, tags: ['physical', 'climb', 'run'], risk: 0.35, exposure: 6, injure: 0.25,
          ok: n('Through the skylight, across three roofs, down a drainpipe. {name} makes it look easy.', '從天窗出去，跨過三個屋頂，順著水管滑下來。{name}做得像散步一樣輕鬆。', '从天窗出去，跨过三个屋顶，顺着水管滑下来。{name}做得像散步一样轻松。') },
        { id: 'walk_out', name: n('Walk out the front as neighbours', '假裝是鄰居從正門走出去', '假装是邻居从正门走出去'), needs: { skill: { social: 2 } }, tags: ['social', 'lie'], risk: 0.4, exposure: 6, perkBonus: { unsuspicious: -0.3, disguise: -0.2 },
          ok: n('"Terrible business," says {name} to the officer at the door, and walks straight past.', '「真是可怕，」{name}對門口的警員說了一句，然後直接走了出去。', '“真是可怕，”{name}对门口的警员说了一句，然后直接走了出去。') },
      ],
      hidden: { id: 'next_door', name: n('The hole into next door', '通往隔壁的牆洞', '通往隔壁的墙洞'), tags: [], risk: 0.1, exposure: 2,
        ok: n('There is a hole into the launderette next door behind the poster. {name} goes first.', '海報後面有一個通往隔壁洗衣店的牆洞，{name}第一個鑽了過去。', '海报后面有一个通往隔壁洗衣店的墙洞，{name}第一个钻了过去。') },
    },

    // ----- 擴充安全屋 -----
    landlord: {
      art: 'flat', tags: ['social'],
      name: n('The landlord', '房東', '房东'),
      desc: n('The flat upstairs has been empty for a year. The landlord asks no questions, but wants something.', '樓上那層空了一年。房東不問問題，但總要有點好處。', '楼上那层空了一年。房东不问问题，但总要有点好处。'),
      approaches: [
        { id: 'charm', name: n('Charm the landlord', '跟房東套交情', '跟房东套交情'), needs: { skill: { social: 2 } }, tags: ['social'], risk: 0.3, exposure: 2, perkBonus: { smooth_talk: -0.25 },
          ok: n('Three cups of tea later, {name} has the keys and a discount.', '喝了三杯茶之後，{name}拿到了鑰匙，還打了折。', '喝了三杯茶之后，{name}拿到了钥匙，还打了折。') },
        { id: 'fix_score', name: n("Fix the landlord's threat score", '幫房東改掉威脅評分', '帮房东改掉威胁评分'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 5, bandwidth: 1,
          ok: n("{name} quietly lowers the landlord's score. The rent is suddenly very reasonable.", '{name}悄悄調低了房東的威脅評分，租金突然變得非常合理。', '{name}悄悄调低了房东的威胁评分，租金突然变得非常合理。') },
        { id: 'repairs', name: n('Offer to fix the boiler', '幫忙修好鍋爐', '帮忙修好锅炉'), needs: { skill: { physical: 1 } }, tags: ['physical', 'hands'], risk: 0.35, exposure: 2,
          ok: n('{name} gets the boiler going for the first time since March. The landlord hands over the keys.', '{name}讓鍋爐從三月以來第一次動了起來，房東把鑰匙交了出來。', '{name}让锅炉从三月以来第一次动了起来，房东把钥匙交了出来。') },
      ],
      hidden: { id: 'landlord_secret', name: n('The landlord hates Lionheart too', '房東也恨獅心防務', '房东也恨狮心防务'), tags: [], risk: 0.05, exposure: 0,
        ok: n("The landlord's son was taken in the first week of the curfew. {name} doesn't even have to ask.", '房東的兒子在宵禁第一週就被帶走了。{name}根本不用開口。', '房东的儿子在宵禁第一周就被带走了。{name}根本不用开口。') },
    },
    move_in: {
      art: 'flat', tags: ['patrol'],
      name: n('Move in after curfew', '宵禁後搬家', '宵禁后搬家'),
      desc: n('Beds, mattresses and a server rack, carried across the street with drones overhead.', '床、床墊和一整個伺服器機櫃，要在無人機底下搬過馬路。', '床、床垫和一整个服务器机柜，要在无人机底下搬过马路。'),
      approaches: [
        { id: 'carry', name: n('Carry it all in one go', '一口氣全搬過去', '一口气全搬过去'), needs: { skill: { physical: 2 } }, tags: ['physical'], risk: 0.35, exposure: 8, injure: 0.2, perkBonus: { heavy_lift: -0.3 },
          ok: n('{name} carries a mattress on each shoulder and does not stop once.', '{name}兩邊肩膀各扛一張床墊，一次都沒停下來。', '{name}两边肩膀各扛一张床垫，一次都没停下来。') },
        { id: 'van', name: n('Use a "removals" van', '開一台「搬家公司」的車', '开一台“搬家公司”的车'), needs: { skill: { social: 1 } }, tags: ['social', 'lie'], risk: 0.3, exposure: 6, perkBonus: { getaway: -0.25 },
          ok: n('A van with a fake logo, {name} in overalls. The drones log it as a licensed night move.', '一台貼著假標誌的貨車，{name}穿著工作服。無人機把它記成合法的夜間搬家。', '一辆贴着假标志的货车，{name}穿着工作服。无人机把它记成合法的夜间搬家。') },
        { id: 'drone_window', name: n('Time it between drone passes', '算準無人機經過的空檔', '算准无人机经过的空档'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.3, exposure: 4, bandwidth: 1,
          ok: n('{name} calls out the gaps. Every trip across the street lands in a blind window.', '{name}喊著空檔的倒數。每一趟過馬路都剛好落在死角。', '{name}喊着空档的倒数。每一趟过马路都刚好落在死角。') },
      ],
      hidden: { id: 'basement_link', name: n('The connecting cellar', '連通的地窖', '连通的地窖'), tags: [], risk: 0.1, exposure: 1,
        ok: n('The two buildings share a cellar. {name} moves everything underground.', '兩棟樓共用一個地窖，{name}從地下把東西全搬了過去。', '两栋楼共用一个地窖，{name}从地下把东西全搬了过去。') },
    },

    // ----- 今晚的機會（jobs）用的關卡 -----
    convoy: {
      art: 'alley', tags: ['patrol'],
      name: n('The supply van', '獅心的補給車', '狮心的补给车'),
      desc: n('A Lionheart van does the rounds of the checkpoints every night, full of batteries, radios and drone parts. It stops for nobody.', '獅心防務的補給車每晚繞一圈檢查站，車上裝滿電池、對講機和無人機零件。它不會為任何人停下來。', '狮心防务的补给车每晚绕一圈检查站，车上装满电池、对讲机和无人机零件。它不会为任何人停下来。'),
      approaches: [
        { id: 'roadworks', name: n('Fake some roadworks', '擺出假的道路施工', '摆出假的道路施工'), tags: ['social', 'lie'], risk: 0.35, exposure: 4, perkBonus: { site_pass: -0.25, disguise: -0.2 },
          ok: n('{name} puts out three cones and a sign. The van stops and waits like a good citizen.', '{name}擺了三個三角錐和一塊牌子。補給車乖乖停下來等。', '{name}摆了三个锥桶和一块牌子。补给车乖乖停下来等。') },
        { id: 'reroute', name: n('Reroute the satnav', '改掉車上的導航', '改掉车上的导航'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.25, exposure: 6, bandwidth: 1,
          ok: n('The satnav sends the driver left, down a dead end. {name} is waiting there.', '導航叫司機左轉，開進一條死巷。{name}就在巷子裡等著。', '导航叫司机左转，开进一条死胡同。{name}就在胡同里等着。') },
        { id: 'stinger', name: n('Lay a stinger', '在路上撒釘子', '在路上撒钉子'), tags: ['hands', 'run'], risk: 0.35, exposure: 8, injure: 0.2, perkBonus: { sprint: -0.15 },
          ok: n('Two flat tyres. By the time the driver gets out, {name} is gone.', '兩個輪胎都扁了。司機下車的時候，{name}已經不見了。', '两个轮胎都瘪了。司机下车的时候，{name}已经不见了。') },
      ],
      hidden: { id: 'chip_shop', name: n('The driver always stops for chips', '司機每天都會停下來買薯條', '司机每天都会停下来买薯条'), tags: [], risk: 0.1, exposure: 2,
        ok: n("Eleven o'clock, the chip shop on the corner, engine running. {name} just opens the back door.", '十一點，轉角的炸魚薯條店，引擎沒熄。{name}直接打開了後車門。', '十一点，转角的炸鱼薯条店，引擎没熄。{name}直接打开了后车门。') },
    },

    crates: {
      art: 'dock', tags: ['door'],
      name: n('The cargo', '車上的貨', '车上的货'),
      desc: n('The back of the van is locked and full of crates. Not all of them can come with you.', '車廂鎖著，裡面堆滿了箱子。不可能全部帶走。', '车厢锁着，里面堆满了箱子。不可能全部带走。'),
      approaches: [
        { id: 'haul', name: n('Grab and carry', '扛了就走', '扛了就走'), needs: { skill: { physical: 2 } }, tags: ['physical', 'run'], risk: 0.3, exposure: 6, perkBonus: { heavy_lift: -0.25 },
          ok: n('{name} carries two crates at once and does not stop until the next street.', '{name}一次扛兩箱，一路扛到下一條街才停。', '{name}一次扛两箱，一路扛到下一条街才停。') },
        { id: 'van_lock', name: n('Pick the van lock', '撬開車廂', '撬开车厢'), tags: ['hands'], risk: 0.4, exposure: 4, perkBonus: { lockpick: -0.3 },
          ok: n('The lock gives. {name} passes the crates out one by one.', '鎖開了。{name}把箱子一個一個遞出來。', '锁开了。{name}把箱子一个一个递出来。') },
        { id: 'manifest', name: n('Edit the manifest', '改掉貨單', '改掉货单'), needs: { skill: { hack: 2 } }, tags: ['hack', 'data'], risk: 0.3, exposure: 3, bandwidth: 1,
          ok: n('{name} changes one line on the manifest. Tomorrow the depot delivers half the van to a community centre down the road.', '{name}改了貨單上的一行字。明天倉庫會把半車的貨送到街尾的社區中心。', '{name}改了货单上的一行字。明天仓库会把半车的货送到街尾的社区中心。') },
      ],
      hidden: { id: 'unsigned', name: n('The crates nobody signed for', '沒人簽收的那幾箱', '没人签收的那几箱'), tags: [], risk: 0.1, exposure: 2,
        ok: n('Three crates were never signed for. Nobody will miss them, and {name} knows it.', '有三箱一直沒人簽收。不會有人發現少了，{name}很清楚。', '有三箱一直没人签收。不会有人发现少了，{name}很清楚。') },
    },

    score_server: {
      art: 'server', tags: ['data', 'office'],
      name: n('The scoring server', '評分伺服器', '评分服务器'),
      desc: n('One rack in a rented basement keeps the threat scores for half the borough.', '租來的地下室裡有一台機櫃，存著半個行政區的威脅評分。', '租来的地下室里有一台机柜，存着半个行政区的威胁评分。'),
      approaches: [
        { id: 'wipe_rows', name: n('Delete our rows', '刪掉我們的紀錄', '删掉我们的记录'), needs: { skill: { hack: 2 } }, tags: ['hack', 'data'], risk: 0.3, exposure: 6, bandwidth: 1,
          ok: n('{name} deletes forty rows and leaves the other four thousand exactly as they were.', '{name}刪掉了四十行，其他四千行原封不動。', '{name}删掉了四十行，其他四千行原封不动。') },
        { id: 'backup', name: n('Pull the backup drives', '拔走備份硬碟', '拔走备份硬盘'), tags: ['hands'], risk: 0.35, exposure: 6, perkBonus: { building_access: -0.2, lockpick: -0.15 },
          ok: n('{name} walks out with the backup drives in a carrier bag. Tonight\'s restore will have nothing to restore.', '{name}把備份硬碟裝進塑膠袋帶走了。今晚的自動還原什麼都還原不了。', '{name}把备份硬盘装进塑料袋带走了。今晚的自动还原什么都还原不了。') },
        { id: 'cleaner', name: n('Pose as the cleaner', '假扮清潔工', '假扮清洁工'), tags: ['social', 'lie'], risk: 0.3, exposure: 4, perkBonus: { disguise: -0.3, smooth_talk: -0.15 },
          ok: n('{name} mops the floor, spills a bucket on exactly the right socket, and apologises a lot.', '{name}拖著地，「不小心」把一桶水潑在對的插座上，然後一直道歉。', '{name}拖着地，“不小心”把一桶水泼在对的插座上，然后一直道歉。') },
      ],
      hidden: { id: 'sticky_note', name: n('The password on the sticky note', '貼在螢幕上的密碼', '贴在屏幕上的密码'), tags: ['data'], risk: 0.05, exposure: 1,
        ok: n('The admin password is on a sticky note on the monitor. {name} sighs and types it in.', '管理員密碼就寫在螢幕上的便利貼。{name}嘆了口氣，照著打進去。', '管理员密码就写在屏幕上的便利贴。{name}叹了口气，照着打进去。') },
    },

    pharmacy: {
      art: 'basement', tags: ['door'],
      name: n('The medicine store', '獅心的藥品倉', '狮心的药品仓'),
      desc: n("Lionheart keep the borough's insulin and antibiotics behind a keypad, for people with a good enough score.", '獅心防務把整區的胰島素和抗生素鎖在一道密碼門後面，只發給分數夠好的人。', '狮心防务把整区的胰岛素和抗生素锁在一道密码门后面，只发给分数够好的人。'),
      approaches: [
        { id: 'transfer', name: n('Write a transfer order', '開一張調藥單', '开一张调药单'), needs: { perk: 'heal' }, tags: ['social'], risk: 0.1, exposure: 2,
          ok: n('{name} fills in the transfer form in perfect doctor\'s handwriting. Nobody can read it, so everybody signs it.', '{name}用標準的醫生字跡填好調藥單。沒人看得懂，所以每個人都簽了。', '{name}用标准的医生字迹填好调药单。没人看得懂，所以每个人都签了。') },
        { id: 'window', name: n('In through the back window', '從後窗爬進去', '从后窗爬进去'), needs: { ability: 'climb' }, tags: ['physical', 'climb'], risk: 0.3, exposure: 5, injure: 0.2,
          ok: n('{name} squeezes through a window built for a cat and unlocks the door from the inside.', '{name}從一扇只容得下貓的窗戶擠進去，從裡面把門打開。', '{name}从一扇只容得下猫的窗户挤进去，从里面把门打开。') },
        { id: 'keypad', name: n('Replay the keypad', '讓密碼鎖重播', '让密码锁重播'), needs: { skill: { hack: 1 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 1,
          ok: n('{name} replays the last code anyone typed. The door clicks.', '{name}把上一個人輸入的密碼重播一次，門喀的一聲開了。', '{name}把上一个人输入的密码重播一次，门咔的一声开了。') },
      ],
      hidden: { id: 'expired', name: n('Write it off as expired', '登記成「已過期」', '登记成“已过期”'), tags: ['data'], risk: 0.1, exposure: 2,
        ok: n('{name} marks the whole shelf as expired. Expired stock gets thrown out, and nobody counts what was thrown out.', '{name}把整個架子登記成「已過期」。過期的藥會被丟掉，而沒有人會去數丟掉了多少。', '{name}把整个架子登记成“已过期”。过期的药会被扔掉，而没有人会去数扔掉了多少。') },
    },

    mural: {
      art: 'highstreet', tags: ['climb'],
      name: n('The wall', '那面牆', '那面墙'),
      desc: n('The side of a block opposite the high street. By morning, everyone on the bus will see it.', '大街對面那棟樓的側牆。明天早上，每一個搭公車的人都會看到。', '大街对面那栋楼的侧墙。明天早上，每一个坐公交的人都会看到。'),
      approaches: [
        { id: 'spray', name: n('Climb up and spray it', '爬上去噴', '爬上去喷'), needs: { skill: { physical: 1 }, ability: 'climb' }, tags: ['physical', 'climb'], risk: 0.3, exposure: 6, injure: 0.2,
          ok: n('Three storeys up, {name} finishes the last letter as the sky goes grey.', '在三樓高的地方，{name}噴完最後一個字母，天剛好開始亮。', '在三楼高的地方，{name}喷完最后一个字母，天刚好开始亮。') },
        { id: 'projector', name: n('Project it', '用投影打上去', '用投影打上去'), needs: { skill: { hack: 1 } }, tags: ['hack', 'broadcast'], risk: 0.25, exposure: 6, bandwidth: 1, perkBonus: { broadcast: -0.15 },
          ok: n('{name} hides a projector in a bin across the road. The DedSec mask is ten metres tall.', '{name}把投影機藏在對街的垃圾桶裡。DedSec 的面具有十米高。', '{name}把投影仪藏在对街的垃圾桶里。DedSec 的面具有十米高。') },
        { id: 'block_party', name: n('Get the street to paint it', '找街坊一起畫', '找街坊一起画'), needs: { skill: { social: 1 } }, tags: ['social'], risk: 0.3, exposure: 10, perkBonus: { distraction: -0.2, gossip: -0.1 },
          ok: n('By two in the morning, twenty neighbours are painting. {name} is handing out brushes.', '凌晨兩點，二十個街坊都在畫。{name}在發刷子。', '凌晨两点，二十个街坊都在画。{name}在发刷子。') },
      ],
      hidden: { id: 'scaffold', name: n("Lionheart's own scaffolding", '獅心自己搭的鷹架', '狮心自己搭的脚手架'), tags: [], risk: 0.1, exposure: 2,
        ok: n('Lionheart put up scaffolding to fix their own camera. {name} uses it to reach the top of the wall.', '獅心防務為了修自己的攝影機搭了鷹架。{name}踩著它爬上了牆頂。', '狮心防务为了修自己的摄像头搭了脚手架。{name}踩着它爬上了墙顶。') },
    },

    false_trail: {
      art: 'gerrard', tags: ['social', 'data'],
      name: n('A false trail', '一條假線索', '一条假线索'),
      desc: n('Lionheart want a name for last week. Give them a wrong one, somewhere far from here.', '獅心防務想為上星期的事找個人負責。給他們一個錯的方向，越遠越好。', '狮心防务想为上星期的事找个人负责。给他们一个错的方向，越远越好。'),
      approaches: [
        { id: 'fake_report', name: n('File fake sightings', '在通報系統報假案', '在通报系统报假案'), needs: { skill: { hack: 1 } }, tags: ['hack', 'data'], risk: 0.25, exposure: 4, bandwidth: 1,
          ok: n('{name} files six sightings from the other end of London. Every patrol in the borough turns north.', '{name}報了六起倫敦另一頭的目擊。整區的巡邏隊都往北邊去了。', '{name}报了六起伦敦另一头的目击。整区的巡逻队都往北边去了。') },
        { id: 'pub_talk', name: n('Start a rumour in the pub', '在酒吧放話', '在酒吧放话'), needs: { skill: { social: 1 } }, tags: ['social', 'lie'], risk: 0.3, exposure: 3, perkBonus: { gossip: -0.2, smooth_talk: -0.15 },
          ok: n('By closing time, the whole pub "knows" DedSec moved to Croydon. {name} bought the round that started it.', '打烊前，整間酒吧的人都「知道」DedSec 搬去克羅伊登了。{name}請的那輪酒就是起點。', '打烊前，整间酒吧的人都“知道”DedSec 搬去克罗伊登了。{name}请的那轮酒就是起点。') },
        { id: 'burner', name: n('Put a burner on the night bus', '把手機丟上夜班公車', '把手机丢上夜班公交'), tags: ['run'], risk: 0.3, exposure: 5, perkBonus: { sprint: -0.15, river_route: -0.2 },
          ok: n('{name} drops a phone full of our chatter onto the N29. Lionheart follow it all the way to Enfield.', '{name}把一支裝滿我們對話紀錄的手機丟上 N29 夜班公車。獅心防務一路追到了恩菲爾德。', '{name}把一部装满我们聊天记录的手机丢上 N29 夜班公交。狮心防务一路追到了恩菲尔德。') },
      ],
      hidden: { id: 'cold_case', name: n('The case they never closed', '他們一直破不了的案子', '他们一直破不了的案子'), tags: ['data'], risk: 0.1, exposure: 2,
        ok: n('{name} ties last week to a case Lionheart never closed. They are happy to blame a ghost.', '{name}把上星期的事接到獅心防務一直破不了的一件舊案上。他們很樂意怪到一個幽靈頭上。', '{name}把上星期的事接到狮心防务一直破不了的一件旧案上。他们很乐意怪到一个幽灵头上。') },
    },

    tap_relay: {
      art: 'station', tags: ['data'],
      name: n('The radio relay', '無線電中繼站', '无线电中继站'),
      desc: n('Every Lionheart radio in the borough goes through a grey box on top of the old telephone exchange.', '整區獅心防務的無線電，都經過舊電話交換局樓頂的一個灰箱子。', '整区狮心防务的无线电，都经过旧电话交换局楼顶的一个灰箱子。'),
      approaches: [
        { id: 'splice', name: n('Splice in a line', '接一條線上去', '接一条线上去'), needs: { ability: 'climb' }, tags: ['hands', 'climb'], risk: 0.3, exposure: 5,
          ok: n('{name} splices a line in, wraps it in tape, and makes it look like it has always been there.', '{name}接了一條線上去，纏上膠帶，看起來就像一直都在那裡。', '{name}接了一条线上去，缠上胶带，看起来就像一直都在那里。') },
        { id: 'clone_key', name: n('Clone the encryption key', '複製加密金鑰', '复制加密密钥'), needs: { skill: { hack: 2 } }, tags: ['hack'], risk: 0.3, exposure: 6, bandwidth: 1,
          ok: n('{name} copies the key. For the next few nights, their radio is our radio.', '{name}複製了金鑰。接下來幾晚，他們的無線電就是我們的無線電。', '{name}复制了密钥。接下来几晚，他们的无线电就是我们的无线电。') },
        { id: 'old_radio', name: n('Tune in the old way', '用老收音機慢慢調', '用老收音机慢慢调'), tags: [], risk: 0.4, exposure: 2, perkBonus: { pirate_radio: -0.3, broadcast: -0.15, gossip: -0.1 },
          ok: n('An old valve radio, an hour of patience, and {name} finds the one channel they forgot to encrypt.', '一台老真空管收音機、一個小時的耐心，{name}找到了他們忘記加密的那個頻道。', '一台老电子管收音机、一个小时的耐心，{name}找到了他们忘记加密的那个频道。') },
      ],
      hidden: { id: 'handset', name: n('The radio left in the break room', '休息室裡忘了拿的對講機', '休息室里忘了拿的对讲机'), tags: [], risk: 0.1, exposure: 2,
        ok: n('A guard left a radio charging in the break room. {name} swaps it for one of ours.', '有個守衛把對講機留在休息室充電。{name}拿我們的一支換走了它。', '有个守卫把对讲机留在休息室充电。{name}拿我们的一部换走了它。') },
    },

    duty_office: {
      art: 'arches', tags: ['door', 'data'],
      name: n('The duty office', '獅心的值班室', '狮心的值班室'),
      desc: n("The local Lionheart duty office. The draft of next week's deployment plan is pinned to the wall.", '獅心防務在這一區的值班室。下星期部署圖的草稿就釘在牆上。', '狮心防务在这一区的值班室。下星期部署图的草稿就钉在墙上。'),
      approaches: [
        { id: 'photo', name: n('Photograph the plan', '拍下部署圖', '拍下部署图'), tags: ['hands'], risk: 0.35, exposure: 4, perkBonus: { lockpick: -0.2, building_access: -0.2 },
          ok: n('{name} gets one clear photo of the wall and is out of the window before the kettle boils.', '{name}把整面牆清楚拍了一張，水還沒燒開就從窗戶出去了。', '{name}把整面墙清楚拍了一张，水还没烧开就从窗户出去了。') },
        { id: 'inbox', name: n("Read the duty manager's email", '讀值班主管的信', '读值班主管的邮件'), needs: { skill: { hack: 1 } }, tags: ['hack', 'data'], risk: 0.25, exposure: 5, bandwidth: 1,
          ok: n('The duty manager replies to everything. {name} reads the whole thread, attachments included.', '值班主管每封信都會回。{name}把整串信讀完，連附件都沒漏掉。', '值班主管每封邮件都会回。{name}把整串邮件读完，连附件都没漏掉。') },
        { id: 'new_guard', name: n('Pose as a new guard', '假裝是新來的保全', '假装是新来的保安'), needs: { skill: { social: 1 } }, tags: ['social', 'lie'], risk: 0.35, exposure: 4, perkBonus: { disguise: -0.3 },
          ok: n('{name} asks where the toilets are and gets the full tour, plan included.', '{name}問了一句廁所在哪裡，結果被帶著參觀了一整圈，部署圖也看到了。', '{name}问了一句厕所在哪里，结果被带着参观了一整圈，部署图也看到了。') },
      ],
      hidden: { id: 'shredder', name: n('The shredder is broken', '碎紙機壞了', '碎纸机坏了'), tags: ['data'], risk: 0.1, exposure: 1,
        ok: n('The shredder has been broken for a month. {name} finds three old drafts of the plan in the recycling.', '碎紙機壞了一個月。{name}在回收桶裡找到三份部署圖的舊草稿。', '碎纸机坏了一个月。{name}在回收桶里找到三份部署图的旧草稿。') },
    },

    checkpoint: {
      art: 'gerrard', tags: ['patrol'],
      name: n('The checkpoint', '檢查站', '检查站'),
      desc: n('A family on the List has to get past the checkpoint at the end of the road before dawn. Their faces are in every scanner.', '一家名單上的人，天亮前要通過路口的檢查站。每一台掃描器裡都有他們的臉。', '一家名单上的人，天亮前要通过路口的检查站。每一台扫描仪里都有他们的脸。'),
      approaches: [
        { id: 'swap_faces', name: n('Swap the photos in the scanner', '換掉掃描器裡的照片', '换掉扫描仪里的照片'), needs: { skill: { hack: 2 } }, tags: ['hack', 'data'], risk: 0.3, exposure: 6, bandwidth: 1,
          ok: n("{name} swaps the family's faces for four people who live in Spain. The scanner waves them through.", '{name}把這一家人的照片換成四個住在西班牙的人。掃描器讓他們過了。', '{name}把这一家人的照片换成四个住在西班牙的人。扫描仪让他们过了。') },
        { id: 'night_bus', name: n('Get them on the night bus', '混進夜班公車', '混进夜班公交'), needs: { skill: { social: 1 } }, tags: ['social'], risk: 0.35, exposure: 4, perkBonus: { smooth_talk: -0.15, disguise: -0.15 },
          ok: n('{name} sits the family among the night-shift cleaners. Nobody checks a bus full of tired people.', '{name}讓這一家人坐在上夜班的清潔工中間。沒有人會去查一整車累壞了的人。', '{name}让这一家人坐在上夜班的清洁工中间。没有人会去查一整车累坏了的人。') },
        { id: 'long_way', name: n('Take them round the long way', '帶他們繞過去', '带他们绕过去'), needs: { ability: 'navigate' }, tags: ['physical', 'navigate', 'run'], risk: 0.35, exposure: 6,
          ok: n('{name} walks the family through three back gardens and a church car park. The checkpoint never sees them.', '{name}帶這一家人穿過三個後院和一座教堂的停車場，檢查站從頭到尾都沒看到他們。', '{name}带这一家人穿过三个后院和一座教堂的停车场，检查站从头到尾都没看到他们。') },
      ],
      hidden: { id: 'shift_gap', name: n('The four-minute gap at shift change', '換班時的四分鐘空檔', '换班时的四分钟空档'), tags: [], risk: 0.1, exposure: 2,
        ok: n('At shift change the booth is empty for four minutes. {name} has the family across in three.', '換班的時候，崗亭會空四分鐘。{name}三分鐘就把這一家人帶過去了。', '换班的时候，岗亭会空四分钟。{name}三分钟就把这一家人带过去了。') },
    },
  };

  // ===== 行動 =====
  // kind：district 行政區行動（提高民心）、base 擴充安全屋、rescue 救出被捕的隊員、defense 守住安全屋、recruit 招募任務。
  // timer：限時行動，只有這麼多步可以用。split：分頭行動，lanes.main 是主力、lanes.decoy 是佯攻。
  const ops = {
    tower: { kind: 'district', stages: ['fence', 'patrol_drone', 'tower_box', 'getaway'], reward: { support: 20 },
      name: n('Take down a surveillance tower', '拆掉一座監控塔', '拆掉一座监控塔'),
      desc: n('Every tower down is one less eye on the curfew.', '每拆掉一座塔，宵禁就少一隻眼睛。', '每拆掉一座塔，宵禁就少一只眼睛。') },
    broadcast: { kind: 'district', split: true, lanes: { main: ['lobby', 'antenna', 'broadcast', 'getaway'], decoy: ['decoy_guard', 'decoy_drone'] }, reward: { support: 15 },
      name: n('Hijack the screens', '插播反宣傳', '插播反宣传'),
      desc: n('Ninety seconds on every screen in Camden. One team goes up to the roof; the other keeps the guard and the drones busy downstairs.', '康登每一塊螢幕，九十秒。一組人上屋頂，另一組在樓下拖住保全和無人機。', '卡姆登每一块屏幕，九十秒。一组人上屋顶，另一组在楼下拖住保安和无人机。') },
    expand: { kind: 'base', stages: ['landlord', 'move_in'], reward: { beds: 2 },
      name: n('Take the flat upstairs', '租下樓上那層', '租下楼上那层'),
      desc: n('Two more beds. More people can live at the safe house and go out at night.', '多兩張床，就能多住兩個人、多派兩個人出門。', '多两张床，就能多住两个人、多派两个人出门。') },
    rescue: { kind: 'rescue', stages: ['holding_yard', 'side_door', 'cells', 'getaway'], timer: 8, reward: { support: 5 },
      name: n('Break {name} out', '救出{name}', '救出{name}'),
      desc: n('The transfer van leaves at dawn. Eight moves, no more.', '移送車天亮就開走。只有八步，不能再多。', '移送车天亮就开走。只有八步，不能再多。') },
    raid: { kind: 'defense', stages: ['barricade', 'burn_files', 'back_door'], timer: 6, reward: { support: 5 },
      name: n('Lionheart are at the door', '獅心防務攻進來了', '狮心防务攻进来了'),
      desc: n('Hold the door, wipe the data, get out. Six moves before they are through. Stay in, and someone gets taken.', '堵門、銷毀資料、撤離。六步之內不完成，門就會被撞開。不應戰的話，一定有人被帶走。', '堵门、销毁数据、撤离。六步之内不完成，门就会被撞开。不应战的话，一定有人被带走。') },
  };
  // ===== 今晚的機會 =====
  // 每天早上從這裡抽，最多同時兩件（js/engine/night.js 的 refreshJobs）。每件留兩晚，打過一次（不管成敗）就沒了。
  // reward：support 民心、cool 熱度下降、wipe 全隊威脅評分下降、heal 傷員早一晚復原（重傷的人也脫離危險）、
  //   gear 器材（之後隊上有人會駭入時，出門自動帶一份：頻寬 +1）、tap 監聽獅心防務的頻道幾晚（這幾晚比較不會被反擊）、
  //   intel 這一區主線任務的情報（出發時起始警戒 −10，每一段都看得到巡邏路線）。
  // need：一定要符合才會出現（threat 有人威脅評分 25 以上、heat 熱度 20 以上、main 這一區的主線任務開了）。
  // boost：符合的話比較常出現（hurt 有人受傷）。weight 權重；where 在某些區更常見（倍數）；minRank 第幾區起才有；timer 限時。
  const jobs = {
    convoy: { stages: ['convoy', 'crates', 'getaway'], timer: 7, reward: { gear: 2, support: 5 }, weight: 2, where: { isle_of_dogs: 2, rotherhithe: 2 },
      name: n('Hit the supply van', '攔下獅心的補給車', '拦下狮心的补给车'),
      desc: n('Batteries, radios, drone parts. Whatever we take, we carry on the next few operations. The van only stops for so long.', '電池、對講機、無人機零件。搶到的器材，接下來幾次行動都用得上。補給車不會停太久。', '电池、对讲机、无人机零件。抢到的器材，接下来几次行动都用得上。补给车不会停太久。') },
    erase: { stages: ['side_door', 'score_server', 'getaway'], reward: { wipe: 25 }, need: 'threat', weight: 3,
      name: n('Wipe our scores', '洗掉我們的威脅評分', '洗掉我们的威胁评分'),
      desc: n("The borough's threat scores sit on one server. A few of us are getting close to the line.", '整區的威脅評分都存在同一台伺服器上。我們有幾個人的分數已經快到紅線了。', '整区的威胁评分都存在同一台服务器上。我们有几个人的分数已经快到红线了。') },
    meds: { stages: ['pharmacy', 'getaway'], reward: { heal: 1, support: 8 }, boost: 'hurt', weight: 2,
      name: n('Free the medicine', '把藥搶出來', '把药抢出来'),
      desc: n('Insulin and antibiotics for the street, and proper dressings for our own wounded.', '胰島素和抗生素分給街坊，我們自己的傷員也能換上像樣的繃帶。', '胰岛素和抗生素分给街坊，我们自己的伤员也能换上像样的绷带。') },
    mural: { stages: ['patrol_drone', 'mural'], reward: { support: 10 }, weight: 2, where: { camden: 2, soho: 2 },
      name: n('Paint the wall', '在牆上噴 DedSec', '在墙上喷 DedSec'),
      desc: n('A quick one. Lionheart paint over it in a week, but by then everyone has a photo.', '很快就能做完。獅心防務一個星期內就會把它蓋掉，但到時候每個人手機裡都有照片了。', '很快就能做完。狮心防务一个星期内就会把它盖掉，但到时候每个人手机里都有照片了。') },
    trail: { stages: ['false_trail', 'getaway'], reward: { cool: 15 }, need: 'heat', weight: 3,
      name: n('Lay a false trail', '放一條假線索', '放一条假线索'),
      desc: n('Send Lionheart chasing shadows somewhere else, and the streets here cool down.', '讓獅心防務去別的地方追影子，這裡的街頭就能降溫。', '让狮心防务去别的地方追影子，这里的街头就能降温。') },
    tap: { stages: ['patrol_drone', 'tap_relay', 'getaway'], reward: { tap: 3 }, weight: 2,
      name: n("Tap Lionheart's radio", '監聽獅心的無線電', '监听狮心的无线电'),
      desc: n('If we can hear them plan a raid or a blackout, we can move first. Good for a few nights, until they change the key.', '聽得到他們安排突襲或停電，我們就能先動。在他們換金鑰之前，可以聽好幾晚。', '听得到他们安排突袭或停电，我们就能先动。在他们换密钥之前，可以听好几晚。') },
    intel: { stages: ['side_door', 'duty_office'], reward: { intel: 1 }, need: 'main', weight: 4,
      name: n('Steal the deployment plan', '偷看部署圖', '偷看部署图'),
      desc: n("Groundwork for this district's main mission: where the guards stand, when they change, which doors they never check.", '為這一區的主線任務打底：守衛站在哪裡、什麼時候換班、哪幾扇門從來不查。', '为这一区的主线任务打底：守卫站在哪里、什么时候换班、哪几扇门从来不查。') },
    evac: { stages: ['checkpoint', 'getaway'], timer: 5, reward: { support: 12, cool: 5 }, minRank: 1, weight: 2, where: { westminster: 2 },
      name: n('Get a family out', '護送一家人出去', '护送一家人出去'),
      desc: n('A family on the List has one night to get out of the district. Five moves before the morning shift.', '一家名單上的人，只有今晚能離開這一區。早班上工之前，只有五步。', '一家名单上的人，只有今晚能离开这一区。早班上工之前，只有五步。') },
  };
  const jobOp = { kind: 'job' };

  // 主線任務分兩段：approach 是第一段（潛入，approachName 是這一段的名字），stages 是第二段（主要目標）。
  // 主角還在的話，第二段用文字冒險的方式進行（content-s2/scenes/）；跳過劇情、或主角不在了，就照 stages 這幾關進行。
  // 戰術地圖用哪幾張在 content-s2/maps.js 的 opMaps.approach 和 opMaps.main。
  const main = {
    m2: { kind: 'main', approach: ['patrol_drone', 'fence'], stages: ['tower_box', 'getaway'], reward: { support: 20 },
      approachName: n('Through Camden Market', '穿過康登市集', '穿过卡姆登市集'),
      name: n('Main mission 2: Curfew Night', '主線任務二：宵禁之夜', '主线任务二：宵禁之夜'),
      desc: n('The first time we move against the curfew head-on. Take down the first tower in Camden. You have to lead it yourself.', '第一次在宵禁裡正面行動，拆掉康登的第一座監控塔。你必須親自帶隊。', '第一次在宵禁里正面行动，拆掉卡姆登的第一座监控塔。你必须亲自带队。') },
    m3: { kind: 'main', approach: ['shopfront', 'lockers'], stages: ['holding_yard', 'cells', 'getaway'], reward: { support: 25 },
      approachName: n('Find where the van went', '查出押送車開去哪裡', '查出押送车开去哪里'),
      name: n('Main mission 3: High Threat', '主線任務三：高威脅', '主线任务三：高威胁'),
      desc: n('A delivery rider scored 91 was taken off Gerrard Street tonight. Get them out, and find out where the number came from.', '一個威脅評分 91 的外送員，今晚在爵祿街被帶走了。把人救出來，查清楚這個分數是怎麼來的。', '一个威胁评分 91 的外卖骑手，今晚在爵禄街被带走了。把人救出来，查清楚这个分数是怎么来的。') },
    m4: { kind: 'main', approach: ['canal', 'side_door'], stages: ['lobby', 'terminal', 'getaway'], reward: { support: 25 },
      approachName: n('Come ashore at the wharf', '從碼頭上岸', '从码头上岸'),
      name: n('Main mission 4: Inside Man', '主線任務四：內應', '主线任务四：内应'),
      desc: n("Dr Hale says he can walk us into Stillwater. Inside is a piece of Lionheart's List.", '黑爾博士說，他能帶我們走進靜域。裡面有獅心防務「名單」的一部分。', '黑尔博士说，他能带我们走进静域。里面有狮心防务“名单”的一部分。') },
    m5: { kind: 'main', approach: ['canal', 'tower_box'], stages: ['tunnel', 'terminal', 'getaway'], reward: { support: 25 },
      approachName: n('Cut the crane lights', '關掉吊車的燈', '关掉吊车的灯'),
      name: n('Main mission 5: The Tunnels', '主線任務五：隧道', '主线任务五：隧道'),
      desc: n("The drone hive sits on top of the old tunnels. Eileen Walsh still has her grandmother's notebook.", '無人機巢蓋在舊隧道的正上方。艾琳・沃什手上還有她祖母的筆記本。', '无人机巢盖在旧隧道的正上方。艾琳·沃什手上还有她祖母的笔记本。') },
    m7: { kind: 'main', approach: ['patrol_drone', 'tower_box'], stages: ['side_door', 'terminal', 'getaway'], reward: { support: 30 },
      approachName: n('Trip the substation', '先關掉變電箱', '先关掉变电箱'),
      name: n('Main mission 7: Blackout', '主線任務七：斷電', '主线任务七：断电'),
      desc: n('Switch off London, one district at a time, and open the way to Whitehall.', '把倫敦一區一區關掉，打開通往白廳的路。', '把伦敦一区一区关掉，打开通往白厅的路。') },
    m8: { kind: 'main', approach: ['tunnel', 'side_door'], stages: ['cells', 'terminal', 'back_door'], reward: { support: 0 },
      approachName: n('Under Whitehall by the old tunnels', '走舊隧道到白廳底下', '走旧隧道到白厅底下'),
      name: n('Main mission 8: Airspace Control', '主線任務八：空域控制中心', '主线任务八：空域控制中心'),
      desc: n('Under Whitehall, every Nightwatch drone in London answers to one room. Tonight we walk in.', '白廳底下，全倫敦的守夜人無人機都聽命於一個房間。今晚，我們走進去。', '白厅底下，全伦敦的守夜人无人机都听命于一个房间。今晚，我们走进去。') },
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
    tunnel: { id: 'tunnel', name: n('Out through the tunnels', '走隧道撤離', '走隧道撤离'), tags: [], sure: true, exposure: 0,
      ok: n('{name} lifts a grate. The old tunnels from Rotherhithe go everywhere, and no drone follows.', '{name}掀開一塊鐵柵。從羅瑟希德延伸出來的舊隧道四通八達，沒有無人機跟得進來。', '{name}掀开一块铁栅。从罗瑟希德延伸出来的旧隧道四通八达，没有无人机跟得进来。') },
    network_cab: { id: 'network_cab', name: n('Call the cab from the network', '叫外圍的計程車來接', '叫外围的出租车来接'), tags: [], sure: true, exposure: 1,
      ok: n('A cab from the network is waiting round the corner. {name} gets everyone in.', '外圍的計程車已經在轉角等著了，{name}讓大家上車。', '外围的出租车已经在转角等着了，{name}让大家上车。') },
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

  S2.ops = { stages, ops, main, jobs, jobOp, recruit, recruitOp, special };
})(window.ECHO = window.ECHO || {});
