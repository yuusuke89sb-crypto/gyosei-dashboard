/**
 * スプレッドシート同期モジュール
 * Google Apps Script の Web API 経由でスプレッドシートとデータを同期
 */
const SpreadsheetSync = {
    CONFIG_KEY: 'gyosei_sync_config',

    // ---- 設定管理 ----
    getConfig() {
        try {
            return JSON.parse(localStorage.getItem(this.CONFIG_KEY)) || {};
        } catch {
            return {};
        }
    },

    saveConfig(config) {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    },

    getGasUrl() {
        return this.getConfig().gasUrl || '';
    },

    isConfigured() {
        return !!this.getGasUrl();
    },

    // ---- データ取得（Pull）----
    async pull() {
        const url = this.getGasUrl();
        if (!url) throw new Error('GAS URL が設定されていません');

        try {
            const response = await fetch(url + '?type=all');
            if (!response.ok) throw new Error('通信エラー: ' + response.status);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // 顧客データを localStorage に保存
            if (data.customers) {
                Store._set(Store.KEYS.CLIENTS, data.customers);
            }

            // 担当者データを localStorage に保存
            if (data.staff) {
                Store._set(Store.KEYS.STAFF, data.staff);
            }

            // 同期日時を記録
            this.saveConfig({
                ...this.getConfig(),
                lastSync: new Date().toISOString(),
            });

            return {
                customers: (data.customers || []).length,
                staff: (data.staff || []).length,
                syncedAt: data.syncedAt,
            };

        } catch (err) {
            console.error('同期エラー:', err);
            throw err;
        }
    },

    // ---- データ送信（Push）----
    async push(action, data) {
        const url = this.getGasUrl();
        if (!url) return null;  // 未設定なら何もしない

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },  // GAS の CORS 制限回避
                body: JSON.stringify({ action, data }),
            });

            const result = await response.json();
            if (result.error) {
                console.warn('Push エラー:', result.error);
            }
            return result;

        } catch (err) {
            console.warn('Push 通信エラー:', err);
            return null;  // Push 失敗は致命的ではないので null を返す
        }
    },

    // ---- 接続テスト ----
    async testConnection(url) {
        try {
            const response = await fetch(url + '?type=all');
            if (!response.ok) throw new Error('HTTP ' + response.status);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            return {
                success: true,
                customers: (data.customers || []).length,
                staff: (data.staff || []).length,
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    // ---- 設定モーダル ----
    showSettingsModal() {
        const config = this.getConfig();
        const existing = document.getElementById('syncSettingsModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'syncSettingsModal';
        modal.style.display = 'flex';
        modal.innerHTML = `
      <div class="modal-overlay" onclick="document.getElementById('syncSettingsModal').remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🔄 スプレッドシート連携設定</h2>
          <button class="modal-close" onclick="document.getElementById('syncSettingsModal').remove()">✕</button>
        </div>
        <div class="sync-settings-body">
          <div class="form-group">
            <label>GAS Web App URL <span class="required">*</span></label>
            <input type="url" id="syncGasUrl" class="search-input" 
              placeholder="https://script.google.com/macros/s/xxx/exec"
              value="${config.gasUrl || ''}"
              style="width:100%;margin-top:4px">
            <p class="form-hint">Apps Script のデプロイ URL を入力してください</p>
          </div>

          <div class="form-actions" style="gap:8px">
            <button class="btn btn-secondary" onclick="SpreadsheetSync.onTestConnection()" id="syncTestBtn">
              🔍 接続テスト
            </button>
            <button class="btn btn-primary" onclick="SpreadsheetSync.onSaveSettings()">
              💾 保存
            </button>
          </div>

          <div id="syncTestResult" style="margin-top:12px;display:none"></div>

          ${config.lastSync ? `
            <div class="sync-status-info">
              <span class="detail-icon">⏱️</span>
              最終同期: ${new Date(config.lastSync).toLocaleString('ja-JP')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
        document.body.appendChild(modal);
    },

    async onTestConnection() {
        const url = document.getElementById('syncGasUrl').value.trim();
        if (!url) {
            App.showToast('URL を入力してください');
            return;
        }

        const btn = document.getElementById('syncTestBtn');
        btn.disabled = true;
        btn.textContent = '⏳ テスト中...';

        const resultDiv = document.getElementById('syncTestResult');
        resultDiv.style.display = 'block';

        const result = await this.testConnection(url);

        if (result.success) {
            resultDiv.innerHTML = `
        <div class="sync-result success">
          ✅ 接続成功！<br>
          顧客: ${result.customers}件 / 担当者: ${result.staff}件
        </div>
      `;
        } else {
            resultDiv.innerHTML = `
        <div class="sync-result error">
          ❌ 接続失敗: ${result.error}
        </div>
      `;
        }

        btn.disabled = false;
        btn.textContent = '🔍 接続テスト';
    },

    onSaveSettings() {
        const url = document.getElementById('syncGasUrl').value.trim();
        this.saveConfig({
            ...this.getConfig(),
            gasUrl: url,
        });
        document.getElementById('syncSettingsModal').remove();
        App.showToast(url ? '連携設定を保存しました' : '連携設定をクリアしました');
    },

    // ---- ワンクリック同期 ----
    async syncNow() {
        if (!this.isConfigured()) {
            this.showSettingsModal();
            return;
        }

        App.showToast('🔄 同期中...');

        try {
            const result = await this.pull();
            App.refreshView();
            App.showToast(`✅ 同期完了！ 顧客${result.customers}件 / 担当者${result.staff}件`);
        } catch (err) {
            App.showToast('❌ 同期エラー: ' + err.message);
        }
    },

    // ---- 請求書PDF → Drive保存 ----
    async pushInvoice(html, invoiceNo, clientName, docType) {
        const url = this.getGasUrl();
        if (!url) return null;  // 未設定なら何もしない

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: 'saveInvoicePdf',
                    data: { html, invoiceNo, clientName, docType: docType || '請求書' },
                }),
            });

            const result = await response.json();
            if (result.error) {
                console.warn('Drive保存エラー:', result.error);
                return null;
            }
            return result;

        } catch (err) {
            console.warn('Drive保存通信エラー:', err);
            return null;
        }
    },

    // ---- Googleカレンダー同期 ----
    async pushCalendarEvent(action, data) {
        const url = this.getGasUrl();
        if (!url) return null;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ action, data }),
            });

            const result = await response.json();
            if (result.error) {
                console.warn('カレンダー同期エラー:', result.error);
            }
            return result;

        } catch (err) {
            console.warn('カレンダー同期通信エラー:', err);
            return null;
        }
    },

    async pullCalendarEvents() {
        const url = this.getGasUrl();
        if (!url) throw new Error('GAS URL が設定されていません');

        try {
            const response = await fetch(url + '?type=events&daysBack=7&daysForward=90');
            if (!response.ok) throw new Error('通信エラー: ' + response.status);

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            return data.events || [];

        } catch (err) {
            console.error('カレンダー取得エラー:', err);
            throw err;
        }
    },
};
