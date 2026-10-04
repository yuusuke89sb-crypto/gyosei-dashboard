/**
 * 全端末共通の設定（2026-10 追加）
 * - 目標値（ホームの年間目標）・事務所情報（請求書の振込先など）をスプレッドシート「共有設定」に保存し、全端末で同じにする
 * - 同期（取得）のたびにシートの値で端末の値を上書きする。保存時はシートへ送る
 */
const SharedSettings = {
  MAP: { goals: 'gyosei_goals', officeInfo: 'gyosei_office_info' },

  /** シートの値を端末へ反映（sync.js の pull から呼ぶ） */
  applyRemote(settings) {
    if (!settings || typeof settings !== 'object') return;
    Object.keys(this.MAP).forEach(key => {
      const s = settings[key];
      if (!s || s.value === null || s.value === undefined) return;
      const json = JSON.stringify(s.value);
      if (localStorage.getItem(this.MAP[key]) !== json) localStorage.setItem(this.MAP[key], json);
    });
  },

  /** 端末で保存 → シートへ送信。失敗したら知らせる */
  async save(key, value) {
    localStorage.setItem(this.MAP[key], JSON.stringify(value));
    if (typeof SpreadsheetSync === 'undefined' || !SpreadsheetSync.isConfigured()) return;
    const device = (typeof InvoiceSync !== 'undefined' && InvoiceSync.getDeviceName()) || '';
    const r = await SpreadsheetSync.push('saveSetting', { key, value, device });
    if (!r || r.error) {
      const msg = '設定を全端末に共有できませんでした（この端末だけに保存されています）。通信を確認してもう一度保存してください。';
      if (typeof App !== 'undefined' && App.showToast) App.showToast('⚠️ ' + msg); else alert(msg);
    }
  },
};

// 既存の保存処理を共有方式に切替え
(function patchSharedSettings() {
  if (typeof GoalTracker !== 'undefined') {
    GoalTracker.saveGoals = function (goals) { SharedSettings.save('goals', goals); };
  }
  if (typeof Invoice !== 'undefined' && typeof Invoice.saveOfficeInfo === 'function') {
    Invoice.saveOfficeInfo = function (info) { SharedSettings.save('officeInfo', info); };
  }
})();
