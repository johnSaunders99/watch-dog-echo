# 參與製作 Contributing

謝謝你願意幫忙！這是一個免費的非官方同人作品，所有貢獻都以 [CC BY-NC-SA 4.0](LICENSE) 授權，**不得用於任何商業用途**。
Thanks for helping! This is a free, unofficial fan work. Every contribution is licensed under [CC BY-NC-SA 4.0](LICENSE), **no commercial use of any kind**.

## 可以幫忙的範圍 What we accept

| 歡迎 Welcome | 說明 Notes |
| --- | --- |
| 翻譯修正 Translation fixes | 任何一種語言讀起來不自然、錯字、用詞不符合當地習慣。Anything that reads unnaturally, typos, regional wording. |
| 名字表 Name tables | 為現有族裔加名字，或新增倫敦常見的族裔。More names, or another heritage common in London. |
| 路人秘密 Passer-by secrets | Profiler 掃描路人時顯示的一句話。The one-line note the Profiler shows for a passer-by. |
| 錯誤回報 Bug reports | 卡關、文字沒翻譯、畫面跑版。開 Issue 時請附上語言、瀏覽器和你輸入的最後幾個指令。Stuck, untranslated text, broken layout. Include your language, browser and the last few commands. |

**主線劇情、角色和結局由作者負責**，不接受劇情改寫或新章節的 Pull Request。想法很歡迎，請開 Issue 討論。
**The main story, characters and endings are written by the maintainers.** We don't accept pull requests that change the plot or add chapters, but ideas are welcome as Issues.

## 加資料的方法 Adding data

第二季的路人資料都在 [`content-s2/people.js`](content-s2/people.js)。每一筆都是同一句話的三種語言：
All Season 2 passer-by data lives in [`content-s2/people.js`](content-s2/people.js). Each entry is the same line in three languages:

```js
n('English', '繁體中文', '简体中文')
// 繁簡寫法完全一樣時可以省略第三個 If Simplified is identical, the third can be left out
n('Khan', '汗')
```

### 寫作規則 Writing rules

1. **三種語言都要寫。** 不會某種語言也沒關係，在 PR 裡說明，我們會補上。**All three languages.** If you can't write one, say so in the PR and we'll fill it in.
2. **每種語言分開寫成自然的整句**，不要逐字翻譯。繁中用台灣常見用語（攝影機、駭入、程式），簡中用大陸常見用語（摄像头、入侵、程序）。**Write each language as a natural sentence**, not a word-for-word translation.
3. **不用代名詞。** 句子裡不寫「他／她」或 he/she，需要名字時用 `{name}`。路人是隨機生成的，我們不替他們決定性別。**No pronouns.** Use `{name}` where you need a name. Passers-by are random, so we don't assign genders.
4. **秘密要短、具體、有一點人味。** 一句話，最多兩句。可以好笑、可以心酸，但不要血腥、色情、仇恨或針對真實人物。**Secrets should be short, specific and human.** One or two sentences. Funny or sad is fine; no gore, sexual content, hate or real people.
5. **名字照當地真實的拼法**，中文用常見音譯。華人名字在三種語言裡都是姓在前。**Use real spellings**, with common Chinese transliterations. Chinese names are family-first in every language.
6. **公司、機構要虛構。** 可以用遊戲裡已有的虛構公司（例如獅心防務 Lionheart Defence）。**Companies must be fictional.**

## 送出前 Before you submit

只需要 [Node.js](https://nodejs.org/)，不用安裝任何套件：
You only need [Node.js](https://nodejs.org/), no packages:

```bash
node tools/check.js
```

最後一行要是 `All checks passed`。它會檢查每一筆資料三語是否齊全、生成的路人文字有沒有漏掉變數，也會把第一季四個結局打一遍。
The last line should read `All checks passed`. It checks every entry has all three languages, that generated passers-by render cleanly, and plays through all four Season 1 endings.

想親眼看看生成的路人長什麼樣子：
To read some generated passers-by yourself:

```bash
node tools/check.js --samples 3
```

## 素材 Assets

不要提交任何從《看門狗》遊戲擷取的圖片、音效、模型或文字，也不要提交圖片或音檔。本作的畫面和音效全部用程式繪製。
Don't submit anything ripped from the *Watch Dogs* games (images, audio, models, text), or any image or audio files. All visuals and sound in this project are drawn by code.
