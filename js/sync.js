/**
 * スプレッドシート同期モジュール
 * Google Apps Script の Web API 経由でスプレッドシートとデータを同期
 */
const SpreadsheetSync = {
    CONFIG_KEY: 'gyosei_sync_settings',

    // デフォルトGAS URL（全デバイスで自動接続）
    DEFAULT_GAS_URL: 'https://script.google.com/macros/s/AKfycbzdDtMhSmy5tqSWNtNnbnCQ-68PY7emgDhdR_abTCuvxv--WgCjIMO0qTgysE2864MA/exec',

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
        return this.getConfig().gasUrl || this.DEFAULT_GAS_URL;
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

            // 案件データを localStorage に保存
            if (data.cases) {
                // ローカルの案件データから docs 等の失われたくないデータをマージ
                const localCases = Store.getCases();
                
                const mergedCases = data.cases.map(remoteCase => {
                    const localCase = localCases.find(c => c.id === remoteCase.id);
                    
                    // docs のパース（GASから文字列で返ってきた場合）
                    let parsedDocs = remoteCase.docs;
                    if (typeof parsedDocs === 'string') {
                        try { parsedDocs = JSON.parse(parsedDocs); } catch(e) { parsedDocs = null; }
                    }
                    // リモートに docs が無い、または空の場合はローカルを優先
                    if ((!parsedDocs || parsedDocs.length === 0) && localCase && localCase.docs) {
                        parsedDocs = localCase.docs;
                    }

                    // advances のパース
                    let parsedAdvances = remoteCase.advances;
                    if (typeof parsedAdvances === 'string') {
                        try { parsedAdvances = JSON.parse(parsedAdvances); } catch(e) { parsedAdvances = null; }
                    }
                    if ((!parsedAdvances || parsedAdvances.length === 0) && localCase && localCase.advances) {
                        parsedAdvances = localCase.advances;
                    }

                    // familyTreeData のパース
                    let parsedFamilyTree = remoteCase.familyTreeData;
                    if (typeof parsedFamilyTree === 'string') {
                        try { parsedFamilyTree = JSON.parse(parsedFamilyTree); } catch(e) { parsedFamilyTree = null; }
                    }
                    if (!parsedFamilyTree && localCase && localCase.familyTreeData) {
                        parsedFamilyTree = localCase.familyTreeData;
                    }

                    return {
                        ...remoteCase,
                        orderNo: remoteCase.orderNo || remoteCase['注文書№'] || remoteCase['注文書No'] || remoteCase['注文書NO'] || remoteCase['注文番号'] || remoteCase['注文No'] || (localCase && localCase.orderNo) || '',
                        docs: Array.isArray(parsedDocs) ? parsedDocs : [],
                        advances: Array.isArray(parsedAdvances) ? parsedAdvances : [],
                        clientContactId: remoteCase.clientContactId || (localCase && localCase.clientContactId) || '',
                        locationId: remoteCase.locationId || (localCase && localCase.locationId) || '',
                        faxId: remoteCase.faxId || (localCase && localCase.faxId) || '',
                        inboxId: remoteCase.inboxId || (localCase && localCase.inboxId) || '',
                        driveFolderUrl: remoteCase.driveFolderUrl || (localCase && localCase.driveFolderUrl) || '',
                        carName: remoteCase.carName || (localCase && localCase.carName) || '',
                        carAddress: remoteCase.carAddress || (localCase && localCase.carAddress) || '',
                        parkingAddress: remoteCase.parkingAddress || (localCase && localCase.parkingAddress) || '',
                        carPolice: remoteCase.carPolice || (localCase && localCase.carPolice) || '',
                        carNumber: remoteCase.carNumber || remoteCase['自動車登録番号'] || remoteCase['登録番号'] || (localCase && localCase.carNumber) || '',
                        oldCarNumber: remoteCase.oldCarNumber || remoteCase['旧自動車登録番号'] || remoteCase['旧ナンバー'] || (localCase && localCase.oldCarNumber) || '',
                        vin: remoteCase.vin || remoteCase['車台番号'] || remoteCase['VIN'] || (localCase && localCase.vin) || '',
                        regType: remoteCase.regType || (localCase && localCase.regType) || '',
                        subCategory: remoteCase.subCategory || remoteCase['登録種別'] || (localCase && localCase.subCategory) || '',
                        invoiceNo: remoteCase.invoiceNo || (localCase && localCase.invoiceNo) || '',
                        deathDate: remoteCase.deathDate || (localCase && localCase.deathDate) || '',
                        surveyDate: remoteCase.surveyDate || (localCase && localCase.surveyDate) || '',
                        applyDate: remoteCase.applyDate || (localCase && localCase.applyDate) || '',
                        policeDeliveryDate: remoteCase.policeDeliveryDate || (localCase && localCase.policeDeliveryDate) || '',
                        storeDeliveryDate: remoteCase.storeDeliveryDate || (localCase && localCase.storeDeliveryDate) || '',
                        storeDeliveryTime: remoteCase.storeDeliveryTime || (localCase && localCase.storeDeliveryTime) || '',
                        surveyLocationId: remoteCase.surveyLocationId || (localCase && localCase.surveyLocationId) || '',
                        policeLocationId: remoteCase.policeLocationId || (localCase && localCase.policeLocationId) || '',
                        landTransportLocationId: remoteCase.landTransportLocationId || (localCase && localCase.landTransportLocationId) || '',
                        registrationDate: remoteCase.registrationDate || (localCase && localCase.registrationDate) || '',
                        milestoneIndex: remoteCase.milestoneIndex !== undefined && remoteCase.milestoneIndex !== ''
                            ? Number(remoteCase.milestoneIndex)
                            : (localCase && localCase.milestoneIndex) !== undefined && (localCase && localCase.milestoneIndex) !== ''
                                ? Number(localCase.milestoneIndex)
                                : 0,
                        familyTreeData: parsedFamilyTree || null,
                    };
                });
                
                Store._set(Store.KEYS.CASES, mergedCases);
            }

            // インボックスデータを localStorage に保存（ローカルのステータス変更を優先保持）
            if (data.inbox && Array.isArray(data.inbox)) {
                const localInbox = Store.getInbox ? Store.getInbox() : [];
                const mergedInbox = data.inbox.map(remoteItem => {
                    const localItem = localInbox.find(l => String(l.id) === String(remoteItem.id));
                    return {
                        ...remoteItem,
                        // ローカルで保留・除外・対応済に変更されていればローカルのステータスを優先
                        status: (localItem && localItem.status && localItem.status !== '未対応')
                            ? localItem.status
                            : (remoteItem.status || '未対応'),
                        caseId: (localItem && localItem.caseId) || remoteItem.caseId || ''
                    };
                });
                // ローカルにしか存在しないアイテムも保持
                localInbox.forEach(l => {
                    if (!mergedInbox.some(m => String(m.id) === String(l.id))) {
                        mergedInbox.push(l);
                    }
                });
                Store._set(Store.KEYS.INBOX, mergedInbox);
            }

            // 場所マスタデータを localStorage に保存
            if (data.locations) {
                Store._set(Store.KEYS.LOCATIONS, data.locations);
            }

            // 顧客担当者データをマージ（ローカル既存データを保持 + ローカルのみのデータをSSへPush）
            {
                var localContacts = JSON.parse(localStorage.getItem('gyosei_client_contacts') || '[]');
                var remoteContacts = data.clientContacts || [];
                var remoteContactIds = {};
                remoteContacts.forEach(function(c){ remoteContactIds[c.id] = true; });
                var localOnlyContacts = localContacts.filter(function(c){ return !remoteContactIds[c.id]; });

                // ローカルのみの担当者をスプレッドシートへ自動Push
                if (localOnlyContacts.length > 0) {
                    console.log('📤 ローカル専用の顧客担当者を同期:', localOnlyContacts.length, '件');
                    localOnlyContacts.forEach(function(c) {
                        SpreadsheetSync.push('upsertClientContact', c).catch(function(e) {
                            console.warn('顧客担当者Push失敗:', c.name, e);
                        });
                    });
                }

                var mergedContacts = remoteContacts.concat(localOnlyContacts);
                localStorage.setItem('gyosei_client_contacts', JSON.stringify(mergedContacts));
            }

            // 帳簿データをマージ（ローカル専用データを保持）
            if (data.journals) {
                var local = JSON.parse(localStorage.getItem('gyosei_journals') || '[]');
                var remoteKeys = {};
                data.journals.forEach(function(j){
                    if (j.id) remoteKeys[j.id] = true;
                    var key = (j.date || '') + '_' + (j.debit || '') + '_' + (j.credit || '') + '_' + (j.amount || 0) + '_' + (j.description || '');
                    remoteKeys[key] = true;
                });
                var localOnly = local.filter(function(j){
                    if (j.id && remoteKeys[j.id]) return false;
                    var key = (j.date || '') + '_' + (j.debit || '') + '_' + (j.credit || '') + '_' + (j.amount || 0) + '_' + (j.description || '');
                    return !remoteKeys[key];
                });
                var merged = data.journals.concat(localOnly);
                localStorage.setItem('gyosei_journals', JSON.stringify(merged));
                if (typeof Accounting !== 'undefined' && typeof Accounting.cleanDuplicates === 'function') {
                    Accounting.cleanDuplicates();
                }
            }

            // 同期日時を記録
            this.saveConfig({
                ...this.getConfig(),
                lastSync: new Date().toISOString(),
            });

            return {
                customers: (data.customers || []).length,
                staff: (data.staff || []).length,
                cases: (data.cases || []).length,
                journals: (data.journals || []).length,
                inbox: (data.inbox || []).length,
                locations: (data.locations || []).length,
                clientContacts: (data.clientContacts || []).length,
                syncedAt: data.syncedAt,
            };

        } catch (err) {
            console.error('同期エラー:', err);
            throw err;
        }
    },

    async push(action, data) {
        const url = this.getGasUrl();
        if (!url) return null;  // 未設定なら何もしない

        const config = this.getConfig();
        const payload = {
            action,
            data,
            lineToken: config.lineToken || '',
            lineUserId: config.lineUserId || '',
            lineNotifyCase: !!config.lineNotifyCase,
            lineNotifyInbox: !!config.lineNotifyInbox
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },  // GAS の CORS 制限回避
                body: JSON.stringify(payload),
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
                locations: (data.locations || []).length,
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

          <div class="form-group" style="margin-top:12px">
            <label>📊 Googleスプレッドシート（原本）のURL</label>
            <input type="url" id="syncSheetUrl" class="search-input" 
              placeholder="https://docs.google.com/spreadsheets/d/xxx/edit"
              value="${config.sheetUrl || ''}"
              style="width:100%;margin-top:4px">
            <p class="form-hint">店舗管理ボタンを押した際に開くスプレッドシートのURL</p>
          </div>

          <!-- 🤖 Gemini API キー (AI OCR・自動解析用) -->
          <div class="form-group" style="margin-top:12px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <label style="font-size:0.8rem; font-weight:700; color:var(--accent-gold, #f59e0b);">🔑 Gemini API キー（完全無料・高精度AI OCR用）</label>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" style="font-size:0.72rem; color:var(--accent-gold, #f59e0b); text-decoration:underline;">無料取得↗</a>
            </div>
            <input type="password" id="syncGeminiApiKey" class="search-input" 
              placeholder="AIzaSy... から始まるAPIキーを入力"
              value="${localStorage.getItem('gyosei_gemini_api_key') || ''}"
              style="width:100%;margin-top:4px">
            <p class="form-hint" style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">
              ※ 入力すると横向きFAXや手書き文字も自動で超高精度認識されます。
            </p>
          </div>

          <!-- LINE Messaging API 設定 -->
          <div style="border-top:1px solid var(--border-color);margin-top:16px;padding-top:16px">
            <h3 style="font-size:0.9rem;margin-bottom:6px;color:var(--accent-orange);display:flex;align-items:center;gap:6px">💬 LINE Messaging API 連携（Bot通知）</h3>
            <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;line-height:1.4">
              LINE公式アカウントのBot機能経由で、スマートフォンのLINE宛てに業務通知や完了リマインダーをPush送信します。
            </p>
            <div class="form-group">
              <label style="font-size:0.75rem">LINE チャネルアクセストークン</label>
              <input type="password" id="syncLineToken" class="search-input" 
                placeholder="LINE Developersで発行したアクセストークンを入力"
                value="${config.lineToken || ''}"
                style="width:100%;margin-top:2px">
            </div>
            <div class="form-group" style="margin-top:10px">
              <label style="font-size:0.75rem">LINE 送信先ユーザーID (Your User ID)</label>
              <input type="text" id="syncLineUserId" class="search-input" 
                placeholder="Uから始まる32桁のユーザーIDを入力"
                value="${config.lineUserId || ''}"
                style="width:100%;margin-top:2px">
              <p class="form-hint" style="margin-top:4px;font-size:0.68rem;line-height:1.35;color:var(--text-muted)">
                ※ ユーザーIDが不明な場合、友だち追加したBotへスマホから適当な言葉（例:「ID」）を送信後、Googleスプレッドシートの「**操作ログ**」シートを開くと、あなたのユーザーIDが自動で記録されています。
              </p>
            </div>
            
            <!-- 通知項目のオン・オフ切り替え -->
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
              <label style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:var(--text-color);cursor:pointer">
                <input type="checkbox" id="syncLineNotifyCase" ${config.lineNotifyCase ? 'checked' : ''} style="margin:0">
                <span>案件完了時にお祝い＆売上報告通知を送る</span>
              </label>
              <label style="display:flex;align-items:center;gap:8px;font-size:0.75rem;color:var(--text-color);cursor:pointer">
                <input type="checkbox" id="syncLineNotifyInbox" ${config.lineNotifyInbox ? 'checked' : ''} style="margin:0">
                <span>新着資料・FAX受信時に通知を送る</span>
              </label>
            </div>
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
            <div class="sync-status-info" style="margin-bottom:12px">
              <span class="detail-icon">⏱️</span>
              最終同期: ${new Date(config.lastSync).toLocaleString('ja-JP')}
            </div>
          ` : ''}

          <!-- 本番移行用メンテナンスツール -->
          <div style="border-top:1px solid var(--border-color);margin-top:16px;padding-top:16px">
            <h3 style="font-size:0.9rem;margin-bottom:6px;color:var(--accent-orange);display:flex;align-items:center;gap:6px">⚠️ 本番移行用のデータ初期化</h3>
            <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;line-height:1.4">
              テスト用に登録した「仕訳帳」および「案件データ（進捗、請求、予定、タスク含む）」のみを一括消去します。<br>
              <strong>※ 顧客情報、担当者、店舗/場所マスターは削除されずにそのまま残ります。</strong>
            </p>
            <button class="btn" onclick="Store.clearTestDataForProduction()" style="background-color:#c2410c;color:white;font-size:0.78rem;padding:6px 12px">
              🧹 仕訳・案件データのみ消去
            </button>
          </div>
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
          顧客: ${result.customers}件 / 担当者: ${result.staff}件 / 場所: ${result.locations}件
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
        const sheetUrl = document.getElementById('syncSheetUrl') ? document.getElementById('syncSheetUrl').value.trim() : '';
        const lineToken = document.getElementById('syncLineToken') ? document.getElementById('syncLineToken').value.trim() : '';
        const lineUserId = document.getElementById('syncLineUserId') ? document.getElementById('syncLineUserId').value.trim() : '';
        const lineNotifyCase = document.getElementById('syncLineNotifyCase') ? document.getElementById('syncLineNotifyCase').checked : false;
        const lineNotifyInbox = document.getElementById('syncLineNotifyInbox') ? document.getElementById('syncLineNotifyInbox').checked : false;
        const geminiApiKey = document.getElementById('syncGeminiApiKey') ? document.getElementById('syncGeminiApiKey').value.trim() : '';
        if (geminiApiKey) {
            localStorage.setItem('gyosei_gemini_api_key', geminiApiKey);
        }
        this.saveConfig({
            ...this.getConfig(),
            gasUrl: url,
            sheetUrl: sheetUrl,
            lineToken: lineToken,
            lineUserId: lineUserId,
            lineNotifyCase: lineNotifyCase,
            lineNotifyInbox: lineNotifyInbox
        });
        document.getElementById('syncSettingsModal').remove();
        App.showToast('連携設定を保存しました');
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
            App.showToast(`✅ 同期完了！ 顧客${result.customers}件 / 担当者${result.staff}件 / 顧客担当者${result.clientContacts || 0}件 / 場所${result.locations}件 / 案件${result.cases}件 / インボックス${result.inbox}件 / 帳簿${result.journals}件`);
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

    // ---- Google Apps Script 汎用通信送信 ----
    async postToGas(action, data) {
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
                console.warn(`${action} 同期エラー:`, result.error);
            }
            return result;

        } catch (err) {
            console.warn(`${action} 通信エラー:`, err);
            return null;
        }
    },

    // バックワード互換性のためのエイリアス
    async pushCalendarEvent(action, data) {
        return this.postToGas(action, data);
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
