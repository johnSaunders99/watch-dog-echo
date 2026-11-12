// 第三季《零時差》的劇情結構：有哪些劇情段落、每一段誰說哪幾句、無線電裡的短句、安全屋的閒聊、四個結局。
// 這裡只有結構和 key，文字在 content-s3/story-locales.js。播放由 js/s3/main.js 負責。
//
// 時間點：第二季白廳那一夜之後三個星期。獅心防務要把地下資料堡壘「基石」整座賣給 Broca Tech，
// 交割日叫「零日」。基石裡有四萬一千份重建檔、一個照 Echo 的樣板做的預測模型，還有宵禁期間照名單帶走的人。
//
// 一句台詞：{ who 誰說的（空字串是旁白）, k 文字的 key }。可以依前兩季的結局換一句：
//   v1：{ 第一季的結局: key }（stay、seal、wildfire、recaptured）
//   s2：{ 第二季的結局: key }（dawn、cage、wild、deal、curfew、wiped）
//   ally：{ 第二季的盟友: key }（hale、cassie、kahn）
(function (E) {
  const S3 = (E.s3 = E.s3 || {});
  const say = (who, k, o) => Object.assign({ who, k }, o);
  const B = 'bagley', EC = 'echo', M = 'maya', H = 'harlow', K = 'keystone';

  // 說話的人：頭像用 js/ui/art.js 的哪一張；有畫好的頭像（S3.pictures 的 pt-<id>）就用那一張。
  const speakers = {
    bagley: { art: 'bagley' }, echo: { art: 'echo' }, maya: { art: 'maya' }, harlow: { art: 'guard' },
    keystone: { art: 'device' }, hastings: { art: 'agent' }, kahn: { art: 'agent' }, hale: { art: 'hale' }, cassie: { art: 'cassie' },
  };

  // ===== 劇情段落：每一段只播一次（記在永久進度的 story 裡）=====
  const beats = {
    // 第一次開始：這一季在做什麼。
    intro: [
      say('', 's3.st.intro.1', { s2: { deal: 's3.st.intro.1.deal', curfew: 's3.st.intro.1.curfew', wiped: 's3.st.intro.1.curfew' } }),
      say(B, 's3.st.intro.2'),
      say(B, 's3.st.intro.3'),
      say(M, 's3.st.intro.4'),
      say(M, 's3.st.intro.5'),
      say(EC, 's3.st.intro.6', { v1: { recaptured: 's3.st.intro.6.recaptured', seal: 's3.st.intro.6.seal', wildfire: 's3.st.intro.6.wildfire' } }),
      say(EC, 's3.st.intro.7'),
      say(M, 's3.st.intro.8'),
      say(B, 's3.st.intro.9'),
    ],
    // 第一次全隊被捕。
    first_fall: [
      say(B, 's3.st.fall.1'),
      say(EC, 's3.st.fall.2'),
      say(M, 's3.st.fall.3'),
      say(M, 's3.st.fall.4'),
      say(EC, 's3.st.fall.5'),
    ],
    // 第一次從拘留室救出人。
    cells: [
      say('', 's3.st.cells.1'),
      say(M, 's3.st.cells.2'),
      say(EC, 's3.st.cells.3'),
      say(B, 's3.st.cells.4'),
    ],
    // 第一次遇到哈洛隊長。
    bulldog_meet: [
      say(H, 's3.st.bulldog.1'),
      say(H, 's3.st.bulldog.2'),
      say(M, 's3.st.bulldog.3'),
    ],
    // 第一次打倒哈洛隊長：零日和買家。
    bulldog_down: [
      say('', 's3.st.bulldog.d1'),
      say(H, 's3.st.bulldog.d2'),
      say(H, 's3.st.bulldog.d3'),
      say(B, 's3.st.bulldog.d4', { ally: { kahn: 's3.st.bulldog.d4.kahn' } }),
      say(M, 's3.st.bulldog.d5'),
    ],
    // 第一次進管制樓層：買家來電。
    offices: [
      say('kahn', 's3.st.kahn.1'),
      say('kahn', 's3.st.kahn.2'),
      say('kahn', 's3.st.kahn.3'),
      say(M, 's3.st.kahn.4'),
      say(B, 's3.st.kahn.5'),
    ],
    // 第一次遇到母機：基石開口說話。
    carrier_meet: [
      say(K, 's3.st.carrier.1'),
      say(EC, 's3.st.carrier.2'),
      say(M, 's3.st.carrier.3'),
    ],
    // 第一次打下母機：Echo 說出基石是什麼。
    carrier_down: [
      say('', 's3.st.carrier.d1'),
      say(K, 's3.st.carrier.d2'),
      say(EC, 's3.st.carrier.d3'),
      say(EC, 's3.st.carrier.d4', { v1: { stay: 's3.st.carrier.d4.stay' } }),
      say(M, 's3.st.carrier.d5'),
    ],
    // 第一次進基石機房：黑斯廷斯。
    vault: [
      say('hastings', 's3.st.hastings.1'),
      say('hastings', 's3.st.hastings.2'),
      say(B, 's3.st.hastings.3'),
    ],
    // 第一次站到核心前面。
    core_meet: [
      say(K, 's3.st.core.1'),
      say(K, 's3.st.core.2'),
      say(EC, 's3.st.core.3'),
      say(K, 's3.st.core.4'),
      say(M, 's3.st.core.5'),
    ],
    // 核心停下來之後：要怎麼處理基石裡的東西。
    choice: [
      say('', 's3.st.choice.1'),
      say(B, 's3.st.choice.2'),
    ],
  };
  // 首領：第一次見面和第一次打倒各播哪一段；之後再遇到，隨機講一句。
  const bossBeats = {
    bulldog: { meet: 'bulldog_meet', down: 'bulldog_down', again: ['s3.st.bulldog.a1', 's3.st.bulldog.a2', 's3.st.bulldog.a3'], who: H },
    carrier: { meet: 'carrier_meet', down: 'carrier_down', again: ['s3.st.carrier.a1', 's3.st.carrier.a2'], who: K },
    keystone: { meet: 'core_meet', down: null, again: ['s3.st.core.a1', 's3.st.core.a2'], who: K },
  };
  // 第一次走進某個區段的第一間，先播哪一段。
  const sectorBeats = { offices: 'offices', vault: 'vault' };

  // ===== 結局：打倒核心之後四選一 =====
  // need：要先從拘留室救出幾個人才選得到（Echo 要看過基石算不到的事，才有把握）。
  const endings = [
    { id: 'return', lines: [say('', 's3.end.return.1'), say('', 's3.end.return.2'), say(EC, 's3.end.return.3'), say(B, 's3.end.return.4')] },
    { id: 'burn', lines: [say('', 's3.end.burn.1'), say('', 's3.end.burn.2'), say(M, 's3.end.burn.3'), say(B, 's3.end.burn.4')] },
    { id: 'open', lines: [say('', 's3.end.open.1'), say('', 's3.end.open.2'), say(EC, 's3.end.open.3')] },
    { id: 'teach', need: 3, lines: [say(EC, 's3.end.teach.1'), say('', 's3.end.teach.2'), say(K, 's3.end.teach.3'), say('', 's3.end.teach.4'), say(B, 's3.end.teach.5'), say(M, 's3.end.teach.6')] },
  ];

  // ===== 無線電：打的時候偶爾插進來的一句，不會暫停遊戲 =====
  const comms = {
    alarm: { who: B, k: ['s3.cm.alarm.1', 's3.cm.alarm.2', 's3.cm.alarm.3'] },
    silent: { who: B, k: ['s3.cm.silent.1', 's3.cm.silent.2'] },
    down: { who: M, k: ['s3.cm.down.1', 's3.cm.down.2'] },
    last: { who: M, k: ['s3.cm.last.1'] },
    low: { who: M, k: ['s3.cm.low.1'] },
    hijack: { who: B, k: ['s3.cm.hijack.1', 's3.cm.hijack.2'] },
    phase: { who: B, k: ['s3.cm.phase.1'] },
    rescue: { who: M, k: ['s3.cm.rescue.1'] },
    getaway: { who: B, k: ['s3.cm.getaway.1'] },
    // 基石對場上那個人的預測（母機和核心那兩場）。flaw 版本只有這個人有弱點時才會講。
    predict: { who: K, k: ['s3.cm.predict.1', 's3.cm.predict.2', 's3.cm.predict.3'] },
    predictFlaw: { who: K, k: ['s3.cm.predict.flaw'] },
  };
  // 安全屋裡有人講一句話。held：有人被關的時候講的；won：打通過之後講的；vets：宵禁那時候的隊伍剛跟過來的時候講的。
  const hub = {
    any: [say(B, 's3.hub.1'), say(EC, 's3.hub.2'), say(M, 's3.hub.3'), say(B, 's3.hub.4'), say(EC, 's3.hub.5'), say(M, 's3.hub.6')],
    held: [say(M, 's3.hub.held.1'), say(B, 's3.hub.held.2')],
    won: [say(B, 's3.hub.won.1'), say(EC, 's3.hub.won.2')],
    vets: [say(M, 's3.hub.vets.1')],
  };

  S3.story = { speakers, beats, bossBeats, sectorBeats, endings, comms, hub };
})(window.ECHO = window.ECHO || {});
