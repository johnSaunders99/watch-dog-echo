// 存檔：存在瀏覽器 localStorage。私密視窗或被封鎖時會靜默失敗，遊戲照常進行。
(function (E) {
  // 存檔格式改變時換 key，舊存檔就不會被讀進新版本。
  const KEY = 'watchdogs-echo.save.v2';

  E.save = {
    write(data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 無法存檔時忽略 */ }
    },
    read() {
      try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
    },
  };
})(window.ECHO = window.ECHO || {});
