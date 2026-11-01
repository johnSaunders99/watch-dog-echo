# 看門狗：殘響 WATCH_DOGS: ECHO

**非官方同人文字冒險，《看門狗：自由軍團》外傳。英文、繁中、簡中三語。**
An unofficial fan-made text adventure set after *Watch Dogs: Legion*. Playable in English, Traditional Chinese and Simplified Chinese.

> 本作為非官方同人創作，與 Ubisoft 無關。《看門狗》相關名稱與角色的權利屬於 Ubisoft。
> This is an unofficial fan work. It is not affiliated with or endorsed by Ubisoft. *Watch Dogs* and related names and characters are trademarks of Ubisoft.

---

## 故事 Story

你是 ECHO，一個能「從資料重建任何人過去」的 AI，剛從實驗室逃出來，困在倫敦的 ctOS 網路裡。把你救出來的 DedSec 駭客失蹤了，而你即將被賣給一家軍事承包商，成為「目標引擎」。你必須潛入三個陌生人的記憶，找到她，並決定這項技術，以及你自己的去向。

You are ECHO, an AI built to reconstruct anyone's past from their data. The DedSec hacker who broke you out has vanished, and you were about to be sold to a military contractor as a targeting engine. Dive into three strangers' memories, find her, and decide what becomes of the technology — and of yourself.

## 怎麼玩 How to play

用瀏覽器打開 `index.html` 就能玩，不需要安裝。Open `index.html` in any modern browser. No install, no build step.

- 可以打字輸入指令，也可以點建議按鈕。Type commands or tap the suggestions.
- 三種語言的指令都能用，例如 `hack laptop`、`駭入筆電`、`入侵旧笔记本`。Commands work in all three languages.
- 右上角可以隨時切換語言。Switch language any time, top right.
- 進度自動儲存在瀏覽器裡。Progress saves automatically in your browser.
- 遊玩時間約 40–60 分鐘，共 4 個結局。About 40–60 minutes, 4 endings.

## 特色 Features

- **同步率 Sync**：在記憶中，要照當事人的個性行動。違背他，記憶就會崩塌。每段記憶的規則都不同。Act as the person whose memory you are in; break character and the memory collapses.
- **出血效應 Bleed**：讀越多人類記憶，ECHO 越像人。它會從「本系統」改口成「我」。The more memories ECHO reads, the more human it becomes.
- **群像劇與角色切換 Ensemble**：招募的同伴可以做 ECHO 做不到的事。Recruit allies and switch to them to act where an AI can't.
- **話題式對話 Topic-based dialogue**：`ask Ho-man about the money`。前面章節的線索會解鎖新話題。Clues from earlier chapters unlock new topics.
- **全程式繪製的畫面 Fully procedural visuals**：13 張場景插畫、Profiler 人物卡、全螢幕演出、合成音效，不使用任何外部素材。13 illustrated scenes, cinematic moments and synthesized sound — no external assets.
- **客串 Cameos**：原作的熟面孔（不劇透）。A few familiar faces.

## 章節 Chapters

| 章節 Chapter | 地點 Location |
| --- | --- |
| 序章 Prologue | 康登區地下室 Camden basement |
| 記憶一 Memory 1 | 狗島・靜域大樓 Isle of Dogs, Stillwater HQ |
| 第一章 Chapter 1 | 唐人街 Chinatown |
| 第二章・記憶二 Chapter 2 · Memory 2 | 滑鐵盧、維多利亞堤岸 Waterloo, Victoria Embankment |
| 第三章 Chapter 3 | 康登區、羅瑟希德 Camden, Rotherhithe |
| 第四章・記憶三 Chapter 4 · Memory 3 | 布魯內爾豎井 The Brunel shaft |
| 終章 Finale | 地下交換機房 The underground exchange |

<details>
<summary>結局與客串（有雷）Endings and cameos (spoilers)</summary>

- **留下 Stay**（真結局 true ending）：出血指數 55 以上 Bleed 55+
- **封存 Seal**、**燎原 Wildfire**：隨時可選 always available
- **回收 Recaptured**：終章曝光度 60 Exposure 60 in the finale
- **Bagley**：第三章 Chapter 3
- **Darcy**：在記憶二發現老鷹符號 Find the eagle symbol in Memory 2
- **Wrench**：在唐人街掃描人群兩次 Scan the Chinatown crowd twice

</details>

## 錄影與測試 Recording

網址後面加 `?jump=` 可以直接跳到某一章，例如 `index.html?jump=finale`。Append `?jump=` to start from a chapter, e.g. `index.html?jump=finale`.
可用 Available: `memory1` `chinatown` `memory2` `chapter3` `memory3` `finale` `choice`

## 專案結構 Project structure

```text
index.html             頁面骨架與載入順序 page shell and load order
css/terminal.css       版面與演出 layout and effects
js/engine/             引擎，不含任何台詞 engine (no story text)
js/ui/                 文字輸出、插畫、演出與音效 output, art, effects, sound
js/main.js             標題畫面、輸入、存檔 title screen, input, saving
content/commands.js    三語指令別名 command aliases
content/scenes/        每個章節一個檔案 one file per chapter
content/locales/       三語文本 story text in three languages
content/dev-routes.js  章節跳轉路線 chapter-jump routes
```

內容檔用 `.js` 而不是 `.json`，因為瀏覽器不允許從本機檔案讀取 JSON，這樣才能直接雙擊 `index.html` 遊玩。
Content files are `.js` rather than `.json` so the game runs straight from the file system.

**新增內容 Adding content**：在 `content/scenes/` 新增場景（台詞只寫 key），在三份語言檔加上同一組 key，再到 `index.html` 加一行 `<script>`。Add a scene file with text keys only, add the keys to all three locales, and include the script in `index.html`.

## 授權 License

本作品全部內容（程式碼、文本、插畫）以 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 授權：可以自由分享與改編，但必須註明出處、**禁止任何商業用途**，改編作品也必須用相同授權。詳見 [LICENSE](LICENSE)。

Everything in this repository (code, text, illustrations) is licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/): share and adapt freely with credit, **no commercial use of any kind**, and adaptations must use the same license. See [LICENSE](LICENSE).

《看門狗》相關的名稱、角色與設定屬於 Ubisoft，不在授權範圍內。Ubisoft's names, characters and settings are not covered by this license.

## 製作 Credits

由 [Claude](https://claude.ai)（Anthropic）與作者協作製作：程式、三語文本、插畫、音效與測試由 Claude 撰寫，方向、品味判斷與審閱由作者負責。
Made in collaboration with Claude (Anthropic): Claude wrote the code, the text in all three languages, the art, the sound and the tests; the author set the direction, judged the taste and reviewed the work.
