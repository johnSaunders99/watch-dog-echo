// 指令別名表：每個標準指令在三種語言中的寫法，切換介面語言後其他語言的寫法仍然有效。
ECHO.commands = {
  look: ['look', 'l', 'examine', 'x', '查看', '看', '觀察', '檢查', '观察', '检查'],
  scan: ['scan', 'profile', '掃描', '扫描', '分析'],
  hack: ['hack', '駭入', '駭', '入侵', '黑入', '骇入', '破解'],
  read: ['read', 'open', '讀取', '讀', '打開', '读取', '读', '打开'],
  recall: ['recall', 'rebuild', 'sync', '重建', '還原', '还原', '同步'],
  go: ['go', 'enter', 'leave', 'walk', 'move', '前往', '進入', '離開', '去', '走', '进入', '离开'],
  talk: ['talk', 'speak', 'ask', 'say', 'tell', 'reply', 'answer', '告訴', '告诉', '交談', '說話', '對話', '問', '跟', '回覆', '接聽', '接', '交谈', '说话', '对话', '问', '回复', '接听'],
  take: ['take', 'accept', 'grab', 'pick up', 'bolt', 'bar', 'cover', 'use', '拿', '收下', '接受', '拿走', '收', '接过', '閂上', '蓋上', '用', '闩上', '盖上'],
  switch: ['switch', 'switch to', 'play as', 'control', '切換', '換成', '操作', '切换', '换成'],
  jump: ['jump', 'leap', 'dive', '跳', '跳下', '跳下去', '躍'],
  choose: ['choose', 'decide', 'pick', 'select', '選擇', '決定', '選', '选择', '决定', '选'],
  attack: ['attack', 'hit', 'punch', 'fight', 'kill', '攻擊', '打', '揍', '殺', '攻击', '杀'],
  wait: ['wait', 'z', 'rest', '等待', '等', '休息'],
  items: ['items', 'inventory', 'inv', 'i', '物品', '線索', '线索'],
  help: ['help', '?', '說明', '幫助', '说明', '帮助'],
  lang: ['lang', 'language', '語言', '语言'],
  restart: ['restart', '重新開始', '重新开始'],
};

// 可以切換操作的角色。Echo 永遠在隊伍裡。
ECHO.partyAliases = {
  echo: ['echo', '本系統', '本系统', '自己'],
  homan: ['homan', 'ho-man', 'chan', '浩文', '陳浩文', '陈浩文'],
  eileen: ['eileen', 'walsh', '艾琳', '沃什'],
  maya: ['maya', 'okafor', '瑪雅', '玛雅'],
};

ECHO.langAliases = {
  'zh-Hant': ['zh-hant', 'zh-tw', 'zh-hk', '繁中', '繁體', '繁体', '繁體中文', '繁体中文', 'tc'],
  'zh-Hans': ['zh-hans', 'zh-cn', '简中', '簡中', '简体', '簡體', '简体中文', '簡體中文', 'sc'],
  en: ['en', 'english', '英文', '英語', '英语'],
};

ECHO.defaultHelp = [
  { c: 'sys', k: 'help.1' },
  { c: 'narr', k: 'help.2' },
  { c: 'narr', k: 'help.3' },
  { c: 'narr', k: 'help.4' },
  { c: 'narr', k: 'help.5' },
  { c: 'narr', k: 'help.6' },
  { c: 'narr', k: 'help.go' },
  { c: 'narr', k: 'help.talk' },
  { c: 'narr', k: 'help.wait' },
  { c: 'narr', k: 'help.take' },
  { c: 'narr', k: 'help.switch' },
  { c: 'narr', k: 'help.7' },
  { c: 'dim', k: 'help.8' },
];
